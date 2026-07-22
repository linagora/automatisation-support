// =====================================================
// IMPORTS — une brique = fonction + input + output
// =====================================================

import {detectSuspiciousPromptPatterns, type DetectSuspiciousPromptPatternsInput, type DetectSuspiciousPromptPatternsOutput} from "./detect-suspicious-prompt-patterns/detectSuspiciousPromptPatterns";
import {planTurnAnalysis, type PlanTurnAnalysisInput, type TurnAnalysisPlan} from "./plan-turn-analysis/planTurnAnalysis";

import {runAnalyzeTextSurface, type AnalyzeTextSurfaceInput, type AnalyzeTextSurfaceOutput} from "./analyze-text-surface-optimized/runAnalyzeTextSurface";
import {runAnalyzeAttachmentSurface, type AnalyzeAttachmentSurfaceInput, type AnalyzeAttachmentSurfaceOutput} from "./analyze-attachment-surface-optimized/runAnalyzeAttachmentSurface";

import {buildStandardResponseFragments, type BuildStandardResponseFragmentsInput, type BuildStandardResponseFragmentsOutput} from "./build-standard-response-fragments/buildStandardResponseFragments";

import {runAnalyzeSupportText, type AnalyzeSupportTextInput, type AnalyzeSupportTextOutput, type AnalyzeSupportTextUnderstanding} from "./analyze-support-text-optimized/runAnalyzeSupportText";
import {runAnalyzeSupportAttachments, type AnalyzeSupportAttachmentsInput, type AnalyzeSupportAttachmentsOutput} from "./analyze-support-attachments-optimized/runAnalyzeSupportAttachments";

import {runProposeTopicUpdates, type ProposeTopicUpdatesInput, type ProposeTopicUpdatesOutput, type TopicUpdatePlan} from "./propose-topic-updates-optimized/runProposeTopicUpdates";

import {runTopicBranch, type LiveMemoryTopicOptimized, type SupportUnderstanding, type TopicBranchOutput, type TopicPlannerOutput} from "./topic-branch-optimized-v3/runTopicBranch";
import {buildMessage, type BuildMessageInput, type BuildMessageOutput} from "./composer-message/buildMessage";
import {runTranslateMessage, type TranslateMessageInput, type TranslateMessageOutput} from "./translator-message/runTranslateMessage";
import {buildSupportPatches, type BuildSupportPatchesInput, type BuildSupportPatchesOutput} from "./build-support-patches-optimized/buildSupportPatches";

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
  topics: unknown[];
  lastUserVerbatim?: string;
  lastBotVerbatim?: string;
  userState?: {
    status?: string;
    flags?: unknown[];
  };
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

type PipelineUserResponse = unknown;
type PipelinePatch = unknown;


// =====================================================
// TYPES — interm outputs
// =====================================================

type RunSupportProcessingPipelineV3OptimizedIntermOutputs = {
  detectSuspiciousPromptPatternsOutput?: DetectSuspiciousPromptPatternsOutput;
  planTurnAnalysisOutput?: TurnAnalysisPlan;

  analyzeTextSurfaceOutput?: AnalyzeTextSurfaceOutput | null;
  analyzeAttachmentSurfaceOutput?: AnalyzeAttachmentSurfaceOutput | null;

  buildStandardResponseFragmentsOutput?: BuildStandardResponseFragmentsOutput;

  analyzeSupportTextOutput?: AnalyzeSupportTextOutput | null;
  analyzeSupportAttachmentsOutput?: AnalyzeSupportAttachmentsOutput | null;

  proposeTopicUpdatesOutput?: ProposeTopicUpdatesOutput | null;

  topicBranchOutputs?: TopicBranchOutput[];

  buildMessageOutput?: BuildMessageOutput;
  translateMessageOutput?: TranslateMessageOutput;
  patchesOutput?: BuildSupportPatchesOutput;
};

// =====================================================
// RUNNER PRINCIPAL
// =====================================================

