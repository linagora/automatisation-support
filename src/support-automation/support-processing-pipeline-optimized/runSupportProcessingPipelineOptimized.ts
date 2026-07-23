// =====================================================
// IMPORTS - one brick = function + input + output
// =====================================================

import {detectSuspiciousPromptPatterns, type PromptSecuritySignals} from "./detect-suspicious-prompt-patterns/detectSuspiciousPromptPatterns";
import {planTurnAnalysis, type TurnAnalysisPlan} from "./plan-turn-analysis/planTurnAnalysis";

import {runAnalyzeTextSurface, type AnalyzeTextSurfaceOutput} from "./analyze-text-surface-optimized/runAnalyzeTextSurface";
import {runAnalyzeAttachmentSurface, type AnalyzeAttachmentSurfaceOutput} from "./analyze-attachment-surface-optimized/runAnalyzeAttachmentSurface";

import {buildStandardResponseFragments, type BuildStandardResponseFragmentsOutput} from "./build-standard-response-fragments/buildStandardResponseFragments";

import {runAnalyzeSupportText, type AnalyzeSupportTextOutput, type AnalyzeSupportTextUnderstanding} from "./analyze-support-text-optimized/runAnalyzeSupportText";
import {runAnalyzeSupportAttachments, type AnalyzeSupportAttachmentsOutput} from "./analyze-support-attachments-optimized/runAnalyzeSupportAttachments";

import {runProposeTopicUpdates, type ProposeTopicUpdatesOutput, type TopicUpdatePlan} from "./propose-topic-updates-optimized/runProposeTopicUpdates";

import {runTopicManager, type RunTopicManagerOutput, type TopicPlannerOutput} from "./topic-manager/runTopicManager";
import type {LiveMemoryTopicOptimized} from "../../infrastructure/live-memory/liveMemoryContextOptimized.template";
import {buildMessage, type BuildMessageOutput} from "./composer-message/buildMessage";
import {runTranslateMessage, type TranslateMessageOutput} from "./translator-message/runTranslateMessage";
import {buildLiveMemoryPatches, type BuildLiveMemoryPatchesOutput} from "./build-live-memory-patches/buildLiveMemoryPatches";

// =====================================================
// TYPES — pipeline input / output
// =====================================================

type RunSupportProcessingPipelineV3OptimizedInput = {
  latestUserMessage: {
    content: string;
    channel?: string;
  };
  latestUserAttachments: unknown[];
  liveMemory: SupportLiveMemoryInput;
};

type SupportLiveMemoryInput = {
  topics: LiveMemoryTopicOptimized[];

  previousConversationTurn: {
    previousUserMessage: string | null;
    previousBotMessage: string | null;
  };

  userState: {
    status: "normal" | "safe" | "suspicious" | "dangerous" | string;
    flags: string[];
  };

  securityAlerts: Array<{
    concernedUserMessage: string[];
    concernedAttachment: unknown[];
    flags: string[];
  }>;

  failedPipelineMessages: Array<{
    concernedUserMessage: string[];
    concernedAttachment: unknown[];
    fallbackReason: unknown;
  }>;
};

type PipelineUserResponse = {
  content: string;
  handoffRecommended: boolean;
};
type PipelinePatch = unknown;

type RecentInteractionContext = {
  previousUserMessageSummary?: string;
  previousBotResponseSummary?: string;
  previousBotQuestionFieldNames?: string[];
};

type RunSupportProcessingPipelineV3OptimizedOutput = {
  status: "processed" | "fallback";
  fallbackReason: RunSupportProcessingPipelineV3OptimizedFallbackReason | null;
  userResponse: PipelineUserResponse;
  patches: PipelinePatch[];
  intermOutputs: RunSupportProcessingPipelineV3OptimizedIntermOutputs;
};

type RunSupportProcessingPipelineV3OptimizedFallbackReason =
  | {source: "brick"; brickOutput: unknown}
  | {source: "runner_or_unexpected"; errorMessage: unknown};


