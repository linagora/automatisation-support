/**
 * Message Analysis
 *
 * This file is the local orchestrator of the message-analysis block.
 *
 * Its responsibility is to analyze the latest user message with context and
 * produce a structured output: currentAnalysisOutput.
 *
 * INPUTS:
 * - latestUserMessage
 * - attachments
 * - previousAnalysisOutput
 * - conversationLogs
 * - attemptHistory
 * - userInformations
 * - dataCollectorProcessing
 *
 * OUTPUT:
 * - currentAnalysisOutput
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
 *    OUTPUTS - currentAnalysisOutput
 */

/**
 * Creates a placeholder function for message-analysis steps that are not implemented yet.
 *
 * @param {string} stepName - Name of the missing message-analysis step.
 * @returns {Function}
 * A function that throws an explicit "not implemented" error.
 */
function createMissingStep(stepName) {
  return function missingStep() {
    throw new Error(`${stepName} is not implemented yet`);
  };
}

/**
 * Creates the initial decision route for the message-analysis flow.
 *
 * This object is updated progressively by each step.
 *
 * @returns {Object}
 */
function createInitialDecisionRoute() {
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
 *
 * @param {Object} currentDecisionRoute - Current decision route.
 * @param {Object} updates - Fields to update.
 * @returns {Object}
 * Updated decision route.
 */
function updateDecisionRoute(currentDecisionRoute, updates) {
  return {
    ...currentDecisionRoute,
    ...updates
  };
}

/**
 * Validates the minimum input/output contract of runMessageAnalysis.
 *
 * This validation is intentionally lightweight.
 * It only checks the fields needed to safely run the local orchestrator.
 *
 * @param {Object} input - Message-analysis input.
 * @returns {void}
 */
function assertValidMessageAnalysisInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("runMessageAnalysis input must be an object");
  }

  const latestUserMessageIsValid =
    typeof input.latestUserMessage === "string" ||
    (
      input.latestUserMessage &&
      typeof input.latestUserMessage === "object" &&
      !Array.isArray(input.latestUserMessage)
    );

  if (!latestUserMessageIsValid) {
    throw new Error("latestUserMessage must be a string or an object");
  }

  if (input.attachments !== undefined && !Array.isArray(input.attachments)) {
    throw new Error("attachments must be an array when provided");
  }

  if (input.conversationLogs !== undefined && !Array.isArray(input.conversationLogs)) {
    throw new Error("conversationLogs must be an array when provided");
  }

  if (input.attemptHistory !== undefined && !Array.isArray(input.attemptHistory)) {
    throw new Error("attemptHistory must be an array when provided");
  }

  if (
    input.dataCollectorProcessing !== undefined &&
    (
      !input.dataCollectorProcessing ||
      typeof input.dataCollectorProcessing !== "object" ||
      Array.isArray(input.dataCollectorProcessing)
    )
  ) {
    throw new Error("dataCollectorProcessing must be an object when provided");
  }
}

function assertValidCurrentAnalysisOutput(currentAnalysisOutput) {
  if (
    !currentAnalysisOutput ||
    typeof currentAnalysisOutput !== "object" ||
    Array.isArray(currentAnalysisOutput)
  ) {
    throw new Error("currentAnalysisOutput must be an object");
  }
}

/**
 * Runs the message-analysis block.
 *
 * @param {Object} input - Message-analysis input.
 * @param {Object|string} input.latestUserMessage - Latest user message to analyze.
 * @param {Array<Object>} [input.attachments] - Optional message attachments.
 * @param {Object|null} [input.previousAnalysisOutput] - Previous structured analysis if available.
 * @param {Array<Object>} [input.conversationLogs] - Conversation history.
 * @param {Array<Object>} [input.attemptHistory] - Previous actions attempted by the user or support system.
 * @param {Object|null} [input.userInformations] - User metadata and context.
 * @param {Object} [input.dataCollectorProcessing] - Open object used to collect useful processing data.
 *
 * @param {Object} [steps] - Optional injected message-analysis steps, mainly used for tests.
 * @param {Function} [steps.runDeterministicRouting] - Detects obvious spam, abuse, empty or out-of-scope cases.
 * @param {Function} [steps.runAttachmentAnalysis] - Analyzes attachments if needed.
 * @param {Function} [steps.runAnalysisRouting] - Decides which analysis path should be used.
 * @param {Function} [steps.runPreAnalysis] - Runs lightweight pre-analysis if needed.
 * @param {Function} [steps.runFullAnalysis] - Runs full support analysis if needed.
 * @param {Function} [steps.assembleCurrentAnalysisOutput] - Builds the final currentAnalysisOutput.
 *
 * @returns {Object}
 * currentAnalysisOutput
 */
