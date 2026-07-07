import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createMatrixSupportProgressReporter
} from "../../../src/infrastructure/matrix/matrixSupportProgressReporter";
import {
  DEFAULT_MATRIX_PROGRESS_MESSAGES
} from "../../../src/infrastructure/matrix/matrixProgressMessages";

import type {
  MatrixSupportProgressReporterConfig
} from "../../../src/infrastructure/matrix/matrixSupportProgressReporter";
import type {
  MatrixSupportAutomationLogger
} from "../../../src/infrastructure/matrix/matrixSupportAutomationLogger";
import type {
  MatrixClientLike
} from "../../../src/infrastructure/matrix/typesMatrixChannel.types";
import type {
  ProgressContext
} from "../../../src/support-automation/progress/supportProgressReporter";

function buildProgressConfig(
  overrides: Partial<MatrixSupportProgressReporterConfig> = {}
): MatrixSupportProgressReporterConfig {
  return {
    enabled: true,
    mode: "typing_and_editable_status",
    statusMessages: true,
    removeStatusOnDone: true,
    finalMessageEnabled: true,
    finalMessage: DEFAULT_MATRIX_PROGRESS_MESSAGES.done,
    typingTimeoutMs: 10_000,
    minStageIntervalMs: 1_000,
    messages: DEFAULT_MATRIX_PROGRESS_MESSAGES,
    ...overrides
  };
}

function buildContext(
  overrides: Partial<ProgressContext> = {}
): ProgressContext {
  return {
    roomId: "!room:example.org",
    userId: "@user:example.org",
    turnId: "$turn_1",
    messageCount: 1,
    userLanguage: "French",
    progressLanguageReady: true,
    ...overrides
  };
}

function buildLogger(): {
  logger: MatrixSupportAutomationLogger;
  log: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
} {
  const log = vi.fn();
  const error = vi.fn();

  return {
    logger: {
      log,
      error
    },
    log,
    error
  };
}

function buildMatrixClient(overrides: Partial<MatrixClientLike> = {}): MatrixClientLike {
  return {
    getUserId: vi.fn(async () => "@bot:example.org"),
    on: vi.fn(),
    start: vi.fn(async () => undefined),
    sendText: vi.fn(async () => "$text"),
    sendMessage: vi.fn(async () => "$status"),
    setTyping: vi.fn(async () => undefined),
    redactEvent: vi.fn(async () => "$redaction"),
    ...overrides
  };
}

