/**
 * Message Analysis
 *
 * This file is the local orchestrator of the message-analysis block.
 *
 * It keeps a route journal and explicitly decides which steps should run.
 *
 * Routing logic:
 *
 * 1. Input cleaning
 *    - If inputClean === false, stop message analysis immediately.
 *    - Then go directly to support knowledge update.
 *
 * 2. Attachment analysis
 *    - If no attachment is present or no attachment is analyzable, continue.
 *    - If attachment analysis later reports a blocking/fraudulent status, stop
 *      message analysis and go directly to support knowledge update.
 *
 * 3. Analysis gate
 *    - Decides only whether lightweight message analysis should run first.
 *
 * 4. Lightweight message analysis
 *    - Runs only if analysis gate says shouldRunLLM0 === true.
 *    - If it runs, it decides whether support message analysis is needed.
 *
 * 5. Support message analysis
 *    - Runs directly if analysis gate says shouldRunLLM0 === false.
 *    - Runs after lightweight analysis only if lightweight analysis asks for it.
 *
 * 6. Support knowledge update
 *    - Always runs at the end to produce supportKnowledgeAfterTurn and
 *      supportKnowledgeDelta.
 */

type UnknownObject = Record<string, unknown>;

type SupportKnowledge = UnknownObject;

type SupportKnowledgeDelta = UnknownObject;

type MaybePromise<T> = T | Promise<T>;

type MessageAnalysisStep<TInput, TOutput> = (
  input: TInput
) => MaybePromise<TOutput>;

interface TicketMemory {
  supportKnowledge?: SupportKnowledge;
  lastSupportKnowledgeDelta?: SupportKnowledgeDelta | null;
  supportKnowledgeDeltaHistory?: SupportKnowledgeDelta[];
  conversationLogs?: UnknownObject[];
  userInformations?: UnknownObject | null;
  visibility?: UnknownObject;
  metadata?: UnknownObject;
  [key: string]: unknown;
}

interface MessageAnalysisInput {
  latestUserMessage: string;
  attachments?: UnknownObject[];
  ticketMemoryBeforeTurn?: TicketMemory | null;
}

interface MessageAnalysisRouteJournalStep {
  status: "completed" | "skipped";
  reason: string | null;
  output: unknown;
  [key: string]: unknown;
}

interface MessageAnalysisRouteJournal {
  executedSteps: string[];
  skippedSteps: string[];
  routeStopped: boolean;
  stopReason: string | null;

  inputCleaning?: MessageAnalysisRouteJournalStep;
  attachmentAnalysis?: MessageAnalysisRouteJournalStep;
  analysisGate?: MessageAnalysisRouteJournalStep;
  lightweightMessageAnalysis?: MessageAnalysisRouteJournalStep;
  supportMessageAnalysis?: MessageAnalysisRouteJournalStep;
  supportKnowledgeUpdate?: MessageAnalysisRouteJournalStep;
}

interface MessageAnalysisOutput {
  supportKnowledgeAfterTurn: SupportKnowledge;
  supportKnowledgeDelta: SupportKnowledgeDelta;
  messageAnalysisRouteJournal?: MessageAnalysisRouteJournal;
  [key: string]: unknown;
}

interface MessageAnalysisSteps {
  runInputCleaning?: MessageAnalysisStep<UnknownObject, UnknownObject>;
  runAttachmentAnalysis?: MessageAnalysisStep<UnknownObject, UnknownObject>;
  runAnalysisGate?: MessageAnalysisStep<UnknownObject, UnknownObject>;
  runLightweightMessageAnalysis?: MessageAnalysisStep<UnknownObject, UnknownObject>;
  runSupportMessageAnalysis?: MessageAnalysisStep<UnknownObject, UnknownObject>;
  runSupportKnowledgeUpdate?: MessageAnalysisStep<UnknownObject, MessageAnalysisOutput>;
}

