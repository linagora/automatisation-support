function namesFromLabels(labels) {
  if (!Array.isArray(labels)) {
    return [];
  }

  return labels
    .map((label) => {
      if (typeof label === "string") {
        return label;
      }

      return label?.name;
    })
    .filter(Boolean);
}

function loginsFromUsers(users) {
  if (!Array.isArray(users)) {
    return [];
  }

  return users.map((user) => user?.login).filter(Boolean);
}

function formatIssueMarkdown({ owner, repo, issue, comments }) {
  const labels = namesFromLabels(issue.labels);
  const assignees = loginsFromUsers(issue.assignees);

  const lines = [
    `# GitHub issue #${issue.number}: ${issue.title}`,
    "",
    "## Metadata",
    "",
    `Repository: ${owner}/${repo}`,
    `Issue number: ${issue.number}`,
    `State: ${issue.state}`,
    `Author: ${issue.user?.login ?? "unknown"}`,
    `Created at: ${issue.created_at ?? ""}`,
    `Updated at: ${issue.updated_at ?? ""}`,
    `Closed at: ${issue.closed_at ?? ""}`,
    `Labels: ${labels.join(", ")}`,
    `Assignees: ${assignees.join(", ")}`,
    `URL: ${issue.html_url ?? ""}`,
    "",
    "## Issue body",
    "",
    issue.body?.trim() || "_No body_",
    ""
  ];

  if (comments.length > 0) {
    lines.push("## Comments", "");

    for (const comment of comments) {
      lines.push(
        `### Comment by ${comment.user?.login ?? "unknown"} at ${comment.created_at ?? ""}`,
        "",
        comment.body?.trim() || "_Empty comment_",
        ""
      );
    }
  }

  return lines.join("\n");
}

function buildIssueMetadata({ owner, repo, issue }) {
  const labels = namesFromLabels(issue.labels);
  const assignees = loginsFromUsers(issue.assignees);

  return {
    mimetype: "text/markdown",
    source: "github_issue",
    repository: `${owner}/${repo}`,
    issue_number: issue.number,
    issue_state: issue.state,
    issue_title: issue.title,
    github_url: issue.html_url,
    labels,
    assignees,
    created_at: issue.created_at,
    updated_at: issue.updated_at,
    relationship_id: `github:${owner}/${repo}:issue:${issue.number}`
  };
}

export {
  buildIssueMetadata,
  formatIssueMarkdown
};