// =====================================================
// TYPES — interm outputs
// =====================================================

export type RunSupportProcessingPipelineV3OptimizedIntermOutputs = {
  detectSuspiciousPromptPatternsOutput?: PromptSecuritySignals;
  planTurnAnalysisOutput?: TurnAnalysisPlan;

  analyzeTextSurfaceOutput?: AnalyzeTextSurfaceOutput | null;
  analyzeAttachmentSurfaceOutput?: AnalyzeAttachmentSurfaceOutput | null;

  buildStandardResponseFragmentsOutput?: BuildStandardResponseFragmentsOutput;

  analyzeSupportTextOutput?: AnalyzeSupportTextOutput | null;
  analyzeSupportAttachmentsOutput?: AnalyzeSupportAttachmentsOutput | null;

  proposeTopicUpdatesOutput?: ProposeTopicUpdatesOutput | null;

  topicManagerOutputs?: RunTopicManagerOutput[];

  buildMessageOutput?: BuildMessageOutput;
  translateMessageOutput?: TranslateMessageOutput;
  patchesOutput?: BuildLiveMemoryPatchesOutput;
};

// =====================================================
// RUNNER PRINCIPAL
// =====================================================

async function runSupportProcessingPipelineV3Optimized(
  input: RunSupportProcessingPipelineV3OptimizedInput
): Promise<RunSupportProcessingPipelineV3OptimizedOutput> {
  const intermOutputs: RunSupportProcessingPipelineV3OptimizedIntermOutputs = {};
  const currentUserMessage = input.latestUserMessage;
  const recentInteractionContext: RecentInteractionContext = {
    previousUserMessageSummary: input.liveMemory.previousConversationTurn.previousUserMessage ?? undefined,
    previousBotResponseSummary: input.liveMemory.previousConversationTurn.previousBotMessage ?? undefined,
    previousBotQuestionFieldNames: []
  };

  try {
    // -----------------------------------------------------
    // 1. Deterministic preflight
    // -----------------------------------------------------

    intermOutputs.detectSuspiciousPromptPatternsOutput =
      detectSuspiciousPromptPatterns({latestUserMessage: input.latestUserMessage});

    intermOutputs.planTurnAnalysisOutput =
      planTurnAnalysis({
        latestUserMessage: input.latestUserMessage,
        latestUserAttachments: input.latestUserAttachments,
        promptSecuritySignals: intermOutputs.detectSuspiciousPromptPatternsOutput,
        accountTrustStatus: {status: input.liveMemory.userState.status}
      });

    // -----------------------------------------------------
    // 2. No analysis path enabled
    // -----------------------------------------------------

    if (
      intermOutputs.planTurnAnalysisOutput.analyzeText !== true &&
      intermOutputs.planTurnAnalysisOutput.analyzeAttachments !== true
    ) {
      return buildNotAnalyzedOutput({input, intermOutputs});
    }

    // -----------------------------------------------------
    // 3. Text / attachment surface analysis
    // -----------------------------------------------------

    if (
      intermOutputs.planTurnAnalysisOutput.analyzeText === true &&
      intermOutputs.planTurnAnalysisOutput.analyzeAttachments === true
    ) {
      [
        intermOutputs.analyzeTextSurfaceOutput,
        intermOutputs.analyzeAttachmentSurfaceOutput
      ] = await Promise.all([
        runAnalyzeTextSurface({
          latestUserMessage: input.latestUserMessage,
          turnAnalysisPlan: intermOutputs.planTurnAnalysisOutput,
          recentInteractionContext
        }),
        runAnalyzeAttachmentSurface({
          latestUserMessage: input.latestUserMessage,
          latestUserAttachments: input.latestUserAttachments,
          turnAnalysisPlan: intermOutputs.planTurnAnalysisOutput
        })
      ]);

      if (intermOutputs.analyzeTextSurfaceOutput.status === "fallback") return buildPipelineFallback({input, intermOutputs, fallbackReason: {source: "brick", brickOutput: intermOutputs.analyzeTextSurfaceOutput}});
      if (intermOutputs.analyzeAttachmentSurfaceOutput.status === "fallback") return buildPipelineFallback({input, intermOutputs, fallbackReason: {source: "brick", brickOutput: intermOutputs.analyzeAttachmentSurfaceOutput}});
    }

    else if (intermOutputs.planTurnAnalysisOutput.analyzeText === true) {
      intermOutputs.analyzeTextSurfaceOutput =
        await runAnalyzeTextSurface({
          latestUserMessage: input.latestUserMessage,
          turnAnalysisPlan: intermOutputs.planTurnAnalysisOutput,
          recentInteractionContext
        });

      intermOutputs.analyzeAttachmentSurfaceOutput = null;

      if (intermOutputs.analyzeTextSurfaceOutput.status === "fallback") return buildPipelineFallback({input, intermOutputs, fallbackReason: {source: "brick", brickOutput: intermOutputs.analyzeTextSurfaceOutput}});
    }

    else if (intermOutputs.planTurnAnalysisOutput.analyzeAttachments === true) {
      intermOutputs.analyzeTextSurfaceOutput = null;

      intermOutputs.analyzeAttachmentSurfaceOutput =
        await runAnalyzeAttachmentSurface({
          latestUserMessage: input.latestUserMessage,
          latestUserAttachments: input.latestUserAttachments,
          turnAnalysisPlan: intermOutputs.planTurnAnalysisOutput
        });

      if (intermOutputs.analyzeAttachmentSurfaceOutput.status === "fallback") return buildPipelineFallback({input, intermOutputs, fallbackReason: {source: "brick", brickOutput: intermOutputs.analyzeAttachmentSurfaceOutput}});
    }

    // -----------------------------------------------------
    // 4. Standard fragments
    // -----------------------------------------------------

    if (intermOutputs.analyzeTextSurfaceOutput !== null) {
      intermOutputs.buildStandardResponseFragmentsOutput =
        buildStandardResponseFragments({
          ...(intermOutputs.analyzeTextSurfaceOutput?.status === "analyzed"
            ? {textSurfaceAnalysis: intermOutputs.analyzeTextSurfaceOutput}
            : {})
        });
    }

    // -----------------------------------------------------
    // 5. Short route: standard only
    // -----------------------------------------------------

    const hasSupportRelevant =
      hasSupportRelevantTextSegments(intermOutputs.analyzeTextSurfaceOutput) ||
      hasSupportRelevantAttachments(intermOutputs.analyzeAttachmentSurfaceOutput);

    if (!hasSupportRelevant) {
      // Deterministic composer.
      // It simply concatenates the standardResponseFragments already built earlier.
      intermOutputs.buildMessageOutput =
        buildMessage({
          standardResponseFragments: intermOutputs.buildStandardResponseFragmentsOutput ?? [],
          topicMessages: []
        });

      // Translator LLM.
      // If the language is already correct, it returns the message unchanged.
      intermOutputs.translateMessageOutput =
        await runTranslateMessage({
          message: intermOutputs.buildMessageOutput.message,
          targetLanguage: getTargetLanguage(intermOutputs.analyzeTextSurfaceOutput)
        });

      if (intermOutputs.translateMessageOutput.status === "fallback") {
        return buildPipelineFallback({
          input,
          intermOutputs,
          fallbackReason: {
            source: "brick",
            brickOutput: intermOutputs.translateMessageOutput
          }
        });
      }

      // Deterministic patches.
      // No local fallback: if an unexpected bug occurs, the pipeline-level try/catch catches it.
      intermOutputs.patchesOutput =
        buildLiveMemoryPatches({
          latestUserMessage: input.latestUserMessage,
          latestUserAttachments: input.latestUserAttachments,
          intermOutputs
        });

      return {
        status: "processed",
        fallbackReason: null,
        userResponse: buildUserResponseFromMessage(
          intermOutputs.translateMessageOutput.message,
          hasHandoverRequestedSurface(intermOutputs.analyzeTextSurfaceOutput)
        ),
        patches: extractPatches(intermOutputs.patchesOutput),
        intermOutputs
      };
    }

    // -----------------------------------------------------
    // 6. Deep support text / attachment
    // -----------------------------------------------------

    const shouldAnalyzeSupportText =
      hasSupportRelevantTextSegments(intermOutputs.analyzeTextSurfaceOutput);

    const shouldAnalyzeSupportAttachments =
      hasSupportRelevantAttachments(intermOutputs.analyzeAttachmentSurfaceOutput);

    const supportTextSurfaceAnalysis =
      shouldAnalyzeSupportText && intermOutputs.analyzeTextSurfaceOutput?.status === "analyzed"
        ? intermOutputs.analyzeTextSurfaceOutput
        : null;

    if (shouldAnalyzeSupportText && shouldAnalyzeSupportAttachments) {
      [
        intermOutputs.analyzeSupportTextOutput,
        intermOutputs.analyzeSupportAttachmentsOutput
      ] = await Promise.all([
        runAnalyzeSupportText({
          textSurfaceAnalysis: supportTextSurfaceAnalysis ?? {segments: []},
          recentInteractionContext
        }),
        runAnalyzeSupportAttachments({
          attachmentSurfaceAnalysis: intermOutputs.analyzeAttachmentSurfaceOutput,
          latestUserAttachments: input.latestUserAttachments,
          recentInteractionContext
        })
      ]);

      if (intermOutputs.analyzeSupportTextOutput.status === "fallback") return buildPipelineFallback({input, intermOutputs, fallbackReason: {source: "brick", brickOutput: intermOutputs.analyzeSupportTextOutput}});
      if (intermOutputs.analyzeSupportAttachmentsOutput.status === "fallback") return buildPipelineFallback({input, intermOutputs, fallbackReason: {source: "brick", brickOutput: intermOutputs.analyzeSupportAttachmentsOutput}});
    }

    else if (shouldAnalyzeSupportText) {
      intermOutputs.analyzeSupportTextOutput =
        await runAnalyzeSupportText({
          textSurfaceAnalysis: supportTextSurfaceAnalysis ?? {segments: []},
          recentInteractionContext
        });

      intermOutputs.analyzeSupportAttachmentsOutput = null;

      if (intermOutputs.analyzeSupportTextOutput.status === "fallback") return buildPipelineFallback({input, intermOutputs, fallbackReason: {source: "brick", brickOutput: intermOutputs.analyzeSupportTextOutput}});
    }

    else if (shouldAnalyzeSupportAttachments) {
      intermOutputs.analyzeSupportTextOutput = null;

      intermOutputs.analyzeSupportAttachmentsOutput =
        await runAnalyzeSupportAttachments({
          attachmentSurfaceAnalysis: intermOutputs.analyzeAttachmentSurfaceOutput,
          latestUserAttachments: input.latestUserAttachments,
          recentInteractionContext
        });

      if (intermOutputs.analyzeSupportAttachmentsOutput.status === "fallback") return buildPipelineFallback({input, intermOutputs, fallbackReason: {source: "brick", brickOutput: intermOutputs.analyzeSupportAttachmentsOutput}});
    }

    // -----------------------------------------------------
    // 7. Topic updates
    // -----------------------------------------------------

    const supportUnderstandings =
      intermOutputs.analyzeSupportTextOutput?.status === "analyzed"
        ? intermOutputs.analyzeSupportTextOutput.understandings
        : [];

    intermOutputs.proposeTopicUpdatesOutput =
      await runProposeTopicUpdates({
        understandings: supportUnderstandings,
        existingTopics: input.liveMemory.topics,
        recentInteractionContext
      });

    if (intermOutputs.proposeTopicUpdatesOutput.status === "fallback") return buildPipelineFallback({input, intermOutputs, fallbackReason: {source: "brick", brickOutput: intermOutputs.proposeTopicUpdatesOutput}});

    if (intermOutputs.proposeTopicUpdatesOutput.status !== "analyzed") {
      throw new Error("Unexpected proposeTopicUpdatesOutput status");
    }

    // -----------------------------------------------------
    // 8. Topic managers in parallel
    // -----------------------------------------------------

    const topicManagerOutputs =
      await Promise.all(
        intermOutputs.proposeTopicUpdatesOutput.topicUpdatePlans.map((topicUpdatePlan) => {
          return runTopicManager({
            topicUpdatePlan,
            currentTopic: selectCurrentTopic(input.liveMemory, topicUpdatePlan),
            sourceUnderstandings: selectSourceUnderstandings(
              supportUnderstandings,
              topicUpdatePlan.sourceUnderstandingIds
            ),
            currentUserMessage: {
              content: currentUserMessage.content,
              channel: currentUserMessage.channel
            },
            previousConversationTurn: input.liveMemory.previousConversationTurn
          });
        })
      );

    intermOutputs.topicManagerOutputs = topicManagerOutputs;

    const failedTopicManager =
      topicManagerOutputs.find((topicManagerOutput) => topicManagerOutput.status === "fallback");

    if (failedTopicManager) return buildPipelineFallback({input, intermOutputs, fallbackReason: {source: "brick", brickOutput: failedTopicManager.fallbackReason}});

    const topicPlannerOutputs =
      topicManagerOutputs.map((topicManagerOutput) => {
        if (topicManagerOutput.topicPlannerOutput === null) throw new Error("Missing topicPlannerOutput");
        return topicManagerOutput.topicPlannerOutput;
      });

    // -----------------------------------------------------
    // 9. Composer message
    // -----------------------------------------------------

    intermOutputs.buildMessageOutput =
      buildMessage({
        standardResponseFragments: intermOutputs.buildStandardResponseFragmentsOutput ?? [],
        topicMessages: topicPlannerOutputs
      });

    // -----------------------------------------------------
    // 10. Translator message
    // -----------------------------------------------------

    intermOutputs.translateMessageOutput =
      await runTranslateMessage({
        message: intermOutputs.buildMessageOutput.message,
        targetLanguage: getTargetLanguage(intermOutputs.analyzeTextSurfaceOutput)
      });

    if (intermOutputs.translateMessageOutput.status === "fallback") {
      return buildPipelineFallback({
        input,
        intermOutputs,
        fallbackReason: {
          source: "brick",
          brickOutput: intermOutputs.translateMessageOutput
        }
      });
    }
    // -----------------------------------------------------
    // 11. Patches
    // -----------------------------------------------------

    intermOutputs.patchesOutput =
      buildLiveMemoryPatches({
        latestUserMessage: input.latestUserMessage,
        latestUserAttachments: input.latestUserAttachments,
        intermOutputs
      });

    return {
      status: "processed",
      fallbackReason: null,
      userResponse: buildUserResponseFromMessage(
        intermOutputs.translateMessageOutput.message,
        hasHandoverRequestedSurface(intermOutputs.analyzeTextSurfaceOutput) ||
          hasTopicManagerHandoverRequested(intermOutputs.topicManagerOutputs)
      ),
      patches: extractPatches(intermOutputs.patchesOutput),
      intermOutputs
    };
  }

  catch (error) {
    return buildPipelineFallback({
      input,
      intermOutputs,
      fallbackReason: {source: "runner_or_unexpected", errorMessage: error}
    });
  }
}


