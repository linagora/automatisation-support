/**
 * Support Processing Pipeline
 *
 * This file is the main orchestrator of the support automation backend.
 *
 * Its responsibility is to coordinate the high-level processing steps:
 *
 * 1. Analyze the latest user message with context and produce a structured analysis: message-analysis
 *    INPUTS  - latestUserMessage, attachments, previousAnalysisOutput, conversationLogs, attemptHistory, userInformation
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

/**
 * Creates a placeholder function for pipeline steps that are not implemented yet.
 *
 * This makes the orchestrator explicit: every expected step is named, and if one
 * is missing, the error message clearly identifies which step still needs to be implemented.
 *
 * @param {string} stepName - Name of the missing pipeline step.
 * @returns {Function}
 * A function that throws an explicit "not implemented" error.
 */
function createMissingStep(stepName) {
  return function missingStep() {
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
 *
 * @param {Object} input - Full support processing input.
 * @param {Object|string} input.latestUserMessage - Latest user message to process.
 * @param {Array<Object>} [input.attachments] - Optional message attachments.
 * @param {Object|null} [input.previousAnalysisOutput] - Previous structured analysis if available.
 * @param {Array<Object>} [input.conversationLogs] - Conversation history.
 * @param {Array<Object>} [input.attemptHistory] - Previous actions attempted by the user or support system.
 * @param {Object|null} [input.userInformations] - User metadata and context.
 *
 * @param {Object} [steps] - Optional injected pipeline steps, mainly used for tests.
 * @param {Function} [steps.runMessageAnalysis] - Analyzes the latest message and its context.
 * @param {Function} [steps.runSearchingDecision] - Decides whether the pipeline should search for a solution.
 * @param {Function} [steps.runSolutionRetrieval] - Retrieves possible solutions when searchingSolution is true.
 * @param {Function} [steps.runResponseDecision] - Applies decision rules to produce the response plan.
 * @param {Function} [steps.produceResponse] - Builds the final text response from the response plan.
 * @param {Function} [steps.produceTicketData] - Produces the ticket data update.
 *
 * @returns {Object} - Final support processing output including: userResponse, updatedDataTicket, dataCollectorProcessing.
 */
function runSupportProcessingPipeline(input, steps = {}) {
  const pipelineSteps = {
    runMessageAnalysis:
      steps.runMessageAnalysis || createMissingStep("runMessageAnalysis"),

    runSearchingDecision:
      steps.runSearchingDecision || createMissingStep("runSearchingDecision"),

    runSolutionRetrieval:
      steps.runSolutionRetrieval || createMissingStep("runSolutionRetrieval"),

    runResponseDecision:
      steps.runResponseDecision || createMissingStep("runResponseDecision"),

    produceResponse:
      steps.produceResponse || createMissingStep("produceResponse"),

    produceTicketData:
      steps.produceTicketData || createMissingStep("produceTicketData")
  };

  const dataCollectorProcessing = {};

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

module.exports = {
  runSupportProcessingPipeline
};