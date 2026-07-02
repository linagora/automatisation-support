import { buildAuthorizationHeader, safeJsonParse } from "./utils.mjs";

function openRagHeaders(config) {
  return buildAuthorizationHeader({
    token: config.token,
    scheme: config.authScheme
  });
}

async function readResponse(response) {
  const text = await response.text();
  return {
    text,
    parsed: safeJsonParse(text)
  };
}

async function ensurePartition(config) {
  if (!config.createPartition) {
    return;
  }

  const url = `${config.baseUrl}/partition/${encodeURIComponent(config.partition)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: openRagHeaders(config)
  });
  const body = await readResponse(response);

  if (response.ok || response.status === 409) {
    console.log(`[openrag] partition ready: ${config.partition}`);
    return;
  }

  throw new Error(
    `OpenRAG partition creation failed: ${response.status} ${response.statusText}\n${body.text}`
  );
}

async function fileExists(config, fileId) {
  const url =
    `${config.baseUrl}/partition/${encodeURIComponent(config.partition)}` +
    `/file/${encodeURIComponent(fileId)}?limit=1`;

  const response = await fetch(url, {
    headers: openRagHeaders(config)
  });

  if (response.ok) {
    return true;
  }

  if (response.status === 404 || response.status === 422) {
    return false;
  }

  return false;
}

async function resolveUploadMethod(config, fileId) {
  if (config.uploadMode === "post") {
    return "POST";
  }

  if (config.uploadMode === "put") {
    return "PUT";
  }

  const exists = await fileExists(config, fileId);
  return exists ? "PUT" : "POST";
}

function buildUploadForm(config, { fileId, markdown, metadata }) {
  const form = new FormData();

  if (config.workspaceId) {
    form.append("workspace_ids", JSON.stringify([config.workspaceId]));
  }

  form.append("metadata", JSON.stringify(metadata));
  form.append(
    "file",
    new Blob([markdown], { type: "text/markdown" }),
    `${fileId}.md`
  );

  return form;
}

async function uploadMarkdownFile(config, { fileId, markdown, metadata }) {
  const method = await resolveUploadMethod(config, fileId);
  const form = buildUploadForm(config, { fileId, markdown, metadata });
  const url =
    `${config.baseUrl}/indexer/partition/${encodeURIComponent(config.partition)}` +
    `/file/${encodeURIComponent(fileId)}`;

  const response = await fetch(url, {
    method,
    headers: openRagHeaders(config),
    body: form
  });
  const body = await readResponse(response);

  if (!response.ok) {
    throw new Error(
      `OpenRAG upload failed for ${fileId}: ${response.status} ${response.statusText}\n${body.text}`
    );
  }

  return {
    method,
    response: body.parsed
  };
}

export {
  ensurePartition,
  uploadMarkdownFile
};
