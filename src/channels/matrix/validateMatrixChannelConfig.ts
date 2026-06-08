type MatrixConfigValidationResult = {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    homeserverUrlConfigured: boolean;
    accessTokenConfigured: boolean;
    defaultRoomIdConfigured: boolean;
    storagePathConfigured: boolean;
    dryRunConfigured: boolean;
    bufferMaxWaitConfigured: boolean;
    runnerMode: "single_room" | "all_joined_rooms";
  };
};

function validateMatrixChannelEnv(
  env: NodeJS.ProcessEnv = process.env
): MatrixConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const homeserverUrlConfigured = Boolean(env.MATRIX_HOMESERVER_URL);
  const accessTokenConfigured = Boolean(env.MATRIX_ACCESS_TOKEN);
  const defaultRoomIdConfigured = Boolean(env.MATRIX_ROOM_ID);
  const storagePathConfigured = Boolean(env.MATRIX_STORAGE_PATH);
  const dryRunConfigured = env.SUPPORT_MATRIX_DRY_RUN !== undefined;
  const bufferMaxWaitConfigured = env.SUPPORT_BUFFER_MAX_WAIT_MS !== undefined;

  if (!homeserverUrlConfigured) {
    errors.push("MATRIX_HOMESERVER_URL is required");
  }

  if (!accessTokenConfigured) {
    errors.push("MATRIX_ACCESS_TOKEN is required");
  }

  if (!defaultRoomIdConfigured) {
    warnings.push(
      "MATRIX_ROOM_ID is not set; runner will listen to all joined rooms"
    );
  }

  if (!dryRunConfigured) {
    warnings.push(
      "SUPPORT_MATRIX_DRY_RUN is not set; delivery mode defaults to real delivery"
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    summary: {
      homeserverUrlConfigured,
      accessTokenConfigured,
      defaultRoomIdConfigured,
      storagePathConfigured,
      dryRunConfigured,
      bufferMaxWaitConfigured,
      runnerMode: defaultRoomIdConfigured ? "single_room" : "all_joined_rooms"
    }
  };
}

export {
  validateMatrixChannelEnv
};

export type {
  MatrixConfigValidationResult
};
