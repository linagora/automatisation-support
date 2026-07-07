import { safeJsonParse, sleep } from "./utils.mjs";

function githubHeaders({ token, apiVersion }) {
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": apiVersion,
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

async function requestGithubJson(url, config) {
  const response = await fetch(url, {
    headers: githubHeaders(config)
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `GitHub request failed: ${response.status} ${response.statusText}\n${url}\n${text}`
    );
  }

  return safeJsonParse(text);
}

async function fetchGithubIssues(config) {
  const issues = [];
  let page = 1;

  while (issues.length < config.limit) {
    const url = new URL(
      `https://api.github.com/repos/${config.owner}/${config.repo}/issues`
    );
    url.searchParams.set("state", config.state);
    url.searchParams.set("sort", config.sort);
    url.searchParams.set("direction", config.direction);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));

    if (config.labels.length > 0) {
      url.searchParams.set("labels", config.labels.join(","));
    }

    if (config.since) {
      url.searchParams.set("since", config.since);
    }

    const batch = await requestGithubJson(url, config);

    if (!Array.isArray(batch) || batch.length === 0) {
      break;
    }

    for (const item of batch) {
      // GitHub's issues endpoint also returns pull requests.
      if (item && item.pull_request) {
        continue;
      }

      issues.push(item);

      if (issues.length >= config.limit) {
        break;
      }
    }

    page += 1;
    await sleep(config.requestDelayMs);
  }

  return issues;
}

async function fetchGithubIssueComments(config, issueNumber) {
  if (!config.includeComments) {
    return [];
  }

  const comments = [];
  let page = 1;

  while (true) {
    const url = new URL(
      `https://api.github.com/repos/${config.owner}/${config.repo}/issues/${issueNumber}/comments`
    );
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));

    const batch = await requestGithubJson(url, config);

    if (!Array.isArray(batch) || batch.length === 0) {
      break;
    }

    comments.push(...batch);

    if (batch.length < 100) {
      break;
    }

    page += 1;
    await sleep(config.requestDelayMs);
  }

  return comments;
}

export {
  fetchGithubIssueComments,
  fetchGithubIssues
};