function createMissingStep<TInput, TOutput>(
  stepName: string
): MessageAnalysisStep<TInput, TOutput> {
  return function missingStep(): never {
    throw new Error(`${stepName} is not implemented yet`);
  };
}

function assertValidMessageAnalysisInput(
  input: unknown
): asserts input is MessageAnalysisInput {}

function assertValidMessageAnalysisOutput(
  messageAnalysisOutput: unknown
): asserts messageAnalysisOutput is MessageAnalysisOutput {}

function createSkippedOutput(reason: string): UnknownObject {
  return {
    status: "skipped",
    reason
  };
}

function getNestedValue(object: unknown, path: string[]): unknown {
  let current = object;

  for (const key of path) {
    if (!current || typeof current !== "object") {
      return undefined;
    }

    current = (current as UnknownObject)[key];
  }

  return current;
}

function getNestedBoolean(object: unknown, path: string[]): boolean | null {
  const value = getNestedValue(object, path);
  return typeof value === "boolean" ? value : null;
}

function getNestedString(object: unknown, path: string[]): string | null {
  const value = getNestedValue(object, path);
  return typeof value === "string" ? value : null;
}

function getFirstBoolean(object: unknown, paths: string[][]): boolean | null {
  for (const path of paths) {
    const value = getNestedBoolean(object, path);

    if (value !== null) {
      return value;
    }
  }

  return null;
}

function getFirstString(object: unknown, paths: string[][]): string | null {
  for (const path of paths) {
    const value = getNestedString(object, path);

    if (value && value.trim().length > 0) {
      return value;
    }
  }

  return null;
}

function getStepStatus(output: unknown): string | null {
  return getFirstString(output, [
    ["status"],
    ["inputCleaning", "status"],
    ["inputClean", "status"],
    ["attachmentAnalysis", "status"],
    ["analysisGate", "status"],
    ["runDecisionPreAnalysis", "status"],
    ["lightweightMessageAnalysis", "status"],
    ["supportMessageAnalysis", "status"]
  ]);
}

function getStepReason(output: unknown): string | null {
  return getFirstString(output, [
    ["reason"],
    ["error"],
    ["inputCleaning", "reason"],
    ["inputClean", "reason"],
    ["attachmentAnalysis", "reason"],
    ["analysisGate", "reason"],
    ["runDecisionPreAnalysis", "reason"],
    ["lightweightMessageAnalysis", "reason"],
    ["supportMessageAnalysis", "reason"]
  ]);
}

function getFailedChecks(inputCleaning: UnknownObject): UnknownObject[] {
  const failedChecks = inputCleaning.failedChecks;

  if (!Array.isArray(failedChecks)) {
    return [];
  }

  return failedChecks.filter(function (failedCheck) {
    return failedCheck && typeof failedCheck === "object";
  }) as UnknownObject[];
}

function isInputClean(inputCleaning: UnknownObject): boolean {
  return inputCleaning.inputClean === true;
}

function getInputCleaningStopReason(inputCleaning: UnknownObject): string {
  const failedChecks = getFailedChecks(inputCleaning);

  if (failedChecks.length === 0) {
    return "input_not_clean";
  }

  const firstFailedCheck = failedChecks[0];

  if (typeof firstFailedCheck.reason === "string") {
    return firstFailedCheck.reason;
  }

  if (typeof firstFailedCheck.checkName === "string") {
    return firstFailedCheck.checkName;
  }

  return "input_not_clean";
}

