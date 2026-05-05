/**
 * Solution Retrieval
 *
 * This file is the local orchestrator of the solution-retrieval block.
 *
 * Its responsibility is to apply the previous searching decision:
 * either bypass solution retrieval, or search for possible solutions in the knowledge base.
 *
 * It does not decide by itself whether a search is useful.
 * This decision has already been made by the searching-decision block.
 *
 * INPUTS:
 * - decisionSearchingSolution
 * - currentAnalysisOutput
 * - conversationLogs
 * - attemptHistory
 *
 * OUTPUT:
 * - possibleSolutions ("not_searched", "not_found", "solutions_found")
 *
 * Internal steps:
 *
 * 0. Searching decision routing
 *    If decisionSearchingSolution is false, bypass retrieval immediately.
 *    No OpenRAG call is made.
 *    OUTPUTS - possibleSolutions with status "not_searched"
 *
 * 1. Retrieval request preparation
 *    Builds the structured search request from currentAnalysisOutput and context.
 *    This step extracts the useful support topic information and prepares the search payload.
 *    INPUTS  - currentAnalysisOutput, conversationLogs, attemptHistory
 *    OUTPUTS - retrievalRequest
 *
 * 2. OpenRAG call
 *    Sends the retrieval request to OpenRAG or to a mocked retrieval provider during tests.
 *    This step is responsible for the external API call.
 *    INPUTS  - retrievalRequest
 *    OUTPUTS - rawRetrievalResponse
 *
 * 3. Retrieval response formatting
 *    Parses, validates and normalizes the raw retrieval response.
 *    It determines whether no solution was found or whether usable solutions were found.
 *    INPUTS  - rawRetrievalResponse, retrievalRequest, currentAnalysisOutput
 *    OUTPUTS - possibleSolutions with status "not_found" or "solutions_found"
 */

type UnknownObject = Record<string, unknown>;

type SolutionRetrievalStep<TInput, TOutput> = (input: TInput) => TOutput;

type PossibleSolutionsStatus = "not_searched" | "not_found" | "solutions_found";

interface SolutionRetrievalInput {
  decisionSearchingSolution: boolean;
  currentAnalysisOutput: UnknownObject;
  conversationLogs?: UnknownObject[];
  attemptHistory?: UnknownObject[];
}

interface RetrievalRequest {
  [key: string]: unknown;
}

interface RawRetrievalResponse {
  [key: string]: unknown;
}

interface PossibleSolutions {
  status: PossibleSolutionsStatus;
  reason?: string | null;
  solutions?: UnknownObject[];
  [key: string]: unknown;
}

interface SolutionRetrievalSteps {
  prepareRetrievalRequest?: SolutionRetrievalStep<UnknownObject, RetrievalRequest>;
  callOpenRag?: SolutionRetrievalStep<UnknownObject, RawRetrievalResponse>;
  formatPossibleSolutions?: SolutionRetrievalStep<UnknownObject, PossibleSolutions>;
}

/**
 * Creates a placeholder function for solution-retrieval steps that are not implemented yet.
 */
function createMissingStep<TInput, TOutput>(
  stepName: string
): SolutionRetrievalStep<TInput, TOutput> {
  return function missingStep(): never {
    throw new Error(`${stepName} is not implemented yet`);
  };
}

/**
 * Validates the minimum input contract of runSolutionRetrieval.
 *
 * This validation is intentionally lightweight.
 * It only checks the fields needed to safely run the local orchestrator.
 */
function assertValidSolutionRetrievalInput(
  input: unknown
): asserts input is SolutionRetrievalInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("runSolutionRetrieval input must be an object");
  }

  const solutionRetrievalInput = input as Partial<SolutionRetrievalInput>;

  if (typeof solutionRetrievalInput.decisionSearchingSolution !== "boolean") {
    throw new Error("decisionSearchingSolution must be a boolean");
  }

  if (
    !solutionRetrievalInput.currentAnalysisOutput ||
    typeof solutionRetrievalInput.currentAnalysisOutput !== "object" ||
    Array.isArray(solutionRetrievalInput.currentAnalysisOutput)
  ) {
    throw new Error("currentAnalysisOutput must be an object");
  }

  if (
    solutionRetrievalInput.conversationLogs !== undefined &&
    !Array.isArray(solutionRetrievalInput.conversationLogs)
  ) {
    throw new Error("conversationLogs must be an array when provided");
  }

  if (
    solutionRetrievalInput.attemptHistory !== undefined &&
    !Array.isArray(solutionRetrievalInput.attemptHistory)
  ) {
    throw new Error("attemptHistory must be an array when provided");
  }

}

/**
 * Validates the retrieval request produced before the OpenRAG call.
 */
function assertValidRetrievalRequest(
  retrievalRequest: unknown
): asserts retrievalRequest is RetrievalRequest {
  if (
    !retrievalRequest ||
    typeof retrievalRequest !== "object" ||
    Array.isArray(retrievalRequest)
  ) {
    throw new Error("retrievalRequest must be an object");
  }
}

