import "dotenv/config";

import {
  listenMatrixMessages
} from "../../src/matrix/listenMatrixMessages";

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
  const startedAt = Date.now();

  console.log(`[Matrix] Listening room=${config.roomId}`);

  await listenMatrixMessages({
    config,
    onMessage: (message) => {
      if (
        message.timestamp !== undefined &&
        message.timestamp < startedAt - 5000
      ) {
        return;
      }

      console.log(`[Matrix] room=${message.roomId} sender=${message.sender}`);
      console.log(message.body);

      /*
       * Later:
       * const pipelineInput =
       *   mapMatrixIncomingMessageToSupportProcessingInput(message);
       * const output = await runSupportProcessingPipeline(pipelineInput);
       * await sendMatrixMessages({
       *   config,
       *   messages: mapUserResponseToMatrixMessages(output.userResponse)
       * });
       */
    }
  });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);

  console.error(message);
  process.exitCode = 1;
});
