import * as fs from "fs/promises";
import * as path from "path";
import { randomUUID } from "crypto";

import type {
  LiveMemoryContext
} from "./typesLiveMemoryContext.types";

const DEFAULT_LIVE_MEMORY_CONTEXT_DIR = path.resolve("data/live-memory-context");

function getLiveMemoryContextDirectory(): string {
  return process.env.LIVE_MEMORY_CONTEXT_DIR ??
    DEFAULT_LIVE_MEMORY_CONTEXT_DIR;
}

function buildLiveMemoryContextPath(conversationKey: string): string {
  return path.join(getLiveMemoryContextDirectory(), `${conversationKey}.json`);
}

async function readLiveMemoryContext(
  conversationKey: string
): Promise<LiveMemoryContext | null> {
  const filePath = buildLiveMemoryContextPath(conversationKey);

  try {
    const rawContent = await fs.readFile(filePath, "utf8");

    return JSON.parse(rawContent) as LiveMemoryContext;
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
    `${JSON.stringify(context, null, 2)}\n`,
    "utf8"
  );
  await fs.rename(temporaryFilePath, filePath);
}

export {
  buildLiveMemoryContextPath,
  readLiveMemoryContext,
  writeLiveMemoryContext
};
