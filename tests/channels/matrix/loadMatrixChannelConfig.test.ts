import { describe, expect, it } from "vitest";

import {
  loadMatrixProgressConfigFromEnv
} from "../../../src/channels/matrix/loadMatrixChannelConfig";
import {
  DEFAULT_MATRIX_PROGRESS_MESSAGES
} from "../../../src/channels/matrix/matrixProgressMessages";

describe("loadMatrixProgressConfigFromEnv", function () {
  it("loads Matrix progress configuration from env", function () {
    expect(loadMatrixProgressConfigFromEnv({
      SUPPORT_MATRIX_PROGRESS_ENABLED: "true",
      SUPPORT_MATRIX_PROGRESS_MODE: "typing_and_editable_status",
      SUPPORT_MATRIX_PROGRESS_STATUS_MESSAGES: "true",
      SUPPORT_MATRIX_PROGRESS_REMOVE_STATUS_ON_DONE: "false",
      SUPPORT_MATRIX_PROGRESS_TYPING_TIMEOUT_MS: "12000",
      SUPPORT_MATRIX_PROGRESS_MIN_STAGE_INTERVAL_MS: "1500"
    })).toEqual({
      enabled: true,
      mode: "typing_and_editable_status",
      statusMessages: true,
      removeStatusOnDone: false,
      finalMessageEnabled: true,
      finalMessage: DEFAULT_MATRIX_PROGRESS_MESSAGES.done,
      typingTimeoutMs: 12_000,
      minStageIntervalMs: 1_500,
      messages: DEFAULT_MATRIX_PROGRESS_MESSAGES
    });
  });

  it("rejects invalid mode and numeric values", function () {
    expect(() => {
      loadMatrixProgressConfigFromEnv({
        SUPPORT_MATRIX_PROGRESS_MODE: "avatar"
      });
    }).toThrow("SUPPORT_MATRIX_PROGRESS_MODE must be");

    expect(() => {
      loadMatrixProgressConfigFromEnv({
        SUPPORT_MATRIX_PROGRESS_TYPING_TIMEOUT_MS: "-1"
      });
    }).toThrow("SUPPORT_MATRIX_PROGRESS_TYPING_TIMEOUT_MS must be a non-negative number");
  });
});
