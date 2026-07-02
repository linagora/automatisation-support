import { createMatrixClient } from "./matrixClient";
import {
  DEFAULT_MATRIX_PROGRESS_MESSAGES,
  formatMatrixProgressFinalMessage,
  formatMatrixProgressStageMessage
} from "./matrixProgressMessages";
import {
  logError,
  logInfo
} from "./matrixSupportAutomationLogger";

import type {
  ProgressContext,
  SupportProgressReporter,
  SupportProgressStage
} from "../../support-automation/progress/supportProgressReporter";
import type {
  MatrixChannelConfig,
  MatrixClientLike
} from "./typesMatrixChannel.types";
import type {
  MatrixSupportAutomationLogger
} from "./matrixSupportAutomationLogger";

type MatrixProgressMode =
  | "typing_only"
  | "typing_and_static_status"
  | "typing_and_editable_status";

type MatrixProgressMessages = typeof DEFAULT_MATRIX_PROGRESS_MESSAGES;

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

type MatrixSupportProgressReporterDependencies = {
  createMatrixClient?: typeof createMatrixClient;
  now?: () => number;
};

type MatrixSupportProgressReporterParams = {
  matrixConfig: MatrixChannelConfig;
  progressConfig: MatrixSupportProgressReporterConfig;
  logger: MatrixSupportAutomationLogger;
  dryRun?: boolean;
  dependencies?: MatrixSupportProgressReporterDependencies;
};

