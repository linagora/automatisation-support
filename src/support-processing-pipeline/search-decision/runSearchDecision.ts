/**
 * Search Decision
 *
 * This file is the local orchestrator of the search-decision block.
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
 * 5. Final search decision
 *    Combines all previous evaluations and returns the final boolean decision.
 *    INPUTS  - topicRoutingResult, solutionLikelihoodResult, topicsQualificationResult, helpfulnessEvaluationResult
 *    OUTPUTS - decisionSearchingSolution
 */

type UnknownObject = Record<string, unknown>;

type SearchDecisionStep<TInput, TOutput> = (input: TInput) => TOutput;

interface SearchDecisionInput {
  currentAnalysisOutput: UnknownObject;
  previousAnalysisOutput?: UnknownObject | null;
  conversationLogs?: UnknownObject[];
  attemptHistory?: UnknownObject[];
  userInformations?: UnknownObject | null;
}

interface DecisionRouteSearchDecision {
  topicIsPresent: boolean | null;
  shouldEvaluateSolutionLikelihood: boolean;
  shouldEvaluateTopicQualification: boolean;
  shouldEvaluateHelpfulness: boolean;
  shouldCalculateFinalDecision: boolean;
  stopReason: string | null;
}

interface TopicRoutingResult {
  topicIsPresent?: boolean;
  stopReason?: string | null;
  [key: string]: unknown;
}

interface SolutionLikelihoodResult {
  shouldEvaluateSolutionLikelihood?: boolean;
  stopReason?: string | null;
  [key: string]: unknown;
}

interface TopicsQualificationResult {
  shouldEvaluateTopicQualification?: boolean;
  stopReason?: string | null;
  [key: string]: unknown;
}

interface HelpfulnessEvaluationResult {
  shouldEvaluateHelpfulness?: boolean;
  stopReason?: string | null;
  [key: string]: unknown;
}

interface SearchDecisionSteps {
  runTopicRouting?: SearchDecisionStep<UnknownObject, TopicRoutingResult>;
  evaluateSolutionLikelihood?: SearchDecisionStep<UnknownObject, SolutionLikelihoodResult>;
  evaluateTopicQualification?: SearchDecisionStep<UnknownObject, TopicsQualificationResult>;
  evaluateHelpfulness?: SearchDecisionStep<UnknownObject, HelpfulnessEvaluationResult>;
  calculateSearchDecision?: SearchDecisionStep<UnknownObject, boolean>;
}

/**
 * Creates a placeholder function for search-decision steps that are not implemented yet.
 */
function createMissingStep<TInput, TOutput>(
  stepName: string
): SearchDecisionStep<TInput, TOutput> {
  return function missingStep(): never {
    throw new Error(`${stepName} is not implemented yet`);
  };
}

/**
 * Creates the initial decision route for the search-decision flow.
 *
 * This object is updated progressively by each step.
 */
function createInitialSearchDecisionRoute(): DecisionRouteSearchDecision {
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
 * Updates the search-decision route without mutating the previous object.
 */
function updateSearchDecisionRoute(
  currentDecisionRoute: DecisionRouteSearchDecision,
  updates: Partial<DecisionRouteSearchDecision>
): DecisionRouteSearchDecision {
  return {
    ...currentDecisionRoute,
    ...updates
  };
}

/**
 * Validates the minimum input contract of runSearchDecision.
 *
 * This validation is intentionally lightweight.
 * It only checks the fields needed to safely run the local orchestrator.
 */
function assertValidSearchDecisionInput(
  input: unknown
): asserts input is SearchDecisionInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("runSearchDecision input must be an object");
  }

  const searchDecisionInput = input as Partial<SearchDecisionInput>;

  if (
    !searchDecisionInput.currentAnalysisOutput ||
    typeof searchDecisionInput.currentAnalysisOutput !== "object" ||
    Array.isArray(searchDecisionInput.currentAnalysisOutput)
  ) {
    throw new Error("currentAnalysisOutput must be an object");
  }

  if (
    searchDecisionInput.previousAnalysisOutput !== undefined &&
    searchDecisionInput.previousAnalysisOutput !== null &&
    (
      typeof searchDecisionInput.previousAnalysisOutput !== "object" ||
      Array.isArray(searchDecisionInput.previousAnalysisOutput)
    )
  ) {
    throw new Error("previousAnalysisOutput must be an object or null when provided");
  }

  if (
    searchDecisionInput.conversationLogs !== undefined &&
    !Array.isArray(searchDecisionInput.conversationLogs)
  ) {
    throw new Error("conversationLogs must be an array when provided");
  }

  if (
    searchDecisionInput.attemptHistory !== undefined &&
    !Array.isArray(searchDecisionInput.attemptHistory)
  ) {
    throw new Error("attemptHistory must be an array when provided");
  }

  if (
    searchDecisionInput.userInformations !== undefined &&
    searchDecisionInput.userInformations !== null &&
    (
      typeof searchDecisionInput.userInformations !== "object" ||
      Array.isArray(searchDecisionInput.userInformations)
    )
  ) {
    throw new Error("userInformations must be an object or null when provided");
  }
}