function shouldStopAfterAttachmentAnalysis(
  attachmentAnalysis: UnknownObject
): boolean {
  const explicitStop = getFirstBoolean(attachmentAnalysis, [
    ["shouldStopMessageAnalysis"],
    ["shouldStopAnalysis"],
    ["shouldStop"],
    ["stopAnalysis"],
    ["attachmentAnalysis", "shouldStopMessageAnalysis"],
    ["attachmentAnalysis", "shouldStopAnalysis"],
    ["attachmentAnalysis", "shouldStop"],
    ["attachmentAnalysis", "stopAnalysis"]
  ]);

  if (explicitStop !== null) {
    return explicitStop;
  }

  const explicitFraud = getFirstBoolean(attachmentAnalysis, [
    ["isFraudulent"],
    ["fraudulent"],
    ["isMalicious"],
    ["malicious"],
    ["attachmentAnalysis", "isFraudulent"],
    ["attachmentAnalysis", "fraudulent"],
    ["attachmentAnalysis", "isMalicious"],
    ["attachmentAnalysis", "malicious"]
  ]);

  if (explicitFraud !== null) {
    return explicitFraud;
  }

  const status = getStepStatus(attachmentAnalysis);

  if (!status) {
    return false;
  }

  /**
   * Important:
   * These statuses should NOT stop the route:
   * - not_present
   * - not_analyzable
   * - analysis_not_available
   *
   * They only mean that no useful attachment enrichment was produced.
   */
  const blockingStatuses = [
    "fraudulent",
    "malicious",
    "unsafe",
    "blocked",
    "attachment_blocked",
    "analysis_blocked"
  ];

  return blockingStatuses.includes(status);
}

function getShouldRunLLM0(analysisGate: unknown): boolean {
  return (
    getFirstBoolean(analysisGate, [
      ["shouldRunLLM0"],
      ["analysisGate", "shouldRunLLM0"],
      ["runDecisionPreAnalysis", "shouldRunLLM0"]
    ]) ?? false
  );
}

function getShouldRunSupportMessageAnalysis(
  lightweightMessageAnalysis: unknown
): boolean {
  return (
    getFirstBoolean(lightweightMessageAnalysis, [
      ["shouldRunSupportMessageAnalysis"],
      ["shouldRunSupportAnalysis"],
      ["shouldRunLLM1"],
      ["lightweightMessageAnalysis", "shouldRunSupportMessageAnalysis"],
      ["lightweightMessageAnalysis", "shouldRunSupportAnalysis"],
      ["lightweightMessageAnalysis", "shouldRunLLM1"],
      ["preAnalysisLlm0", "shouldRunLLM1"],
      ["routing", "shouldRunSupportMessageAnalysis"],
      ["routing", "shouldRunSupportAnalysis"],
      ["routing", "shouldRunLLM1"],
      ["decision", "shouldRunSupportMessageAnalysis"],
      ["decision", "shouldRunSupportAnalysis"],
      ["decision", "shouldRunLLM1"]
    ]) ?? false
  );
}

/**
 * Runs the message-analysis block.
 */
