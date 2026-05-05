/**
 * Message Analysis
 *
 * This file is the local orchestrator of the message-analysis block.
 *
 * Its responsibility is to analyze the latest user message with context and
 * produce a structured output: currentAnalysisOutput, including analysisDelta.
 *
 * INPUTS:
 * - latestUserMessage
 * - attachments
 * - previousAnalysisOutput
 * - conversationLogs
 * - attemptHistory
 * - userInformations
 *
 * OUTPUT:
 * - currentAnalysisOutput, including analysisDelta
 *
 * Internal steps:
 *
 * 1. Deterministic routing
 *    Detects obvious cases such as spam, abuse, empty message, or clear out-of-scope message.
 *    OUTPUTS - deterministicRoutingResult
 *
 * 2. Attachment analysis
 *    Analyzes attachments if needed.
 *    OUTPUTS - attachmentAnalysisResult
 *
 * 3. Analysis routing
 *    Decides whether we should run pre-analysis, full analysis, or both.
 *    OUTPUTS - analysisRoutingResult
 *
 * 4. Pre-analysis manager
 *    Runs the lightweight pre-analysis step if needed.
 *    OUTPUTS - preAnalysisResult
 *
 * 5. Full-analysis manager
 *    Runs the full support analysis step if needed.
 *    OUTPUTS - fullAnalysisResult
 *
 * 6. Analysis assembler
 *    Builds the final currentAnalysisOutput from all intermediate results.
 *    It normalizes the current analysis and computes analysisDelta by comparing
 *    the current analysis with previousAnalysisOutput.
 *    OUTPUTS - currentAnalysisOutput, including analysisDelta
 */

type UnknownObject = Record<string, unknown>;

type MessageAnalysisStep<TInput, TOutput> = (input: TInput) => TOutput;

interface MessageAnalysisInput {
  latestUserMessage: string | UnknownObject;
  attachments?: UnknownObject[];
  previousAnalysisOutput?: UnknownObject | null;
  conversationLogs?: UnknownObject[];
  attemptHistory?: UnknownObject[];
  userInformations?: UnknownObject | null;
}

interface AnalysisDelta {
  hasNewInformation: boolean;
  newTopics: UnknownObject[];
  updatedTopics: UnknownObject[];
  resolvedTopics: UnknownObject[];
  newSignals: UnknownObject[];
  newScopeBoundaries: UnknownObject[];
  warningComprehensionChanged?: boolean;
  [key: string]: unknown;
}

interface CurrentAnalysisOutput {
  analysisDelta: AnalysisDelta;
  [key: string]: unknown;
}

interface DecisionRouteMessageAnalysis {
  shouldAnalyzeMessage: boolean;
  shouldRunAttachmentAnalysis: boolean;
  shouldRunPreAnalysis: boolean;
  shouldRunFullAnalysis: boolean;
  reason: string | null;
}

interface DeterministicRoutingResult {
  shouldAnalyzeMessage?: boolean;
  shouldRunAttachmentAnalysis?: boolean;
  reason?: string | null;
  [key: string]: unknown;
}

interface AnalysisRoutingResult {
  shouldRunPreAnalysis?: boolean;
  shouldRunFullAnalysis?: boolean;
  reason?: string | null;
  [key: string]: unknown;
}

interface PreAnalysisResult {
  shouldRunFullAnalysis?: boolean;
  reason?: string | null;
  [key: string]: unknown;
}

interface MessageAnalysisSteps {
  runDeterministicRouting?: MessageAnalysisStep<UnknownObject, DeterministicRoutingResult>;
  runAttachmentAnalysis?: MessageAnalysisStep<UnknownObject, UnknownObject>;
  runAnalysisRouting?: MessageAnalysisStep<UnknownObject, AnalysisRoutingResult>;
  runPreAnalysis?: MessageAnalysisStep<UnknownObject, PreAnalysisResult>;
  runFullAnalysis?: MessageAnalysisStep<UnknownObject, UnknownObject>;
  assembleCurrentAnalysisOutput?: MessageAnalysisStep<UnknownObject, CurrentAnalysisOutput>;
}

