import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  envBoolean,
  envCsv,
  envNumber,
  envString,
  loadDotEnv
} from "./src/env.mjs";
import {
  fetchGithubIssueComments,
  fetchGithubIssues
} from "./src/github.mjs";
import {
  formatIssueMarkdown
} from "./src/markdown.mjs";
import {
  ensurePartition,
  uploadMarkdownFile
} from "./src/openrag.mjs";
import {
  issueOutputPath,
  sanitizeFileId,
  sleep,
  writeTextFile
} from "./src/utils.mjs";

loadDotEnv();

const runMode = envString("RUN_MODE", "extract").toLowerCase();
const manifestFile = resolve(
  process.cwd(),
  envString("MANIFEST_FILE", "generated/issues-manifest.json")
);
const selectionFile = resolve(
  process.cwd(),
  envString("SELECTION_FILE", "generated/selected-issues.json")
);

const config = {
  runMode,
  openrag: {
    baseUrl: envString("OPENRAG_BASE_URL").replace(/\/+$/u, ""),
    token: envString("OPENRAG_TOKEN"),
    authScheme: envString("OPENRAG_AUTH_SCHEME", "Bearer"),
    partition: envString("OPENRAG_PARTITION"),
    workspaceId: envString("OPENRAG_WORKSPACE_ID"),
    createPartition: envBoolean("OPENRAG_CREATE_PARTITION", true),
    uploadMode: envString("OPENRAG_UPLOAD_MODE", "auto").toLowerCase()
  },
  github: {
    owner: envString("GITHUB_OWNER"),
    repo: envString("GITHUB_REPO"),
    token: envString("GITHUB_TOKEN"),
    apiVersion: envString("GITHUB_API_VERSION", "2022-11-28"),
    limit: envNumber("GITHUB_ISSUE_LIMIT", 100),
    state: envString("GITHUB_ISSUE_STATE", "closed"),
    sort: envString("GITHUB_ISSUE_SORT", "comments"),
    direction: envString("GITHUB_ISSUE_DIRECTION", "desc"),
    labels: envCsv("GITHUB_LABELS"),
    since: envString("GITHUB_SINCE"),
    includeComments: envBoolean("GITHUB_INCLUDE_COMMENTS", true),
    requestDelayMs: envNumber("REQUEST_DELAY_MS", 150)
  },
  outputDir: resolve(process.cwd(), envString("OUTPUT_DIR", "generated/issues")),
  manifestFile,
  selectionFile,
  dryRun: envBoolean("DRY_RUN", false)
};

if (!["extract", "index-selected", "extract-and-index-selected"].includes(config.runMode)) {
  throw new Error(
    `Invalid RUN_MODE=${config.runMode}. Expected extract, index-selected, or extract-and-index-selected.`
  );
}

if (config.runMode !== "index-selected") {
  if (!config.github.owner) {
    throw new Error("GITHUB_OWNER is required for extraction.");
  }

  if (!config.github.repo) {
    throw new Error("GITHUB_REPO is required for extraction.");
  }
}

if (config.runMode !== "extract" && !config.dryRun) {
  if (!config.openrag.baseUrl) {
    throw new Error("OPENRAG_BASE_URL is required for real indexing.");
  }

  if (!config.openrag.token) {
    throw new Error("OPENRAG_TOKEN is required for real indexing.");
  }

  if (!config.openrag.partition) {
    throw new Error("OPENRAG_PARTITION is required for real indexing.");
  }
}

if (!["open", "closed", "all"].includes(config.github.state)) {
  throw new Error(
    `Invalid GITHUB_ISSUE_STATE=${config.github.state}. Expected open, closed, or all.`
  );
}

if (!["created", "updated", "comments"].includes(config.github.sort)) {
  throw new Error(
    `Invalid GITHUB_ISSUE_SORT=${config.github.sort}. Expected created, updated, or comments.`
  );
}

if (!["asc", "desc"].includes(config.github.direction)) {
  throw new Error(
    `Invalid GITHUB_ISSUE_DIRECTION=${config.github.direction}. Expected asc or desc.`
  );
}

if (!["auto", "post", "put"].includes(config.openrag.uploadMode)) {
  throw new Error(
    `Invalid OPENRAG_UPLOAD_MODE=${config.openrag.uploadMode}. Expected auto, post, or put.`
  );
}

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

