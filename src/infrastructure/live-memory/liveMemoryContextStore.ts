import * as fs from "fs/promises";
import * as path from "path";
import { randomUUID } from "crypto";

import {
  parseLiveMemoryTopicId
} from "./normalizeLiveMemoryTopicId";

import type {
  LiveMemoryContext,
  LiveMemoryTopic,
  LiveMemoryUserState
} from "./typesLiveMemoryContext.types";

const DEFAULT_LIVE_MEMORY_CONTEXT_DIR = path.resolve("data/live-memory-context");

const DEFAULT_USER_STATE: LiveMemoryUserState = {
  status: "normal",
  flags: []
};

function getLiveMemoryContextDirectory(): string {
  return process.env.LIVE_MEMORY_CONTEXT_DIR ??
    DEFAULT_LIVE_MEMORY_CONTEXT_DIR;
}

function buildLiveMemoryContextPath(conversationKey: string): string {
  return path.join(getLiveMemoryContextDirectory(), `${conversationKey}.json`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : null;
}

function normalizeUserState(value: unknown): LiveMemoryUserState {
  if (!isRecord(value)) {
    return DEFAULT_USER_STATE;
  }

  const status = value.status === "watch" || value.status === "blocked"
    ? value.status
    : "normal";
  const flags = Array.isArray(value.flags)
    ? value.flags.flatMap((flag) => {
        return typeof flag === "string" && flag.trim() !== ""
          ? [flag.trim()]
          : [];
      })
    : [];

  return {
    status,
    flags
  };
}

function normalizeTopic(value: unknown): LiveMemoryTopic | null {
  if (!isRecord(value)) {
    return null;
  }

  const topicId = parseLiveMemoryTopicId(
    value.topicId
  );

  if (topicId === null) {
    return null;
  }

  return {
    topicId,
    title: nullableString(value.title),
    broadCategoryHint: nullableString(value.broadCategoryHint),
    summary: nullableString(value.summary),
    caseDetails: Array.isArray(value.caseDetails)
      ? value.caseDetails as LiveMemoryTopic["caseDetails"]
      : [],
    attemptedActions: Array.isArray(value.attemptedActions)
      ? value.attemptedActions as LiveMemoryTopic["attemptedActions"]
      : [],
    ...(nullableString(value.supportKnowledgeSummary)
      ? { supportKnowledgeSummary: nullableString(value.supportKnowledgeSummary) as string }
      : {})
  };
}

function normalizeContext(value: unknown): LiveMemoryContext {
  if (!isRecord(value)) {
    return {
      topics: [],
      lastUserVerbatim: null,
      lastBotVerbatim: null,
      userState: DEFAULT_USER_STATE
    };
  }

  return {
    topics: Array.isArray(value.topics)
      ? value.topics.flatMap((topic) => {
          const normalized = normalizeTopic(topic);

          return normalized ? [normalized] : [];
        })
      : [],
    lastUserVerbatim: nullableString(value.lastUserVerbatim),
    lastBotVerbatim: nullableString(value.lastBotVerbatim),
    userState: normalizeUserState(value.userState)
  };
}

async function readLiveMemoryContext(
  conversationKey: string
): Promise<LiveMemoryContext | null> {
  const filePath = buildLiveMemoryContextPath(conversationKey);

  try {
    const rawContent = await fs.readFile(filePath, "utf8");

    return normalizeContext(JSON.parse(rawContent));
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      (error as { code?: unknown }).code === "ENOENT"
    ) {
      return null;
    }

    throw error;
  }
}

async function writeLiveMemoryContext(
  conversationKey: string,
  context: LiveMemoryContext
): Promise<void> {
  const filePath = buildLiveMemoryContextPath(conversationKey);
  const directory = path.dirname(filePath);
  const temporaryFilePath = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`
  );

  await fs.mkdir(directory, {
    recursive: true
  });
  await fs.writeFile(
    temporaryFilePath,
    `${JSON.stringify(normalizeContext(context), null, 2)}\n`,
    "utf8"
  );
  await fs.rename(temporaryFilePath, filePath);
}

export {
  buildLiveMemoryContextPath,
  readLiveMemoryContext,
  writeLiveMemoryContext
};