/**
 * Creates a placeholder function for message-analysis steps that are not implemented yet.
 */
function createMissingStep<TInput, TOutput>(stepName: string): MessageAnalysisStep<TInput, TOutput> {
  return function missingStep(): never {
    throw new Error(`${stepName} is not implemented yet`);
  };
}

/**
 * Creates the initial decision route for the message-analysis flow.
 *
 * This object is updated progressively by each step.
 */
function createInitialDecisionRoute(): DecisionRouteMessageAnalysis {
  return {
    shouldAnalyzeMessage: true,
    shouldRunAttachmentAnalysis: false,
    shouldRunPreAnalysis: false,
    shouldRunFullAnalysis: false,
    reason: null
  };
}

/**
 * Updates the decision route without mutating the previous object.
 */
function updateDecisionRoute(
  currentDecisionRoute: DecisionRouteMessageAnalysis,
  updates: Partial<DecisionRouteMessageAnalysis>
): DecisionRouteMessageAnalysis {
  return {
    ...currentDecisionRoute,
    ...updates
  };
}

/**
 * Validates the minimum input contract of runMessageAnalysis.
 *
 * This validation is intentionally lightweight.
 * It only checks the fields needed to safely run the local orchestrator.
 */
function assertValidMessageAnalysisInput(input: unknown): asserts input is MessageAnalysisInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("runMessageAnalysis input must be an object");
  }

  const messageAnalysisInput = input as Partial<MessageAnalysisInput>;

  const latestUserMessageIsValid =
    typeof messageAnalysisInput.latestUserMessage === "string" ||
    (
      messageAnalysisInput.latestUserMessage !== null &&
      typeof messageAnalysisInput.latestUserMessage === "object" &&
      !Array.isArray(messageAnalysisInput.latestUserMessage)
    );

  if (!latestUserMessageIsValid) {
    throw new Error("latestUserMessage must be a string or an object");
  }

  if (
    messageAnalysisInput.attachments !== undefined &&
    !Array.isArray(messageAnalysisInput.attachments)
  ) {
    throw new Error("attachments must be an array when provided");
  }

  if (
    messageAnalysisInput.conversationLogs !== undefined &&
    !Array.isArray(messageAnalysisInput.conversationLogs)
  ) {
    throw new Error("conversationLogs must be an array when provided");
  }

  if (
    messageAnalysisInput.attemptHistory !== undefined &&
    !Array.isArray(messageAnalysisInput.attemptHistory)
  ) {
    throw new Error("attemptHistory must be an array when provided");
  }
}

/**
 * Validates the analysisDelta contract.
 */
function assertValidAnalysisDelta(analysisDelta: unknown): asserts analysisDelta is AnalysisDelta {
  if (
    !analysisDelta ||
    typeof analysisDelta !== "object" ||
    Array.isArray(analysisDelta)
  ) {
    throw new Error("analysisDelta must be an object");
  }

  const analysisDeltaOutput = analysisDelta as Partial<AnalysisDelta>;

  if (typeof analysisDeltaOutput.hasNewInformation !== "boolean") {
    throw new Error("analysisDelta.hasNewInformation must be a boolean");
  }

  if (!Array.isArray(analysisDeltaOutput.newTopics)) {
    throw new Error("analysisDelta.newTopics must be an array");
  }

  if (!Array.isArray(analysisDeltaOutput.updatedTopics)) {
    throw new Error("analysisDelta.updatedTopics must be an array");
  }

  if (!Array.isArray(analysisDeltaOutput.resolvedTopics)) {
    throw new Error("analysisDelta.resolvedTopics must be an array");
  }

  if (!Array.isArray(analysisDeltaOutput.newSignals)) {
    throw new Error("analysisDelta.newSignals must be an array");
  }

  if (!Array.isArray(analysisDeltaOutput.newScopeBoundaries)) {
    throw new Error("analysisDelta.newScopeBoundaries must be an array");
  }

  if (
    analysisDeltaOutput.warningComprehensionChanged !== undefined &&
    typeof analysisDeltaOutput.warningComprehensionChanged !== "boolean"
  ) {
    throw new Error("analysisDelta.warningComprehensionChanged must be a boolean when provided");
  }
}

