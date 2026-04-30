/**
 * Support Processing Pipeline
 *
 * This file is the main orchestrator of the support automation backend.
 *
 * Its responsibility is to coordinate the high-level processing steps:
 *
 * 1. Analyze the latest user message and produce a structured analysis.
 * 2. Produce an initial decision based on this structured analysis.
 * 3. Optionally retrieve a solution if the initial decision requires it.
 * 4. Refine the initial decision with the retrieval result if retrieval was used.
 * 5. Build a response plan for the user from the final decision.
 * 6. Finalize the output: user response, ticket patch, logs and debug data.
 *
 * Important:
 * This file should remain an orchestrator only.
 * Business logic must stay inside the dedicated modules:
 * - message-analysis
 * - decision-engine
 * - solution-retrieval
 * - decision-refinement
 * - response-planning
 * - output-finalizer
 */

/**
 * Creates a placeholder function for pipeline steps that are not implemented yet.
 *
 * This makes the orchestrator explicit: every expected step is named, and if one
 * is missing, the error message clearly identifies which step still needs to be implemented.
 *
 * @param {string} stepName - Name of the missing pipeline step.
 *
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
 * @param {Object} input.latestUserMessage - Latest user message to process.
 * @param {string} input.latestUserMessage.text - Latest user message text.
 * @param {string} [input.latestUserMessage.messageId] - Optional message identifier.
 * @param {string} [input.latestUserMessage.createdAt] - Optional message creation date.
 * @param {Array<Object>} [input.attachments] - Optional message attachments.
 * @param {Object|null} [input.previousAnalysisOutput] - Previous structured analysis if available.
 * @param {Array<Object>} [input.conversationLogs] - Conversation history.
 * @param {Array<Object>} [input.attemptHistory] - Previous actions attempted by the user or support system.
 * @param {Object|null} [input.userContext] - User metadata and context.
 *
 * @param {Object} [steps] - Optional injected pipeline steps, mainly used for tests.
 *
 * @param {Function} [steps.runMessageAnalysis]
 * Analyzes the latest message and its context.
 *
 * Expected input:
 * {
 *   latestUserMessage,
 *   attachments,
 *   previousAnalysisOutput,
 *   conversationLogs,
 *   attemptHistory,
 * }
 *
 * Expected output:
 * {
 *   currentAnalysisOutput : MAJ de previousAnalysisOutput 
 * }
 *
 * @param {Function} [steps.runSupportDecisionEngine]
 * Produces the initial decision from the structured analysis.
 *
 * Expected input:
 * {
 *   supportAnalysisOutput,
 *   conversationLogs,
 *   attemptHistory,
 *   userContext
 * }
 *
 * Expected output:
 * {
 *   nextAction,
 *   responsePlanDraft,
 *   ticketPatchDraft,
 *   reason,
 *   debug
 * }
 *
 * Expected nextAction examples:
 * - ask_info
 * - retrieve_solution
 * - handover
 * - store_signal
 * - store_scope_boundary
 * - no_action_needed
 *
 * @param {Function} [steps.runSolutionRetrieval]
 * Retrieves a solution when the initial decision requires it.
 *
 * Expected input:
 * {
 *   initialDecision,
 *   supportAnalysisOutput,
 *   conversationLogs,
 *   attemptHistory,
 *   userContext
 * }
 *
 * Expected output:
 * {
 *   solutionFound,
 *   confidence,
 *   sources,
 *   suggestedSteps,
 *   evidencePackage,
 *   debug
 * }
 *
 * @param {Function} [steps.refineSupportDecision]
 * Refines the initial decision after optional solution retrieval.
 *
 * Expected input:
 * {
 *   initialDecision,
 *   retrievalResult,
 *   supportAnalysisOutput,
 *   userContext
 * }
 *
 * Expected output:
 * {
 *   nextAction,
 *   responsePlan,
 *   ticketPatch,
 *   reason,
 *   debug
 * }
 *
 * If no retrieval was required, this step can simply return a final decision
 * equivalent to the initial decision.
 *
 * @param {Function} [steps.buildResponsePlan]
 * Builds the response strategy and draft user response from the final decision.
 *
 * Expected input:
 * {
 *   finalDecision,
 *   retrievalResult,
 *   supportAnalysisOutput,
 *   userContext
 * }
 *
 * Expected output:
 * {
 *   userResponseDraft,
 *   responsePlan,
 *   ticketPatchDraft,
 *   debug
 * }
 *
 * @param {Function} [steps.finalizeSupportOutput]
 * Assembles the final standardized output.
 *
 * Expected input:
 * {
 *   messageAnalysisResult,
 *   initialDecision,
 *   retrievalResult,
 *   finalDecision,
 *   responseResult
 * }
 *
 * Expected output:
 * {
 *   userResponse,
 *   ticketPatch,
 *   logs,
 *   debug
 * }
 *
 * @returns {Object}
 * Final support processing output.
 *
 * Expected output:
 * {
 *   userResponse,
 *   ticketPatch,
 *   logs,
 *   debug
 * }
 */
