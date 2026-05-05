/**
 * Response Decision
 *
 * This file is the local orchestrator of the response-decision block.
 *
 * This block applies deterministic rules to build a structured response plan.
 *
 * It does not generate the final user-facing text directly.
 * It decides what kind of messages should be sent, in which order, and with which variables.
 *
 * INPUTS:
 * - currentAnalysisOutput
 * - analysisDelta
 * - previousAnalysisOutput
 * - conversationLogs
 * - attemptHistory
 * - userInformations
 * - possibleSolutions
 *
 * OUTPUT:
 * - responsePlan
 *
 * Expected responsePlan shape:
 *
 * {
 *   userLanguage: string | null;
 *   messages: UnknownObject[];
 * }
 *
 * Internal steps:
 *
 * 0. Response plan initialization
 *    Creates an empty responsePlan ready to receive one or several messages.
 *
 * 1. Signal / scope_boundary without topic routing
 *    If there is no topic and only signal / scope_boundary segments,
 *    builds the associated responsePlan and stops the flow.
 *
 * 2. Politeness introduction
 *    Adds a politeness introduction when at least one topic is present.
 *
 * 3. Warning comprehension handling
 *    Adds a warning comprehension message if warning_comprehension is "yes".
 *
 * 4. Topic response messages
 *    Adds one response message per topic.
 *
 * 5. Politeness closure
 *    Adds or merges the final politeness closure.
 *
 * 6. Signal / scope_boundary with topic handling
 *    Adds extra messages for signal or scope_boundary segments when topics are also present.
 */

type UnknownObject = Record<string, unknown>;

type AnalysisDelta = UnknownObject;

type ResponseDecisionStep<TInput, TOutput> = (input: TInput) => TOutput;

interface ResponseDecisionInput {
  currentAnalysisOutput: UnknownObject;
  analysisDelta: AnalysisDelta;
  previousAnalysisOutput?: UnknownObject | null;
  conversationLogs?: UnknownObject[];
  attemptHistory?: UnknownObject[];
  userInformations?: UnknownObject | null;
  possibleSolutions: unknown;
}

interface ResponsePlan {
  userLanguage: string | null;
  messages: UnknownObject[];
}

interface ResponseDecisionSteps {
  initializeResponsePlan?: ResponseDecisionStep<UnknownObject, ResponsePlan>;

  handleStandaloneSignalOrScopeBoundary?: ResponseDecisionStep<
    UnknownObject,
    ResponsePlan | null
  >;

  addPolitenessIntroduction?: ResponseDecisionStep<UnknownObject, ResponsePlan>;

  addWarningComprehensionMessage?: ResponseDecisionStep<UnknownObject, ResponsePlan>;

  addTopicResponseMessages?: ResponseDecisionStep<UnknownObject, ResponsePlan>;

  addPolitenessClosure?: ResponseDecisionStep<UnknownObject, ResponsePlan>;

  addSignalAndScopeBoundaryMessages?: ResponseDecisionStep<UnknownObject, ResponsePlan>;
}

/**
 * Creates a placeholder function for response-decision steps that are not implemented yet.
 */
function createMissingStep<TInput, TOutput>(
  stepName: string
): ResponseDecisionStep<TInput, TOutput> {
  return function missingStep(): never {
    throw new Error(`${stepName} is not implemented yet`);
  };
}

/**
 * Temporary assertion placeholders.
 *
 * These functions are intentionally empty for now.
 * Their real validation logic should be implemented later in a dedicated assertions file.
 */
function assertValidAnalysisDelta(analysisDelta: unknown): asserts analysisDelta is AnalysisDelta {}

function assertValidResponseDecisionInput(input: unknown): asserts input is ResponseDecisionInput {}

function assertValidResponsePlan(responsePlan: unknown): asserts responsePlan is ResponsePlan {}

function assertValidStandaloneResponsePlan(
  standaloneResponsePlan: unknown
): asserts standaloneResponsePlan is ResponsePlan | null {}

/**
 * Runs the response-decision block.
 */
