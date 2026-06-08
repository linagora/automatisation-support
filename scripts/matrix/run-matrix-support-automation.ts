import "dotenv/config";

import {
  loadMatrixBufferMaxWaitMsFromEnv,
  loadMatrixBufferInactivityMsFromEnv,
  loadMatrixChannelConfigFromEnv,
  loadMatrixDryRunFromEnv,
  loadMatrixIgnoreMessagesBeforeStartupFromEnv,
  loadMatrixProcessHistoricalMessagesFromEnv,
  loadMatrixStartupGraceMsFromEnv
} from "../../src/channels/matrix/loadMatrixChannelConfig";
import {
  runMatrixSupportAutomation
} from "../../src/channels/matrix/runMatrixSupportAutomation";

async function main(): Promise<void> {
  const config = loadMatrixChannelConfigFromEnv();
  const inactivityTimeoutMs = loadMatrixBufferInactivityMsFromEnv();
  const maxWaitMs = loadMatrixBufferMaxWaitMsFromEnv();
  const dryRun = loadMatrixDryRunFromEnv();
  const startupGraceMs = loadMatrixStartupGraceMsFromEnv();
  const ignoreMessagesBeforeStartup =
    loadMatrixIgnoreMessagesBeforeStartupFromEnv();
  const processHistoricalMessages =
    loadMatrixProcessHistoricalMessagesFromEnv();
  const handle = await runMatrixSupportAutomation({
    config,
    ...(inactivityTimeoutMs !== undefined ? { inactivityTimeoutMs } : {}),
    ...(maxWaitMs !== undefined ? { maxWaitMs } : {}),
    ...(startupGraceMs !== undefined ? { startupGraceMs } : {}),
    dryRun,
    ignoreMessagesBeforeStartup,
    processHistoricalMessages
  });

  console.log("[MatrixSupportAutomation] started");

  async function shutdown(signal: string): Promise<void> {
    console.log(`[MatrixSupportAutomation] received ${signal}, stopping`);
    await handle.stop();
    console.log("[MatrixSupportAutomation] stopped");
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