/**
 * Validates the output contract of runSearchDecision.
 */
function assertValidDecisionSearchingSolution(
  decisionSearchingSolution: unknown
): asserts decisionSearchingSolution is boolean {
  if (typeof decisionSearchingSolution !== "boolean") {
    throw new Error("decisionSearchingSolution must be a boolean");
  }
}

/**
 * Runs the search-decision block.
 */
function runSearchDecision(
  input: SearchDecisionInput,
  steps: SearchDecisionSteps = {}
): boolean {
  assertValidSearchDecisionInput(input);

  const searchDecisionSteps: Required<SearchDecisionSteps> = {
    runTopicRouting:
      steps.runTopicRouting ||
      createMissingStep<UnknownObject, TopicRoutingResult>("runTopicRouting"),

    evaluateSolutionLikelihood:
      steps.evaluateSolutionLikelihood ||
      createMissingStep<UnknownObject, SolutionLikelihoodResult>("evaluateSolutionLikelihood"),

    evaluateTopicQualification:
      steps.evaluateTopicQualification ||
      createMissingStep<UnknownObject, TopicsQualificationResult>("evaluateTopicQualification"),

    evaluateHelpfulness:
      steps.evaluateHelpfulness ||
      createMissingStep<UnknownObject, HelpfulnessEvaluationResult>("evaluateHelpfulness"),

    calculateSearchDecision:
      steps.calculateSearchDecision ||
      createMissingStep<UnknownObject, boolean>("calculateSearchDecision")
  };

  let decisionRouteSearchDecision = createInitialSearchDecisionRoute();

  /**
   * Step 1: Topic routing
   *
   * At this step, we only know whether at least one exploitable topic is present.
   */
  const topicRoutingResult = searchDecisionSteps.runTopicRouting({
    currentAnalysisOutput: input.currentAnalysisOutput,
    previousAnalysisOutput: input.previousAnalysisOutput,
    conversationLogs: input.conversationLogs,
    attemptHistory: input.attemptHistory,
    userInformations: input.userInformations,
    decisionRouteSearchDecision
  });

  decisionRouteSearchDecision = updateSearchDecisionRoute(decisionRouteSearchDecision, {
    topicIsPresent:
      topicRoutingResult.topicIsPresent ??
      decisionRouteSearchDecision.topicIsPresent,

    stopReason:
      topicRoutingResult.stopReason ??
      decisionRouteSearchDecision.stopReason
  });

  /**
   * Step 2: Solution likelihood evaluation
   *
   * This step is always called, but it can return a skipped result if
   * decisionRouteSearchDecision.topicIsPresent is false.
   */
  const solutionLikelihoodResult = searchDecisionSteps.evaluateSolutionLikelihood({
    currentAnalysisOutput: input.currentAnalysisOutput,
    previousAnalysisOutput: input.previousAnalysisOutput,
    conversationLogs: input.conversationLogs,
    attemptHistory: input.attemptHistory,
    userInformations: input.userInformations,
    decisionRouteSearchDecision,
    topicRoutingResult
  });

  decisionRouteSearchDecision = updateSearchDecisionRoute(decisionRouteSearchDecision, {
    shouldEvaluateSolutionLikelihood:
      solutionLikelihoodResult.shouldEvaluateSolutionLikelihood ??
      decisionRouteSearchDecision.shouldEvaluateSolutionLikelihood,

    stopReason:
      solutionLikelihoodResult.stopReason ??
      decisionRouteSearchDecision.stopReason
  });

  /**
   * Step 3: Topic qualification evaluation
   *
   * This step is always called, but it can return a skipped result if
   * decisionRouteSearchDecision.shouldEvaluateSolutionLikelihood is false.
   */
  const topicsQualificationResult = searchDecisionSteps.evaluateTopicQualification({
    currentAnalysisOutput: input.currentAnalysisOutput,
    previousAnalysisOutput: input.previousAnalysisOutput,
    conversationLogs: input.conversationLogs,
    attemptHistory: input.attemptHistory,
    userInformations: input.userInformations,
    decisionRouteSearchDecision,
    topicRoutingResult,
    solutionLikelihoodResult
  });

  decisionRouteSearchDecision = updateSearchDecisionRoute(decisionRouteSearchDecision, {
    shouldEvaluateTopicQualification:
      topicsQualificationResult.shouldEvaluateTopicQualification ??
      decisionRouteSearchDecision.shouldEvaluateTopicQualification,

    stopReason:
      topicsQualificationResult.stopReason ??
      decisionRouteSearchDecision.stopReason
  });

  /**
   * Step 4: Helpfulness evaluation
   *
   * This step is always called, but it can return a skipped result if
   * decisionRouteSearchDecision.shouldEvaluateTopicQualification is false.
   */
  const helpfulnessEvaluationResult = searchDecisionSteps.evaluateHelpfulness({
    currentAnalysisOutput: input.currentAnalysisOutput,
    previousAnalysisOutput: input.previousAnalysisOutput,
    conversationLogs: input.conversationLogs,
    attemptHistory: input.attemptHistory,
    userInformations: input.userInformations,
    decisionRouteSearchDecision,
    topicRoutingResult,
    solutionLikelihoodResult,
    topicsQualificationResult
  });

  decisionRouteSearchDecision = updateSearchDecisionRoute(decisionRouteSearchDecision, {
    shouldEvaluateHelpfulness:
      helpfulnessEvaluationResult.shouldEvaluateHelpfulness ??
      decisionRouteSearchDecision.shouldEvaluateHelpfulness,

    stopReason:
      helpfulnessEvaluationResult.stopReason ??
      decisionRouteSearchDecision.stopReason
  });

  /**
   * Step 5: Final search decision
   *
   * This step is always called and is responsible for returning false if
   * the previous evaluations indicate that solution retrieval should not run.
   */
  const decisionSearchingSolution = searchDecisionSteps.calculateSearchDecision({
    currentAnalysisOutput: input.currentAnalysisOutput,
    previousAnalysisOutput: input.previousAnalysisOutput,
    conversationLogs: input.conversationLogs,
    attemptHistory: input.attemptHistory,
    userInformations: input.userInformations,
    decisionRouteSearchDecision,
    topicRoutingResult,
    solutionLikelihoodResult,
    topicsQualificationResult,
    helpfulnessEvaluationResult
  });

  assertValidDecisionSearchingSolution(decisionSearchingSolution);

  return decisionSearchingSolution;
}

export {
  runSearchDecision,
  createInitialSearchDecisionRoute,
  updateSearchDecisionRoute,
  assertValidSearchDecisionInput,
  assertValidDecisionSearchingSolution
};

export type {
  SearchDecisionInput,
  SearchDecisionSteps,
  DecisionRouteSearchDecision,
  TopicRoutingResult,
  SolutionLikelihoodResult,
  TopicsQualificationResult,
  HelpfulnessEvaluationResult
};
