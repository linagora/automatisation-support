import { describe, expect, it } from "vitest";

import {
  validateMatrixChannelEnv
} from "../../../src/channels/matrix/validateMatrixChannelConfig";

describe("validateMatrixChannelEnv", function () {
  it("accepts a valid Matrix config", function () {
    expect(validateMatrixChannelEnv({
      MATRIX_HOMESERVER_URL: "https://matrix.example.org",
      MATRIX_ACCESS_TOKEN: "secret-token",
      MATRIX_ROOM_ID: "!room:example.org",
      SUPPORT_MATRIX_DRY_RUN: "true"
    })).toEqual({
      isValid: true,
      errors: [],
      warnings: [],
      summary: {
        homeserverUrlConfigured: true,
        accessTokenConfigured: true,
        defaultRoomIdConfigured: true,
        storagePathConfigured: false,
        dryRunConfigured: true,
        bufferMaxWaitConfigured: false,
        runnerMode: "single_room"
      }
    });
  });

  it("warns when room id or dry-run are not configured", function () {
    expect(validateMatrixChannelEnv({
      MATRIX_HOMESERVER_URL: "https://matrix.example.org",
      MATRIX_ACCESS_TOKEN: "secret-token"
    })).toEqual({
      isValid: true,
      errors: [],
      warnings: [
        "MATRIX_ROOM_ID is not set; runner will listen to all joined rooms",
        "SUPPORT_MATRIX_DRY_RUN is not set; delivery mode defaults to real delivery"
      ],
      summary: {
        homeserverUrlConfigured: true,
        accessTokenConfigured: true,
        defaultRoomIdConfigured: false,
        storagePathConfigured: false,
        dryRunConfigured: false,
        bufferMaxWaitConfigured: false,
        runnerMode: "all_joined_rooms"
      }
    });
  });

  it("returns clear errors when required config is missing", function () {
    expect(validateMatrixChannelEnv({})).toMatchObject({
      isValid: false,
      errors: [
        "MATRIX_HOMESERVER_URL is required",
        "MATRIX_ACCESS_TOKEN is required"
      ]
    });
  });
});
