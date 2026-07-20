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

import {runAssessSupportNeed, type AssessSupportNeedInput, type AssessSupportNeedOutput} from "./assess-support-need-optimized/runAssessSupportNeed";
import {assessTopicReadiness, type AssessTopicReadinessInput, type TopicReadinessAssessment} from "./topic-branch/assess-topic-readiness-optimized/assessTopicReadiness";
import {deriveSupportRouting, type DeriveSupportRoutingInput, type DerivedSupportRouting} from "./derive-support-routing-optimized/deriveSupportRouting";

import {runQualificationOrienter, type QualificationOrienterInput, type QualificationOrienterOutput} from "./qualification-orienter-optimized/runQualificationOrienter";
import {runSearchSimilarity, type SearchSimilarityInput, type SearchSimilarityOutput} from "./search-similarity-optimized/runSearchSimilarity";
import {runSynthesizeRag, type SynthesizeRagInput, type SynthesizeRagOutput} from "./synthesize-rag-optimized/runSynthesizeRag";

import {runTopicPlanner, type TopicPlannerInput, type TopicPlannerOutput} from "./topic-planner-optimized/runTopicPlanner";
import {runComposerPlanner, type ComposerPlannerInput, type ComposerPlannerOutput} from "./composer-planner-optimized/runComposerPlanner";
import {runRenderer, type RendererInput, type RendererOutput} from "./renderer-optimized/runRenderer";
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

  composerPlannerOutput?: ComposerPlannerOutput;
  rendererOutput?: RendererOutput;
  patchesOutput?: BuildSupportPatchesOutput;
};

type TopicBranchOutput = {
  assessSupportNeedOutput: AssessSupportNeedOutput;
  assessTopicReadinessOutput: TopicReadinessAssessment | null;
  deriveSupportRoutingOutput: DerivedSupportRouting | null;

  qualificationOrienterOutput: QualificationOrienterOutput | null;
  searchSimilarityOutput: SearchSimilarityOutput | null;
  synthesizeRagOutput: SynthesizeRagOutput | null;

  topicPlannerOutput: TopicPlannerOutput | null;
};

type TopicBranchResult =
  | {status: "processed"; topicPlannerOutput: TopicPlannerOutput; topicBranchOutput: TopicBranchOutput}
  | {status: "fallback"; fallbackReason: RunSupportProcessingPipelineV3OptimizedFallbackReason; topicPlannerOutput: null; topicBranchOutput: TopicBranchOutput};


// =====================================================
// RUNNER PRINCIPAL
// =====================================================

