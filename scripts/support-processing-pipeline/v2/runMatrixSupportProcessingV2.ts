import "dotenv/config";

import {
  loadMatrixBufferMaxWaitMsFromEnv,
  loadMatrixBufferInactivityMsFromEnv,
  loadMatrixChannelConfigFromEnv,
  loadMatrixDryRunFromEnv,
  loadMatrixIgnoreMessagesBeforeStartupFromEnv,
  loadMatrixProgressConfigFromEnv,
  loadMatrixProcessHistoricalMessagesFromEnv,
  loadMatrixStartupGraceMsFromEnv
} from "../../../src/channels/matrix/loadMatrixChannelConfig";
import {
  runMatrixSupportAutomationV2
} from "../../../src/channels/matrix/runMatrixSupportAutomationV2";

function hasFlag(flagName: string): boolean {
  return process.argv.includes(flagName);
}

function hasMatrixCredentials(): boolean {
  return Boolean(process.env.MATRIX_HOMESERVER_URL && process.env.MATRIX_ACCESS_TOKEN);
}

async function runDryRunSelfCheckWithoutMatrixEnv(): Promise<void> {
  const handle = await runMatrixSupportAutomationV2({
    config: {
      homeserverUrl: "https://dry-run.local",
      accessToken: "dry-run-token",
      ...(process.env.MATRIX_ROOM_ID
        ? { defaultRoomId: process.env.MATRIX_ROOM_ID }
        : {})
    },
    dryRun: true,
    dependencies: {
      listenMatrixEvents: async () => {
        return {
          stop: async () => undefined
        };
      }
    }
  });

  await handle.flushPending();
  await handle.stop();
  console.log("[MatrixSupportAutomationV2] dry-run self-check completed");
}

async function main(): Promise<void> {
  const cliDryRun = hasFlag("--dry-run");
  const dryRun = cliDryRun || loadMatrixDryRunFromEnv();

  if (dryRun && !hasMatrixCredentials()) {
    await runDryRunSelfCheckWithoutMatrixEnv();
    return;
  }

  const config = loadMatrixChannelConfigFromEnv();
  const inactivityTimeoutMs = loadMatrixBufferInactivityMsFromEnv();
  const maxWaitMs = loadMatrixBufferMaxWaitMsFromEnv();
  const startupGraceMs = loadMatrixStartupGraceMsFromEnv();
  const progressConfig = loadMatrixProgressConfigFromEnv();
  const ignoreMessagesBeforeStartup =
    loadMatrixIgnoreMessagesBeforeStartupFromEnv();
  const processHistoricalMessages =
    loadMatrixProcessHistoricalMessagesFromEnv();
  const handle = await runMatrixSupportAutomationV2({
    config,
    ...(inactivityTimeoutMs !== undefined ? { inactivityTimeoutMs } : {}),
    ...(maxWaitMs !== undefined ? { maxWaitMs } : {}),
    ...(startupGraceMs !== undefined ? { startupGraceMs } : {}),
    dryRun,
    progressConfig,
    ignoreMessagesBeforeStartup,
    processHistoricalMessages
  });

  console.log("[MatrixSupportAutomationV2] started");

  async function shutdown(signal: string): Promise<void> {
    console.log(`[MatrixSupportAutomationV2] received ${signal}, stopping`);
    await handle.stop();
    console.log("[MatrixSupportAutomationV2] stopped");
    process.exit(0);
  }

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  console.error(message);
  process.exitCode = 1;
});