function runResponseDecision(
  input: ResponseDecisionInput,
  steps: ResponseDecisionSteps = {}
): ResponsePlan {
  assertValidResponseDecisionInput(input);
  assertValidAnalysisDelta(input.analysisDelta);

  const responseDecisionSteps: Required<ResponseDecisionSteps> = {
    initializeResponsePlan:
      steps.initializeResponsePlan ||
      createMissingStep<UnknownObject, ResponsePlan>("initializeResponsePlan"),

    handleStandaloneSignalOrScopeBoundary:
      steps.handleStandaloneSignalOrScopeBoundary ||
      createMissingStep<UnknownObject, ResponsePlan | null>(
        "handleStandaloneSignalOrScopeBoundary"
      ),

    addPolitenessIntroduction:
      steps.addPolitenessIntroduction ||
      createMissingStep<UnknownObject, ResponsePlan>("addPolitenessIntroduction"),

    addWarningComprehensionMessage:
      steps.addWarningComprehensionMessage ||
      createMissingStep<UnknownObject, ResponsePlan>("addWarningComprehensionMessage"),

    addTopicResponseMessages:
      steps.addTopicResponseMessages ||
      createMissingStep<UnknownObject, ResponsePlan>("addTopicResponseMessages"),

    addPolitenessClosure:
      steps.addPolitenessClosure ||
      createMissingStep<UnknownObject, ResponsePlan>("addPolitenessClosure"),

    addSignalAndScopeBoundaryMessages:
      steps.addSignalAndScopeBoundaryMessages ||
      createMissingStep<UnknownObject, ResponsePlan>("addSignalAndScopeBoundaryMessages")
  };

  /**
   * Step 0: Response plan initialization
   */
  let responsePlan = responseDecisionSteps.initializeResponsePlan({
    analysisDelta: input.analysisDelta
  });

  assertValidResponsePlan(responsePlan);

  /**
   * Step 1: Signal / scope_boundary without topic routing
   *
   * If this step returns a responsePlan, the response-decision flow stops here.
   * If it returns null, the normal topic-oriented flow continues.
   */
  const standaloneResponsePlan =
    responseDecisionSteps.handleStandaloneSignalOrScopeBoundary({
      analysisDelta: input.analysisDelta,
      responsePlan
    });

  assertValidStandaloneResponsePlan(standaloneResponsePlan);

  if (standaloneResponsePlan !== null) {
    assertValidResponsePlan(standaloneResponsePlan);

    return standaloneResponsePlan;
  }

  /**
   * Step 2: Politeness introduction
   */
  responsePlan = responseDecisionSteps.addPolitenessIntroduction({
    conversationLogs: input.conversationLogs,
    userInformations: input.userInformations,
    responsePlan
  });

  assertValidResponsePlan(responsePlan);

  /**
   * Step 3: Warning comprehension handling
   */
  responsePlan = responseDecisionSteps.addWarningComprehensionMessage({
    analysisDelta: input.analysisDelta,
    responsePlan
  });

  assertValidResponsePlan(responsePlan);

  /**
   * Step 4: Topic response messages
   */
  responsePlan = responseDecisionSteps.addTopicResponseMessages({
    currentAnalysisOutput: input.currentAnalysisOutput,
    analysisDelta: input.analysisDelta,
    conversationLogs: input.conversationLogs,
    attemptHistory: input.attemptHistory,
    userInformations: input.userInformations,
    possibleSolutions: input.possibleSolutions,
    responsePlan
  });

  assertValidResponsePlan(responsePlan);

  /**
   * Step 5: Politeness closure
   */
  responsePlan = responseDecisionSteps.addPolitenessClosure({
    responsePlan
  });

  assertValidResponsePlan(responsePlan);

  /**
   * Step 6: Signal / scope_boundary with topic handling
   */
  responsePlan = responseDecisionSteps.addSignalAndScopeBoundaryMessages({
    analysisDelta: input.analysisDelta,
    responsePlan
  });

  assertValidResponsePlan(responsePlan);

  return responsePlan;
}

export {
  runResponseDecision,
  assertValidAnalysisDelta,
  assertValidResponseDecisionInput,
  assertValidResponsePlan,
  assertValidStandaloneResponsePlan
};

export type {
  ResponseDecisionInput,
  ResponseDecisionSteps,
  AnalysisDelta,
  ResponsePlan
};