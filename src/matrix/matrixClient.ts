import {
  MatrixClient,
  SimpleFsStorageProvider
} from "matrix-bot-sdk";

import type {
  MatrixConfig
} from "./typesMatrix.types";

const MATRIX_STORAGE_FILE = ".matrix-bot-storage.json";

function createMatrixClient(config: MatrixConfig): MatrixClient {
  const storage = new SimpleFsStorageProvider(MATRIX_STORAGE_FILE);

  return new MatrixClient(
    config.homeserverUrl,
    config.accessToken,
    storage
  );
}

export {
  createMatrixClient
};
