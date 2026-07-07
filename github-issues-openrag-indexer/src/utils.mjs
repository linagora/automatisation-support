import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeFileId(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/gu, "_")
    .replace(/^_+|_+$/gu, "")
    .slice(0, 180);
}

function writeTextFile(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

function issueOutputPath(outputDir, fileId) {
  return join(outputDir, `${fileId}.md`);
}

function safeJsonParse(text) {
  if (!text || !text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function buildAuthorizationHeader({ token, scheme }) {
  if (!token) {
    return {};
  }

  const cleanScheme = scheme.trim();
  const value = cleanScheme ? `${cleanScheme} ${token}` : token;

  return {
    Authorization: value
  };
}

export {
  buildAuthorizationHeader,
  issueOutputPath,
  safeJsonParse,
  sanitizeFileId,
  sleep,
  writeTextFile
};
