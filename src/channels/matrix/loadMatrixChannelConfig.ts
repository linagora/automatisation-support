import type {
  MatrixChannelConfig
} from "./typesMatrixChannel.types";

function loadMatrixChannelConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env
): MatrixChannelConfig {
  const homeserverUrl = env.MATRIX_HOMESERVER_URL;
  const accessToken = env.MATRIX_ACCESS_TOKEN;

  if (!homeserverUrl || !accessToken) {
    throw new Error(
      "Missing MATRIX_HOMESERVER_URL or MATRIX_ACCESS_TOKEN. Optional variables: MATRIX_ROOM_ID, MATRIX_STORAGE_PATH, SUPPORT_BUFFER_INACTIVITY_MS, SUPPORT_BUFFER_MAX_WAIT_MS."
    );
  }

  return {
    homeserverUrl,
    accessToken,
    ...(env.MATRIX_ROOM_ID ? { defaultRoomId: env.MATRIX_ROOM_ID } : {}),
    ...(env.MATRIX_STORAGE_PATH ? { storagePath: env.MATRIX_STORAGE_PATH } : {})
  };
}

function loadMatrixBufferInactivityMsFromEnv(
  env: NodeJS.ProcessEnv = process.env
): number | undefined {
  if (!env.SUPPORT_BUFFER_INACTIVITY_MS) {
    return undefined;
  }

  const value = Number(env.SUPPORT_BUFFER_INACTIVITY_MS);

  if (!Number.isFinite(value) || value < 0) {
    throw new Error("SUPPORT_BUFFER_INACTIVITY_MS must be a non-negative number");
  }

  return value;
}

function loadMatrixBufferMaxWaitMsFromEnv(
  env: NodeJS.ProcessEnv = process.env
): number | undefined {
  if (!env.SUPPORT_BUFFER_MAX_WAIT_MS) {
    return undefined;
  }

  const value = Number(env.SUPPORT_BUFFER_MAX_WAIT_MS);

  if (!Number.isFinite(value) || value < 0) {
    throw new Error("SUPPORT_BUFFER_MAX_WAIT_MS must be a non-negative number");
  }

  return value;
}

function loadMatrixDryRunFromEnv(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return env.SUPPORT_MATRIX_DRY_RUN === "true";
}

function loadMatrixIgnoreMessagesBeforeStartupFromEnv(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return env.SUPPORT_IGNORE_MESSAGES_BEFORE_STARTUP !== "false";
}

function loadMatrixProcessHistoricalMessagesFromEnv(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return env.SUPPORT_PROCESS_HISTORICAL_MESSAGES === "true";
}

function loadMatrixStartupGraceMsFromEnv(
  env: NodeJS.ProcessEnv = process.env
): number | undefined {
  if (!env.SUPPORT_STARTUP_GRACE_MS) {
    return undefined;
  }

  const value = Number(env.SUPPORT_STARTUP_GRACE_MS);

  if (!Number.isFinite(value) || value < 0) {
    throw new Error("SUPPORT_STARTUP_GRACE_MS must be a non-negative number");
  }

  return value;
}

export {
  loadMatrixBufferMaxWaitMsFromEnv,
  loadMatrixBufferInactivityMsFromEnv,
  loadMatrixChannelConfigFromEnv,
  loadMatrixDryRunFromEnv,
  loadMatrixIgnoreMessagesBeforeStartupFromEnv,
  loadMatrixProcessHistoricalMessagesFromEnv,
  loadMatrixStartupGraceMsFromEnv
};