function runSupportProcessingPipeline(input, steps = {}) {
  const pipelineSteps = {
    runMessageAnalysis:
      steps.runMessageAnalysis || createMissingStep("runMessageAnalysis"),

    runSupportDecisionEngine:
      steps.runSupportDecisionEngine || createMissingStep("runSupportDecisionEngine"),

    runSolutionRetrieval:
      steps.runSolutionRetrieval || createMissingStep("runSolutionRetrieval"),

    refineSupportDecision:
      steps.refineSupportDecision || createMissingStep("refineSupportDecision"),

    buildResponsePlan:
      steps.buildResponsePlan || createMissingStep("buildResponsePlan"),

    finalizeSupportOutput:
      steps.finalizeSupportOutput || createMissingStep("finalizeSupportOutput")
  };

  /**
   * Step 1: Message analysis
   *
   * Transforms the latest user message and its context into a normalized
   * supportAnalysisOutput.
   *
   * This step may later involve spam detection, attachment analysis, LLM0
   * lightweight routing, LLM1 full support analysis, schema validation and
   * normalization.
   */
  const messageAnalysisResult = pipelineSteps.runMessageAnalysis({
    latestUserMessage: input.latestUserMessage,
    attachments: input.attachments,
    previousAnalysisOutput: input.previousAnalysisOutput,
    conversationLogs: input.conversationLogs,
    attemptHistory: input.attemptHistory,
    userContext: input.userContext
  });

  /**
   * Step 2: Initial decision
   *
   * Reads the structured support analysis and decides the next action before
   * any optional solution retrieval.
   */
  const initialDecision = pipelineSteps.runSupportDecisionEngine({
    supportAnalysisOutput: messageAnalysisResult.supportAnalysisOutput,
    conversationLogs: input.conversationLogs,
    attemptHistory: input.attemptHistory,
    userContext: input.userContext
  });

  /**
   * Step 3: Optional solution retrieval
   *
   * This step only runs when the initial decision explicitly asks for solution
   * retrieval.
   *
   * The action name is intentionally business-oriented: "retrieve_solution".
   * The fact that the implementation may use RAG/OpenRAG is an internal detail.
   */
  let retrievalResult = null;

  if (initialDecision.nextAction === "retrieve_solution") {
    retrievalResult = pipelineSteps.runSolutionRetrieval({
      initialDecision,
      supportAnalysisOutput: messageAnalysisResult.supportAnalysisOutput,
      conversationLogs: input.conversationLogs,
      attemptHistory: input.attemptHistory,
      userContext: input.userContext
    });
  }

  /**
   * Step 4: Decision refinement
   *
   * Converts the initial decision into a final decision.
   *
   * If retrieval was executed, this step uses the retrieval result to decide
   * whether the system should answer directly, hand over, ask for more
   * information, or keep another appropriate action.
   *
   * If retrieval was not executed, this step should mostly preserve the initial
   * decision while converting it to the final decision contract.
   */
  const finalDecision = pipelineSteps.refineSupportDecision({
    initialDecision,
    retrievalResult,
    supportAnalysisOutput: messageAnalysisResult.supportAnalysisOutput,
    userContext: input.userContext
  });

  /**
   * Step 5: Response planning
   *
   * Builds the response plan from the final decision.
   *
   * This step should not decide whether a solution is reliable.
   * That decision belongs to decision-refinement.
   */
  const responseResult = pipelineSteps.buildResponsePlan({
    finalDecision,
    retrievalResult,
    supportAnalysisOutput: messageAnalysisResult.supportAnalysisOutput,
    userContext: input.userContext
  });

  /**
   * Step 6: Output finalization
   *
   * Assembles the final standardized output.
   *
   * This step should not make new business decisions.
   * It only packages the final user response, ticket patch, logs and debug data.
   */
  return pipelineSteps.finalizeSupportOutput({
    messageAnalysisResult,
    initialDecision,
    retrievalResult,
    finalDecision,
    responseResult
  });
}

module.exports = {
  runSupportProcessingPipeline
};