describe("MatrixSupportProgressReporter", function () {
  afterEach(function () {
    vi.useRealTimers();
  });

  it("logs simulated progress in dry-run without creating a Matrix client", async function () {
    const createMatrixClient = vi.fn();
    const { logger, log } = buildLogger();
    const reporter = createMatrixSupportProgressReporter({
      matrixConfig: {
        homeserverUrl: "https://matrix.example.org",
        accessToken: "token"
      },
      progressConfig: buildProgressConfig({
        minStageIntervalMs: 0
      }),
      logger,
      dryRun: true,
      dependencies: {
        createMatrixClient
      }
    });
    const context = buildContext();

    await reporter.startBuffer(context);
    await reporter.startTurn(context);
    await reporter.stage(context, "analyzing_support");
    await reporter.stage(context, "rendering_response");
    await reporter.finishTurn(context);

    expect(createMatrixClient).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.objectContaining({
      eventName: "matrix.v2.progress.typing.simulated",
      message: "progress.typing_on simulated turnId=$turn_1"
    }));
    expect(log).toHaveBeenCalledWith(expect.objectContaining({
      eventName: "matrix.v2.progress.status_create.simulated",
      message: "progress.status_create simulated turnId=$turn_1 stage=analyzing_support text=\"Je qualifie le problème rencontré…\""
    }));
    expect(log).toHaveBeenCalledWith(expect.objectContaining({
      eventName: "matrix.v2.progress.status_edit.simulated",
      message: "progress.status_edit simulated turnId=$turn_1 stage=rendering_response text=\"Je rédige la réponse…\""
    }));
    expect(log).toHaveBeenCalledWith(expect.objectContaining({
      eventName: "matrix.v2.progress.status_remove.simulated",
      message: "progress.status_remove simulated turnId=$turn_1"
    }));
    expect(log).toHaveBeenCalledWith(expect.objectContaining({
      eventName: "matrix.v2.progress.typing.simulated",
      message: "progress.typing_off simulated turnId=$turn_1"
    }));
  });

  it("sends typing, creates an editable status, edits it, and redacts it on finish", async function () {
    const matrixClient = buildMatrixClient({
      sendMessage: vi.fn(async (_roomId, content) => {
        if (
          typeof content["m.relates_to"] === "object" &&
          content["m.relates_to"] !== null
        ) {
          return "$edit";
        }

        return "$status";
      })
    });
    const { logger } = buildLogger();
    let currentTime = 0;
    const reporter = createMatrixSupportProgressReporter({
      matrixConfig: {
        homeserverUrl: "https://matrix.example.org",
        accessToken: "token"
      },
      progressConfig: buildProgressConfig(),
      logger,
      dependencies: {
        createMatrixClient: vi.fn(() => matrixClient),
        now: () => currentTime
      }
    });
    const context = buildContext();

    await reporter.startBuffer(context);
    await reporter.startTurn(context);
    currentTime = 1_500;
    await reporter.stage(context, "analyzing_surface");
    currentTime = 3_000;
    await reporter.stage(context, "analyzing_support");
    await reporter.finishTurn(context);

    expect(matrixClient.setTyping).toHaveBeenCalledWith(
      context.roomId,
      true,
      10_000
    );
    expect(matrixClient.sendMessage).toHaveBeenCalledWith(context.roomId, {
      msgtype: "m.text",
      body: "Je comprends votre message…"
    });
    expect(matrixClient.sendMessage).toHaveBeenCalledWith(
      context.roomId,
      expect.objectContaining({
        body: "* Je qualifie le problème rencontré…",
        "m.new_content": {
          msgtype: "m.text",
          body: "Je qualifie le problème rencontré…"
        },
        "m.relates_to": {
          rel_type: "m.replace",
          event_id: "$status"
        }
      })
    );
    expect(matrixClient.redactEvent).toHaveBeenCalledWith(
      context.roomId,
      "$status",
      "support progress completed"
    );
    expect(matrixClient.setTyping).toHaveBeenLastCalledWith(
      context.roomId,
      false,
      0
    );
  });

  it("does not send a visible status before the detected language is ready", async function () {
    const matrixClient = buildMatrixClient();
    const { logger } = buildLogger();
    const reporter = createMatrixSupportProgressReporter({
      matrixConfig: {
        homeserverUrl: "https://matrix.example.org",
        accessToken: "token"
      },
      progressConfig: buildProgressConfig(),
      logger,
      dependencies: {
        createMatrixClient: vi.fn(() => matrixClient)
      }
    });
    const context = buildContext({
      userLanguage: undefined,
      progressLanguageReady: false
    });

    await reporter.startTurn(context);
    await reporter.stage(context, "analyzing_surface");
    await reporter.stage(context, "analyzing_support");

    expect(matrixClient.sendMessage).not.toHaveBeenCalled();

    context.userLanguage = "English";
    context.progressLanguageReady = true;
    await reporter.stage(context, "analyzing_surface");

    expect(matrixClient.sendMessage).toHaveBeenCalledWith(context.roomId, {
      msgtype: "m.text",
      body: "I understand your message..."
    });
  });

  it("uses English for intermediate progress messages after English is detected", async function () {
    const matrixClient = buildMatrixClient();
    const { logger } = buildLogger();
    let currentTime = 0;
    const reporter = createMatrixSupportProgressReporter({
      matrixConfig: {
        homeserverUrl: "https://matrix.example.org",
        accessToken: "token"
      },
      progressConfig: buildProgressConfig({
        minStageIntervalMs: 0
      }),
      logger,
      dependencies: {
        createMatrixClient: vi.fn(() => matrixClient),
        now: () => currentTime
      }
    });
    const context = buildContext({
      userLanguage: "English"
    });

    await reporter.startTurn(context);
    await reporter.stage(context, "analyzing_surface");
    currentTime = 1_500;
    await reporter.stage(context, "analyzing");
    currentTime = 3_000;
    await reporter.stage(context, "rendering_response");

    expect(matrixClient.sendMessage).toHaveBeenCalledWith(context.roomId, {
      msgtype: "m.text",
      body: "I understand your message..."
    });
    expect(matrixClient.sendMessage).toHaveBeenCalledWith(
      context.roomId,
      expect.objectContaining({
        body: "* I'm analyzing your request...",
        "m.new_content": {
          msgtype: "m.text",
          body: "I'm analyzing your request..."
        }
      })
    );
    expect(matrixClient.sendMessage).toHaveBeenCalledWith(
      context.roomId,
      expect.objectContaining({
        body: "* I'm writing the response...",
        "m.new_content": {
          msgtype: "m.text",
          body: "I'm writing the response..."
        }
      })
    );
  });

  it("deduplicates equal stages and throttles quick status edits", async function () {
    const matrixClient = buildMatrixClient();
    const { logger } = buildLogger();
    let currentTime = 0;
    const reporter = createMatrixSupportProgressReporter({
      matrixConfig: {
        homeserverUrl: "https://matrix.example.org",
        accessToken: "token"
      },
      progressConfig: buildProgressConfig(),
      logger,
      dependencies: {
        createMatrixClient: vi.fn(() => matrixClient),
        now: () => currentTime
      }
    });
    const context = buildContext();

    await reporter.startTurn(context);
    currentTime = 500;
    await reporter.stage(context, "analyzing_surface");
    currentTime = 1_500;
    await reporter.stage(context, "analyzing_support");
    await reporter.stage(context, "analyzing_support");

    expect(matrixClient.sendMessage).toHaveBeenCalledTimes(2);
    expect(matrixClient.sendMessage).toHaveBeenLastCalledWith(
      context.roomId,
      expect.objectContaining({
        body: "* Je qualifie le problème rencontré…"
      })
    );
  });

  it("edits the current status to the final intro when removal is disabled", async function () {
    const matrixClient = buildMatrixClient();
    const { logger } = buildLogger();
    let currentTime = 0;
    const reporter = createMatrixSupportProgressReporter({
      matrixConfig: {
        homeserverUrl: "https://matrix.example.org",
        accessToken: "token"
      },
      progressConfig: buildProgressConfig({
        removeStatusOnDone: false,
        finalMessageEnabled: true
      }),
      logger,
      dependencies: {
        createMatrixClient: vi.fn(() => matrixClient),
        now: () => currentTime
      }
    });
    const context = buildContext();

    await reporter.startTurn(context);
    currentTime = 1_500;
    await reporter.stage(context, "rendering_response");
    await reporter.finishTurn(context);

    expect(matrixClient.redactEvent).not.toHaveBeenCalled();
    expect(matrixClient.sendMessage).toHaveBeenLastCalledWith(
      context.roomId,
      expect.objectContaining({
        body: "* Ci-dessous, voici ma réponse générée automatiquement.",
        "m.new_content": {
          msgtype: "m.text",
          body: "Ci-dessous, voici ma réponse générée automatiquement."
        }
      })
    );
  });

  it("formats the final intro in French when the detected user language is French", async function () {
    const matrixClient = buildMatrixClient();
    const { logger } = buildLogger();
    let currentTime = 0;
    const reporter = createMatrixSupportProgressReporter({
      matrixConfig: {
        homeserverUrl: "https://matrix.example.org",
        accessToken: "token"
      },
      progressConfig: buildProgressConfig({
        removeStatusOnDone: false,
        finalMessageEnabled: true
      }),
      logger,
      dependencies: {
        createMatrixClient: vi.fn(() => matrixClient),
        now: () => currentTime
      }
    });
    const context = buildContext({
      userLanguage: "French"
    });

    await reporter.startTurn(context);
    currentTime = 1_500;
    await reporter.stage(context, "rendering_response");
    await reporter.finishTurn(context);

    expect(matrixClient.sendMessage).toHaveBeenLastCalledWith(
      context.roomId,
      expect.objectContaining({
        "m.new_content": {
          msgtype: "m.text",
          body: "Ci-dessous, voici ma réponse générée automatiquement."
        }
      })
    );
  });

  it("formats the final intro in English when the detected user language is English", async function () {
    const matrixClient = buildMatrixClient();
    const { logger } = buildLogger();
    let currentTime = 0;
    const reporter = createMatrixSupportProgressReporter({
      matrixConfig: {
        homeserverUrl: "https://matrix.example.org",
        accessToken: "token"
      },
      progressConfig: buildProgressConfig({
        removeStatusOnDone: false,
        finalMessageEnabled: true
      }),
      logger,
      dependencies: {
        createMatrixClient: vi.fn(() => matrixClient),
        now: () => currentTime
      }
    });
    const context = buildContext({
      userLanguage: "English"
    });

    await reporter.startTurn(context);
    currentTime = 1_500;
    await reporter.stage(context, "rendering_response");
    await reporter.finishTurn(context);

    expect(matrixClient.sendMessage).toHaveBeenLastCalledWith(
      context.roomId,
      expect.objectContaining({
        "m.new_content": {
          msgtype: "m.text",
          body: "Below is my automatically generated response."
        }
      })
    );
  });

  it("uses the English final intro fallback for unsupported languages", async function () {
    const matrixClient = buildMatrixClient();
    const { logger } = buildLogger();
    let currentTime = 0;
    const reporter = createMatrixSupportProgressReporter({
      matrixConfig: {
        homeserverUrl: "https://matrix.example.org",
        accessToken: "token"
      },
      progressConfig: buildProgressConfig({
        removeStatusOnDone: false,
        finalMessageEnabled: true
      }),
      logger,
      dependencies: {
        createMatrixClient: vi.fn(() => matrixClient),
        now: () => currentTime
      }
    });
    const context = buildContext({
      userLanguage: "Unknown"
    });

    await reporter.startTurn(context);
    currentTime = 1_500;
    await reporter.stage(context, "rendering_response");
    await reporter.finishTurn(context);

    expect(matrixClient.sendMessage).toHaveBeenLastCalledWith(
      context.roomId,
      expect.objectContaining({
        "m.new_content": {
          msgtype: "m.text",
          body: "Below is my automatically generated response."
        }
      })
    );
  });

  it("uses English final intro fallback when userLanguage is missing", async function () {
    const matrixClient = buildMatrixClient();
    const { logger } = buildLogger();
    let currentTime = 0;
    const reporter = createMatrixSupportProgressReporter({
      matrixConfig: {
        homeserverUrl: "https://matrix.example.org",
        accessToken: "token"
      },
      progressConfig: buildProgressConfig({
        removeStatusOnDone: false,
        finalMessageEnabled: true
      }),
      logger,
      dependencies: {
        createMatrixClient: vi.fn(() => matrixClient),
        now: () => currentTime
      }
    });
    const context = buildContext({
      userLanguage: undefined
    });

    await reporter.startTurn(context);
    currentTime = 1_500;
    await reporter.stage(context, "rendering_response");
    await reporter.finishTurn(context);

    expect(matrixClient.sendMessage).toHaveBeenLastCalledWith(
      context.roomId,
      expect.objectContaining({
        "m.new_content": {
          msgtype: "m.text",
          body: "Below is my automatically generated response."
        }
      })
    );
  });

  it("logs language_missing when the final intro falls back because userLanguage is missing", async function () {
    const matrixClient = buildMatrixClient();
    const { logger, log } = buildLogger();
    let currentTime = 0;
    const reporter = createMatrixSupportProgressReporter({
      matrixConfig: {
        homeserverUrl: "https://matrix.example.org",
        accessToken: "token"
      },
      progressConfig: buildProgressConfig({
        removeStatusOnDone: false,
        finalMessageEnabled: true
      }),
      logger,
      dependencies: {
        createMatrixClient: vi.fn(() => matrixClient),
        now: () => currentTime
      }
    });
    const context = buildContext({
      userLanguage: undefined
    });

    await reporter.startTurn(context);
    currentTime = 1_500;
    await reporter.stage(context, "rendering_response");
    await reporter.finishTurn(context);

    expect(log).toHaveBeenCalledWith(expect.objectContaining({
      eventName: "matrix.v2.progress.language_missing",
      fallbackLanguage: "English"
    }));
  });

  it("keeps editable status messages isolated per turn", async function () {
    let createdStatusCount = 0;
    const matrixClient = buildMatrixClient({
      sendMessage: vi.fn(async (_roomId, content) => {
        if (
          typeof content["m.relates_to"] === "object" &&
          content["m.relates_to"] !== null
        ) {
          return "$edit";
        }

        createdStatusCount += 1;
        return `$status_${createdStatusCount}`;
      })
    });
    const { logger } = buildLogger();
    let currentTime = 0;
    const reporter = createMatrixSupportProgressReporter({
      matrixConfig: {
        homeserverUrl: "https://matrix.example.org",
        accessToken: "token"
      },
      progressConfig: buildProgressConfig({
        removeStatusOnDone: false
      }),
      logger,
      dependencies: {
        createMatrixClient: vi.fn(() => matrixClient),
        now: () => currentTime
      }
    });
    const firstTurn = buildContext();
    const secondTurn = {
      ...buildContext(),
      turnId: "$turn_2"
    };

    await reporter.startTurn(firstTurn);
    currentTime = 1_500;
    await reporter.stage(firstTurn, "rendering_response");
    await reporter.finishTurn(firstTurn);
    currentTime = 3_000;
    await reporter.startTurn(secondTurn);
    currentTime = 4_500;
    await reporter.stage(secondTurn, "analyzing_surface");
    currentTime = 6_000;
    await reporter.stage(secondTurn, "analyzing_support");

    const sendMessage = vi.mocked(
      matrixClient.sendMessage as NonNullable<MatrixClientLike["sendMessage"]>
    );
    const editContents = sendMessage.mock.calls
      .map((call) => {
        return call[1];
      })
      .filter((content) => {
        return typeof content["m.relates_to"] === "object" &&
          content["m.relates_to"] !== null;
      });

    expect(editContents).toHaveLength(2);
    expect(editContents[0]["m.relates_to"]).not.toEqual(
      editContents[1]["m.relates_to"]
    );
  });

  it("shows the latest pending stage after throttle instead of an obsolete one", async function () {
    vi.useFakeTimers();

    const matrixClient = buildMatrixClient();
    const { logger } = buildLogger();
    let currentTime = 0;
    const reporter = createMatrixSupportProgressReporter({
      matrixConfig: {
        homeserverUrl: "https://matrix.example.org",
        accessToken: "token"
      },
      progressConfig: buildProgressConfig(),
      logger,
      dependencies: {
        createMatrixClient: vi.fn(() => matrixClient),
        now: () => currentTime
      }
    });
    const context = buildContext();

    await reporter.startTurn(context);
    currentTime = 200;
    await reporter.stage(context, "analyzing_surface");
    currentTime = 300;
    await reporter.stage(context, "rendering_response");
    currentTime = 1_000;
    await vi.advanceTimersByTimeAsync(1_000);

    expect(matrixClient.sendMessage).toHaveBeenCalledTimes(2);
    expect(matrixClient.sendMessage).toHaveBeenLastCalledWith(
      context.roomId,
      expect.objectContaining({
        body: "* Je rédige la réponse…"
      })
    );
  });

  it("refreshes typing periodically until finish", async function () {
    vi.useFakeTimers();

    const matrixClient = buildMatrixClient();
    const { logger } = buildLogger();
    const reporter = createMatrixSupportProgressReporter({
      matrixConfig: {
        homeserverUrl: "https://matrix.example.org",
        accessToken: "token"
      },
      progressConfig: buildProgressConfig({
        mode: "typing_only",
        statusMessages: false,
        typingTimeoutMs: 2_000
      }),
      logger,
      dependencies: {
        createMatrixClient: vi.fn(() => matrixClient)
      }
    });
    const context = buildContext();

    await reporter.startTurn(context);
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.advanceTimersByTimeAsync(1_000);
    await reporter.finishTurn(context);
    await vi.advanceTimersByTimeAsync(2_000);

    expect(matrixClient.setTyping).toHaveBeenNthCalledWith(
      1,
      context.roomId,
      true,
      2_000
    );
    expect(matrixClient.setTyping).toHaveBeenNthCalledWith(
      2,
      context.roomId,
      true,
      2_000
    );
    expect(matrixClient.setTyping).toHaveBeenNthCalledWith(
      3,
      context.roomId,
      true,
      2_000
    );
    expect(matrixClient.setTyping).toHaveBeenLastCalledWith(
      context.roomId,
      false,
      0
    );
    expect(matrixClient.setTyping).toHaveBeenCalledTimes(4);
  });
});
