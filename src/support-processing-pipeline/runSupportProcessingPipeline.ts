/**
 * Main orchestrator of the support processing pipeline.
 */

import { runMessageAnalysis } from "./message-analysis/runMessageAnalysis";
import { runSearchDecision } from "./search-decision/runSearchDecision";
import { runSolutionRetrieval } from "./solution-retrieval/runSolutionRetrieval";
import { runResponsePlan } from "./response-plan/runResponsePlan";
import { runResponseProduction } from "./response-production/runResponseProduction";
import { runPatchesProduction } from "./patches-production/runPatchesProduction";

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
  ResponsePlanInput,
  ResponsePlanOutput,
  ResponseProductionInput,
  ResponseProductionOutput,
  PatchesProductionInput,
  Patches
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

function resolveStep<TInput, TOutput>(
  providedStep: PipelineStep<TInput, TOutput> | undefined,
  defaultStep: PipelineStep<TInput, TOutput> | undefined,
  stepName: string
): PipelineStep<TInput, TOutput> {
  return providedStep || defaultStep || createMissingStep<TInput, TOutput>(stepName);
}

async function runSupportProcessingPipeline(
  inputSupportProcessingPipeline: SupportProcessingPipelineInput,
  steps: SupportProcessingPipelineSteps = {}
): Promise<SupportProcessingPipelineOutput> {
  const pipelineSteps: Required<SupportProcessingPipelineSteps> = {
    runMessageAnalysis: resolveStep<MessageAnalysisInput, MessageAnalysisOutput>(
      steps.runMessageAnalysis,
      runMessageAnalysis,
      "runMessageAnalysis"
    ),

    runSearchDecision: resolveStep<SearchDecisionInput, SearchDecisionOutput>(
      steps.runSearchDecision,
      runSearchDecision,
      "runSearchDecision"
    ),

    runSolutionRetrieval: resolveStep<
      SolutionRetrievalInput,
      SolutionRetrievalOutput
    >(
      steps.runSolutionRetrieval,
      runSolutionRetrieval,
      "runSolutionRetrieval"
    ),

    runResponsePlan: resolveStep<
      ResponsePlanInput,
      ResponsePlanOutput
    >(
      steps.runResponsePlan,
      runResponsePlan,
      "runResponsePlan"
    ),

    runResponseProduction: resolveStep<
      ResponseProductionInput,
      ResponseProductionOutput
    >(
      steps.runResponseProduction,
      runResponseProduction,
      "runResponseProduction"
    ),

    runPatchesProduction: resolveStep<PatchesProductionInput, Patches>(
      steps.runPatchesProduction,
      runPatchesProduction,
      "runPatchesProduction"
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
  let decisionSearchingSolutionForResponsePlan: ResponsePlanInput["decisionSearchingSolution"] = {
    topics: []
  };

  if (turnUnderstandingDelta.segments_topic.length !== 0) {
    const searchDecisionInput: SearchDecisionInput = {
      supportTopicKnowledge,
      turnUnderstandingDelta
    };

    const decisionSearchingSolution =
      await pipelineSteps.runSearchDecision(searchDecisionInput);

    decisionSearchingSolutionForResponsePlan = {
      topics: decisionSearchingSolution.decision.topics
    };

    const shouldSearchSolution =
      decisionSearchingSolution.decision.topics.some((topicDecision) => {
        return topicDecision.type === "solution_searching";
      });

    if (shouldSearchSolution) {
      const solutionRetrievalInput: SolutionRetrievalInput = {
        supportTopicKnowledge,
        turnUnderstandingDelta
      };

      possibleSolutions =
        await pipelineSteps.runSolutionRetrieval(solutionRetrievalInput);
    }
  }

  const responsePlanInput: ResponsePlanInput = {
    securityGateSummary: turnUnderstandingDelta.securityGateSummary ?? {
      gateChecked: {},
      gateFailed: []
    },
    accountTrustStatus,
    accountProfile,
    accountInteractionTraits,
    turnUnderstandingDelta,
    possibleSolutions,
    decisionSearchingSolution: decisionSearchingSolutionForResponsePlan
  };

  const responsePlan =
    await pipelineSteps.runResponsePlan(responsePlanInput);

  const responseProductionInput: ResponseProductionInput = {
    responsePlan
  };

  const userResponse =
    await pipelineSteps.runResponseProduction(responseProductionInput);

  const patchesProductionInput: PatchesProductionInput = {
    turnUnderstandingDelta,
    responsePlan
  };

  const patches =
    await pipelineSteps.runPatchesProduction(patchesProductionInput);

  return {
    userResponse,
    patches
  };
}

export { runSupportProcessingPipeline };
