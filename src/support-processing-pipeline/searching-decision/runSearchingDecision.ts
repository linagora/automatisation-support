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

type UnknownObject = Record<string, unknown>;

type SearchingDecisionStep<TInput, TOutput> = (input: TInput) => TOutput;

interface SearchingDecisionInput {
  currentAnalysisOutput: UnknownObject;
  previousAnalysisOutput?: UnknownObject | null;
  conversationLogs?: UnknownObject[];
  attemptHistory?: UnknownObject[];
  userInformations?: UnknownObject | null;
}

interface DecisionRouteSearchingDecision {
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

interface SearchingDecisionSteps {
  runTopicRouting?: SearchingDecisionStep<UnknownObject, TopicRoutingResult>;
  evaluateSolutionLikelihood?: SearchingDecisionStep<UnknownObject, SolutionLikelihoodResult>;
  evaluateTopicQualification?: SearchingDecisionStep<UnknownObject, TopicsQualificationResult>;
  evaluateHelpfulness?: SearchingDecisionStep<UnknownObject, HelpfulnessEvaluationResult>;
  calculateSearchingDecision?: SearchingDecisionStep<UnknownObject, boolean>;
}

/**
 * Creates a placeholder function for searching-decision steps that are not implemented yet.
 */
function createMissingStep<TInput, TOutput>(
  stepName: string
): SearchingDecisionStep<TInput, TOutput> {
  return function missingStep(): never {
    throw new Error(`${stepName} is not implemented yet`);
  };
}

/**
 * Creates the initial decision route for the searching-decision flow.
 *
 * This object is updated progressively by each step.
 */
function createInitialSearchingDecisionRoute(): DecisionRouteSearchingDecision {
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
 */
function updateSearchingDecisionRoute(
  currentDecisionRoute: DecisionRouteSearchingDecision,
  updates: Partial<DecisionRouteSearchingDecision>
): DecisionRouteSearchingDecision {
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
 */
function assertValidSearchingDecisionInput(
  input: unknown
): asserts input is SearchingDecisionInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("runSearchingDecision input must be an object");
  }

  const searchingDecisionInput = input as Partial<SearchingDecisionInput>;

  if (
    !searchingDecisionInput.currentAnalysisOutput ||
    typeof searchingDecisionInput.currentAnalysisOutput !== "object" ||
    Array.isArray(searchingDecisionInput.currentAnalysisOutput)
  ) {
    throw new Error("currentAnalysisOutput must be an object");
  }

  if (
    searchingDecisionInput.previousAnalysisOutput !== undefined &&
    searchingDecisionInput.previousAnalysisOutput !== null &&
    (
      typeof searchingDecisionInput.previousAnalysisOutput !== "object" ||
      Array.isArray(searchingDecisionInput.previousAnalysisOutput)
    )
  ) {
    throw new Error("previousAnalysisOutput must be an object or null when provided");
  }

  if (
    searchingDecisionInput.conversationLogs !== undefined &&
    !Array.isArray(searchingDecisionInput.conversationLogs)
  ) {
    throw new Error("conversationLogs must be an array when provided");
  }

  if (
    searchingDecisionInput.attemptHistory !== undefined &&
    !Array.isArray(searchingDecisionInput.attemptHistory)
  ) {
    throw new Error("attemptHistory must be an array when provided");
  }

  if (
    searchingDecisionInput.userInformations !== undefined &&
    searchingDecisionInput.userInformations !== null &&
    (
      typeof searchingDecisionInput.userInformations !== "object" ||
      Array.isArray(searchingDecisionInput.userInformations)
    )
  ) {
    throw new Error("userInformations must be an object or null when provided");
  }
}

/**
 * Validates the output contract of runSearchingDecision.
 */
function assertValidDecisionSearchingSolution(
  decisionSearchingSolution: unknown
): asserts decisionSearchingSolution is boolean {
  if (typeof decisionSearchingSolution !== "boolean") {
    throw new Error("decisionSearchingSolution must be a boolean");
  }
}

/**
 * Runs the searching-decision block.
 */
function runSearchingDecision(
  input: SearchingDecisionInput,
  steps: SearchingDecisionSteps = {}
): boolean {
  assertValidSearchingDecisionInput(input);

  const searchingDecisionSteps: Required<SearchingDecisionSteps> = {
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

    calculateSearchingDecision:
      steps.calculateSearchingDecision ||
      createMissingStep<UnknownObject, boolean>("calculateSearchingDecision")
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
    decisionRouteSearchingDecision
  });

  decisionRouteSearchingDecision = updateSearchingDecisionRoute(decisionRouteSearchingDecision, {
    topicIsPresent:
      topicRoutingResult.topicIsPresent ??
      decisionRouteSearchingDecision.topicIsPresent,

    stopReason:
      topicRoutingResult.stopReason ??
      decisionRouteSearchingDecision.stopReason
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
    decisionRouteSearchingDecision,
    topicRoutingResult
  });

  decisionRouteSearchingDecision = updateSearchingDecisionRoute(decisionRouteSearchingDecision, {
    shouldEvaluateSolutionLikelihood:
      solutionLikelihoodResult.shouldEvaluateSolutionLikelihood ??
      decisionRouteSearchingDecision.shouldEvaluateSolutionLikelihood,

    stopReason:
      solutionLikelihoodResult.stopReason ??
      decisionRouteSearchingDecision.stopReason
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
    decisionRouteSearchingDecision,
    topicRoutingResult,
    solutionLikelihoodResult
  });

  decisionRouteSearchingDecision = updateSearchingDecisionRoute(decisionRouteSearchingDecision, {
    shouldEvaluateTopicQualification:
      topicsQualificationResult.shouldEvaluateTopicQualification ??
      decisionRouteSearchingDecision.shouldEvaluateTopicQualification,

    stopReason:
      topicsQualificationResult.stopReason ??
      decisionRouteSearchingDecision.stopReason
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
      helpfulnessEvaluationResult.stopReason ??
      decisionRouteSearchingDecision.stopReason
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
    decisionRouteSearchingDecision,
    topicRoutingResult,
    solutionLikelihoodResult,
    topicsQualificationResult,
    helpfulnessEvaluationResult
  });

  assertValidDecisionSearchingSolution(decisionSearchingSolution);

  return decisionSearchingSolution;
}

export {
  runSearchingDecision,
  createInitialSearchingDecisionRoute,
  updateSearchingDecisionRoute,
  assertValidSearchingDecisionInput,
  assertValidDecisionSearchingSolution
};

export type {
  SearchingDecisionInput,
  SearchingDecisionSteps,
  DecisionRouteSearchingDecision,
  TopicRoutingResult,
  SolutionLikelihoodResult,
  TopicsQualificationResult,
  HelpfulnessEvaluationResult
};