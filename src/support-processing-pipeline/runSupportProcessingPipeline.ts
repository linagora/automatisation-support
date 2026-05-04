/**
 * Support Processing Pipeline
 *
 * This file is the main orchestrator of the support automation backend.
 *
 * Its responsibility is to coordinate the high-level processing steps:
 *
 * 1. Analyze the latest user message with context and produce a structured analysis: message-analysis
 *    INPUTS  - latestUserMessage, attachments, previousAnalysisOutput, conversationLogs, attemptHistory, userInformations
 *    OUTPUTS - currentAnalysisOutput
 *
 * 2. Apply deterministic rules to decide whether we should search for a solution in our database: searching-decision
 *    INPUTS  - currentAnalysisOutput, conversationLogs, attemptHistory, userInformations
 *    OUTPUTS - decisionSearchingSolution (true/false)
 *
 * 3. Retrieve a solution if the searching decision requires it: solution-retrieval
 *    INPUTS  - decisionSearchingSolution, currentAnalysisOutput, conversationLogs, attemptHistory
 *    OUTPUTS - possibleSolutions ("not_searched", "not_found", "solutions_found")
 *
 * 4. Apply decision rules to produce the automatic answer plan: response-decision
 *    INPUTS  - currentAnalysisOutput, conversationLogs, attemptHistory, userInformations, possibleSolutions
 *    OUTPUTS - responsePlan
 *
 * 5. Build a response for the user from the response plan and predefined templates: response-producer
 *    INPUTS  - responsePlan
 *    OUTPUTS - userResponse
 *
 * 6. Produce the data needed to update the ticket state: data-producer
 *    INPUTS  - currentAnalysisOutput, conversationLogs, attemptHistory, userInformations, possibleSolutions, responsePlan
 *    OUTPUTS - updatedDataTicket
 */

type UnknownObject = Record<string, unknown>;

type PipelineStep<TInput, TOutput> = (input: TInput) => TOutput;

interface SupportProcessingPipelineInput {
  latestUserMessage: string | UnknownObject;
  attachments?: UnknownObject[];
  previousAnalysisOutput?: UnknownObject | null;
  conversationLogs?: UnknownObject[];
  attemptHistory?: UnknownObject[];
  userInformations?: UnknownObject | null;
}

interface MessageAnalysisInput {
  latestUserMessage: string | UnknownObject;
  attachments?: UnknownObject[];
  previousAnalysisOutput?: UnknownObject | null;
  conversationLogs?: UnknownObject[];
  attemptHistory?: UnknownObject[];
  userInformations?: UnknownObject | null;
  dataCollectorProcessing: UnknownObject;
}

interface SearchingDecisionInput {
  currentAnalysisOutput: UnknownObject;
  previousAnalysisOutput?: UnknownObject | null;
  conversationLogs?: UnknownObject[];
  attemptHistory?: UnknownObject[];
  userInformations?: UnknownObject | null;
  dataCollectorProcessing: UnknownObject;
}

interface SolutionRetrievalInput {
  decisionSearchingSolution: boolean;
  currentAnalysisOutput: UnknownObject;
  conversationLogs?: UnknownObject[];
  attemptHistory?: UnknownObject[];
  userInformations?: UnknownObject | null;
  dataCollectorProcessing: UnknownObject;
}

interface ResponseDecisionInput {
  currentAnalysisOutput: UnknownObject;
  conversationLogs?: UnknownObject[];
  attemptHistory?: UnknownObject[];
  userInformations?: UnknownObject | null;
  possibleSolutions: unknown;
  dataCollectorProcessing: UnknownObject;
}

interface ResponseProducerInput {
  responsePlan: unknown;
  currentAnalysisOutput: UnknownObject;
  possibleSolutions: unknown;
  userInformations?: UnknownObject | null;
  dataCollectorProcessing: UnknownObject;
}

interface DataProducerInput {
  currentAnalysisOutput: UnknownObject;
  conversationLogs?: UnknownObject[];
  attemptHistory?: UnknownObject[];
  userInformations?: UnknownObject | null;
  possibleSolutions: unknown;
  responsePlan: unknown;
  dataCollectorProcessing: UnknownObject;
}

interface SupportProcessingPipelineSteps {
  runMessageAnalysis?: PipelineStep<MessageAnalysisInput, UnknownObject>;
  runSearchingDecision?: PipelineStep<SearchingDecisionInput, boolean>;
  runSolutionRetrieval?: PipelineStep<SolutionRetrievalInput, unknown>;
  runResponseDecision?: PipelineStep<ResponseDecisionInput, unknown>;
  produceResponse?: PipelineStep<ResponseProducerInput, unknown>;
  produceTicketData?: PipelineStep<DataProducerInput, unknown>;
}

