import {
  MatrixClient,
  SimpleFsStorageProvider
} from "matrix-bot-sdk";
import {
  validateMatrixHomeserver
} from "./validateMatrixHomeserver";

import type {
  MatrixChannelConfig,
  MatrixClientLike
} from "./typesMatrixChannel.types";

const DEFAULT_MATRIX_STORAGE_FILE = ".matrix-bot-storage.json";
const validatedHomeserverUrls = new Set<string>();

async function ensureMatrixHomeserverValidated(
  homeserverUrl: string
): Promise<void> {
  const trimmedHomeserverUrl = homeserverUrl.trim();

  if (validatedHomeserverUrls.has(trimmedHomeserverUrl)) {
    return;
  }

  await validateMatrixHomeserver(trimmedHomeserverUrl);
  validatedHomeserverUrls.add(trimmedHomeserverUrl);
}

function withHomeserverPreflight(params: {
  config: MatrixChannelConfig;
  client: MatrixClientLike;
}): MatrixClientLike {
  const ensureReady = async (): Promise<void> => {
    await ensureMatrixHomeserverValidated(params.config.homeserverUrl);
  };

  return {
    getUserId: async () => {
      await ensureReady();
      return params.client.getUserId();
    },
    on: params.client.on.bind(params.client) as MatrixClientLike["on"],
    start: async () => {
      await ensureReady();
      return params.client.start();
    },
    stop: params.client.stop?.bind(params.client),
    sendText: async (roomId, content) => {
      await ensureReady();
      return params.client.sendText(roomId, content);
    },
    sendMessage: params.client.sendMessage
      ? async (roomId, content) => {
          await ensureReady();
          return params.client.sendMessage?.(roomId, content) ?? "";
        }
      : undefined,
    setTyping: params.client.setTyping
      ? async (roomId, typing, timeoutMs) => {
          await ensureReady();
          return params.client.setTyping?.(roomId, typing, timeoutMs);
        }
      : undefined,
    redactEvent: params.client.redactEvent
      ? async (roomId, eventId, reason) => {
          await ensureReady();
          const redactEvent = params.client.redactEvent;

          if (!redactEvent) {
            throw new Error("Matrix redactEvent is unavailable");
          }

          return redactEvent(roomId, eventId, reason);
        }
      : undefined,
    mxcToHttp: params.client.mxcToHttp?.bind(params.client),
    downloadContent: params.client.downloadContent
      ? async (mxcUrl, allowRemote) => {
          await ensureReady();
          return params.client.downloadContent?.(mxcUrl, allowRemote) ??
            Promise.reject(new Error("Matrix downloadContent is unavailable"));
        }
      : undefined
  };
}

function createMatrixClient(config: MatrixChannelConfig): MatrixClientLike {
  const storage = new SimpleFsStorageProvider(
    config.storagePath ?? DEFAULT_MATRIX_STORAGE_FILE
  );

  const client = new MatrixClient(
    config.homeserverUrl,
    config.accessToken,
    storage
  ) as MatrixClientLike;

  return withHomeserverPreflight({
    config,
    client
  });
}

export {
  ensureMatrixHomeserverValidated,
  createMatrixClient
};
