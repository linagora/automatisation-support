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
  extractDocs,
  extractDocsFromSource
} from "./src/docs.mjs";
import {
  fetchGithubIssueComments,
  fetchGithubIssues
} from "./src/github.mjs";
import {
  formatIssueMarkdown
} from "./src/markdown.mjs";
import {
  addFilesToWorkspace,
  createWorkspace,
  ensurePartition,
  listWorkspaces,
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
const docsManifestFile = resolve(
  process.cwd(),
  envString("DOCS_MANIFEST_FILE", "generated/docs-manifest.json")
);
const docsSelectionFile = resolve(
  process.cwd(),
  envString("DOCS_SELECTION_FILE", "generated/selected-docs.json")
);
const docsExtraHeadersRaw = envString("DOCS_EXTRA_HEADERS_JSON", "{}");

function parseDocsExtraHeaders(value) {
  if (!value) {
    return {};
  }

  let parsed;

  try {
    parsed = JSON.parse(value);
  } catch (error) {
    throw new Error(`Invalid DOCS_EXTRA_HEADERS_JSON: ${error.message}`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Invalid DOCS_EXTRA_HEADERS_JSON: expected a JSON object.");
  }

  return Object.fromEntries(
    Object.entries(parsed)
      .filter(([name, headerValue]) => (
        typeof name === "string" &&
        name.trim() !== "" &&
        (typeof headerValue === "string" || typeof headerValue === "number" || typeof headerValue === "boolean")
      ))
      .map(([name, headerValue]) => [name.trim(), String(headerValue)])
  );
}

const config = {
  runMode,
  openrag: {
    baseUrl: envString("OPENRAG_BASE_URL").replace(/\/+$/u, ""),
    token: envString("OPENRAG_TOKEN"),
    authScheme: envString("OPENRAG_AUTH_SCHEME", "Bearer"),
    partition: envString("OPENRAG_PARTITION"),
    workspaceId: envString("OPENRAG_WORKSPACE_ID"),
    issuesWorkspace: envString("OPENRAG_ISSUES_WORKSPACE", "github_issues_support"),
    docsWorkspace: envString("OPENRAG_DOCS_WORKSPACE", "twake_docs"),
    allWorkspace: envString("OPENRAG_ALL_WORKSPACE", "support_all"),
    attachToWorkspaces: envBoolean("OPENRAG_ATTACH_TO_WORKSPACES", true),
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
  docs: {
    baseUrl: envString("DOCS_BASE_URL", "https://twake-docs.stg.lin-saas.com/"),
    sourceDir: envString("DOCS_SOURCE_DIR"),
    startUrls: envCsv("DOCS_START_URLS"),
    authCookie: envString("DOCS_AUTH_COOKIE"),
    authorizationHeader: envString("DOCS_AUTHORIZATION_HEADER"),
    extraHeaders: ["probe-docs-auth", "extract-docs-source"].includes(runMode)
      ? {}
      : parseDocsExtraHeaders(docsExtraHeadersRaw),
    debug: envBoolean("DOCS_DEBUG", false),
    outputDir: resolve(process.cwd(), envString("DOCS_OUTPUT_DIR", "generated/docs")),
    manifestFile: docsManifestFile,
    selectionFile: docsSelectionFile,
    limit: envNumber("DOCS_LIMIT", 200)
  },
  outputDir: resolve(process.cwd(), envString("OUTPUT_DIR", "generated/issues")),
  manifestFile,
  selectionFile,
  dryRun: envBoolean("DRY_RUN", false)
};

const githubExtractionModes = ["extract", "extract-and-index-selected"];
const githubIndexModes = ["index-selected", "extract-and-index-selected"];
const docsExtractionModes = ["extract-docs", "extract-docs-source"];
const docsIndexModes = ["index-docs-selected"];
const docsProbeModes = ["probe-docs-auth"];
const workspaceModes = [
  "list-workspaces",
  "create-workspaces",
  "attach-selected-issues-to-workspaces"
];
const validRunModes = [
  ...githubExtractionModes,
  "index-selected",
  ...docsExtractionModes,
  ...docsIndexModes,
  ...docsProbeModes,
  ...workspaceModes
];

if (!validRunModes.includes(config.runMode)) {
  throw new Error(
    `Invalid RUN_MODE=${config.runMode}. Expected ${validRunModes.join(", ")}.`
  );
}

if (githubExtractionModes.includes(config.runMode)) {
  if (!config.github.owner) {
    throw new Error("GITHUB_OWNER is required for extraction.");
  }

  if (!config.github.repo) {
    throw new Error("GITHUB_REPO is required for extraction.");
  }
}

if (
  workspaceModes.includes(config.runMode) ||
  ((githubIndexModes.includes(config.runMode) || docsIndexModes.includes(config.runMode)) && !config.dryRun)
) {
  if (!config.openrag.baseUrl) {
    throw new Error("OPENRAG_BASE_URL is required for OpenRAG operations.");
  }

  if (!config.openrag.token) {
    throw new Error("OPENRAG_TOKEN is required for OpenRAG operations.");
  }

  if (!config.openrag.partition) {
    throw new Error("OPENRAG_PARTITION is required for OpenRAG operations.");
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

function docsSelectionExamplePath() {
  return resolve(dirname(config.docs.selectionFile), "selected-docs.example.json");
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

function ensureDocsSelectionExampleFile() {
  const examplePath = docsSelectionExamplePath();

  if (existsSync(examplePath)) {
    return;
  }

  writeJsonFile(examplePath, {
    selectedFileIds: [
      "docs_twake_home"
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

function normalizeDocsSelection(selection) {
  const selectedFileIds = Array.isArray(selection?.selectedFileIds)
    ? selection.selectedFileIds
        .filter((value) => typeof value === "string" && value.trim() !== "")
        .map((value) => value.trim())
    : [];
  const selectedUrls = Array.isArray(selection?.selectedUrls)
    ? selection.selectedUrls
        .filter((value) => typeof value === "string" && value.trim() !== "")
        .map((value) => value.trim())
    : [];

  return {
    selectedFileIds: Array.from(new Set(selectedFileIds)),
    selectedUrls: Array.from(new Set(selectedUrls))
  };
}

function findSelectedDocs(manifest, selection) {
  const normalized = normalizeDocsSelection(selection);
  const pages = Array.isArray(manifest?.pages) ? manifest.pages : [];
  const byFileId = new Map(pages.map((page) => [page.fileId, page]));
  const byUrl = new Map(pages.map((page) => [page.url, page]));
  const selected = [];
  const missing = [];

  for (const fileId of normalized.selectedFileIds) {
    const page = byFileId.get(fileId);

    if (page) {
      selected.push(page);
    } else {
      missing.push(`fileId ${fileId}`);
    }
  }

  for (const url of normalized.selectedUrls) {
    const page = byUrl.get(url);

    if (page) {
      selected.push(page);
    } else {
      missing.push(`url ${url}`);
    }
  }

  return {
    selected: Array.from(new Map(selected.map((page) => [page.fileId, page])).values()),
    missing
  };
}

function buildMetadataFromManifestDoc(page) {
  return {
    mimetype: "text/markdown",
    source_type: "twake_docs",
    source_url: page.url,
    title: page.title,
    section: page.section,
    created_at: new Date().toISOString()
  };
}

function configuredWorkspaces() {
  return [
    {
      workspaceId: config.openrag.issuesWorkspace,
      displayName: "GitHub Support Issues"
    },
    {
      workspaceId: config.openrag.docsWorkspace,
      displayName: "Twake Documentation"
    },
    {
      workspaceId: config.openrag.allWorkspace,
      displayName: "All Support Knowledge"
    }
  ];
}

async function attachFileIdsToWorkspaces(fileIds, workspaceIds) {
  const uniqueFileIds = Array.from(new Set(fileIds)).filter(Boolean);
  const results = [];

  for (const workspaceId of workspaceIds) {
    const result = await addFilesToWorkspace(config.openrag, workspaceId, uniqueFileIds);
    results.push({
      workspaceId,
      count: result.count
    });
  }

  return results;
}

async function runListWorkspaces() {
  const response = await listWorkspaces(config.openrag);
  console.log(JSON.stringify(response, null, 2));
}

async function runCreateWorkspaces() {
  let createdCount = 0;
  let existingCount = 0;
  let failedCount = 0;

  for (const workspace of configuredWorkspaces()) {
    try {
      const result = await createWorkspace(
        config.openrag,
        workspace.workspaceId,
        workspace.displayName
      );

      if (result.alreadyExists) {
        existingCount += 1;
        console.log(`[openrag] workspace already exists: ${workspace.workspaceId}`);
      } else {
        createdCount += 1;
        console.log(`[openrag] workspace created: ${workspace.workspaceId}`);
      }
    } catch (error) {
      failedCount += 1;
      console.error(`[error] workspace ${workspace.workspaceId}`);
      console.error(error.message);
    }
  }

  console.log(
    [
      "[summary]",
      `created count=${createdCount}`,
      `already exists count=${existingCount}`,
      `failed count=${failedCount}`
    ].join("\n")
  );

  if (failedCount > 0) {
    process.exitCode = 1;
  }
}

async function runAttachSelectedIssuesToWorkspaces() {
  ensureSelectionExampleFile();

  if (!existsSync(config.selectionFile)) {
    console.log(
      `[selection] ${config.selectionFile} not found. Created example: ${selectionExamplePath()}`
    );
    console.log("Create generated/selected-issues.json, then rerun attach-selected-issues-to-workspaces.");
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

  const fileIds = selected.map((issue) => issue.fileId).filter(Boolean);
  let attachedToIssuesCount = 0;
  let attachedToAllCount = 0;
  let failedCount = 0;

  try {
    const result = await addFilesToWorkspace(
      config.openrag,
      config.openrag.issuesWorkspace,
      fileIds
    );
    attachedToIssuesCount = result.count;
    console.log(`[openrag] attached ${result.count} files to ${config.openrag.issuesWorkspace}`);
  } catch (error) {
    failedCount += 1;
    console.error(`[error] attach to ${config.openrag.issuesWorkspace}`);
    console.error(error.message);
  }

  try {
    const result = await addFilesToWorkspace(
      config.openrag,
      config.openrag.allWorkspace,
      fileIds
    );
    attachedToAllCount = result.count;
    console.log(`[openrag] attached ${result.count} files to ${config.openrag.allWorkspace}`);
  } catch (error) {
    failedCount += 1;
    console.error(`[error] attach to ${config.openrag.allWorkspace}`);
    console.error(error.message);
  }

  console.log(
    [
      "[summary]",
      `selected count=${selected.length}`,
      `attached to ${config.openrag.issuesWorkspace} count=${attachedToIssuesCount}`,
      `attached to ${config.openrag.allWorkspace} count=${attachedToAllCount}`,
      `failed count=${failedCount}`
    ].join("\n")
  );

  if (failedCount > 0) {
    process.exitCode = 1;
  }
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
  let workspaceAttachCount = 0;
  const uploadedFileIds = [];

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
        uploadedFileIds.push(issue.fileId);
      }

      indexedCount += 1;
    } catch (error) {
      failedCount += 1;
      console.error(`[error] selected issue #${issue?.number ?? "unknown"}`);
      console.error(error);
    }
  }

  if (!config.dryRun && config.openrag.attachToWorkspaces && uploadedFileIds.length > 0) {
    try {
      const results = await attachFileIdsToWorkspaces(uploadedFileIds, [
        config.openrag.issuesWorkspace,
        config.openrag.allWorkspace
      ]);
      workspaceAttachCount = results.reduce((sum, result) => sum + result.count, 0);

      for (const result of results) {
        console.log(`[openrag] attached ${result.count} files to ${result.workspaceId}`);
      }
    } catch (error) {
      failedCount += 1;
      console.error("[error] automatic workspace attachment failed");
      console.error(error.message);
    }
  }

  console.log(
    [
      "[summary]",
      `selected count=${selected.length}`,
      `indexed count=${indexedCount}`,
      `skipped count=${skippedCount}`,
      `workspace attachment count=${workspaceAttachCount}`,
      `failed count=${failedCount}`,
      `DRY_RUN=${config.dryRun}`
    ].join("\n")
  );

  if (failedCount > 0) {
    process.exitCode = 1;
  }
}

async function runExtractDocs() {
  console.log(`[docs] crawling ${config.docs.baseUrl} limit=${config.docs.limit}`);
  console.log(`[docs] auth cookie provided: ${config.docs.authCookie ? "yes" : "no"}`);
  console.log(`[docs] authorization header provided: ${config.docs.authorizationHeader ? "yes" : "no"}`);
  console.log(`[docs] extra headers provided: ${Object.keys(config.docs.extraHeaders).length}`);
  console.log("[extract-docs] OpenRAG upload disabled");

  const result = await extractDocs(config.docs);
  writeJsonFile(config.docs.manifestFile, result.manifest);
  ensureDocsSelectionExampleFile();

  console.log(
    [
      "[summary]",
      `pages crawled=${result.pagesCrawled}`,
      `markdown files generated=${result.markdownFilesGenerated}`,
      `skipped auth/empty pages=${result.skippedAuthOrEmptyPages}`,
      `failed pages=${result.failedPages.length}`,
      `manifest path=${config.docs.manifestFile}`,
      "Extraction only. Review generated/docs-manifest.json, then create generated/selected-docs.json."
    ].join("\n")
  );

  if (result.markdownFilesGenerated === 0 && result.skippedAuthOrEmptyPages > 0) {
    console.log(
      "No documentation content extracted. The site likely requires authentication. Provide DOCS_AUTH_COOKIE or DOCS_AUTHORIZATION_HEADER."
    );
  }

  if (result.failedPages.length > 0) {
    console.log("[failed-pages]");
    for (const failure of result.failedPages) {
      console.log(`${failure.url} ${failure.error}`);
    }
  }
}

async function runExtractDocsSource() {
  console.log(`[docs-source] reading ${config.docs.sourceDir || "(missing DOCS_SOURCE_DIR)"}`);
  console.log("[extract-docs-source] OpenRAG upload disabled");

  const result = await extractDocsFromSource(config.docs);
  writeJsonFile(config.docs.manifestFile, result.manifest);
  ensureDocsSelectionExampleFile();

  console.log(
    [
      "[summary]",
      `source dir=${result.sourceDir}`,
      `markdown files generated=${result.markdownFilesGenerated}`,
      `page count=${result.pageCount}`,
      `manifest path=${config.docs.manifestFile}`,
      "Extraction only. Review generated/docs-manifest.json, then create generated/selected-docs.json."
    ].join("\n")
  );
}

function cleanProbeBody(text) {
  return text
    .replace(/<script\b[\s\S]*?<\/script>/giu, " ")
    .replace(/<style\b[\s\S]*?<\/style>/giu, " ")
    .replace(/<[^>]+>/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 120);
}

function probeHtmlTitle(html) {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/iu);

  if (!match) {
    return "";
  }

  return cleanProbeBody(match[1]);
}

function isDocsAuthPortal({ title, body }) {
  const text = `${title} ${body}`.toLowerCase();

  return (
    text.includes("authentication portal") ||
    text.includes("development portal") ||
    text.includes("manage your second factors") ||
    text.includes("connect")
  );
}

function looksLikeMarkdown({ contentType, body }) {
  const trimmed = body.trim();

  return (
    contentType.toLowerCase().includes("markdown") ||
    /^#{1,6}\s+\S/mu.test(trimmed) ||
    /^\s*[-*]\s+\S/mu.test(trimmed)
  );
}

async function runProbeDocsAuth() {
  const baseUrl = process.env.DOCS_BASE_URL || "https://twake-docs.stg.lin-saas.com/";
  const authCookie = process.env.DOCS_AUTH_COOKIE || "";
  const paths = [
    "/",
    "/md/index.md",
    "/overview",
    "/md/overview.md",
    "/overview/getting-started",
    "/md/overview/getting-started.md",
    "/developer-guide",
    "/md/developer-guide.md",
    "/services",
    "/md/services.md"
  ];

  console.log("[probe-docs-auth] OpenRAG upload disabled");
  console.log(`[probe-docs-auth] auth cookie provided: ${authCookie ? "yes" : "no"}`);

  for (const path of paths) {
    const url = new URL(path, baseUrl).toString();
    const headers = {
      Accept: "text/html,text/markdown,text/plain;q=0.9,*/*;q=0.8",
      "User-Agent": "github-issues-openrag-indexer/1.0"
    };

    if (authCookie) {
      headers.Cookie = authCookie;
    }

    try {
      const response = await fetch(url, { headers });
      const contentType = response.headers.get("content-type") ?? "";
      const body = await response.text();
      const title = contentType.includes("text/html") || /<html\b|<title\b/iu.test(body)
        ? probeHtmlTitle(body)
        : "";

      console.log(
        JSON.stringify({
          url,
          status: response.status,
          contentType,
          title,
          bodyPreview: cleanProbeBody(body),
          isAuthPortal: isDocsAuthPortal({ title, body }),
          looksMarkdown: looksLikeMarkdown({ contentType, body })
        })
      );
    } catch (error) {
      console.log(
        JSON.stringify({
          url,
          status: "fetch_error",
          contentType: "",
          title: "",
          bodyPreview: error.message,
          isAuthPortal: false,
          looksMarkdown: false
        })
      );
    }
  }
}

async function runIndexDocsSelected() {
  ensureDocsSelectionExampleFile();

  if (!existsSync(config.docs.selectionFile)) {
    console.log(
      `[selection] ${config.docs.selectionFile} not found. Created example: ${docsSelectionExamplePath()}`
    );
    console.log("Create generated/selected-docs.json, then rerun index-docs-selected.");
    return;
  }

  const manifest = await readJsonFile(config.docs.manifestFile);
  const selection = await readJsonFile(config.docs.selectionFile);
  const { selected, missing } = findSelectedDocs(manifest, selection);

  if (missing.length > 0) {
    throw new Error(
      `Docs selection contains entries missing from manifest: ${missing.join(", ")}`
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
  let workspaceAttachCount = 0;
  const uploadedFileIds = [];

  for (const page of selected) {
    try {
      if (!page?.fileId || !page?.markdownPath) {
        skippedCount += 1;
        console.log(`[skip] invalid manifest entry for docs page ${page?.url ?? "unknown"}`);
        continue;
      }

      const markdown = await readFile(page.markdownPath, "utf8");
      const metadata = buildMetadataFromManifestDoc(page);

      if (config.dryRun) {
        console.log(
          `[dry-run] would index ${page.fileId} url=${page.url} markdown=${page.markdownPath}`
        );
      } else {
        const uploadResult = await uploadMarkdownFile(config.openrag, {
          fileId: page.fileId,
          markdown,
          metadata
        });

        console.log(`[openrag] ${uploadResult.method} ${page.fileId} url=${page.url}`);
        uploadedFileIds.push(page.fileId);
      }

      indexedCount += 1;
    } catch (error) {
      failedCount += 1;
      console.error(`[error] selected docs page ${page?.url ?? "unknown"}`);
      console.error(error);
    }
  }

  if (!config.dryRun && config.openrag.attachToWorkspaces && uploadedFileIds.length > 0) {
    try {
      const results = await attachFileIdsToWorkspaces(uploadedFileIds, [
        config.openrag.docsWorkspace,
        config.openrag.allWorkspace
      ]);
      workspaceAttachCount = results.reduce((sum, result) => sum + result.count, 0);

      for (const result of results) {
        console.log(`[openrag] attached ${result.count} files to ${result.workspaceId}`);
      }
    } catch (error) {
      failedCount += 1;
      console.error("[error] automatic docs workspace attachment failed");
      console.error(error.message);
    }
  }

  console.log(
    [
      "[summary]",
      `selected count=${selected.length}`,
      `indexed count=${indexedCount}`,
      `skipped count=${skippedCount}`,
      `workspace attachment count=${workspaceAttachCount}`,
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

  if (config.runMode === "extract-docs") {
    await runExtractDocs();
    return;
  }

  if (config.runMode === "extract-docs-source") {
    await runExtractDocsSource();
    return;
  }

  if (config.runMode === "index-docs-selected") {
    await runIndexDocsSelected();
    return;
  }

  if (config.runMode === "probe-docs-auth") {
    await runProbeDocsAuth();
    return;
  }

  if (config.runMode === "list-workspaces") {
    await runListWorkspaces();
    return;
  }

  if (config.runMode === "create-workspaces") {
    await runCreateWorkspaces();
    return;
  }

  if (config.runMode === "attach-selected-issues-to-workspaces") {
    await runAttachSelectedIssuesToWorkspaces();
    return;
  }

  await runExtract();
  await runIndexSelected();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