// =====================================================
// TOPIC BRANCH INPUT HELPERS
// =====================================================

function selectCurrentTopic(
  liveMemory: SupportLiveMemoryInput,
  topicUpdatePlan: TopicUpdatePlan
): LiveMemoryTopicOptimized | null {
  if (topicUpdatePlan.topicId === null) return null;

  return liveMemory.topics.find((topic) => {
    return topic.sourceProposeTopicUpdates.topicId === topicUpdatePlan.topicId;
  }) ?? null;
}

function selectSourceUnderstandings(
  supportUnderstandings: AnalyzeSupportTextUnderstanding[],
  sourceUnderstandingIds: string[]
): AnalyzeSupportTextUnderstanding[] {
  const sourceIdSet = new Set(sourceUnderstandingIds);
  return supportUnderstandings.filter((understanding) => {
    return sourceIdSet.has(understanding.understandingId);
  });
}

function hasSupportRelevantTextSegments(
  output: AnalyzeTextSurfaceOutput | null | undefined
): boolean {
  return output?.status === "analyzed" &&
    output.segments.some((segment) => segment.category === "support_relevant");
}

function hasSupportRelevantAttachments(
  output: AnalyzeAttachmentSurfaceOutput | null | undefined
): boolean {
  return output?.status === "analyzed" &&
    output.attachments.some((attachment) => attachment.supportRelevant === true);
}

