import "dotenv/config";

import {
  validateMatrixChannelEnv
} from "../../src/channels/matrix/validateMatrixChannelConfig";

function main(): void {
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

main();
