import {mkdir, writeFile} from "node:fs/promises";
import {join} from "node:path";

type SupportProcessingRunDebugDumpPhase =
  | "pipeline"
  | "runner_error";

type SupportProcessingRunDebugDumpInput = {
  phase: SupportProcessingRunDebugDumpPhase;
  outputDir: string;
  run: {
    roomId: string;
    userId: string;
    turnId: string;
    messageCount: number;
    conversationKey: string;
    dryRun: boolean;
  };
  latestUserMessage: unknown;
  latestUserAttachments: unknown;
  liveMemoryContextBeforePipeline: unknown;
  supportProcessingInput: unknown;
  supportProcessingOutput?: unknown;
  runnerError?: unknown;
};

type SupportProcessingRunDebugDumper = (
  input: Omit<SupportProcessingRunDebugDumpInput, "outputDir">
) => Promise<void>;

function createSupportProcessingRunDebugDumperFromEnv(): SupportProcessingRunDebugDumper | null {
  if (process.env.SUPPORT_PIPELINE_DEBUG_DUMP !== "true") {
    return null;
  }

  const outputDir =
    process.env.SUPPORT_PIPELINE_DEBUG_DUMP_DIR?.trim() ||
    "tmp/live-message-processing-pipeline-output";

  return async (input) => {
    await writeSupportProcessingRunDebugDump({
      ...input,
      outputDir
    });
  };
}

async function writeSupportProcessingRunDebugDump(
  input: SupportProcessingRunDebugDumpInput
): Promise<void> {
  await mkdir(input.outputDir, {
    recursive: true
  });

  const filePath = join(
    input.outputDir,
    buildDebugDumpFileName(input)
  );

  const payload = {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    phase: input.phase,
    run: input.run,
    latestUserMessage: input.latestUserMessage,
    latestUserAttachments: input.latestUserAttachments,
    liveMemoryContextBeforePipeline: input.liveMemoryContextBeforePipeline,
    supportProcessingInput: input.supportProcessingInput,
    supportProcessingOutput: input.supportProcessingOutput ?? null,
    runnerError: serializeUnknown(input.runnerError ?? null)
  };

  await writeFile(
    filePath,
    `${safeJsonStringify(payload)}\n`,
    "utf8"
  );
}

function buildDebugDumpFileName(
  input: SupportProcessingRunDebugDumpInput
): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-");

  return [
    timestamp,
    sanitizeFileName(input.run.roomId),
    sanitizeFileName(input.run.userId),
    sanitizeFileName(input.run.turnId),
    input.phase
  ].join("__") + ".json";
}

function sanitizeFileName(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120);
}

function safeJsonStringify(value: unknown): string {
  const seen = new WeakSet<object>();

  return JSON.stringify(
    value,
    (_key, nestedValue) => {
      return serializeForJson(nestedValue, seen);
    },
    2
  );
}

function serializeForJson(
  value: unknown,
  seen: WeakSet<object>
): unknown {
  if (value instanceof Error) {
    return serializeError(value);
  }

  if (value instanceof Map) {
    return Array.from(value.entries());
  }

  if (value instanceof Set) {
    return Array.from(value.values());
  }

  if (value && typeof value === "object") {
    if (seen.has(value)) {
      return "[Circular]";
    }

    seen.add(value);
  }

  return redactSecretLikeValue(value);
}

function serializeUnknown(value: unknown): unknown {
  if (value instanceof Error) {
    return serializeError(value);
  }

  return value;
}

function serializeError(error: Error): {
  name: string;
  message: string;
  stack: string | null;
} {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack ?? null
  };
}

function redactSecretLikeValue(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }

  const output: Record<string, unknown> = {};

  for (const [key, nestedValue] of Object.entries(value)) {
    if (isSecretLikeKey(key)) {
      output[key] = "[redacted]";
      continue;
    }

    output[key] = nestedValue;
  }

  return output;
}

function isSecretLikeKey(key: string): boolean {
  const normalizedKey = key.toLowerCase();

  return normalizedKey.includes("apikey") ||
    normalizedKey.includes("api_key") ||
    normalizedKey.includes("authorization") ||
    normalizedKey.includes("bearer") ||
    normalizedKey.includes("password") ||
    normalizedKey.includes("secret") ||
    normalizedKey.includes("token");
}

export {
  createSupportProcessingRunDebugDumperFromEnv,
  writeSupportProcessingRunDebugDump
};

export type {
  SupportProcessingRunDebugDumper,
  SupportProcessingRunDebugDumpInput
};