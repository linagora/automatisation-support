/**
 * Main orchestrator of the support processing pipeline.
 */

import type {
  SupportProcessingPipelineInput,
  SupportProcessingPipelineOutput,
  SupportProcessingPipelineSteps,
  MessageAnalysisInput,
  MessageAnalysisOutput,
  SearchDecisionInput,
  SearchDecisionOutput,
  SolutionRetrievalInput,
  SolutionRetrievalOutput,
  ResponseDecisionInput,
  ResponseDecisionOutput,
  ResponseProductionInput,
  ResponseProductionOutput,
  DataProductionInput,
  DataProductionOutput,
  PipelinePatches
} from "./typesSupportProcessingPipeline.types";

type MaybePromise<T> = T | Promise<T>;

type PipelineStep<TInput, TOutput> = (
  input: TInput
) => MaybePromise<TOutput>;

function createMissingStep<TInput, TOutput>(
  stepName: string
): PipelineStep<TInput, TOutput> {
  return function missingStep(): never {
    throw new Error(`${stepName} is not implemented yet`);
  };
}

async function runSupportProcessingPipeline(
  inputSupportProcessingPipeline: SupportProcessingPipelineInput,
  steps: SupportProcessingPipelineSteps = {}
): Promise<SupportProcessingPipelineOutput> {
  const pipelineSteps: Required<SupportProcessingPipelineSteps> = {
    runMessageAnalysis:
      steps.runMessageAnalysis ||
      createMissingStep<MessageAnalysisInput, MessageAnalysisOutput>(
        "runMessageAnalysis"
      ),

    runSearchDecision:
      steps.runSearchDecision ||
      createMissingStep<SearchDecisionInput, SearchDecisionOutput>(
        "runSearchDecision"
      ),

    runSolutionRetrieval:
      steps.runSolutionRetrieval ||
      createMissingStep<SolutionRetrievalInput, SolutionRetrievalOutput>(
        "runSolutionRetrieval"
      ),

    runResponseDecision:
      steps.runResponseDecision ||
      createMissingStep<ResponseDecisionInput, ResponseDecisionOutput>(
        "runResponseDecision"
      ),

    runResponseProduction:
      steps.runResponseProduction ||
      createMissingStep<ResponseProductionInput, ResponseProductionOutput>(
        "runResponseProduction"
      ),

    runDataProduction:
      steps.runDataProduction ||
      createMissingStep<DataProductionInput, DataProductionOutput>(
        "runDataProduction"
      )
  };

  const {
    latestUserMessage,
    latestUserAttachments,
    accountTrustStatus,
    accountProfile,
    accountInteractionTraits,
    supportTopicKnowledge,
    conversationHistory
  } = inputSupportProcessingPipeline;

  const messageAnalysisInput: MessageAnalysisInput = {
    latestUserMessage,
    latestUserAttachments,
    accountTrustStatus,
    supportTopicKnowledge,
    conversationHistory
  };

  const turnUnderstandingDelta =
    await pipelineSteps.runMessageAnalysis(messageAnalysisInput);

  let possibleSolutions: SolutionRetrievalOutput = [];

  if (turnUnderstandingDelta.segments_topic.length !== 0) {
    const searchDecisionInput: SearchDecisionInput = {
      supportTopicKnowledge,
      turnUnderstandingDelta
    };

    const decisionSearchingSolution =
      await pipelineSteps.runSearchDecision(searchDecisionInput);

    if (decisionSearchingSolution.shouldSearchSolution === true) {
      const solutionRetrievalInput: SolutionRetrievalInput = {
        supportTopicKnowledge,
        turnUnderstandingDelta
      };

      possibleSolutions =
        await pipelineSteps.runSolutionRetrieval(solutionRetrievalInput);
    }
  }

  const responseDecisionInput: ResponseDecisionInput = {
    accountTrustStatus,
    accountProfile,
    accountInteractionTraits,
    supportTopicKnowledge,
    turnUnderstandingDelta,
    possibleSolutions
  };

  const responsePlan =
    await pipelineSteps.runResponseDecision(responseDecisionInput);

  const responseProductionInput: ResponseProductionInput = {
    responsePlan
  };

  const userResponse =
    await pipelineSteps.runResponseProduction(responseProductionInput);

  const dataProductionInput: DataProductionInput = {
    turnUnderstandingDelta,
    responsePlan
  };

  const dataProductionOutput =
    await pipelineSteps.runDataProduction(dataProductionInput);

  const patches: PipelinePatches = {
    supportTopicKnowledgePatch: dataProductionOutput.supportTopicKnowledgePatch,
    conversationHistoryPatch: dataProductionOutput.conversationHistoryPatch
  };

  if (dataProductionOutput.accountTrustStatusPatch) {
    patches.accountTrustStatusPatch =
      dataProductionOutput.accountTrustStatusPatch;
  }

  if (dataProductionOutput.accountInteractionTraitsPatch) {
    patches.accountInteractionTraitsPatch =
      dataProductionOutput.accountInteractionTraitsPatch;
  }

  return {
    userResponse,
    patches
  };
}

export { runSupportProcessingPipeline };