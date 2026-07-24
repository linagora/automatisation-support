import "dotenv/config";

import {
  loadMatrixBufferMaxWaitMsFromEnv,
  loadMatrixBufferInactivityMsFromEnv,
  loadMatrixChannelConfigFromEnv,
  loadMatrixDryRunFromEnv,
  loadMatrixIgnoreMessagesBeforeStartupFromEnv,
  loadMatrixProcessHistoricalMessagesFromEnv,
  loadMatrixStartupGraceMsFromEnv
} from "../../src/infrastructure/matrix/loadMatrixChannelConfig";
import {runSupportAutomation} from "../../src/support-automation/runSupportAutomation";

function hasFlag(flagName: string): boolean {
  return process.argv.includes(flagName);
}

async function main(): Promise<void> {
  const dryRun = hasFlag("--dry-run") || loadMatrixDryRunFromEnv();

  const handle = await runSupportAutomation({
    matrixConfig: loadMatrixChannelConfigFromEnv(),
    inactivityTimeoutMs: loadMatrixBufferInactivityMsFromEnv(),
    maxWaitMs: loadMatrixBufferMaxWaitMsFromEnv(),
    startupGraceMs: loadMatrixStartupGraceMsFromEnv(),
    dryRun,
    ignoreMessagesBeforeStartup: loadMatrixIgnoreMessagesBeforeStartupFromEnv(),
    processHistoricalMessages: loadMatrixProcessHistoricalMessagesFromEnv()
  });

  console.log("[SupportAutomation] started");

  async function shutdown(signal: string): Promise<void> {
    console.log(`[SupportAutomation] received ${signal}, stopping`);
    await handle.stop();
    console.log("[SupportAutomation] stopped");
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