/**
 * Validates the raw retrieval response returned by OpenRAG.
 */
function assertValidRawRetrievalResponse(
  rawRetrievalResponse: unknown
): asserts rawRetrievalResponse is RawRetrievalResponse {
  if (
    !rawRetrievalResponse ||
    typeof rawRetrievalResponse !== "object" ||
    Array.isArray(rawRetrievalResponse)
  ) {
    throw new Error("rawRetrievalResponse must be an object");
  }
}

/**
 * Validates the final output contract of runSolutionRetrieval.
 */
function assertValidPossibleSolutions(
  possibleSolutions: unknown
): asserts possibleSolutions is PossibleSolutions {
  if (
    !possibleSolutions ||
    typeof possibleSolutions !== "object" ||
    Array.isArray(possibleSolutions)
  ) {
    throw new Error("possibleSolutions must be an object");
  }

  const possibleSolutionsOutput = possibleSolutions as Partial<PossibleSolutions>;

  const validStatuses: PossibleSolutionsStatus[] = [
    "not_searched",
    "not_found",
    "solutions_found"
  ];

  if (
    typeof possibleSolutionsOutput.status !== "string" ||
    !validStatuses.includes(possibleSolutionsOutput.status as PossibleSolutionsStatus)
  ) {
    throw new Error(
      "possibleSolutions.status must be one of: not_searched, not_found, solutions_found"
    );
  }

  if (
    possibleSolutionsOutput.reason !== undefined &&
    possibleSolutionsOutput.reason !== null &&
    typeof possibleSolutionsOutput.reason !== "string"
  ) {
    throw new Error("possibleSolutions.reason must be a string or null when provided");
  }

  if (
    possibleSolutionsOutput.solutions !== undefined &&
    !Array.isArray(possibleSolutionsOutput.solutions)
  ) {
    throw new Error("possibleSolutions.solutions must be an array when provided");
  }

  if (
    possibleSolutionsOutput.status === "solutions_found" &&
    (
      possibleSolutionsOutput.solutions === undefined ||
      possibleSolutionsOutput.solutions.length === 0
    )
  ) {
    throw new Error(
      "possibleSolutions.solutions must contain at least one solution when status is solutions_found"
    );
  }
}

/**
 * Runs the solution-retrieval block.
 */
function runSolutionRetrieval(
  input: SolutionRetrievalInput,
  steps: SolutionRetrievalSteps = {}
): PossibleSolutions {
  assertValidSolutionRetrievalInput(input);

  /**
   * Step 0: Searching decision routing
   *
   * If the previous block decided that no solution search is needed,
   * we bypass retrieval immediately.
   */
  if (!input.decisionSearchingSolution) {
    const possibleSolutions: PossibleSolutions = {
      status: "not_searched",
      reason: "searching_decision_was_false"
    };

    assertValidPossibleSolutions(possibleSolutions);

    return possibleSolutions;
  }

  const solutionRetrievalSteps: Required<SolutionRetrievalSteps> = {
    prepareRetrievalRequest:
      steps.prepareRetrievalRequest ||
      createMissingStep<UnknownObject, RetrievalRequest>("prepareRetrievalRequest"),

    callOpenRag:
      steps.callOpenRag ||
      createMissingStep<UnknownObject, RawRetrievalResponse>("callOpenRag"),

    formatPossibleSolutions:
      steps.formatPossibleSolutions ||
      createMissingStep<UnknownObject, PossibleSolutions>("formatPossibleSolutions")
  };

  /**
   * Step 1: Retrieval request preparation
   */
  const retrievalRequest = solutionRetrievalSteps.prepareRetrievalRequest({
    currentAnalysisOutput: input.currentAnalysisOutput,
    conversationLogs: input.conversationLogs,
    attemptHistory: input.attemptHistory
  });

  assertValidRetrievalRequest(retrievalRequest);

  /**
   * Step 2: OpenRAG call
   */
  const rawRetrievalResponse = solutionRetrievalSteps.callOpenRag({
    retrievalRequest
  });

  assertValidRawRetrievalResponse(rawRetrievalResponse);

  /**
   * Step 3: Retrieval response formatting
   */
  const possibleSolutions = solutionRetrievalSteps.formatPossibleSolutions({
    rawRetrievalResponse,
    retrievalRequest,
    currentAnalysisOutput: input.currentAnalysisOutput,
    conversationLogs: input.conversationLogs,
    attemptHistory: input.attemptHistory,
  });

  assertValidPossibleSolutions(possibleSolutions);

  return possibleSolutions;
}

export {
  runSolutionRetrieval,
  assertValidSolutionRetrievalInput,
  assertValidRetrievalRequest,
  assertValidRawRetrievalResponse,
  assertValidPossibleSolutions
};

export type {
  SolutionRetrievalInput,
  SolutionRetrievalSteps,
  RetrievalRequest,
  RawRetrievalResponse,
  PossibleSolutions,
  PossibleSolutionsStatus
};