function buildSummaryIssue(issue, comments) {
  const fileId = buildIssueFileId(issue.number);
  const filename = `${fileId}.md`;
  const markdownPath = issueOutputPath(config.outputDir, fileId);

  return {
    number: issue.number,
    title: issue.title,
    state: issue.state,
    comments: comments.length,
    labels: namesFromLabels(issue.labels),
    url: issue.html_url,
    fileId,
    filename,
    markdownPath,
    createdAt: issue.created_at ?? null,
    updatedAt: issue.updated_at ?? null,
    closedAt: issue.closed_at ?? null
  };
}

function buildIssueFileId(issueNumber) {
  return sanitizeFileId(
    `github_${config.github.owner}_${config.github.repo}_issue_${issueNumber}`
  );
}

function buildIssuesManifest({
  issues,
  issueSummaries,
  totalComments
}) {
  const averageCommentsPerIssue =
    issues.length > 0 ? totalComments / issues.length : 0;

  return {
    owner: config.github.owner,
    repo: config.github.repo,
    state: config.github.state,
    sort: config.github.sort,
    direction: config.github.direction,
    issueLimit: config.github.limit,
    issueCount: issues.length,
    totalComments,
    averageCommentsPerIssue,
    issues: issueSummaries
  };
}

function writeJsonFile(path, value) {
  writeTextFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function readJsonFile(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function selectionExamplePath() {
  return resolve(dirname(config.selectionFile), "selected-issues.example.json");
}

function ensureSelectionExampleFile() {
  const examplePath = selectionExamplePath();

  if (existsSync(examplePath)) {
    return;
  }

  writeJsonFile(examplePath, {
    selectedIssueNumbers: [
      472,
      240
    ]
  });
}

function normalizeSelection(selection) {
  const selectedIssueNumbers = Array.isArray(selection?.selectedIssueNumbers)
    ? selection.selectedIssueNumbers
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value))
    : [];
  const selectedFileIds = Array.isArray(selection?.selectedFileIds)
    ? selection.selectedFileIds
        .filter((value) => typeof value === "string" && value.trim() !== "")
        .map((value) => value.trim())
    : [];

  return {
    selectedIssueNumbers: Array.from(new Set(selectedIssueNumbers)),
    selectedFileIds: Array.from(new Set(selectedFileIds))
  };
}

function buildMetadataFromManifestIssue(manifest, issue) {
  const owner = manifest.owner ?? config.github.owner;
  const repo = manifest.repo ?? config.github.repo;

  return {
    mimetype: "text/markdown",
    source: "github_issue",
    repository: `${owner}/${repo}`,
    issue_number: issue.number,
    issue_state: issue.state,
    issue_title: issue.title,
    github_url: issue.url,
    labels: Array.isArray(issue.labels) ? issue.labels : [],
    assignees: [],
    created_at: issue.createdAt,
    updated_at: issue.updatedAt,
    closed_at: issue.closedAt,
    relationship_id: `github:${owner}/${repo}:issue:${issue.number}`
  };
}

function findSelectedIssues(manifest, selection) {
  const normalized = normalizeSelection(selection);
  const issues = Array.isArray(manifest?.issues) ? manifest.issues : [];
  const byNumber = new Map(issues.map((issue) => [issue.number, issue]));
  const byFileId = new Map(issues.map((issue) => [issue.fileId, issue]));
  const selected = [];
  const missing = [];

  for (const issueNumber of normalized.selectedIssueNumbers) {
    const issue = byNumber.get(issueNumber);

    if (issue) {
      selected.push(issue);
    } else {
      missing.push(`issue #${issueNumber}`);
    }
  }

  for (const fileId of normalized.selectedFileIds) {
    const issue = byFileId.get(fileId);

    if (issue) {
      selected.push(issue);
    } else {
      missing.push(`fileId ${fileId}`);
    }
  }

  return {
    selected: Array.from(new Map(selected.map((issue) => [issue.fileId, issue])).values()),
    missing
  };
}

