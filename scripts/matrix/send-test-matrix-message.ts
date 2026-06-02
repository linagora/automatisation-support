import "dotenv/config";

import {
  sendMatrixMessages
} from "../../src/matrix/sendMatrixMessages";

import type {
  MatrixConfig
} from "../../src/matrix/typesMatrix.types";

function readMatrixConfigFromEnv(): MatrixConfig {
  const homeserverUrl = process.env.MATRIX_HOMESERVER_URL;
  const accessToken = process.env.MATRIX_ACCESS_TOKEN;
  const roomId = process.env.MATRIX_ROOM_ID;

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

async function main(): Promise<void> {
  const config = readMatrixConfigFromEnv();

  await sendMatrixMessages({
    config,
    messages: [
      {
        type: "test",
        content: "Test Matrix integration from support-processing pipeline."
      }
    ]
  });

  console.log("Matrix test message sent.");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  console.error(message);
  process.exitCode = 1;
});