async function runMessageAnalysis(
  input: MessageAnalysisInput,
  steps: MessageAnalysisSteps = {}
): Promise<MessageAnalysisOutput> {
  assertValidMessageAnalysisInput(input);

  const messageAnalysisSteps: Required<MessageAnalysisSteps> = {
    runInputCleaning:
      steps.runInputCleaning ||
      createMissingStep<UnknownObject, UnknownObject>("runInputCleaning"),

    runAttachmentAnalysis:
      steps.runAttachmentAnalysis ||
      createMissingStep<UnknownObject, UnknownObject>("runAttachmentAnalysis"),

    runAnalysisGate:
      steps.runAnalysisGate ||
      createMissingStep<UnknownObject, UnknownObject>("runAnalysisGate"),

    runLightweightMessageAnalysis:
      steps.runLightweightMessageAnalysis ||
      createMissingStep<UnknownObject, UnknownObject>("runLightweightMessageAnalysis"),

    runSupportMessageAnalysis:
      steps.runSupportMessageAnalysis ||
      createMissingStep<UnknownObject, UnknownObject>("runSupportMessageAnalysis"),

    runSupportKnowledgeUpdate:
      steps.runSupportKnowledgeUpdate ||
      createMissingStep<UnknownObject, MessageAnalysisOutput>("runSupportKnowledgeUpdate")
  };

  const ticketMemoryBeforeTurn = input.ticketMemoryBeforeTurn || null;

  const baseInput = {
    latestUserMessage: input.latestUserMessage,
    attachments: input.attachments || [],
    ticketMemoryBeforeTurn,

    supportKnowledge: ticketMemoryBeforeTurn?.supportKnowledge,
    lastSupportKnowledgeDelta: ticketMemoryBeforeTurn?.lastSupportKnowledgeDelta || null,
    supportKnowledgeDeltaHistory:
      ticketMemoryBeforeTurn?.supportKnowledgeDeltaHistory || [],
    conversationLogs: ticketMemoryBeforeTurn?.conversationLogs || [],
    userInformations: ticketMemoryBeforeTurn?.userInformations || null,
    visibility: ticketMemoryBeforeTurn?.visibility,
    metadata: ticketMemoryBeforeTurn?.metadata
  };

  const messageAnalysisRouteJournal: MessageAnalysisRouteJournal = {
    executedSteps: [],
    skippedSteps: [],
    routeStopped: false,
    stopReason: null
  };

  /**
   * STEP 1 — Input cleaning
   *
   * runInputCleaning returns:
   * {
   *   inputClean: boolean;
   *   failedChecks: InputCleaningCheck[];
   * }
   */
  const inputCleaning = await messageAnalysisSteps.runInputCleaning({
    latestUserMessage: input.latestUserMessage,
    attachments: input.attachments || [],
    userInformations: ticketMemoryBeforeTurn?.userInformations || null,
    supportKnowledgeBeforeTurn: ticketMemoryBeforeTurn?.supportKnowledge || null
  }) as UnknownObject;

  messageAnalysisRouteJournal.executedSteps.push("inputCleaning");

  messageAnalysisRouteJournal.inputCleaning = {
    status: "completed",
    reason: isInputClean(inputCleaning)
      ? null
      : getInputCleaningStopReason(inputCleaning),
    inputClean: inputCleaning.inputClean,
    failedChecks: inputCleaning.failedChecks,
    output: inputCleaning
  };

  /**
   * BIG IF 1 — input cleaning blocks the route
   *
   * If inputClean === false, we do not run:
   * - attachmentAnalysis
   * - analysisGate
   * - lightweightMessageAnalysis
   * - supportMessageAnalysis
   *
   * We go directly to supportKnowledgeUpdate.
   */
  if (!isInputClean(inputCleaning)) {
    const stopReason = getInputCleaningStopReason(inputCleaning);

    const attachmentAnalysis = createSkippedOutput("input_cleaning_failed");
    const analysisGate = createSkippedOutput("input_cleaning_failed");
    const lightweightMessageAnalysis = createSkippedOutput("input_cleaning_failed");
    const supportMessageAnalysis = createSkippedOutput("input_cleaning_failed");

    messageAnalysisRouteJournal.routeStopped = true;
    messageAnalysisRouteJournal.stopReason = stopReason;

    messageAnalysisRouteJournal.skippedSteps.push(
      "attachmentAnalysis",
      "analysisGate",
      "lightweightMessageAnalysis",
      "supportMessageAnalysis"
    );

    messageAnalysisRouteJournal.attachmentAnalysis = {
      status: "skipped",
      reason: "input_cleaning_failed",
      output: attachmentAnalysis
    };

    messageAnalysisRouteJournal.analysisGate = {
      status: "skipped",
      reason: "input_cleaning_failed",
      output: analysisGate
    };

    messageAnalysisRouteJournal.lightweightMessageAnalysis = {
      status: "skipped",
      reason: "input_cleaning_failed",
      output: lightweightMessageAnalysis
    };

    messageAnalysisRouteJournal.supportMessageAnalysis = {
      status: "skipped",
      reason: "input_cleaning_failed",
      output: supportMessageAnalysis
    };

    const supportKnowledgeUpdateOutput =
      await messageAnalysisSteps.runSupportKnowledgeUpdate({
        ...baseInput,
        inputCleaning,
        attachmentAnalysis,
        analysisGate,
        lightweightMessageAnalysis,
        supportMessageAnalysis,

        /**
         * Temporary backward-compatible aliases.
         */
        inputClean: inputCleaning,
        runDecisionPreAnalysis: analysisGate,
        preAnalysisLlm0: lightweightMessageAnalysis,
        supportAnalysisLlm1: supportMessageAnalysis,

        messageAnalysisRouteJournal
      });

    const finalOutput = {
      ...supportKnowledgeUpdateOutput,
      messageAnalysisRouteJournal
    };

    assertValidMessageAnalysisOutput(finalOutput);

    return finalOutput;
  }

  /**
   * STEP 2 — Attachment analysis
   *
   * runAttachmentAnalysis may return:
   * - not_present
   * - not_analyzable
   * - analyzed
   * - analysis_not_available
   *
   * With the current implementation, none of these statuses should stop the route.
   * Future blocking statuses can be handled by shouldStopAfterAttachmentAnalysis.
   */
  const attachmentAnalysis =
    await messageAnalysisSteps.runAttachmentAnalysis({
      latestUserMessage: input.latestUserMessage,
      attachments: input.attachments || [],
      inputClean: inputCleaning,

      ...baseInput,
      inputCleaning,
      messageAnalysisRouteJournal
    }) as UnknownObject;

  messageAnalysisRouteJournal.executedSteps.push("attachmentAnalysis");

  const attachmentShouldStop = shouldStopAfterAttachmentAnalysis(attachmentAnalysis);

  messageAnalysisRouteJournal.attachmentAnalysis = {
    status: "completed",
    reason: getStepReason(attachmentAnalysis),
    shouldStopMessageAnalysis: attachmentShouldStop,
    output: attachmentAnalysis
  };

  /**
   * BIG IF 2 — attachment analysis blocks the route
   *
   * This is currently only for future cases such as:
   * - fraudulent attachment
   * - malicious attachment
   * - unsafe attachment
   *
   * It does not trigger for not_present or not_analyzable.
   */
  if (attachmentShouldStop) {
    const stopReason =
      getStepReason(attachmentAnalysis) ||
      "attachment_analysis_stopped_message_analysis";

    const analysisGate = createSkippedOutput("attachment_analysis_failed");
    const lightweightMessageAnalysis = createSkippedOutput("attachment_analysis_failed");
    const supportMessageAnalysis = createSkippedOutput("attachment_analysis_failed");

    messageAnalysisRouteJournal.routeStopped = true;
    messageAnalysisRouteJournal.stopReason = stopReason;

    messageAnalysisRouteJournal.skippedSteps.push(
      "analysisGate",
      "lightweightMessageAnalysis",
      "supportMessageAnalysis"
    );

    messageAnalysisRouteJournal.analysisGate = {
      status: "skipped",
      reason: "attachment_analysis_failed",
      output: analysisGate
    };

    messageAnalysisRouteJournal.lightweightMessageAnalysis = {
      status: "skipped",
      reason: "attachment_analysis_failed",
      output: lightweightMessageAnalysis
    };

    messageAnalysisRouteJournal.supportMessageAnalysis = {
      status: "skipped",
      reason: "attachment_analysis_failed",
      output: supportMessageAnalysis
    };

    const supportKnowledgeUpdateOutput =
      await messageAnalysisSteps.runSupportKnowledgeUpdate({
        ...baseInput,
        inputCleaning,
        attachmentAnalysis,
        analysisGate,
        lightweightMessageAnalysis,
        supportMessageAnalysis,

        /**
         * Temporary backward-compatible aliases.
         */
        inputClean: inputCleaning,
        runDecisionPreAnalysis: analysisGate,
        preAnalysisLlm0: lightweightMessageAnalysis,
        supportAnalysisLlm1: supportMessageAnalysis,

        messageAnalysisRouteJournal
      });

    const finalOutput = {
      ...supportKnowledgeUpdateOutput,
      messageAnalysisRouteJournal
    };

    assertValidMessageAnalysisOutput(finalOutput);

    return finalOutput;
  }

  /**
   * STEP 3 — Analysis gate
   *
   * Current output shape from runAnalysisGate/runPreanalysisDecision:
   * {
   *   runDecisionPreAnalysis: {
   *     shouldRunLLM0: boolean;
   *     reason: string;
   *     reasons: string[];
   *     detectedSignals: string[];
   *     detectedScopeBoundaries: string[];
   *   }
   * }
   */
  const analysisGate =
    await messageAnalysisSteps.runAnalysisGate({
      ...baseInput,
      inputCleaning,
      inputClean: inputCleaning,
      attachmentAnalysis,
      messageAnalysisRouteJournal
    }) as UnknownObject;

  const shouldRunLLM0 = getShouldRunLLM0(analysisGate);

  messageAnalysisRouteJournal.executedSteps.push("analysisGate");

  messageAnalysisRouteJournal.analysisGate = {
    status: "completed",
    reason: getStepReason(analysisGate),
    shouldRunLLM0,
    output: analysisGate
  };

  let lightweightMessageAnalysis: UnknownObject;
  let supportMessageAnalysis: UnknownObject;

  /**
   * BIG IF 3 — analysis gate routing
   *
   * If shouldRunLLM0 === true:
   * - run lightweightMessageAnalysis
   * - then only lightweightMessageAnalysis decides if supportMessageAnalysis runs
   *
   * If shouldRunLLM0 === false:
   * - skip lightweightMessageAnalysis
   * - run supportMessageAnalysis directly
   */
  if (shouldRunLLM0) {
    /**
     * STEP 4A — Lightweight message analysis
     */
    lightweightMessageAnalysis =
      await messageAnalysisSteps.runLightweightMessageAnalysis({
        ...baseInput,
        inputCleaning,
        inputClean: inputCleaning,
        attachmentAnalysis,
        analysisGate,

        /**
         * Temporary backward-compatible aliases.
         */
        runDecisionPreAnalysis: analysisGate,

        messageAnalysisRouteJournal
      }) as UnknownObject;

    messageAnalysisRouteJournal.executedSteps.push("lightweightMessageAnalysis");

    const shouldRunSupportMessageAnalysis =
      getShouldRunSupportMessageAnalysis(lightweightMessageAnalysis);

    messageAnalysisRouteJournal.lightweightMessageAnalysis = {
      status: "completed",
      reason: getStepReason(lightweightMessageAnalysis),
      shouldRunSupportMessageAnalysis,
      shouldRunLLM1: shouldRunSupportMessageAnalysis,
      output: lightweightMessageAnalysis
    };

    /**
     * BIG IF 4 — lightweight analysis decides if support analysis runs
     */
    if (shouldRunSupportMessageAnalysis) {
      /**
       * STEP 5A — Support message analysis after lightweight analysis
       */
      supportMessageAnalysis =
        await messageAnalysisSteps.runSupportMessageAnalysis({
          ...baseInput,
          inputCleaning,
          inputClean: inputCleaning,
          attachmentAnalysis,
          analysisGate,
          lightweightMessageAnalysis,

          /**
           * Temporary backward-compatible aliases.
           */
          runDecisionPreAnalysis: analysisGate,
          preAnalysisLlm0: lightweightMessageAnalysis,

          messageAnalysisRouteJournal
        }) as UnknownObject;

      messageAnalysisRouteJournal.executedSteps.push("supportMessageAnalysis");

      messageAnalysisRouteJournal.supportMessageAnalysis = {
        status: "completed",
        reason: getStepReason(supportMessageAnalysis),
        shouldRunSupportMessageAnalysis: true,
        shouldRunLLM1: true,
        output: supportMessageAnalysis
      };
    } else {
      supportMessageAnalysis = createSkippedOutput(
        "lightweight_message_analysis_decided_support_analysis_not_needed"
      );

      messageAnalysisRouteJournal.skippedSteps.push("supportMessageAnalysis");

      messageAnalysisRouteJournal.supportMessageAnalysis = {
        status: "skipped",
        reason: "lightweight_message_analysis_decided_support_analysis_not_needed",
        shouldRunSupportMessageAnalysis: false,
        shouldRunLLM1: false,
        output: supportMessageAnalysis
      };
    }
  } else {
    /**
     * STEP 4B — Lightweight message analysis skipped
     */
    lightweightMessageAnalysis = createSkippedOutput(
      "analysis_gate_skipped_lightweight_message_analysis"
    );

    messageAnalysisRouteJournal.skippedSteps.push("lightweightMessageAnalysis");

    messageAnalysisRouteJournal.lightweightMessageAnalysis = {
      status: "skipped",
      reason: "analysis_gate_skipped_lightweight_message_analysis",
      shouldRunSupportMessageAnalysis: true,
      shouldRunLLM1: true,
      output: lightweightMessageAnalysis
    };

    /**
     * STEP 5B — Support message analysis runs directly
     */
    supportMessageAnalysis =
      await messageAnalysisSteps.runSupportMessageAnalysis({
        ...baseInput,
        inputCleaning,
        inputClean: inputCleaning,
        attachmentAnalysis,
        analysisGate,
        lightweightMessageAnalysis,

        /**
         * Temporary backward-compatible aliases.
         */
        runDecisionPreAnalysis: analysisGate,
        preAnalysisLlm0: lightweightMessageAnalysis,

        messageAnalysisRouteJournal
      }) as UnknownObject;

    messageAnalysisRouteJournal.executedSteps.push("supportMessageAnalysis");

    messageAnalysisRouteJournal.supportMessageAnalysis = {
      status: "completed",
      reason: getStepReason(supportMessageAnalysis),
      shouldRunSupportMessageAnalysis: true,
      shouldRunLLM1: true,
      output: supportMessageAnalysis
    };
  }

  /**
   * STEP 6 — Support knowledge update
   */
  const supportKnowledgeUpdateOutput =
    await messageAnalysisSteps.runSupportKnowledgeUpdate({
      ...baseInput,
      inputCleaning,
      inputClean: inputCleaning,
      attachmentAnalysis,
      analysisGate,
      lightweightMessageAnalysis,
      supportMessageAnalysis,

      /**
       * Temporary backward-compatible aliases.
       */
      runDecisionPreAnalysis: analysisGate,
      preAnalysisLlm0: lightweightMessageAnalysis,
      supportAnalysisLlm1: supportMessageAnalysis,

      messageAnalysisRouteJournal
    });

  messageAnalysisRouteJournal.executedSteps.push("supportKnowledgeUpdate");

  messageAnalysisRouteJournal.supportKnowledgeUpdate = {
    status: "completed",
    reason: getStepReason(supportKnowledgeUpdateOutput),
    output: supportKnowledgeUpdateOutput
  };

  const finalOutput = {
    ...supportKnowledgeUpdateOutput,
    messageAnalysisRouteJournal
  };

  assertValidMessageAnalysisOutput(finalOutput);

  return finalOutput;
}

export {
  runMessageAnalysis,
  assertValidMessageAnalysisInput,
  assertValidMessageAnalysisOutput
};

export type {
  MessageAnalysisInput,
  MessageAnalysisSteps,
  MessageAnalysisOutput,
  MessageAnalysisRouteJournal,
  SupportKnowledge,
  SupportKnowledgeDelta,
  TicketMemory
};