interface SupportProcessingPipelineOutput {
  userResponse: unknown;
  updatedDataTicket: unknown;
  dataCollectorProcessing: UnknownObject;
}

/**
 * Creates a placeholder function for pipeline steps that are not implemented yet.
 *
 * This makes the orchestrator explicit: every expected step is named, and if one
 * is missing, the error message clearly identifies which step still needs to be implemented.
 */
function createMissingStep<TInput, TOutput>(stepName: string): PipelineStep<TInput, TOutput> {
  return function missingStep(): never {
    throw new Error(`${stepName} is not implemented yet`);
  };
}

/**
 * Runs the full support processing pipeline.
 *
 * In production, this function will use the real implementations of each step.
 * During early development and unit testing, the `steps` parameter allows us to
 * inject mock implementations without calling real SLM/LLM APIs, RAG, database,
 * or Twake services.
 */
function runSupportProcessingPipeline(
  input: SupportProcessingPipelineInput,
  steps: SupportProcessingPipelineSteps = {}
): SupportProcessingPipelineOutput {
  const pipelineSteps: Required<SupportProcessingPipelineSteps> = {
    runMessageAnalysis:
      steps.runMessageAnalysis ||
      createMissingStep<MessageAnalysisInput, UnknownObject>("runMessageAnalysis"),

    runSearchingDecision:
      steps.runSearchingDecision ||
      createMissingStep<SearchingDecisionInput, boolean>("runSearchingDecision"),

    runSolutionRetrieval:
      steps.runSolutionRetrieval ||
      createMissingStep<SolutionRetrievalInput, unknown>("runSolutionRetrieval"),

    runResponseDecision:
      steps.runResponseDecision ||
      createMissingStep<ResponseDecisionInput, unknown>("runResponseDecision"),

    produceResponse:
      steps.produceResponse ||
      createMissingStep<ResponseProducerInput, unknown>("produceResponse"),

    produceTicketData:
      steps.produceTicketData ||
      createMissingStep<DataProducerInput, unknown>("produceTicketData")
  };

  const dataCollectorProcessing: UnknownObject = {};

  /**
   * Step 1: Message analysis
   */
  const currentAnalysisOutput = pipelineSteps.runMessageAnalysis({
    latestUserMessage: input.latestUserMessage,
    attachments: input.attachments,
    previousAnalysisOutput: input.previousAnalysisOutput,
    conversationLogs: input.conversationLogs,
    attemptHistory: input.attemptHistory,
    userInformations: input.userInformations,
    dataCollectorProcessing
  });

  /**
   * Step 2: Searching decision
   */
  const decisionSearchingSolution = pipelineSteps.runSearchingDecision({
    currentAnalysisOutput,
    previousAnalysisOutput: input.previousAnalysisOutput,
    conversationLogs: input.conversationLogs,
    attemptHistory: input.attemptHistory,
    userInformations: input.userInformations,
    dataCollectorProcessing
  });

  /**
   * Step 3: Solution retrieval
   */
  const possibleSolutions = pipelineSteps.runSolutionRetrieval({
    decisionSearchingSolution,
    currentAnalysisOutput,
    conversationLogs: input.conversationLogs,
    attemptHistory: input.attemptHistory,
    userInformations: input.userInformations,
    dataCollectorProcessing
  });

  /**
   * Step 4: Response decision
   */
  const responsePlan = pipelineSteps.runResponseDecision({
    currentAnalysisOutput,
    conversationLogs: input.conversationLogs,
    attemptHistory: input.attemptHistory,
    userInformations: input.userInformations,
    possibleSolutions,
    dataCollectorProcessing
  });

  /**
   * Step 5: Response producer
   */
  const userResponse = pipelineSteps.produceResponse({
    responsePlan,
    currentAnalysisOutput,
    possibleSolutions,
    userInformations: input.userInformations,
    dataCollectorProcessing
  });

  /**
   * Step 6: Data producer
   */
  const updatedDataTicket = pipelineSteps.produceTicketData({
    currentAnalysisOutput,
    conversationLogs: input.conversationLogs,
    attemptHistory: input.attemptHistory,
    userInformations: input.userInformations,
    possibleSolutions,
    responsePlan,
    dataCollectorProcessing
  });

  return {
    userResponse,
    updatedDataTicket,
    dataCollectorProcessing
  };
}

export {
  runSupportProcessingPipeline
};

export type {
  SupportProcessingPipelineInput,
  SupportProcessingPipelineSteps,
  SupportProcessingPipelineOutput
};