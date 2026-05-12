/**
 * Main orchestrator of the support processing pipeline.
 */

import type {
  SupportProcessingPipelineInput,
  SupportProcessingPipelineOutput,
  SupportProcessingPipelineSteps,
  MessageAnalysisInput,
  SearchDecisionInput,
  SolutionRetrievalInput,
  ResponseDecisionInput,
  ResponseProductionInput,
  DataProductionInput,
  TurnUnderstandingDelta,
  DecisionSearchingSolution,
  PossibleSolution,
  ResponsePlan,
  UserResponse,
  DataProductionOutput
} from "./typesSupportProcessingPipeline.types.ts";

type MaybePromise<T> = T | Promise<T>;

type PipelineStep<TInput, TOutput> = (input: TInput) => MaybePromise<TOutput>;

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
      createMissingStep<MessageAnalysisInput, TurnUnderstandingDelta>(
        "runMessageAnalysis"
      ),

    runSearchDecision:
      steps.runSearchDecision ||
      createMissingStep<SearchDecisionInput, DecisionSearchingSolution>(
        "runSearchDecision"
      ),

    runSolutionRetrieval:
      steps.runSolutionRetrieval ||
      createMissingStep<SolutionRetrievalInput, PossibleSolution[]>(
        "runSolutionRetrieval"
      ),

    runResponseDecision:
      steps.runResponseDecision ||
      createMissingStep<ResponseDecisionInput, ResponsePlan>(
        "runResponseDecision"
      ),

    runResponseProduction:
      steps.runResponseProduction ||
      createMissingStep<ResponseProductionInput, UserResponse>(
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

  let possibleSolutions: PossibleSolution[] = [];

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

  const {
    supportTopicKnowledgePatch,
    conversationHistoryPatch,
    accountTrustStatusPatch,
    accountInteractionTraitsPatch
  } = await pipelineSteps.runDataProduction(dataProductionInput);

  return {
    userResponse,
    patches: {
      supportTopicKnowledgePatch,
      conversationHistoryPatch,
      accountTrustStatusPatch,
      accountInteractionTraitsPatch
    }
  };
}

export { runSupportProcessingPipeline };