async function runSupportProcessingPipelineV3Optimized(
  input: RunSupportProcessingPipelineV3OptimizedInput
): Promise<RunSupportProcessingPipelineV3OptimizedOutput> {
  const intermOutputs: RunSupportProcessingPipelineV3OptimizedIntermOutputs = {};
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
      intermOutputs.composerPlannerOutput =
        await runComposerPlanner({
          mode: "only_standard_fragments",
          standardResponseFragments: intermOutputs.buildStandardResponseFragmentsOutput ?? [],
          topicPlannerOutputs: []
        });

      if (intermOutputs.composerPlannerOutput.status === "fallback") return buildPipelineFallback({input, intermOutputs, fallbackReason: {source: "brick", brickOutput: intermOutputs.composerPlannerOutput}});

      intermOutputs.rendererOutput =
        await runRenderer({composerPlannerOutput: intermOutputs.composerPlannerOutput});

      if (intermOutputs.rendererOutput.status === "fallback") return buildPipelineFallback({input, intermOutputs, fallbackReason: {source: "brick", brickOutput: intermOutputs.rendererOutput}});

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

    const topicBranchResults =
      await Promise.all(
        intermOutputs.proposeTopicUpdatesOutput.topicUpdatePlans.map((topicUpdatePlan) => {
          return runTopicBranch({input, topicUpdatePlan, supportUnderstandings, recentInteractionContext});
        })
      );

    intermOutputs.topicBranchOutputs =
      topicBranchResults.map((topicBranchResult) => topicBranchResult.topicBranchOutput);

    const failedTopicBranch =
      topicBranchResults.find((topicBranchResult) => topicBranchResult.status === "fallback");

    if (failedTopicBranch) return buildPipelineFallback({input, intermOutputs, fallbackReason: failedTopicBranch.fallbackReason});

    const topicPlannerOutputs =
      topicBranchResults.map((topicBranchResult) => {
        if (topicBranchResult.topicPlannerOutput === null) throw new Error("Missing topicPlannerOutput");
        return topicBranchResult.topicPlannerOutput;
      });

    // -----------------------------------------------------
    // 9. Composer global
    // -----------------------------------------------------

    intermOutputs.composerPlannerOutput =
      await runComposerPlanner({
        mode: "support",
        standardResponseFragments: intermOutputs.buildStandardResponseFragmentsOutput ?? [],
        topicPlannerOutputs
      });

    if (intermOutputs.composerPlannerOutput.status === "fallback") return buildPipelineFallback({input, intermOutputs, fallbackReason: {source: "brick", brickOutput: intermOutputs.composerPlannerOutput}});

    // -----------------------------------------------------
    // 10. Renderer
    // -----------------------------------------------------

    intermOutputs.rendererOutput =
      await runRenderer({composerPlannerOutput: intermOutputs.composerPlannerOutput});

    if (intermOutputs.rendererOutput.status === "fallback") return buildPipelineFallback({input, intermOutputs, fallbackReason: {source: "brick", brickOutput: intermOutputs.rendererOutput}});

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
// BRANCHE PAR TOPIC
// =====================================================

async function runTopicBranch(params: {
  input: RunSupportProcessingPipelineV3OptimizedInput;
  topicUpdatePlan: TopicUpdatePlan;
  supportUnderstandings: AnalyzeSupportTextUnderstanding[];
  recentInteractionContext: unknown;
}): Promise<TopicBranchResult> {
  const previousLiveTopic =
    findPreviousLiveTopic(params.input.liveMemory, params.topicUpdatePlan.targetTopicId);

  const sourceUnderstandings =
    selectUnderstandings(params.supportUnderstandings, params.topicUpdatePlan.sourceUnderstandingIds);

  const topicIdentity =
    resolveTopicIdentity(params.topicUpdatePlan, previousLiveTopic);

  // -----------------------------------------------------
  // 1. Assess support need
  // -----------------------------------------------------

  const assessSupportNeedOutput =
    await runAssessSupportNeed({
      topic: {
        topicId: topicIdentity.topicId,
        title: topicIdentity.title,
        supportDomain: topicIdentity.supportDomain,
        summary: topicIdentity.summary,
        previousSupportNeedAssessment: readPreviousSupportNeedAssessment(previousLiveTopic),
        previousSupportKnowledgeSummary: readPreviousSupportKnowledgeSummary(previousLiveTopic),
        sourceUnderstandings
      },
      recentInteractionContext: params.recentInteractionContext
    });

  const topicBranchOutput: TopicBranchOutput = {
    assessSupportNeedOutput,
    assessTopicReadinessOutput: null,
    deriveSupportRoutingOutput: null,
    qualificationOrienterOutput: null,
    searchSimilarityOutput: null,
    synthesizeRagOutput: null,
    topicPlannerOutput: null
  };

  if (assessSupportNeedOutput.status === "fallback") {
    return {status: "fallback", fallbackReason: {source: "brick", brickOutput: assessSupportNeedOutput}, topicPlannerOutput: null, topicBranchOutput};
  }

  if (assessSupportNeedOutput.status !== "analyzed" || assessSupportNeedOutput.supportNeedAssessment === null) {
    throw new Error("Unexpected assessSupportNeedOutput status");
  }

  // -----------------------------------------------------
  // 2. Readiness + routing déterministes
  // -----------------------------------------------------

  topicBranchOutput.assessTopicReadinessOutput =
    assessTopicReadiness({
      supportNeedAssessment: assessSupportNeedOutput.supportNeedAssessment,
      supportDomain: topicIdentity.supportDomain,
      sourceUnderstandings,
      previousSupportKnowledgeSummary: readPreviousSupportKnowledgeSummary(previousLiveTopic)
    });

  topicBranchOutput.deriveSupportRoutingOutput =
    deriveSupportRouting({
      supportNeedAssessment: assessSupportNeedOutput.supportNeedAssessment,
      topicReadinessAssessment: topicBranchOutput.assessTopicReadinessOutput,
      supportDomain: topicIdentity.supportDomain
    });

  // -----------------------------------------------------
  // 3. Qualification + similarity/RAG
  // -----------------------------------------------------

  if (topicBranchOutput.deriveSupportRoutingOutput.similarTopicSearchRouting.shouldSearch) {
    const qualificationOrienterPromise =
      runQualificationOrienter({
        topicUpdatePlan: params.topicUpdatePlan,
        topicIdentity,
        sourceUnderstandings,
        supportNeedAssessment: assessSupportNeedOutput.supportNeedAssessment,
        topicReadinessAssessment: topicBranchOutput.assessTopicReadinessOutput,
        routing: topicBranchOutput.deriveSupportRoutingOutput
      });

    const similarityAndSynthesisPromise =
      runSearchSimilarity({
        topicUpdatePlan: params.topicUpdatePlan,
        topicIdentity,
        sourceUnderstandings,
        liveMemory: params.input.liveMemory,
        routing: topicBranchOutput.deriveSupportRoutingOutput
      }).then(async (searchSimilarityOutput) => {
        if (searchSimilarityOutput.status === "fallback") return {status: "fallback" as const, fallbackReason: {source: "brick" as const, brickOutput: searchSimilarityOutput}, searchSimilarityOutput, synthesizeRagOutput: null};

        const synthesizeRagOutput =
          await runSynthesizeRag({
            topicUpdatePlan: params.topicUpdatePlan,
            topicIdentity,
            sourceUnderstandings,
            searchSimilarityOutput
          });

        if (synthesizeRagOutput.status === "fallback") return {status: "fallback" as const, fallbackReason: {source: "brick" as const, brickOutput: synthesizeRagOutput}, searchSimilarityOutput, synthesizeRagOutput};

        return {status: "processed" as const, searchSimilarityOutput, synthesizeRagOutput};
      });

    const [
      qualificationOrienterOutput,
      similarityAndSynthesisOutput
    ] = await Promise.all([
      qualificationOrienterPromise,
      similarityAndSynthesisPromise
    ]);

    topicBranchOutput.qualificationOrienterOutput = qualificationOrienterOutput;
    topicBranchOutput.searchSimilarityOutput = similarityAndSynthesisOutput.searchSimilarityOutput;
    topicBranchOutput.synthesizeRagOutput = similarityAndSynthesisOutput.synthesizeRagOutput;

    if (qualificationOrienterOutput.status === "fallback") {
      return {status: "fallback", fallbackReason: {source: "brick", brickOutput: qualificationOrienterOutput}, topicPlannerOutput: null, topicBranchOutput};
    }

    if (similarityAndSynthesisOutput.status === "fallback") {
      return {status: "fallback", fallbackReason: similarityAndSynthesisOutput.fallbackReason, topicPlannerOutput: null, topicBranchOutput};
    }
  }

  else {
    topicBranchOutput.qualificationOrienterOutput =
      await runQualificationOrienter({
        topicUpdatePlan: params.topicUpdatePlan,
        topicIdentity,
        sourceUnderstandings,
        supportNeedAssessment: assessSupportNeedOutput.supportNeedAssessment,
        topicReadinessAssessment: topicBranchOutput.assessTopicReadinessOutput,
        routing: topicBranchOutput.deriveSupportRoutingOutput
      });

    if (topicBranchOutput.qualificationOrienterOutput.status === "fallback") {
      return {status: "fallback", fallbackReason: {source: "brick", brickOutput: topicBranchOutput.qualificationOrienterOutput}, topicPlannerOutput: null, topicBranchOutput};
    }
  }

  // -----------------------------------------------------
  // 4. Planner topic
  // -----------------------------------------------------

  topicBranchOutput.topicPlannerOutput =
    await runTopicPlanner({
      topicUpdatePlan: params.topicUpdatePlan,
      topicIdentity,
      sourceUnderstandings,
      supportNeedOutput: assessSupportNeedOutput,
      readinessOutput: topicBranchOutput.assessTopicReadinessOutput,
      routingOutput: topicBranchOutput.deriveSupportRoutingOutput,
      qualificationOrienterOutput: topicBranchOutput.qualificationOrienterOutput,
      searchSimilarityOutput: topicBranchOutput.searchSimilarityOutput,
      synthesizeRagOutput: topicBranchOutput.synthesizeRagOutput
    });

  if (topicBranchOutput.topicPlannerOutput.status === "fallback") {
    return {status: "fallback", fallbackReason: {source: "brick", brickOutput: topicBranchOutput.topicPlannerOutput}, topicPlannerOutput: null, topicBranchOutput};
  }

  return {
    status: "processed",
    topicPlannerOutput: topicBranchOutput.topicPlannerOutput,
    topicBranchOutput
  };
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