async function runSupportProcessingPipelineV3Optimized(
  input: RunSupportProcessingPipelineV3OptimizedInput
): Promise<RunSupportProcessingPipelineV3OptimizedOutput> {
  const intermOutputs: RunSupportProcessingPipelineV3OptimizedIntermOutputs = {};
  const currentUserMessage = input.latestUserMessage;
  const recentInteractionContext = buildRecentInteractionContext(input.liveMemory);

  try {
    // -----------------------------------------------------
    // 1. Préflight déterministe
    // -----------------------------------------------------

    intermOutputs.detectSuspiciousPromptPatternsOutput =
      detectSuspiciousPromptPatterns({latestUserMessage: input.latestUserMessage});

    intermOutputs.planTurnAnalysisOutput =
      planTurnAnalysis({
        latestUserMessage: input.latestUserMessage,
        latestUserAttachments: input.latestUserAttachments,
        promptSecuritySignals: intermOutputs.detectSuspiciousPromptPatternsOutput,
        accountTrustStatus: {status: input.liveMemory.userState?.status ?? "neutral"}
      });

    // -----------------------------------------------------
    // 2. Aucun chemin d’analyse activé
    // -----------------------------------------------------

    if (
      intermOutputs.planTurnAnalysisOutput.analyzeText !== true &&
      intermOutputs.planTurnAnalysisOutput.analyzeAttachments !== true
    ) {
      return buildNotAnalyzedOutput({input, intermOutputs});
    }

    // -----------------------------------------------------
    // 3. Analyse surface texte / attachment
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
// 5. Route courte : standard only
// -----------------------------------------------------

const hasSupportRelevant =
  hasSupportRelevantTextSegments(intermOutputs.analyzeTextSurfaceOutput) ||
  hasSupportRelevantAttachments(intermOutputs.analyzeAttachmentSurfaceOutput);

if (!hasSupportRelevant) {
  // Composer déterministe.
  // Il concatène simplement les standardResponseFragments déjà construits avant.
  intermOutputs.buildMessageOutput =
    buildMessage({
      standardResponseFragments: intermOutputs.buildStandardResponseFragmentsOutput ?? [],
      topicMessages: []
    });

  // Translator LLM.
  // Même si la langue est déjà bonne, il renvoie le message tel quel.
  intermOutputs.translateMessageOutput =
    await runTranslateMessage({
      message: intermOutputs.buildMessageOutput.message,
      targetLanguage: getTargetLanguage(intermOutputs.analyzeTextSurfaceOutput),
      channel: input.latestUserMessage.channel
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

  // Patches déterministes.
  // Pas de fallback local : si bug inattendu, le try/catch global de la pipeline le capte.
  intermOutputs.patchesOutput =
    buildSupportPatches({
      liveMemory: input.liveMemory,
      latestUserMessage: input.latestUserMessage,
      latestUserAttachments: input.latestUserAttachments,
      intermOutputs
    });

  return {
    status: "processed",
    fallbackReason: null,
    userResponse: buildUserResponseFromMessage(intermOutputs.translateMessageOutput.message),
    patches: extractPatches(intermOutputs.patchesOutput),
    intermOutputs
  };
}

    // -----------------------------------------------------
    // 6. Deep support texte / attachment
    // -----------------------------------------------------

    const shouldAnalyzeSupportText =
      hasSupportRelevantTextSegments(intermOutputs.analyzeTextSurfaceOutput);

    const shouldAnalyzeSupportAttachments =
      hasSupportRelevantAttachments(intermOutputs.analyzeAttachmentSurfaceOutput);

    if (shouldAnalyzeSupportText && shouldAnalyzeSupportAttachments) {
      [
        intermOutputs.analyzeSupportTextOutput,
        intermOutputs.analyzeSupportAttachmentsOutput
      ] = await Promise.all([
        runAnalyzeSupportText({
          textSurfaceAnalysis: intermOutputs.analyzeTextSurfaceOutput,
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
          textSurfaceAnalysis: intermOutputs.analyzeTextSurfaceOutput,
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
        recentInteractionContext,
        latestUserMessageContent: input.latestUserMessage.content
      });

    if (intermOutputs.proposeTopicUpdatesOutput.status === "fallback") return buildPipelineFallback({input, intermOutputs, fallbackReason: {source: "brick", brickOutput: intermOutputs.proposeTopicUpdatesOutput}});

    if (intermOutputs.proposeTopicUpdatesOutput.status !== "analyzed") {
      throw new Error("Unexpected proposeTopicUpdatesOutput status");
    }

    // -----------------------------------------------------
    // 8. Branches topic en parallèle
    // -----------------------------------------------------

    const topicBranchOutputs =
      await Promise.all(
        intermOutputs.proposeTopicUpdatesOutput.topicUpdatePlans.map((topicUpdatePlan) => {
          return runTopicBranch({
            topicUpdatePlan,
            currentTopic: selectCurrentTopic(input.liveMemory, topicUpdatePlan),
            sourceUnderstandings: selectSourceUnderstandings(
              supportUnderstandings,
              topicUpdatePlan.sourceUnderstandingIds
            ),
            currentUserMessage: {
              content: currentUserMessage.content
            },
            previousConversationTurn: resolvePreviousConversationTurn(input.liveMemory)
          });
        })
      );

    intermOutputs.topicBranchOutputs = topicBranchOutputs;

    const failedTopicBranch =
      topicBranchOutputs.find((topicBranchOutput) => topicBranchOutput.status === "fallback");

    if (failedTopicBranch) return buildPipelineFallback({input, intermOutputs, fallbackReason: {source: "brick", brickOutput: failedTopicBranch.fallbackReason}});

    const topicPlannerOutputs =
      topicBranchOutputs.map((topicBranchOutput) => {
        if (topicBranchOutput.topicPlannerOutput === null) throw new Error("Missing topicPlannerOutput");
        return topicBranchOutput.topicPlannerOutput;
      });

// -----------------------------------------------------
// 9. Composer message
// -----------------------------------------------------

intermOutputs.buildMessageOutput =
  buildMessage({
    standardResponseFragments: intermOutputs.buildStandardResponseFragmentsOutput ?? [],
    topicMessages: buildTopicMessages({
      topicPlannerOutputs,
      topicUpdatePlans: intermOutputs.proposeTopicUpdatesOutput?.topicUpdatePlans ?? [],
      liveMemoryTopics: input.liveMemory.topics ?? []
    })
  });

// -----------------------------------------------------
// 10. Translator message
// -----------------------------------------------------

intermOutputs.translateMessageOutput =
  await runTranslateMessage({
    message: intermOutputs.buildMessageOutput.message,
    targetLanguage: getTargetLanguage(intermOutputs.analyzeTextSurfaceOutput),
    channel: input.latestUserMessage.channel
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
      await buildSupportPatches({
        liveMemory: input.liveMemory,
        latestUserMessage: input.latestUserMessage,
        latestUserAttachments: input.latestUserAttachments,
        intermOutputs
      });

    if (intermOutputs.patchesOutput.status === "fallback") return buildPipelineFallback({input, intermOutputs, fallbackReason: {source: "brick", brickOutput: intermOutputs.patchesOutput}});

    return {
      status: "processed",
      fallbackReason: null,
      userResponse: extractUserResponse(intermOutputs.rendererOutput),
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
  if (topicUpdatePlan.targetTopicId === null) return null;

  const topic = liveMemory.topics.find((candidate) => {
    return isRecord(candidate) && candidate.topicId === topicUpdatePlan.targetTopicId;
  });

  return isRecord(topic)
    ? topic as LiveMemoryTopicOptimized
    : null;
}

function selectSourceUnderstandings(
  supportUnderstandings: AnalyzeSupportTextUnderstanding[],
  sourceUnderstandingIds: string[]
): SupportUnderstanding[] {
  const sourceIdSet = new Set(sourceUnderstandingIds);
  return supportUnderstandings.filter((understanding) => {
    return sourceIdSet.has(understanding.understandingId);
  });
}

function resolvePreviousConversationTurn(
  liveMemory: SupportLiveMemoryInput
): {
  previousUserVerbatim: string | null;
  previousBotVerbatim: string | null;
} {
  return {
    previousUserVerbatim: liveMemory.lastUserVerbatim ?? null,
    previousBotVerbatim: liveMemory.lastBotVerbatim ?? null
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
      content: "Erreur technique dans l’analyse automatique. Un membre du support va reprendre votre demande.",
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
      content: "Votre message n’a pas pu être analysé automatiquement. Un membre du support pourra le reprendre si nécessaire.",
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
