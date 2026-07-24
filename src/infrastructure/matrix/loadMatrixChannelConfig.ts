import type {
  MatrixChannelConfig
} from "./typesMatrixChannel.types";

type MatrixProgressMode =
  | "typing_only"
  | "typing_and_static_status"
  | "typing_and_editable_status";

type MatrixProgressMessages = {
  queued: string;
  analyzing: string;
  retrieving: string;
  composing: string;
  translating: string;
  done: string;
  failed: string;
};

type MatrixSupportProgressReporterConfig = {
  enabled: boolean;
  mode: MatrixProgressMode;
  statusMessages: boolean;
  removeStatusOnDone: boolean;
  finalMessageEnabled: boolean;
  finalMessage: string;
  typingTimeoutMs: number;
  minStageIntervalMs: number;
  messages: MatrixProgressMessages;
};

const DEFAULT_MATRIX_PROGRESS_MESSAGES: MatrixProgressMessages = {
  queued: "Message reçu, je le prends en compte.",
  analyzing: "J’analyse votre demande.",
  retrieving: "Je recherche les informations utiles.",
  composing: "Je prépare une réponse.",
  translating: "J’adapte la réponse à votre langue.",
  done: "Traitement terminé.",
  failed: "Une erreur technique est survenue."
};

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
  return env.SUPPORT_MATRIX_DRY_RUN === "true" || env.DRY_RUN === "true";
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

function loadBooleanFromEnv(params: {
  env: NodeJS.ProcessEnv;
  key: string;
  defaultValue: boolean;
}): boolean {
  const value = params.env[params.key];

  if (value === undefined) {
    return params.defaultValue;
  }

  return value === "true";
}

function loadNonNegativeNumberFromEnv(params: {
  env: NodeJS.ProcessEnv;
  key: string;
  defaultValue: number;
}): number {
  const rawValue = params.env[params.key];

  if (rawValue === undefined) {
    return params.defaultValue;
  }

  const value = Number(rawValue);

  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${params.key} must be a non-negative number`);
  }

  return value;
}

function loadMatrixProgressModeFromEnv(
  env: NodeJS.ProcessEnv
): MatrixProgressMode {
  const mode = env.SUPPORT_MATRIX_PROGRESS_MODE ?? "typing_only";

  if (
    mode === "typing_only" ||
    mode === "typing_and_static_status" ||
    mode === "typing_and_editable_status"
  ) {
    return mode;
  }

  throw new Error(
    "SUPPORT_MATRIX_PROGRESS_MODE must be typing_only, typing_and_static_status, or typing_and_editable_status"
  );
}

function loadMatrixProgressConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env
): MatrixSupportProgressReporterConfig {
  return {
    enabled: loadBooleanFromEnv({
      env,
      key: "SUPPORT_MATRIX_PROGRESS_ENABLED",
      defaultValue: false
    }),
    mode: loadMatrixProgressModeFromEnv(env),
    statusMessages: loadBooleanFromEnv({
      env,
      key: "SUPPORT_MATRIX_PROGRESS_STATUS_MESSAGES",
      defaultValue: false
    }),
    removeStatusOnDone: loadBooleanFromEnv({
      env,
      key: "SUPPORT_MATRIX_PROGRESS_REMOVE_STATUS_ON_DONE",
      defaultValue: true
    }),
    finalMessageEnabled: loadBooleanFromEnv({
      env,
      key: "SUPPORT_MATRIX_PROGRESS_FINAL_MESSAGE_ENABLED",
      defaultValue: true
    }),
    finalMessage:
      env.SUPPORT_MATRIX_PROGRESS_FINAL_MESSAGE ??
      DEFAULT_MATRIX_PROGRESS_MESSAGES.done,
    typingTimeoutMs: loadNonNegativeNumberFromEnv({
      env,
      key: "SUPPORT_MATRIX_PROGRESS_TYPING_TIMEOUT_MS",
      defaultValue: 10_000
    }),
    minStageIntervalMs: loadNonNegativeNumberFromEnv({
      env,
      key: "SUPPORT_MATRIX_PROGRESS_MIN_STAGE_INTERVAL_MS",
      defaultValue: 1_000
    }),
    messages: DEFAULT_MATRIX_PROGRESS_MESSAGES
  };
}

export {
  loadMatrixBufferMaxWaitMsFromEnv,
  loadMatrixBufferInactivityMsFromEnv,
  loadMatrixChannelConfigFromEnv,
  loadMatrixDryRunFromEnv,
  loadMatrixIgnoreMessagesBeforeStartupFromEnv,
  loadMatrixProgressConfigFromEnv,
  loadMatrixProcessHistoricalMessagesFromEnv,
  loadMatrixStartupGraceMsFromEnv
};

export type {
  MatrixProgressMode,
  MatrixSupportProgressReporterConfig
};