/**
 * Validates the output contract of runMessageAnalysis.
 */
function assertValidCurrentAnalysisOutput(
  currentAnalysisOutput: unknown
): asserts currentAnalysisOutput is CurrentAnalysisOutput {
  if (
    !currentAnalysisOutput ||
    typeof currentAnalysisOutput !== "object" ||
    Array.isArray(currentAnalysisOutput)
  ) {
    throw new Error("currentAnalysisOutput must be an object");
  }

  const currentAnalysis = currentAnalysisOutput as Partial<CurrentAnalysisOutput>;

  assertValidAnalysisDelta(currentAnalysis.analysisDelta);
}

/**
 * Runs the message-analysis block.
 */
function runMessageAnalysis(
  input: MessageAnalysisInput,
  steps: MessageAnalysisSteps = {}
): CurrentAnalysisOutput {
  assertValidMessageAnalysisInput(input);

  const messageAnalysisSteps: Required<MessageAnalysisSteps> = {
    runDeterministicRouting:
      steps.runDeterministicRouting ||
      createMissingStep<UnknownObject, DeterministicRoutingResult>("runDeterministicRouting"),

    runAttachmentAnalysis:
      steps.runAttachmentAnalysis ||
      createMissingStep<UnknownObject, UnknownObject>("runAttachmentAnalysis"),

    runAnalysisRouting:
      steps.runAnalysisRouting ||
      createMissingStep<UnknownObject, AnalysisRoutingResult>("runAnalysisRouting"),

    runPreAnalysis:
      steps.runPreAnalysis ||
      createMissingStep<UnknownObject, PreAnalysisResult>("runPreAnalysis"),

    runFullAnalysis:
      steps.runFullAnalysis ||
      createMissingStep<UnknownObject, UnknownObject>("runFullAnalysis"),

    assembleCurrentAnalysisOutput:
      steps.assembleCurrentAnalysisOutput ||
      createMissingStep<UnknownObject, CurrentAnalysisOutput>("assembleCurrentAnalysisOutput")
  };

  let decisionRouteMessageAnalysis = createInitialDecisionRoute();

  /**
   * Step 1: Deterministic routing
   */
  const deterministicRoutingResult = messageAnalysisSteps.runDeterministicRouting({
    latestUserMessage: input.latestUserMessage,
    attachments: input.attachments,
    previousAnalysisOutput: input.previousAnalysisOutput,
    conversationLogs: input.conversationLogs,
    attemptHistory: input.attemptHistory,
    userInformations: input.userInformations,
    decisionRouteMessageAnalysis
  });

  decisionRouteMessageAnalysis = updateDecisionRoute(decisionRouteMessageAnalysis, {
    shouldAnalyzeMessage:
      deterministicRoutingResult.shouldAnalyzeMessage ??
      decisionRouteMessageAnalysis.shouldAnalyzeMessage,

    shouldRunAttachmentAnalysis:
      deterministicRoutingResult.shouldRunAttachmentAnalysis ??
      decisionRouteMessageAnalysis.shouldRunAttachmentAnalysis,

    reason:
      deterministicRoutingResult.reason ??
      decisionRouteMessageAnalysis.reason
  });

  /**
   * Step 2: Attachment analysis
   *
   * This step is always called, but it can return a skipped result if
   * decisionRoute.shouldRunAttachmentAnalysis is false.
   */
  const attachmentAnalysisResult = messageAnalysisSteps.runAttachmentAnalysis({
    latestUserMessage: input.latestUserMessage,
    attachments: input.attachments,
    previousAnalysisOutput: input.previousAnalysisOutput,
    conversationLogs: input.conversationLogs,
    attemptHistory: input.attemptHistory,
    userInformations: input.userInformations,
    decisionRoute: decisionRouteMessageAnalysis,
    deterministicRoutingResult
  });

  /**
   * Step 3: Analysis routing
   */
  const analysisRoutingResult = messageAnalysisSteps.runAnalysisRouting({
    latestUserMessage: input.latestUserMessage,
    attachments: input.attachments,
    previousAnalysisOutput: input.previousAnalysisOutput,
    conversationLogs: input.conversationLogs,
    attemptHistory: input.attemptHistory,
    userInformations: input.userInformations,
    decisionRoute: decisionRouteMessageAnalysis,
    deterministicRoutingResult,
    attachmentAnalysisResult
  });

  decisionRouteMessageAnalysis = updateDecisionRoute(decisionRouteMessageAnalysis, {
    shouldRunPreAnalysis:
      analysisRoutingResult.shouldRunPreAnalysis ??
      decisionRouteMessageAnalysis.shouldRunPreAnalysis,

    shouldRunFullAnalysis:
      analysisRoutingResult.shouldRunFullAnalysis ??
      decisionRouteMessageAnalysis.shouldRunFullAnalysis,

    reason:
      analysisRoutingResult.reason ??
      decisionRouteMessageAnalysis.reason
  });

  /**
   * Step 4: Pre-analysis manager
   *
   * This step is always called, but it can return a skipped result if
   * decisionRoute.shouldRunPreAnalysis is false.
   */
  const preAnalysisResult = messageAnalysisSteps.runPreAnalysis({
    latestUserMessage: input.latestUserMessage,
    attachments: input.attachments,
    previousAnalysisOutput: input.previousAnalysisOutput,
    conversationLogs: input.conversationLogs,
    attemptHistory: input.attemptHistory,
    userInformations: input.userInformations,
    decisionRoute: decisionRouteMessageAnalysis,
    deterministicRoutingResult,
    attachmentAnalysisResult,
    analysisRoutingResult
  });

  decisionRouteMessageAnalysis = updateDecisionRoute(decisionRouteMessageAnalysis, {
    shouldRunFullAnalysis:
      preAnalysisResult.shouldRunFullAnalysis ??
      decisionRouteMessageAnalysis.shouldRunFullAnalysis,

    reason:
      preAnalysisResult.reason ??
      decisionRouteMessageAnalysis.reason
  });

  /**
   * Step 5: Full-analysis manager
   *
   * This step is always called, but it can return a skipped result if
   * decisionRoute.shouldRunFullAnalysis is false.
   */
  const fullAnalysisResult = messageAnalysisSteps.runFullAnalysis({
    latestUserMessage: input.latestUserMessage,
    attachments: input.attachments,
    previousAnalysisOutput: input.previousAnalysisOutput,
    conversationLogs: input.conversationLogs,
    attemptHistory: input.attemptHistory,
    userInformations: input.userInformations,
    decisionRoute: decisionRouteMessageAnalysis,
    deterministicRoutingResult,
    attachmentAnalysisResult,
    analysisRoutingResult,
    preAnalysisResult
  });

  /**
   * Step 6: Analysis assembler
   *
   * This step is responsible for producing the final currentAnalysisOutput,
   * including analysisDelta.
   */
  const currentAnalysisOutput = messageAnalysisSteps.assembleCurrentAnalysisOutput({
    latestUserMessage: input.latestUserMessage,
    attachments: input.attachments,
    previousAnalysisOutput: input.previousAnalysisOutput,
    conversationLogs: input.conversationLogs,
    attemptHistory: input.attemptHistory,
    userInformations: input.userInformations,
    decisionRoute: decisionRouteMessageAnalysis,
    deterministicRoutingResult,
    attachmentAnalysisResult,
    analysisRoutingResult,
    preAnalysisResult,
    fullAnalysisResult
  });

  assertValidCurrentAnalysisOutput(currentAnalysisOutput);

  return currentAnalysisOutput;
}

export {
  runMessageAnalysis,
  createInitialDecisionRoute,
  updateDecisionRoute,
  assertValidMessageAnalysisInput,
  assertValidAnalysisDelta,
  assertValidCurrentAnalysisOutput
};

export type {
  MessageAnalysisInput,
  MessageAnalysisSteps,
  AnalysisDelta,
  CurrentAnalysisOutput,
  DecisionRouteMessageAnalysis,
  DeterministicRoutingResult,
  AnalysisRoutingResult,
  PreAnalysisResult
};