type TurnProgressState = {
  turnId: string;
  startedAt: number;
  statusEventId?: string;
  lastStage?: SupportProgressStage;
  lastVisibleText?: string;
  lastStageSentAt?: number;
  typingRefreshTimer?: ReturnType<typeof setInterval>;
  pendingStage?: SupportProgressStage;
  pendingStageTimer?: ReturnType<typeof setTimeout>;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function shouldUseEditableStatus(
  config: MatrixSupportProgressReporterConfig
): boolean {
  return (
    config.enabled &&
    config.statusMessages &&
    config.mode === "typing_and_editable_status"
  );
}

function buildReplacementContent(params: {
  eventId: string;
  text: string;
}): Record<string, unknown> {
  return {
    msgtype: "m.text",
    body: `* ${params.text}`,
    "m.new_content": {
      msgtype: "m.text",
      body: params.text
    },
    "m.relates_to": {
      rel_type: "m.replace",
      event_id: params.eventId
    }
  };
}

function createMatrixSupportProgressReporter(
  params: MatrixSupportProgressReporterParams
): SupportProgressReporter {
  const dryRun = params.dryRun === true;
  const config = params.progressConfig;
  const createClient =
    params.dependencies?.createMatrixClient ?? createMatrixClient;
  const now = params.dependencies?.now ?? Date.now;
  const client: MatrixClientLike | null =
    !dryRun && config.enabled ? createClient(params.matrixConfig) : null;
  const stateByTurnKey = new Map<string, TurnProgressState>();

  function getTurnId(context: ProgressContext): string {
    return context.turnId ?? "unknown_turn";
  }

  function getTurnKey(context: ProgressContext): string {
    return `${context.roomId}\u0000${context.userId}\u0000${getTurnId(context)}`;
  }

  function createFreshState(context: ProgressContext): TurnProgressState {
    return {
      turnId: getTurnId(context),
      startedAt: now()
    };
  }

  function getState(context: ProgressContext): TurnProgressState {
    const turnKey = getTurnKey(context);
    const existingState = stateByTurnKey.get(turnKey);

    if (existingState !== undefined) {
      return existingState;
    }

    const state = createFreshState(context);

    stateByTurnKey.set(turnKey, state);

    return state;
  }

  function clearStateTimers(state: TurnProgressState): void {
    if (state.typingRefreshTimer !== undefined) {
      clearInterval(state.typingRefreshTimer);
    }

    if (state.pendingStageTimer !== undefined) {
      clearTimeout(state.pendingStageTimer);
    }
  }

  function resetState(context: ProgressContext): TurnProgressState {
    const turnKey = getTurnKey(context);
    const existingState = stateByTurnKey.get(turnKey);

    if (existingState !== undefined) {
      clearStateTimers(existingState);
    }

    const state = createFreshState(context);

    stateByTurnKey.set(turnKey, state);

    return state;
  }

  function deleteState(context: ProgressContext): void {
    const state = stateByTurnKey.get(getTurnKey(context));

    if (state !== undefined) {
      clearStateTimers(state);
    }

    stateByTurnKey.delete(getTurnKey(context));
  }

  function getStageText(
    context: ProgressContext,
    stage: SupportProgressStage
  ): string {
    return formatMatrixProgressStageMessage({
      stage,
      userLanguage: context.userLanguage
    });
  }

  function logSimulation(
    eventName: string,
    context: ProgressContext,
    metadata: Record<string, unknown>
  ): void {
    const state = getState(context);

    logInfo({
      logger: params.logger,
      eventName,
      metadata: {
        roomId: context.roomId,
        userId: context.userId,
        turnId: getTurnId(context),
        stageAt: new Date(now()).toISOString(),
        elapsedMs: now() - state.startedAt,
        ...metadata
      }
    });
  }

  async function runBestEffort(
    actionName: string,
    action: () => Promise<void>
  ): Promise<void> {
    try {
      await action();
    } catch (error) {
      logError({
        logger: params.logger,
        eventName: "matrix.v2.progress.action_failed",
        metadata: {
          actionName,
          error: getErrorMessage(error)
        }
      });
    }
  }

  async function setTyping(
    context: ProgressContext,
    typing: boolean
  ): Promise<void> {
    if (!config.enabled) {
      return;
    }

    if (dryRun) {
      logSimulation("matrix.v2.progress.typing.simulated", context, {
        typing,
        message: typing
          ? `progress.typing_on simulated turnId=${getTurnId(context)}`
          : `progress.typing_off simulated turnId=${getTurnId(context)}`
      });
      return;
    }

    if (!client?.setTyping) {
      return;
    }

    await runBestEffort("setTyping", async () => {
      await client.setTyping?.(
        context.roomId,
        typing,
        typing ? config.typingTimeoutMs : 0
      );
    });

    const state = getState(context);

    if (!typing) {
      if (state.typingRefreshTimer !== undefined) {
        clearInterval(state.typingRefreshTimer);
        delete state.typingRefreshTimer;
      }

      return;
    }

    if (state.typingRefreshTimer !== undefined) {
      return;
    }

    const refreshIntervalMs = Math.max(
      1_000,
      Math.floor(config.typingTimeoutMs / 2)
    );
    const timer = setInterval(() => {
      void runBestEffort("refreshTyping", async () => {
        await client.setTyping?.(
          context.roomId,
          true,
          config.typingTimeoutMs
        );
      });
    }, refreshIntervalMs);

    timer.unref?.();
    state.typingRefreshTimer = timer;
  }

  async function createStatusMessage(
    context: ProgressContext,
    stage: SupportProgressStage
  ): Promise<void> {
    if (!shouldUseEditableStatus(config)) {
      return;
    }

    const state = getState(context);

    if (state.statusEventId !== undefined) {
      return;
    }

    const text = getStageText(context, stage);

    state.lastStage = stage;
    state.lastVisibleText = text;
    state.lastStageSentAt = now();

    if (dryRun) {
      state.statusEventId = `$simulated-progress-status:${state.turnId}`;
      logSimulation("matrix.v2.progress.status_create.simulated", context, {
        stage,
        text,
        message: `progress.status_create simulated turnId=${getTurnId(context)} stage=${stage} text="${text}"`
      });
      return;
    }

    if (!client?.sendMessage) {
      return;
    }

    await runBestEffort("createStatusMessage", async () => {
      state.statusEventId = await client.sendMessage?.(context.roomId, {
        msgtype: "m.text",
        body: text
      });
    });
  }

  async function sendStatusEdit(paramsToEdit: {
    context: ProgressContext;
    eventName: string;
    text: string;
    stage?: SupportProgressStage;
  }): Promise<void> {
    const state = getState(paramsToEdit.context);

    if (state.statusEventId === undefined) {
      return;
    }

    state.lastVisibleText = paramsToEdit.text;
    state.lastStageSentAt = now();

    if (paramsToEdit.stage !== undefined) {
      state.lastStage = paramsToEdit.stage;
    }

    if (dryRun) {
      logSimulation(paramsToEdit.eventName, paramsToEdit.context, {
        ...(paramsToEdit.stage !== undefined
          ? { stage: paramsToEdit.stage }
          : {}),
        text: paramsToEdit.text,
        message: paramsToEdit.stage !== undefined
          ? `progress.status_edit simulated turnId=${getTurnId(paramsToEdit.context)} stage=${paramsToEdit.stage} text="${paramsToEdit.text}"`
          : `progress.status_final_edit simulated turnId=${getTurnId(paramsToEdit.context)} text="${paramsToEdit.text}"`
      });
      return;
    }

    if (!client?.sendMessage) {
      return;
    }

    await runBestEffort("editStatusMessage", async () => {
      await client.sendMessage?.(
        paramsToEdit.context.roomId,
        buildReplacementContent({
          eventId: state.statusEventId as string,
          text: paramsToEdit.text
        })
      );
    });
  }

  async function editStatusMessage(
    context: ProgressContext,
    stage: SupportProgressStage,
    options: {
      force?: boolean;
    } = {}
  ): Promise<void> {
    if (!shouldUseEditableStatus(config)) {
      return;
    }

    const state = getState(context);
    const text = getStageText(context, stage);
    const currentTime = now();

    if (state.lastStage === stage || state.lastVisibleText === text) {
      return;
    }

    if (
      !options.force &&
      state.lastStageSentAt !== undefined &&
      currentTime - state.lastStageSentAt < config.minStageIntervalMs
    ) {
      state.pendingStage = stage;

      if (state.pendingStageTimer === undefined) {
        const delayMs = config.minStageIntervalMs -
          (currentTime - state.lastStageSentAt);

        state.pendingStageTimer = setTimeout(() => {
          void flushPendingStage(context);
        }, Math.max(0, delayMs));
        state.pendingStageTimer.unref?.();
      }

      return;
    }

    if (state.pendingStageTimer !== undefined) {
      clearTimeout(state.pendingStageTimer);
      delete state.pendingStageTimer;
    }

    delete state.pendingStage;

    if (state.statusEventId === undefined) {
      await createStatusMessage(context, stage);
      return;
    }

    await sendStatusEdit({
      context,
      eventName: "matrix.v2.progress.status_edit.simulated",
      stage,
      text
    });
  }

  async function flushPendingStage(context: ProgressContext): Promise<void> {
    const state = getState(context);
    const pendingStage = state.pendingStage;

    if (state.pendingStageTimer !== undefined) {
      clearTimeout(state.pendingStageTimer);
      delete state.pendingStageTimer;
    }

    delete state.pendingStage;

    if (pendingStage !== undefined) {
      await editStatusMessage(context, pendingStage, {
        force: true
      });
    }
  }

  async function editFinalStatusMessage(
    context: ProgressContext
  ): Promise<void> {
    if (
      !shouldUseEditableStatus(config) ||
      config.removeStatusOnDone ||
      !config.finalMessageEnabled
    ) {
      return;
    }

    const state = getState(context);

    if (state.pendingStageTimer !== undefined) {
      clearTimeout(state.pendingStageTimer);
      delete state.pendingStageTimer;
    }

    delete state.pendingStage;

    if (context.userLanguage === undefined) {
      logInfo({
        logger: params.logger,
        eventName: "matrix.v2.progress.language_missing",
        metadata: {
          roomId: context.roomId,
          userId: context.userId,
          turnId: getTurnId(context),
          lastStage: state.lastStage,
          fallbackLanguage: "English"
        }
      });
    }

    await sendStatusEdit({
      context,
      eventName: "matrix.v2.progress.status_final_edit.simulated",
      text: formatMatrixProgressFinalMessage({
        userLanguage: context.userLanguage
      })
    });
  }

  async function editFailedStatusMessage(
    context: ProgressContext
  ): Promise<void> {
    if (!shouldUseEditableStatus(config)) {
      return;
    }

    await sendStatusEdit({
      context,
      eventName: "matrix.v2.progress.status_failed_edit.simulated",
      stage: "failed",
      text: getStageText(context, "failed")
    });
  }

  async function removeStatusMessage(context: ProgressContext): Promise<void> {
    if (!shouldUseEditableStatus(config) || !config.removeStatusOnDone) {
      return;
    }

    const state = getState(context);

    if (state.pendingStageTimer !== undefined) {
      clearTimeout(state.pendingStageTimer);
      delete state.pendingStageTimer;
    }

    delete state.pendingStage;

    if (state.statusEventId === undefined) {
      return;
    }

    if (dryRun) {
      logSimulation("matrix.v2.progress.status_remove.simulated", context, {
        message: `progress.status_remove simulated turnId=${getTurnId(context)}`
      });
      state.statusEventId = undefined;
      return;
    }

    if (!client?.redactEvent) {
      return;
    }

    await runBestEffort("removeStatusMessage", async () => {
      await client.redactEvent?.(
        context.roomId,
        state.statusEventId as string,
        "support progress completed"
      );
      state.statusEventId = undefined;
    });
  }

  return {
    startBuffer: async (context) => {
      await setTyping(context, true);
    },
    startTurn: async (context) => {
      resetState(context);
      await setTyping(context, true);
    },
    stage: async (context, stage) => {
      await setTyping(context, true);
      if (context.progressLanguageReady !== true) {
        return;
      }

      await editStatusMessage(context, stage);
    },
    finishTurn: async (context) => {
      await editFinalStatusMessage(context);
      await removeStatusMessage(context);
      await setTyping(context, false);
      deleteState(context);
    },
    failTurn: async (context, error) => {
      logError({
        logger: params.logger,
        eventName: "matrix.v2.progress.turn_failed",
        metadata: {
          roomId: context.roomId,
          userId: context.userId,
          turnId: getTurnId(context),
          error: getErrorMessage(error)
        }
      });
      await editFailedStatusMessage(context);
      await removeStatusMessage(context);
      await setTyping(context, false);
      deleteState(context);
    }
  };
}

export {
  createMatrixSupportProgressReporter
};

export type {
  MatrixProgressMode,
  MatrixProgressMessages,
  MatrixSupportProgressReporterConfig,
  MatrixSupportProgressReporterDependencies,
  MatrixSupportProgressReporterParams
};
