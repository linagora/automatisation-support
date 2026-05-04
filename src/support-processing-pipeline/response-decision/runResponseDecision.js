/**
 * Searching Decision
 *
 * This file is the local orchestrator of the searching-decision block.
 *
 * This block applies deterministic rules to decide whether the pipeline should
 * search for a solution in the knowledge base.
 *
 * It does not retrieve any solution.
 * It only decides if solution retrieval is useful and relevant at this point.
 *
 * INPUTS:
 * - currentAnalysisOutput
 * - previousAnalysisOutput
 * - conversationLogs
 * - attemptHistory
 * - userInformations
 * - dataCollectorProcessing
 *
 * OUTPUT:
 * - decisionSearchingSolution (true/false)
 *
 * Internal steps:
 *
 * 1. Topic routing
 *    Checks if the current analysis contains at least one exploitable support topic.
 *    INPUTS  - currentAnalysisOutput
 *    OUTPUTS - topicRoutingResult
 *
 * 2. Solution likelihood evaluation
 *    For each topic, evaluates whether a solution is likely to exist in the knowledge base.
 *    INPUTS  - currentAnalysisOutput
 *    OUTPUTS - solutionLikelihoodResult
 *
 * 3. Topic qualification evaluation
 *    For each topic, evaluates whether the topic contains enough information to search properly.
 *    INPUTS  - currentAnalysisOutput
 *    OUTPUTS - topicsQualificationResult
 *
 * 4. Helpfulness evaluation
 *    For each topic, evaluates whether searching for a solution is likely to help the user,
 *    according to conversation history, previous attempts, previous analysis and user context.
 *    INPUTS  - currentAnalysisOutput, previousAnalysisOutput, conversationLogs, attemptHistory, userInformations
 *    OUTPUTS - helpfulnessEvaluationResult
 *
 * 5. Final searching decision
 *    Combines all previous evaluations and returns the final boolean decision.
 *    INPUTS  - topicRoutingResult, solutionLikelihoodResult, topicsQualificationResult, helpfulnessEvaluationResult
 *    OUTPUTS - decisionSearchingSolution
 */

/**
 * Creates a placeholder function for searching-decision steps that are not implemented yet.
 *
 * @param {string} stepName - Name of the missing searching-decision step.
 * @returns {Function}
 * A function that throws an explicit "not implemented" error.
 */
function createMissingStep(stepName) {
  return function missingStep() {
    throw new Error(`${stepName} is not implemented yet`);
  };
}

/**
 * Creates the initial decision route for the searching-decision flow.
 *
 * This object is updated progressively by each step.
 *
 * @returns {Object}
 */
function createInitialSearchingDecisionRoute() {
  return {
    topicIsPresent: null,
    shouldEvaluateSolutionLikelihood: true,
    shouldEvaluateTopicQualification: true,
    shouldEvaluateHelpfulness: true,
    shouldCalculateFinalDecision: true,
    stopReason: null
  };
}

/**
 * Updates the searching-decision route without mutating the previous object.
 *
 * @param {Object} currentDecisionRoute - Current decision route.
 * @param {Object} updates - Fields to update.
 * @returns {Object}
 * Updated decision route.
 */
function updateSearchingDecisionRoute(currentDecisionRoute, updates) {
  return {
    ...currentDecisionRoute,
    ...updates
  };
}

/**
 * Validates the minimum input contract of runSearchingDecision.
 *
 * This validation is intentionally lightweight.
 * It only checks the fields needed to safely run the local orchestrator.
 *
 * @param {Object} input - Searching-decision input.
 * @returns {void}
 */
function assertValidSearchingDecisionInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("runSearchingDecision input must be an object");
  }

  if (
    !input.currentAnalysisOutput ||
    typeof input.currentAnalysisOutput !== "object" ||
    Array.isArray(input.currentAnalysisOutput)
  ) {
    throw new Error("currentAnalysisOutput must be an object");
  }

  if (
    input.previousAnalysisOutput !== undefined &&
    input.previousAnalysisOutput !== null &&
    (
      typeof input.previousAnalysisOutput !== "object" ||
      Array.isArray(input.previousAnalysisOutput)
    )
  ) {
    throw new Error("previousAnalysisOutput must be an object or null when provided");
  }

  if (input.conversationLogs !== undefined && !Array.isArray(input.conversationLogs)) {
    throw new Error("conversationLogs must be an array when provided");
  }

  if (input.attemptHistory !== undefined && !Array.isArray(input.attemptHistory)) {
    throw new Error("attemptHistory must be an array when provided");
  }

  if (
    input.userInformations !== undefined &&
    input.userInformations !== null &&
    (
      typeof input.userInformations !== "object" ||
      Array.isArray(input.userInformations)
    )
  ) {
    throw new Error("userInformations must be an object or null when provided");
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

/**
 * Validates the output contract of runSearchingDecision.
 *
 * @param {boolean} decisionSearchingSolution - Final searching decision.
 * @returns {void}
 */
function assertValidDecisionSearchingSolution(decisionSearchingSolution) {
  if (typeof decisionSearchingSolution !== "boolean") {
    throw new Error("decisionSearchingSolution must be a boolean");
  }
}

/**
 * Runs the searching-decision block.
 *
 * @param {Object} input - Searching-decision input.
 * @param {Object} input.currentAnalysisOutput - Current structured analysis.
 * @param {Object|null} [input.previousAnalysisOutput] - Previous structured analysis if available.
 * @param {Array<Object>} [input.conversationLogs] - Conversation history.
 * @param {Array<Object>} [input.attemptHistory] - Previous actions attempted by the user or support system.
 * @param {Object|null} [input.userInformations] - User metadata and context.
 * @param {Object} [input.dataCollectorProcessing] - Open object used to collect useful processing data.
 *
 * @param {Object} [steps] - Optional injected searching-decision steps, mainly used for tests.
 * @param {Function} [steps.runTopicRouting] - Checks if at least one exploitable support topic is present.
 * @param {Function} [steps.evaluateSolutionLikelihood] - Evaluates if solutions are likely to exist.
 * @param {Function} [steps.evaluateTopicQualification] - Evaluates if topics are sufficiently qualified.
 * @param {Function} [steps.evaluateHelpfulness] - Evaluates if searching is likely to help the user.
 * @param {Function} [steps.calculateSearchingDecision] - Combines evaluations into the final boolean decision.
 *
 * @returns {boolean}
 * decisionSearchingSolution
 */
ffunction runSearchingDecision(input, steps = {}) {
  assertValidSearchingDecisionInput(input);

  const searchingDecisionSteps = {
    runTopicRouting:
      steps.runTopicRouting || createMissingStep("runTopicRouting"),

    evaluateSolutionLikelihood:
      steps.evaluateSolutionLikelihood || createMissingStep("evaluateSolutionLikelihood"),

    evaluateTopicQualification:
      steps.evaluateTopicQualification || createMissingStep("evaluateTopicQualification"),

    evaluateHelpfulness:
      steps.evaluateHelpfulness || createMissingStep("evaluateHelpfulness"),

    calculateSearchingDecision:
      steps.calculateSearchingDecision || createMissingStep("calculateSearchingDecision")
  };

  let decisionRouteSearchingDecision = createInitialSearchingDecisionRoute();

  /**
   * Step 1: Topic routing
   *
   * At this step, we only know whether at least one exploitable topic is present.
   */
  const topicRoutingResult = searchingDecisionSteps.runTopicRouting({
    currentAnalysisOutput: input.currentAnalysisOutput,
    previousAnalysisOutput: input.previousAnalysisOutput,
    conversationLogs: input.conversationLogs,
    attemptHistory: input.attemptHistory,
    userInformations: input.userInformations,
    dataCollectorProcessing: input.dataCollectorProcessing,
    decisionRouteSearchingDecision
  });

  decisionRouteSearchingDecision = updateSearchingDecisionRoute(decisionRouteSearchingDecision, {
    topicIsPresent:
      topicRoutingResult.topicIsPresent ?? decisionRouteSearchingDecision.topicIsPresent,

    stopReason:
      topicRoutingResult.stopReason ?? decisionRouteSearchingDecision.stopReason
  });

  /**
   * Step 2: Solution likelihood evaluation
   *
   * This step is always called, but it can return a skipped result if
   * decisionRouteSearchingDecision.topicIsPresent is false.
   */
  const solutionLikelihoodResult = searchingDecisionSteps.evaluateSolutionLikelihood({
    currentAnalysisOutput: input.currentAnalysisOutput,
    previousAnalysisOutput: input.previousAnalysisOutput,
    conversationLogs: input.conversationLogs,
    attemptHistory: input.attemptHistory,
    userInformations: input.userInformations,
    dataCollectorProcessing: input.dataCollectorProcessing,
    decisionRouteSearchingDecision,
    topicRoutingResult
  });

  decisionRouteSearchingDecision = updateSearchingDecisionRoute(decisionRouteSearchingDecision, {
    shouldEvaluateSolutionLikelihood:
      solutionLikelihoodResult.shouldEvaluateSolutionLikelihood ??
      decisionRouteSearchingDecision.shouldEvaluateSolutionLikelihood,

    stopReason:
      solutionLikelihoodResult.stopReason ?? decisionRouteSearchingDecision.stopReason
  });

  /**
   * Step 3: Topic qualification evaluation
   *
   * This step is always called, but it can return a skipped result if
   * decisionRouteSearchingDecision.shouldEvaluateSolutionLikelihood is false.
   */
  const topicsQualificationResult = searchingDecisionSteps.evaluateTopicQualification({
    currentAnalysisOutput: input.currentAnalysisOutput,
    previousAnalysisOutput: input.previousAnalysisOutput,
    conversationLogs: input.conversationLogs,
    attemptHistory: input.attemptHistory,
    userInformations: input.userInformations,
    dataCollectorProcessing: input.dataCollectorProcessing,
    decisionRouteSearchingDecision,
    topicRoutingResult,
    solutionLikelihoodResult
  });

  decisionRouteSearchingDecision = updateSearchingDecisionRoute(decisionRouteSearchingDecision, {
    shouldEvaluateTopicQualification:
      topicsQualificationResult.shouldEvaluateTopicQualification ??
      decisionRouteSearchingDecision.shouldEvaluateTopicQualification,

    stopReason:
      topicsQualificationResult.stopReason ?? decisionRouteSearchingDecision.stopReason
  });

  /**
   * Step 4: Helpfulness evaluation
   *
   * This step is always called, but it can return a skipped result if
   * decisionRouteSearchingDecision.shouldEvaluateTopicQualification is false.
   */
  const helpfulnessEvaluationResult = searchingDecisionSteps.evaluateHelpfulness({
    currentAnalysisOutput: input.currentAnalysisOutput,
    previousAnalysisOutput: input.previousAnalysisOutput,
    conversationLogs: input.conversationLogs,
    attemptHistory: input.attemptHistory,
    userInformations: input.userInformations,
    dataCollectorProcessing: input.dataCollectorProcessing,
    decisionRouteSearchingDecision,
    topicRoutingResult,
    solutionLikelihoodResult,
    topicsQualificationResult
  });

  decisionRouteSearchingDecision = updateSearchingDecisionRoute(decisionRouteSearchingDecision, {
    shouldEvaluateHelpfulness:
      helpfulnessEvaluationResult.shouldEvaluateHelpfulness ??
      decisionRouteSearchingDecision.shouldEvaluateHelpfulness,

    stopReason:
      helpfulnessEvaluationResult.stopReason ?? decisionRouteSearchingDecision.stopReason
  });

  /**
   * Step 5: Final searching decision
   *
   * This step is always called and is responsible for returning false if
   * the previous evaluations indicate that solution retrieval should not run.
   */
  const decisionSearchingSolution = searchingDecisionSteps.calculateSearchingDecision({
    currentAnalysisOutput: input.currentAnalysisOutput,
    previousAnalysisOutput: input.previousAnalysisOutput,
    conversationLogs: input.conversationLogs,
    attemptHistory: input.attemptHistory,
    userInformations: input.userInformations,
    dataCollectorProcessing: input.dataCollectorProcessing,
    decisionRouteSearchingDecision,
    topicRoutingResult,
    solutionLikelihoodResult,
    topicsQualificationResult,
    helpfulnessEvaluationResult
  });

  assertValidDecisionSearchingSolution(decisionSearchingSolution);

  return decisionSearchingSolution;
}

module.exports = {
  runSearchingDecision,
  createInitialSearchingDecisionRoute,
  updateSearchingDecisionRoute,
  assertValidSearchingDecisionInput,
  assertValidDecisionSearchingSolution
};