function hasHandoverRequestedSurface(
  output: AnalyzeTextSurfaceOutput | null | undefined
): boolean {
  return output?.status === "analyzed" &&
    output.segments.some((segment) => {
      const candidate = segment as {
        standardSubcategory?: unknown;
        standardAction?: unknown;
      };

      return candidate.standardSubcategory === "handover_requested" ||
        candidate.standardAction === "handover_requested";
    });
}

function hasTopicManagerHandoverRequested(
  outputs: RunTopicManagerOutput[] | undefined
): boolean {
  return outputs?.some((output) => {
    return output.status === "processed" &&
      output.sourceTopicManager.handover.isRequested === true;
  }) ?? false;
}

function getTargetLanguage(
  output: AnalyzeTextSurfaceOutput | null | undefined
): string | null {
  return output?.status === "analyzed" ? output.userLanguage : null;
}

function buildUserResponseFromMessage(
  message: string,
  handoffRecommended = false
): PipelineUserResponse {
  return {
    content: message,
    handoffRecommended
  };
}

function extractPatches(output: BuildLiveMemoryPatchesOutput): PipelinePatch[] {
  return [output];
}

// =====================================================
// OUTPUT BUILDERS
// =====================================================

function buildPipelineFallback(params: {
  input: RunSupportProcessingPipelineV3OptimizedInput;
  intermOutputs: RunSupportProcessingPipelineV3OptimizedIntermOutputs;
  fallbackReason: RunSupportProcessingPipelineV3OptimizedFallbackReason;
}): RunSupportProcessingPipelineV3OptimizedOutput {
  return {
    status: "fallback",
    fallbackReason: params.fallbackReason,
    userResponse: {
      content: "Technical issue while processing the request. A support team member will take over.",
      handoffRecommended: true
    },
    patches: [
      {
        type: "pipeline_fallback",
        fallbackReason: params.fallbackReason,
        latestUserMessage: params.input.latestUserMessage,
        latestUserAttachmentsCount: params.input.latestUserAttachments.length
      }
    ],
    intermOutputs: params.intermOutputs
  };
}

function buildNotAnalyzedOutput(params: {
  input: RunSupportProcessingPipelineV3OptimizedInput;
  intermOutputs: RunSupportProcessingPipelineV3OptimizedIntermOutputs;
}): RunSupportProcessingPipelineV3OptimizedOutput {
  return {
    status: "processed",
    fallbackReason: null,
    userResponse: {
      content: "We could not automatically analyze your message. A support team member may take over if needed.",
      handoffRecommended: true
    },
    patches: [
      {
        type: "turn_not_analyzed",
        latestUserMessage: params.input.latestUserMessage,
        latestUserAttachmentsCount: params.input.latestUserAttachments.length
      }
    ],
    intermOutputs: params.intermOutputs
  };
}