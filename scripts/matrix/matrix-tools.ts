import "dotenv/config";

import * as sdk from "matrix-js-sdk";

import {
  loadMatrixChannelConfigFromEnv
} from "../../src/infrastructure/matrix/loadMatrixChannelConfig";
import {
  validateMatrixChannelEnv
} from "../../src/infrastructure/matrix/validateMatrixChannelConfig";

type MatrixToolCommand = "check" | "listen" | "send-test";

type MinimalMatrixConfig = {
  homeserverUrl: string;
  accessToken: string;
  roomId: string;
};

function printUsage(): void {
  console.log(`
Matrix tools

Usage:
  tsx scripts/matrix/matrix-tools.ts check
  tsx scripts/matrix/matrix-tools.ts listen
  tsx scripts/matrix/matrix-tools.ts send-test [message]

Commands:
  check       Validate Matrix environment variables.
  listen      Listen to incoming Matrix messages in MATRIX_ROOM_ID.
  send-test   Send a test message to MATRIX_ROOM_ID.

Required env:
  MATRIX_HOMESERVER_URL
  MATRIX_ACCESS_TOKEN
  MATRIX_ROOM_ID
`);
}

function readCommand(): MatrixToolCommand {
  const command = process.argv[2];

  if (
    command === "check" ||
    command === "listen" ||
    command === "send-test"
  ) {
    return command;
  }

  printUsage();
  throw new Error(`Unknown Matrix command: ${command ?? "(none)"}`);
}

function readMatrixConfig(): MinimalMatrixConfig {
  const loadedConfig = loadMatrixChannelConfigFromEnv() as Partial<MinimalMatrixConfig>;

  const homeserverUrl = loadedConfig.homeserverUrl;
  const accessToken = loadedConfig.accessToken;
  const roomId = loadedConfig.roomId;

  if (!homeserverUrl || !accessToken || !roomId) {
    throw new Error(
      "Missing MATRIX_HOMESERVER_URL, MATRIX_ACCESS_TOKEN or MATRIX_ROOM_ID"
    );
  }

  return {
    homeserverUrl,
    accessToken,
    roomId
  };
}

function checkMatrixConfig(): void {
  const result = validateMatrixChannelEnv();

  console.log("[MatrixConfig] summary", result.summary);

  for (const warning of result.warnings) {
    console.warn("[MatrixConfig] warning", warning);
  }

  if (!result.isValid) {
    for (const error of result.errors) {
      console.error("[MatrixConfig] error", error);
    }

    process.exitCode = 1;
    return;
  }

  console.log("[MatrixConfig] OK");
}

function createMatrixClient(config: MinimalMatrixConfig): sdk.MatrixClient {
  return sdk.createClient({
    baseUrl: config.homeserverUrl,
    accessToken: config.accessToken
  });
}

async function listenMatrixRoom(): Promise<void> {
  checkMatrixConfig();

  if (process.exitCode) {
    return;
  }

  const config = readMatrixConfig();
  const client = createMatrixClient(config);
  const startedAt = Date.now();
  const botUserId = client.getUserId();

  console.log(`[Matrix] Listening room=${config.roomId}`);
  console.log(`[Matrix] Bot user=${botUserId ?? "(unknown)"}`);
  console.log("[Matrix] Waiting for new messages...");

  client.on("Room.timeline", (event: unknown, room: unknown) => {
    const matrixEvent = event as {
      getType?: () => string;
      getSender?: () => string | undefined;
      getTs?: () => number;
      getContent?: () => {
        body?: unknown;
        msgtype?: unknown;
      };
    };

    const matrixRoom = room as {
      roomId?: string;
    };

    const roomId = matrixRoom.roomId;

    if (roomId !== config.roomId) {
      return;
    }

    if (matrixEvent.getType?.() !== "m.room.message") {
      return;
    }

    const sender = matrixEvent.getSender?.();

    if (sender && botUserId && sender === botUserId) {
      return;
    }

    const timestamp = matrixEvent.getTs?.();

    if (timestamp !== undefined && timestamp < startedAt - 5000) {
      return;
    }

    const content = matrixEvent.getContent?.();
    const body = typeof content?.body === "string" ? content.body : null;

    if (!body) {
      return;
    }

    console.log("");
    console.log(`[Matrix] room=${roomId} sender=${sender ?? "(unknown)"}`);
    console.log(body);
  });

  client.on("sync", (state: unknown) => {
    if (state === "PREPARED") {
      console.log("[Matrix] Sync prepared");
    }

    if (state === "ERROR") {
      console.warn("[Matrix] Sync error");
    }
  });

  await client.startClient({
    initialSyncLimit: 0
  });

  async function shutdown(signal: string): Promise<void> {
    console.log(`[Matrix] received ${signal}, stopping`);
    client.stopClient();
    console.log("[Matrix] stopped");
    process.exit(0);
  }

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });

  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

async function sendTestMatrixMessage(): Promise<void> {
  checkMatrixConfig();

  if (process.exitCode) {
    return;
  }

  const config = readMatrixConfig();
  const client = createMatrixClient(config);
  const message =
    process.argv.slice(3).join(" ").trim() ||
    "Test Matrix integration from support-processing pipeline.";

  await client.sendEvent(
    config.roomId,
    "m.room.message",
    {
      msgtype: "m.text",
      body: message
    },
    ""
  );

  console.log(`[Matrix] Test message sent to room=${config.roomId}`);
}

async function main(): Promise<void> {
  const command = readCommand();

  if (command === "check") {
    checkMatrixConfig();
    return;
  }

  if (command === "listen") {
    await listenMatrixRoom();
    return;
  }

  if (command === "send-test") {
    await sendTestMatrixMessage();
    return;
  }

  throw new Error(`Unhandled Matrix command: ${command}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  console.error(message);
  process.exitCode = 1;
});