function runMessageAnalysis(input, steps = {}) {
  assertValidMessageAnalysisInput(input);
  
  const messageAnalysisSteps = {
    runDeterministicRouting:
      steps.runDeterministicRouting || createMissingStep("runDeterministicRouting"),

    runAttachmentAnalysis:
      steps.runAttachmentAnalysis || createMissingStep("runAttachmentAnalysis"),

    runAnalysisRouting:
      steps.runAnalysisRouting || createMissingStep("runAnalysisRouting"),

    runPreAnalysis:
      steps.runPreAnalysis || createMissingStep("runPreAnalysis"),

    runFullAnalysis:
      steps.runFullAnalysis || createMissingStep("runFullAnalysis"),

    assembleCurrentAnalysisOutput:
      steps.assembleCurrentAnalysisOutput || createMissingStep("assembleCurrentAnalysisOutput")
  };

  let decisionRoute = createInitialDecisionRoute();

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
    dataCollectorProcessing: input.dataCollectorProcessing,
    decisionRoute
  });

  decisionRoute = updateDecisionRoute(decisionRoute, {
    shouldAnalyzeMessage:
      deterministicRoutingResult.shouldAnalyzeMessage ?? decisionRoute.shouldAnalyzeMessage,

    shouldRunAttachmentAnalysis:
      deterministicRoutingResult.shouldRunAttachmentAnalysis ?? decisionRoute.shouldRunAttachmentAnalysis,

    reason:
      deterministicRoutingResult.reason ?? decisionRoute.reason
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
    dataCollectorProcessing: input.dataCollectorProcessing,
    decisionRoute,
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
    dataCollectorProcessing: input.dataCollectorProcessing,
    decisionRoute,
    deterministicRoutingResult,
    attachmentAnalysisResult
  });

  decisionRoute = updateDecisionRoute(decisionRoute, {
    shouldRunPreAnalysis:
      analysisRoutingResult.shouldRunPreAnalysis ?? decisionRoute.shouldRunPreAnalysis,

    shouldRunFullAnalysis:
      analysisRoutingResult.shouldRunFullAnalysis ?? decisionRoute.shouldRunFullAnalysis,

    reason:
      analysisRoutingResult.reason ?? decisionRoute.reason
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
    dataCollectorProcessing: input.dataCollectorProcessing,
    decisionRoute,
    deterministicRoutingResult,
    attachmentAnalysisResult,
    analysisRoutingResult
  });

  decisionRoute = updateDecisionRoute(decisionRoute, {
    shouldRunFullAnalysis:
      preAnalysisResult.shouldRunFullAnalysis ?? decisionRoute.shouldRunFullAnalysis,

    reason:
      preAnalysisResult.reason ?? decisionRoute.reason
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
    dataCollectorProcessing: input.dataCollectorProcessing,
    decisionRoute,
    deterministicRoutingResult,
    attachmentAnalysisResult,
    analysisRoutingResult,
    preAnalysisResult
  });

  /**
   * Step 6: Analysis assembler
   */
  const currentAnalysisOutput = messageAnalysisSteps.assembleCurrentAnalysisOutput({
    latestUserMessage: input.latestUserMessage,
    attachments: input.attachments,
    previousAnalysisOutput: input.previousAnalysisOutput,
    conversationLogs: input.conversationLogs,
    attemptHistory: input.attemptHistory,
    userInformations: input.userInformations,
    dataCollectorProcessing: input.dataCollectorProcessing,
    decisionRoute,
    deterministicRoutingResult,
    attachmentAnalysisResult,
    analysisRoutingResult,
    preAnalysisResult,
    fullAnalysisResult
  });
  
  assertValidCurrentAnalysisOutput(currentAnalysisOutput);

  return currentAnalysisOutput;
}

module.exports = {
  runMessageAnalysis,
  createInitialDecisionRoute,
  updateDecisionRoute,
  assertValidMessageAnalysisInput,
  assertValidCurrentAnalysisOutput
};