async function runExtract() {
  console.log(
    `[github] fetching ${config.github.limit} issues from ${config.github.owner}/${config.github.repo} state=${config.github.state} sort=${config.github.sort} direction=${config.github.direction}`
  );
  console.log(
    "[hint] For a clean extraction, remove old generated files first: rm -rf generated/issues generated/issues-manifest.json"
  );
  console.log("[extract] OpenRAG upload disabled");

  const issues = await fetchGithubIssues(config.github);
  console.log(`[github] fetched ${issues.length} issues`);

  let markdownFilesGenerated = 0;
  let failedCount = 0;
  let totalComments = 0;
  const issueSummaries = [];

  for (const issue of issues) {
    try {
      const comments = await fetchGithubIssueComments(config.github, issue.number);
      totalComments += comments.length;
      issueSummaries.push(buildSummaryIssue(issue, comments));
      const fileId = buildIssueFileId(issue.number);
      const markdown = formatIssueMarkdown({
        owner: config.github.owner,
        repo: config.github.repo,
        issue,
        comments
      });

      const localPath = issueOutputPath(config.outputDir, fileId);
      writeTextFile(localPath, markdown);
      console.log(
        `[extract] wrote ${localPath} issue=#${issue.number} comments=${comments.length}`
      );

      markdownFilesGenerated += 1;
      await sleep(config.github.requestDelayMs);
    } catch (error) {
      failedCount += 1;
      console.error(`[error] issue #${issue?.number ?? "unknown"}`);
      console.error(error);
    }
  }

  const openCount = issues.filter((issue) => issue.state === "open").length;
  const closedCount = issues.filter((issue) => issue.state === "closed").length;
  const averageCommentsPerIssue =
    issues.length > 0 ? totalComments / issues.length : 0;
  const manifest = buildIssuesManifest({
    issues,
    issueSummaries,
    totalComments
  });

  writeJsonFile(config.manifestFile, manifest);
  ensureSelectionExampleFile();

  console.log(
    `[done] processed=${issues.length} markdown_files_generated=${markdownFilesGenerated} failed=${failedCount}`
  );
  console.log(
    [
      "[summary]",
      `issues fetched=${issues.length}`,
      `open issues=${openCount}`,
      `closed issues=${closedCount}`,
      `markdown files generated=${markdownFilesGenerated}`,
      `total comments fetched=${totalComments}`,
      `average comments per issue=${averageCommentsPerIssue.toFixed(2)}`,
      `manifest=${config.manifestFile}`,
      "Extraction only. Review generated/issues-manifest.json, then create generated/selected-issues.json."
    ].join("\n")
  );

  if (failedCount > 0) {
    process.exitCode = 1;
  }
}

async function runIndexSelected() {
  ensureSelectionExampleFile();

  if (!existsSync(config.selectionFile)) {
    console.log(
      `[selection] ${config.selectionFile} not found. Created example: ${selectionExamplePath()}`
    );
    console.log("Create generated/selected-issues.json, then rerun index-selected.");
    return;
  }

  const manifest = await readJsonFile(config.manifestFile);
  const selection = await readJsonFile(config.selectionFile);
  const { selected, missing } = findSelectedIssues(manifest, selection);

  if (missing.length > 0) {
    throw new Error(
      `Selection contains entries missing from manifest: ${missing.join(", ")}`
    );
  }

  if (!config.dryRun) {
    await ensurePartition(config.openrag);
  } else {
    console.log("[dry-run] OpenRAG upload disabled");
  }

  let indexedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const issue of selected) {
    try {
      if (!issue?.fileId || !issue?.markdownPath) {
        skippedCount += 1;
        console.log(`[skip] invalid manifest entry for issue #${issue?.number ?? "unknown"}`);
        continue;
      }

      const markdown = await readFile(issue.markdownPath, "utf8");
      const metadata = buildMetadataFromManifestIssue(manifest, issue);

      if (config.dryRun) {
        console.log(
          `[dry-run] would index ${issue.fileId} issue=#${issue.number} markdown=${issue.markdownPath}`
        );
      } else {
        const uploadResult = await uploadMarkdownFile(config.openrag, {
          fileId: issue.fileId,
          markdown,
          metadata
        });

        console.log(
          `[openrag] ${uploadResult.method} ${issue.fileId} issue=#${issue.number}`
        );
      }

      indexedCount += 1;
    } catch (error) {
      failedCount += 1;
      console.error(`[error] selected issue #${issue?.number ?? "unknown"}`);
      console.error(error);
    }
  }

  console.log(
    [
      "[summary]",
      `selected count=${selected.length}`,
      `indexed count=${indexedCount}`,
      `skipped count=${skippedCount}`,
      `failed count=${failedCount}`,
      `DRY_RUN=${config.dryRun}`
    ].join("\n")
  );

  if (failedCount > 0) {
    process.exitCode = 1;
  }
}

async function main() {
  if (config.runMode === "extract") {
    await runExtract();
    return;
  }

  if (config.runMode === "index-selected") {
    await runIndexSelected();
    return;
  }

  await runExtract();
  await runIndexSelected();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
