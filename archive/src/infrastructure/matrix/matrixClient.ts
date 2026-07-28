import {
  MatrixClient,
  SimpleFsStorageProvider
} from "matrix-bot-sdk";

import type {
  MatrixChannelConfig,
  MatrixClientLike
} from "./typesMatrixChannel.types";

const DEFAULT_MATRIX_STORAGE_FILE = ".matrix-bot-storage.json";

function createMatrixClient(config: MatrixChannelConfig): MatrixClientLike {
  const storage = new SimpleFsStorageProvider(
    config.storagePath ?? DEFAULT_MATRIX_STORAGE_FILE
  );

  return new MatrixClient(
    config.homeserverUrl,
    config.accessToken,
    storage
  ) as MatrixClientLike;
}

export {
  createMatrixClient
};
