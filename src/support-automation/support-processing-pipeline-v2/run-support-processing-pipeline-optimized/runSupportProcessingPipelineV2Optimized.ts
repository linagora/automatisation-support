import {
  detectSuspiciousPromptPatterns
} from "../detect-suspicious-prompt-patterns/detectSuspiciousPromptPatterns";
import {
  planTurnAnalysis
} from "../plan-turn-analysis/planTurnAnalysis";
import {
  runAnalyzeTextSurface
} from "../analyze-text-surface-optimized/runAnalyzeTextSurface";
import {
  buildStandardResponseFragments
} from "../build-standard-response-fragments/buildStandardResponseFragments";
import {
  analyzeSupportText
} from "../analyze-support-text/analyzeSupportText";
import {
  DEFAULT_SUPPORT_EXTRACTABLE_FIELD_CATALOG
} from "../analyze-support-text/supportExtractableFieldCatalog";
import {
  proposeTopicUpdates
} from "../propose-topic-updates/proposeTopicUpdates";
import {
  getKnowledgeEnrichmentRoute,
  planKnowledgeEnrichment,
  shouldRunCatalogFromKnowledgeEnrichment,
  shouldRunRagFromKnowledgeEnrichment
} from "../plan-knowledge-enrichment/planKnowledgeEnrichment";
import {
  buildEffectiveKnowledgeRetrievalPlan,
  retrieveSupportKnowledge
} from "../retrieve-support-knowledge/retrieveSupportKnowledge";
import {
  synthesizeRetrievedKnowledge
} from "../synthesize-retrieved-knowledge/synthesizeRetrievedKnowledge";
import {
  selectCatalogKnowledgeForTopic
} from "../select-catalog-knowledge-for-topic/selectCatalogKnowledgeForTopic";
import {
  buildCandidateFieldsForTopicSelector
} from "../select-catalog-knowledge-for-topic/buildCandidateFieldsForTopicSelector";
import {
  planSupportResponse
} from "../plan-support-response/planSupportResponse";
import {
  composeSupportResponsePlan
} from "../compose-support-response-plan/composeSupportResponsePlan";
import {
  renderSupportResponse
} from "../response-renderer/renderSupportResponse";
import {
  mergeSupportKnowledgeSummary,
  toPlannerKnowledgeInput
} from "../supportKnowledgeSummary";
import {
  buildUnansweredRequestedFieldNamesForTopic
} from "../unansweredRequestedFields";
import {
  buildSupportProcessingPersistenceEffectsV2
} from "../build-persistence-effects/buildSupportProcessingPersistenceEffectsV2";
import {
  buildUserResponseV2
} from "../build-user-response/buildUserResponseV2";
import {
  assignTopicResponsePlanIds
} from "../responsePlanIds";
import {
  buildTemporarySelectedCatalogKnowledge
} from "../../support-catalog";
import {
  appendNamedDebugOutput,
  isSupportProcessingPipelineV2DebugStop,
  resolveStep,
  runStep,
  skipStep,
  skipSteps
} from "./pipelineRuntime";
import type {
  AttachmentSurfaceAnalysis,
  AttachmentUnderstanding,
  BuildSupportPersistenceEffectsInput,
  ComposedSupportResponsePlan,
  ExtractableFieldDefinition,
  KnowledgeChunk,
  KnowledgeEnrichmentPlan,
  MergedTopicSnapshot,
  ProposeTopicUpdatesOutput,
  RagUsage,
  RagUsageStatus,
  RetrievedKnowledgeSynthesis,
  RenderSupportResponseInput,
  ResponsePlanV2,
  SelectedCatalogKnowledgeForTopic,
  StandardResponseFragment,
  SupportResponseCue,
  SupportProcessingPipelineV2Runtime,
  SupportProcessingPipelineV2Input,
  SupportProcessingPipelineV2Output,
  SupportProcessingPipelineV2Steps,
  SupportProcessingStepName,
  TextSurfaceAnalysis,
  TextUnderstanding,
  TopicEvidence,
  TopicKnowledgeEnrichmentPlanResult,
  TopicRetrievedKnowledgeSynthesisResult,
  TopicRetrievedSupportKnowledgeResult,
  TopicPatch,
  TopicUpdateOp,
  TopicUpdateProposal
} from "../typesSupportProcessingPipelineV2.types";
import type {
  SupportProcessingPipelineV2DebugStop,
  SupportProcessingPipelineV2InternalDebugState,
  SupportProcessingPipelineV2InternalRuntime
} from "./pipelineRuntime";

function shouldRunDeepTextAnalysis(
  textSurfaceAnalysis: TextSurfaceAnalysis | undefined
): textSurfaceAnalysis is TextSurfaceAnalysis {
  return textSurfaceAnalysis?.segments.some((segment) => {
    return segment.category === "support_relevant";
  }) === true;
}

async function analyzeTextSurface(
  input: Parameters<typeof runAnalyzeTextSurface>[0]
): Promise<TextSurfaceAnalysis> {
  const output = await runAnalyzeTextSurface(input);

  if (output.status === "analyzed") {
    return {
      userLanguage: output.userLanguage,
      segments: output.segments
    };
  }

  return {
    status: "fallback",
    fallbackReason: output.fallbackReason,
    userLanguage: output.userLanguage,
    segments: []
  } as TextSurfaceAnalysis;
}

function shouldRunDeepAttachmentAnalysis(
  attachmentSurfaceAnalysis: AttachmentSurfaceAnalysis | undefined
): attachmentSurfaceAnalysis is AttachmentSurfaceAnalysis {
  return attachmentSurfaceAnalysis?.some((attachment) => {
    return attachment.shouldRunDeepAnalysis;
  }) === true;
}

function isActionableTopicUpdateProposal(
  proposal: TopicUpdateProposal
): boolean {
  return proposal.action === "create_new_topic" ||
    proposal.action === "update_existing_topic";
}

function isProposeTopicUpdatesOutput(
  value: ProposeTopicUpdatesOutput | TopicUpdateProposal[]
): value is ProposeTopicUpdatesOutput {
  return !Array.isArray(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUsableResponsePlan(value: unknown): value is ResponsePlanV2 {
  return isRecord(value) &&
    Array.isArray(value.acknowledge) &&
    Array.isArray(value.answer) &&
    Array.isArray(value.ask) &&
    Array.isArray(value.say) &&
    value.say.some((item) => {
      return typeof item === "string" && item.trim() !== "";
    }) &&
    (
      value.review === null ||
      typeof value.review === "string"
    );
}

function buildFallbackTopicResponsePlan(params: {
  branchId: string;
  topicId: number | null;
}): ResponsePlanV2 {
  return {
    topicId: params.topicId ?? null,
    acknowledge: [],
    answer: [],
    ask: [],
    say: [
      "Acknowledge the user's topic without making unsupported claims. Ask for clarification only if necessary."
    ],
    review: `topic_response_plan_fallback:${params.branchId}`
  };
}

function findExistingTopicForProposal(
  proposal: TopicUpdateProposal,
  supportTopicKnowledge: SupportProcessingPipelineV2Input["supportTopicKnowledge"]
): unknown | undefined {
  if (proposal.topicId === null) {
    return undefined;
  }

  return supportTopicKnowledge.topics.find((topic) => {
    return topic.topicId === proposal.topicId;
  });
}

function buildTopicEvidenceFromSnapshot(params: {
  snapshot: MergedTopicSnapshot;
  textUnderstandings: TextUnderstanding[];
  supportResponseCues: SupportResponseCue[];
}): TopicEvidence {
  const relatedUnderstandingIds = new Set(
    params.snapshot.sourceUnderstandingIds
  );
  const relatedTextUnderstandings = params.textUnderstandings.filter(
    (understanding) => {
      return relatedUnderstandingIds.has(understanding.understandingId);
    }
  );
  const relatedSupportResponseCues = params.supportResponseCues.filter((cue) => {
    return cue.relatedUnderstandingIds.length > 0 &&
      cue.relatedUnderstandingIds.every((understandingId) => {
        return relatedUnderstandingIds.has(understandingId);
      });
  });

  return {
    proposalId: params.snapshot.snapshotId,
    topicId: params.snapshot.topicId ?? null,
    topicSnapshot: params.snapshot,
    topicSourceVerbatims: Array.from(new Set(params.snapshot.sourceVerbatims)),
    relatedUnderstandingIds: params.snapshot.sourceUnderstandingIds,
    relatedTextUnderstandings,
    relatedAttachmentUnderstandings: [],
    relatedSupportResponseCues,
    existingTopic: params.snapshot
  };
}

function buildTopicEvidence(params: {
  proposal: TopicUpdateProposal;
  existingTopic?: unknown;
  textUnderstandings: TextUnderstanding[];
  attachmentUnderstandings: AttachmentUnderstanding[];
  supportResponseCues: SupportResponseCue[];
}): TopicEvidence {
  const relatedUnderstandingIds = new Set(
    params.proposal.fromUnderstandingIds
  );
  const relatedAttachmentIndexes = new Set(
    params.proposal.relatedAttachmentIndexes ?? []
  );
  const relatedTextUnderstandings = params.textUnderstandings.filter(
    (understanding) => {
      return relatedUnderstandingIds.has(understanding.understandingId);
    }
  );
  const relatedAttachmentUnderstandings =
    params.attachmentUnderstandings.filter((attachment) => {
      return relatedAttachmentIndexes.has(attachment.attachmentIndex);
    });
  const relatedSupportResponseCues = params.supportResponseCues.filter((cue) => {
    return cue.relatedUnderstandingIds.length > 0 &&
      cue.relatedUnderstandingIds.every((understandingId) => {
        return relatedUnderstandingIds.has(understandingId);
      });
  });
  const topicSourceVerbatims = Array.from(new Set(
    params.proposal.selectedSourceVerbatims
  ));

  return {
    proposalId: params.proposal.proposalId,
    topicId: params.proposal.topicId,
    topicSourceVerbatims,
    relatedUnderstandingIds: params.proposal.fromUnderstandingIds,
    relatedTextUnderstandings,
    relatedAttachmentUnderstandings,
    relatedSupportResponseCues,
    ...(params.existingTopic ? { existingTopic: params.existingTopic } : {})
  };
}

function buildTopicUserMessageContent(topicEvidence: TopicEvidence): string {
  return topicEvidence.topicSourceVerbatims.join(" ").trim();
}

function ragRetrievalFailureReason(error: unknown): string {
  if (error instanceof Error && error.name === "AbortError") {
    return "abort_error";
  }

  if (
    error instanceof Error &&
    /abort|timeout|timed out/i.test(error.message)
  ) {
    return "timeout";
  }

  return "retrieval_error";
}

function debugLogRagRetrievalError(error: unknown): void {
  if (process.env.SUPPORT_RAG_DEBUG !== "true") {
    return;
  }

  const name = error instanceof Error ? error.name : "unknown";
  const rawMessage = error instanceof Error ? error.message : String(error);
  const secret = process.env.SUPPORT_RAG_API_KEY;
  const message = secret
    ? rawMessage.replaceAll(secret, "[redacted]")
    : rawMessage;

  console.debug({
    eventName: "support.v2.rag_retrieval_failed",
    errorName: name,
    errorMessage: message.replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
  });
}

function estimateTokens(charCount: number): number {
  return Math.ceil(charCount / 4);
}

function ragUsageStatus(params: {
  failureReason?: string;
  chunkCount: number;
}): RagUsageStatus {
  if (params.failureReason) {
    return params.failureReason === "abort_error" ||
      params.failureReason === "timeout"
      ? "timeout"
      : "failed";
  }

  return params.chunkCount > 0 ? "success" : "empty";
}

function requestChars(plan: KnowledgeEnrichmentPlan): number {
  return plan.retrievalRequests.reduce((total, request) => {
    return total + request.queryText.length;
  }, 0);
}

function responseChars(chunks: KnowledgeChunk[]): number {
  return chunks.reduce((total, chunk) => {
    return total + chunk.content.length;
  }, 0);
}

function logKnowledgeEnrichment(params: {
  topicId: number | null;
  plan: KnowledgeEnrichmentPlan;
}): void {
  console.info(
    `[Knowledge enrichment] topicId=${params.topicId ?? "null"} route=${getKnowledgeEnrichmentRoute(params.plan)} reason=${params.plan.reason}`
  );
}

function logRagUsage(usage: RagUsage): void {
  console.info(
    `[RAG usage] topicId=${usage.topicId ?? "null"} status=${usage.status} request_chars=${usage.requestChars} estimated_request_tokens=${usage.estimatedRequestTokens} chunks=${usage.chunkCount} response_chars=${usage.responseChars} estimated_response_tokens=${usage.estimatedResponseTokens} duration_ms=${usage.durationMs}`
  );
}

function buildSkippedRagUsage(topicId: number | null): RagUsage {
  return {
    topicId,
    status: "skipped_by_router",
    requestChars: 0,
    estimatedRequestTokens: 0,
    chunkCount: 0,
    responseChars: 0,
    estimatedResponseTokens: 0,
    durationMs: 0
  };
}

function buildRagUsage(params: {
  topicId: number | null;
  plan: KnowledgeEnrichmentPlan;
  chunks: KnowledgeChunk[];
  startedAt: number;
  failureReason?: string;
}): RagUsage {
  const requestCharCount = requestChars(params.plan);
  const responseCharCount = responseChars(params.chunks);

  return {
    topicId: params.topicId,
    status: ragUsageStatus({
      failureReason: params.failureReason,
      chunkCount: params.chunks.length
    }),
    requestChars: requestCharCount,
    estimatedRequestTokens: estimateTokens(requestCharCount),
    chunkCount: params.chunks.length,
    responseChars: responseCharCount,
    estimatedResponseTokens: estimateTokens(responseCharCount),
    durationMs: Math.max(0, Date.now() - params.startedAt)
  };
}

function emptySelectedCatalogKnowledge(
  reason: string
): SelectedCatalogKnowledgeForTopic {
  return {
    selectedFieldNames: [],
    selectedFields: [],
    selectedGenericKnowledge: [],
    scopeReason: reason,
    rejectedFieldNames: []
  };
}

function getRawRendererLanguage(userLanguage: unknown): string {
  if (typeof userLanguage !== "string") {
    return "unknown";
  }

  const trimmedLanguage = userLanguage.trim();

  return trimmedLanguage === "" ? "unknown" : trimmedLanguage;
}

function resolvePipelineSteps(
  steps: SupportProcessingPipelineV2Steps
): Required<SupportProcessingPipelineV2Steps> {
  return {
    detectSuspiciousPromptPatterns: resolveStep(
      steps.detectSuspiciousPromptPatterns || detectSuspiciousPromptPatterns,
      "detectSuspiciousPromptPatterns"
    ),
    planTurnAnalysis: resolveStep(
      steps.planTurnAnalysis || planTurnAnalysis,
      "planTurnAnalysis"
    ),
    analyzeTextSurface: resolveStep(
      steps.analyzeTextSurface || analyzeTextSurface,
      "analyzeTextSurface"
    ),
    analyzeAttachmentSurface: resolveStep(
      steps.analyzeAttachmentSurface,
      "analyzeAttachmentSurface"
    ),
    buildStandardResponseFragments: resolveStep(
      steps.buildStandardResponseFragments || buildStandardResponseFragments,
      "buildStandardResponseFragments"
    ),
    analyzeSupportText: resolveStep(
      steps.analyzeSupportText || analyzeSupportText,
      "analyzeSupportText"
    ),
    analyzeSupportAttachments: resolveStep(
      steps.analyzeSupportAttachments,
      "analyzeSupportAttachments"
    ),
    proposeTopicUpdates: resolveStep(
      steps.proposeTopicUpdates ||
        (async (input) => {
          const result = await proposeTopicUpdates(input);

          return result;
        }),
      "proposeTopicUpdates"
    ),
    applyTopicUpdates: resolveStep(steps.applyTopicUpdates, "applyTopicUpdates"),
    planKnowledgeEnrichment: resolveStep(
      steps.planKnowledgeEnrichment || planKnowledgeEnrichment,
      "planKnowledgeEnrichment"
    ),
    selectCatalogKnowledgeForTopic: resolveStep(
      steps.selectCatalogKnowledgeForTopic ||
        selectCatalogKnowledgeForTopic,
      "selectCatalogKnowledgeForTopic"
    ),
    retrieveSupportKnowledge: resolveStep(
      steps.retrieveSupportKnowledge || retrieveSupportKnowledge,
      "retrieveSupportKnowledge"
    ),
    synthesizeRetrievedKnowledge: resolveStep(
      steps.synthesizeRetrievedKnowledge || synthesizeRetrievedKnowledge,
      "synthesizeRetrievedKnowledge"
    ),
    planSupportResponse: resolveStep(
      steps.planSupportResponse ||
        (async (input) => {
          const result = await planSupportResponse(input);

          return result.responsePlan;
        }),
      "planSupportResponse"
    ),
    composeSupportResponsePlan: resolveStep(
      steps.composeSupportResponsePlan ||
        (async (input) => {
          const result = await composeSupportResponsePlan(input);

          return result.composedSupportResponsePlan;
        }),
      "composeSupportResponsePlan"
    ),
    renderSupportResponse: resolveStep(
      steps.renderSupportResponse ||
        (async (input) => {
          const result = await renderSupportResponse(input);

          return result.renderedResponse;
        }),
      "renderSupportResponse"
    ),
    buildUserResponse: resolveStep(
      steps.buildUserResponse || buildUserResponseV2,
      "buildUserResponse"
    ),
    buildSupportProcessingPersistenceEffects: resolveStep(
      steps.buildSupportProcessingPersistenceEffects ||
        buildSupportProcessingPersistenceEffectsV2,
      "buildSupportProcessingPersistenceEffects"
    )
  };
}

async function runSupportProcessingPipelineV2OptimizedInternal(
  inputSupportProcessingPipeline: SupportProcessingPipelineV2Input,
  steps: SupportProcessingPipelineV2Steps = {},
  runtime: SupportProcessingPipelineV2InternalRuntime = {},
  debugState?: SupportProcessingPipelineV2InternalDebugState
): Promise<SupportProcessingPipelineV2Output> {
  const internalRuntime: SupportProcessingPipelineV2InternalRuntime =
    debugState ? { ...runtime, debugState } : runtime;
  const pipelineSteps = resolvePipelineSteps(steps);

  const {
    latestUserMessage,
    latestUserAttachments,
    accountTrustStatus,
    accountProfile,
    supportTopicKnowledge,
    recentInteractionContext,
    responsePlanningPolicy
  } = inputSupportProcessingPipeline;

  const extractableFieldCatalog: ExtractableFieldDefinition[] =
    DEFAULT_SUPPORT_EXTRACTABLE_FIELD_CATALOG.map((fieldDefinition) => {
      return { ...fieldDefinition };
    });
  const promptSecuritySignals = await runStep(
    internalRuntime,
    "detectSuspiciousPromptPatterns",
    pipelineSteps.detectSuspiciousPromptPatterns,
    {
      latestUserMessage
    }
  );

  const turnAnalysisPlan = await runStep(
    internalRuntime,
    "planTurnAnalysis",
    pipelineSteps.planTurnAnalysis,
    {
      latestUserMessage,
      latestUserAttachments,
      promptSecuritySignals,
      accountTrustStatus
    }
  );

  const [textSurfaceAnalysis, attachmentSurfaceAnalysis] = await Promise.all([
    turnAnalysisPlan.analyzeText
      ? runStep(
          internalRuntime,
          "analyzeTextSurface",
          pipelineSteps.analyzeTextSurface,
          {
            latestUserMessage,
            turnAnalysisPlan,
            recentInteractionContext
          },
          (output) => {
            return {
              userLanguage: output.userLanguage,
              rawUserLanguage: output.userLanguage
            };
          }
        )
      : skipStep(internalRuntime, "analyzeTextSurface").then(() => undefined),
    turnAnalysisPlan.analyzeAttachments
      ? runStep(
          internalRuntime,
          "analyzeAttachmentSurface",
          pipelineSteps.analyzeAttachmentSurface,
          {
            latestUserMessage,
            latestUserAttachments,
            turnAnalysisPlan
          }
        )
      : skipStep(internalRuntime, "analyzeAttachmentSurface").then(() => undefined)
  ]);

  const standardResponseFragments = await runStep(
    internalRuntime,
    "buildStandardResponseFragments",
    pipelineSteps.buildStandardResponseFragments,
    {
      turnAnalysisPlan,
      latestUserMessage,
      accountProfile,
      recentInteractionContext,
      ...(textSurfaceAnalysis ? { textSurfaceAnalysis } : {}),
      ...(attachmentSurfaceAnalysis ? { attachmentSurfaceAnalysis } : {})
    }
  );

  const runTextDeepAnalysis = shouldRunDeepTextAnalysis(textSurfaceAnalysis);
  const runAttachmentDeepAnalysis =
    shouldRunDeepAttachmentAnalysis(attachmentSurfaceAnalysis);
  const rendererLanguage = getRawRendererLanguage(
    textSurfaceAnalysis?.userLanguage
  );
  let topicResponsePlans: ResponsePlanV2[] | undefined;
  let composedSupportResponsePlan: ComposedSupportResponsePlan | undefined;
  let topicKnowledgeEnrichmentPlans:
    | TopicKnowledgeEnrichmentPlanResult[]
    | undefined;
  let topicRetrievedSupportKnowledge:
    | TopicRetrievedSupportKnowledgeResult[]
    | undefined;
  let topicRetrievedKnowledgeSyntheses:
    | TopicRetrievedKnowledgeSynthesisResult[]
    | undefined;
  let textUnderstandings: TextUnderstanding[] | undefined;
  let attachmentUnderstandings: AttachmentUnderstanding[] | undefined;
  let supportResponseCues: SupportResponseCue[] | undefined;
  let topicUpdateOps: TopicUpdateOp[] | undefined;
  let topicPatches: TopicPatch[] | undefined;
  let mergedTopicSnapshots: MergedTopicSnapshot[] | undefined;
  let topicUpdateProposals: TopicUpdateProposal[] | undefined;
  let knowledgeEnrichmentPlan:
    | Awaited<ReturnType<typeof planKnowledgeEnrichment>>
    | undefined;
  let retrievedSupportKnowledge: KnowledgeChunk[] | undefined;
  let synthesizedRetrievedKnowledge:
    | RetrievedKnowledgeSynthesis
    | null
    | undefined;
  let ragUsage: RagUsage[] | undefined;

  if (!runTextDeepAnalysis && !runAttachmentDeepAnalysis) {
    await skipSteps(internalRuntime, [
      "analyzeSupportText",
      "analyzeSupportAttachments",
      "proposeTopicUpdates",
      "applyTopicUpdates",
      "planKnowledgeEnrichment",
      "selectCatalogKnowledgeForTopic",
      "retrieveSupportKnowledge",
      "synthesizeRetrievedKnowledge",
      "planSupportResponse"
    ]);
  } else {
    const [
      analyzedSupportText,
      analyzedSupportAttachments
    ] = await Promise.all([
      runTextDeepAnalysis
        ? runStep(
            internalRuntime,
            "analyzeSupportText",
            pipelineSteps.analyzeSupportText,
            {
              turnAnalysisPlan,
              textSurfaceAnalysis,
              recentInteractionContext,
              extractableFieldCatalog
            }
          )
        : skipStep(internalRuntime, "analyzeSupportText").then(
            () => ({
              textUnderstandings: [] satisfies TextUnderstanding[],
              supportResponseCues: [] satisfies SupportResponseCue[]
            })
          ),
      runAttachmentDeepAnalysis
        ? runStep(
            internalRuntime,
            "analyzeSupportAttachments",
            pipelineSteps.analyzeSupportAttachments,
            {
              turnAnalysisPlan,
              attachmentSurfaceAnalysis,
              latestUserAttachments,
              latestUserMessage,
              recentInteractionContext,
              extractableFieldCatalog
            }
          )
        : skipStep(internalRuntime, "analyzeSupportAttachments").then(
            () => [] satisfies AttachmentUnderstanding[]
          )
    ]);
    textUnderstandings = analyzedSupportText.textUnderstandings;
    supportResponseCues = analyzedSupportText.supportResponseCues;
    attachmentUnderstandings = analyzedSupportAttachments;

    const proposedTopicUpdates = await runStep(
      internalRuntime,
      "proposeTopicUpdates",
      pipelineSteps.proposeTopicUpdates,
      {
        textUnderstandings,
        supportTopicKnowledge,
        recentInteractionContext,
        latestUserMessageContent: latestUserMessage.content
      }
    );
    if (isProposeTopicUpdatesOutput(proposedTopicUpdates)) {
      topicUpdateOps = proposedTopicUpdates.topicUpdateOps;
      topicPatches = proposedTopicUpdates.topicPatches;
      mergedTopicSnapshots = proposedTopicUpdates.mergedTopicSnapshots;
      topicUpdateProposals = proposedTopicUpdates.topicUpdateProposals;
    } else {
      topicUpdateOps = [];
      topicPatches = [];
      mergedTopicSnapshots = [];
      topicUpdateProposals = proposedTopicUpdates;
    }

    await skipStep(internalRuntime, "applyTopicUpdates");

    const actionableTopicSnapshots = mergedTopicSnapshots ?? [];
    const actionableTopicUpdateProposals = actionableTopicSnapshots.length > 0
      ? []
      : (topicUpdateProposals ?? []).filter(
          isActionableTopicUpdateProposal
        );

    if (
      actionableTopicSnapshots.length === 0 &&
      actionableTopicUpdateProposals.length === 0
    ) {
      topicResponsePlans = [];
      topicKnowledgeEnrichmentPlans = [];
      topicRetrievedSupportKnowledge = [];
      topicRetrievedKnowledgeSyntheses = [];
      ragUsage = [];
      await skipSteps(internalRuntime, [
        "planKnowledgeEnrichment",
        "selectCatalogKnowledgeForTopic",
        "retrieveSupportKnowledge",
        "synthesizeRetrievedKnowledge",
        "planSupportResponse"
      ]);
    } else {
      const topicBranchSources = actionableTopicSnapshots.length > 0
        ? actionableTopicSnapshots.map((snapshot) => ({
            branchId: snapshot.snapshotId,
            topicId: snapshot.topicId ?? null,
            topicEvidence: buildTopicEvidenceFromSnapshot({
              snapshot,
              textUnderstandings: textUnderstandings ?? [],
              supportResponseCues: supportResponseCues ?? []
            }),
            topicSnapshot: snapshot
          }))
        : actionableTopicUpdateProposals.map((topicUpdateProposal) => {
            const existingTopic = findExistingTopicForProposal(
              topicUpdateProposal,
              supportTopicKnowledge
            );
            const topicEvidence = buildTopicEvidence({
              proposal: topicUpdateProposal,
              ...(existingTopic ? { existingTopic } : {}),
              textUnderstandings: textUnderstandings ?? [],
              attachmentUnderstandings: attachmentUnderstandings ?? [],
              supportResponseCues: supportResponseCues ?? []
            });

            return {
              branchId: topicUpdateProposal.proposalId,
              topicId: topicUpdateProposal.topicId,
              topicEvidence,
              topicSnapshot: undefined
            };
          });
      const topicBranchResults = await Promise.all(
        topicBranchSources.map(async (topicBranchSource) => {
          const topicEvidence = topicBranchSource.topicEvidence;
          const topicUserMessageContent =
            buildTopicUserMessageContent(topicEvidence);
          let topicKnowledgeEnrichmentPlan = await runStep(
            internalRuntime,
            "planKnowledgeEnrichment",
            pipelineSteps.planKnowledgeEnrichment,
            {
              topicEvidence,
              ...(topicBranchSource.topicSnapshot
                ? { topicSnapshot: topicBranchSource.topicSnapshot }
                : {}),
              extractableFieldCatalog,
              recentInteractionContext,
              targetLanguage: rendererLanguage
            }
          );
          logKnowledgeEnrichment({
            topicId: topicBranchSource.topicId,
            plan: topicKnowledgeEnrichmentPlan
          });

          const enrichmentRoute = getKnowledgeEnrichmentRoute(
            topicKnowledgeEnrichmentPlan
          );
          const shouldRunCatalog = shouldRunCatalogFromKnowledgeEnrichment(
            topicKnowledgeEnrichmentPlan
          );
          const shouldRunRag = shouldRunRagFromKnowledgeEnrichment(
            topicKnowledgeEnrichmentPlan
          );
          const catalogSelectionPromise = (async (): Promise<SelectedCatalogKnowledgeForTopic> => {
            if (shouldRunCatalog) {
              const selectorFields = topicBranchSource.topicSnapshot
                ? buildCandidateFieldsForTopicSelector({
                    topicSnapshot: topicBranchSource.topicSnapshot,
                    knowledgeEnrichmentPlan: topicKnowledgeEnrichmentPlan,
                    extractableFieldCatalog
                  })
                : undefined;

              return runStep(
                internalRuntime,
                "selectCatalogKnowledgeForTopic",
                pipelineSteps.selectCatalogKnowledgeForTopic,
                {
                  topicUserMessageContent,
                  topicEvidence,
                  ...(topicBranchSource.topicSnapshot
                    ? {
                        topicSnapshot: topicBranchSource.topicSnapshot
                      }
                    : {}),
                  knowledgeEnrichmentPlan: topicKnowledgeEnrichmentPlan,
                  ...(selectorFields
                    ? {
                        knownFields: selectorFields.knownFields,
                        candidateFields: selectorFields.candidateFields,
                        candidateDiagnosticFlows:
                          selectorFields.candidateDiagnosticFlows
                      }
                    : {}),
                  extractableFieldCatalog,
                  recentInteractionContext,
                  targetLanguage: rendererLanguage
                }
              ).catch((): SelectedCatalogKnowledgeForTopic => {
                // TODO: Remove this fallback once the topic catalog selector is
                // fully proven and every injected test runtime provides the step.
                return buildTemporarySelectedCatalogKnowledge({
                  relatedTextUnderstandings:
                    topicEvidence.relatedTextUnderstandings,
                  relatedAttachmentUnderstandings:
                    topicEvidence.relatedAttachmentUnderstandings
                }) as SelectedCatalogKnowledgeForTopic;
              });
            }

            await skipStep(internalRuntime, "selectCatalogKnowledgeForTopic");

            return emptySelectedCatalogKnowledge(
              `skipped_by_knowledge_enrichment:${enrichmentRoute}`
            );
          })();

          const ragRetrievalAndSynthesisPromise = (async (): Promise<{
            topicKnowledgeEnrichmentPlan: KnowledgeEnrichmentPlan;
            topicRetrievedSupportKnowledge: KnowledgeChunk[];
            topicRetrievedKnowledgeSynthesis: RetrievedKnowledgeSynthesis | null;
            topicRagUsage: RagUsage;
          }> => {
            let effectiveTopicKnowledgeEnrichmentPlan =
              topicKnowledgeEnrichmentPlan;
            let topicRetrievedSupportKnowledge: KnowledgeChunk[] = [];
            let topicRetrievedKnowledgeSynthesis:
              | RetrievedKnowledgeSynthesis
              | null = null;
            let topicRagUsage = buildSkippedRagUsage(topicBranchSource.topicId);
            const ragOnlySelectedCatalogKnowledge = emptySelectedCatalogKnowledge(
              "intentionally_not_available_to_rag_or_synthesis"
            );

            if (!shouldRunRag) {
              await skipSteps(internalRuntime, [
                "retrieveSupportKnowledge",
                "synthesizeRetrievedKnowledge"
              ]);
              logRagUsage(topicRagUsage);

              return {
                topicKnowledgeEnrichmentPlan: effectiveTopicKnowledgeEnrichmentPlan,
                topicRetrievedSupportKnowledge,
                topicRetrievedKnowledgeSynthesis,
                topicRagUsage
              };
            }

            let knowledgeRetrievalFailureReason: string | undefined;
            const ragStartedAt = Date.now();

            try {
              effectiveTopicKnowledgeEnrichmentPlan =
                buildEffectiveKnowledgeRetrievalPlan({
                  knowledgeEnrichmentPlan: topicKnowledgeEnrichmentPlan,
                  topicEvidence,
                  ...(topicBranchSource.topicSnapshot
                    ? { topicSnapshot: topicBranchSource.topicSnapshot }
                    : {}),
                  selectedCatalogKnowledge: ragOnlySelectedCatalogKnowledge,
                  topicKnowledgeEnrichmentPlan
                });

              topicRetrievedSupportKnowledge = await runStep(
                internalRuntime,
                "retrieveSupportKnowledge",
                pipelineSteps.retrieveSupportKnowledge,
                {
                  knowledgeEnrichmentPlan: effectiveTopicKnowledgeEnrichmentPlan,
                  topicEvidence,
                  ...(topicBranchSource.topicSnapshot
                    ? { topicSnapshot: topicBranchSource.topicSnapshot }
                    : {}),
                  selectedCatalogKnowledge: ragOnlySelectedCatalogKnowledge,
                  topicKnowledgeEnrichmentPlan:
                    effectiveTopicKnowledgeEnrichmentPlan
                }
              );
            } catch (error) {
              knowledgeRetrievalFailureReason =
                ragRetrievalFailureReason(error);
              topicRetrievedSupportKnowledge = [];
              debugLogRagRetrievalError(error);
            }

            topicRagUsage = buildRagUsage({
              topicId: topicBranchSource.topicId,
              plan: effectiveTopicKnowledgeEnrichmentPlan,
              chunks: topicRetrievedSupportKnowledge,
              startedAt: ragStartedAt,
              failureReason: knowledgeRetrievalFailureReason
            });
            logRagUsage(topicRagUsage);

            topicRetrievedKnowledgeSynthesis = await runStep(
              internalRuntime,
              "synthesizeRetrievedKnowledge",
              pipelineSteps.synthesizeRetrievedKnowledge,
              {
                knowledgeEnrichmentPlan: effectiveTopicKnowledgeEnrichmentPlan,
                knowledgeChunks: topicRetrievedSupportKnowledge,
                topicEvidence,
                ...(topicBranchSource.topicSnapshot
                  ? { topicSnapshot: topicBranchSource.topicSnapshot }
                  : {}),
                selectedCatalogKnowledge: ragOnlySelectedCatalogKnowledge,
                topicKnowledgeEnrichmentPlan:
                  effectiveTopicKnowledgeEnrichmentPlan,
                ...(knowledgeRetrievalFailureReason
                  ? { knowledgeRetrievalFailureReason }
                  : {})
              }
            );

            return {
              topicKnowledgeEnrichmentPlan: effectiveTopicKnowledgeEnrichmentPlan,
              topicRetrievedSupportKnowledge,
              topicRetrievedKnowledgeSynthesis,
              topicRagUsage
            };
          })();

          const [
            selectedCatalogKnowledge,
            ragRetrievalAndSynthesisResult
          ] = await Promise.all([
            catalogSelectionPromise,
            ragRetrievalAndSynthesisPromise
          ]);

          topicKnowledgeEnrichmentPlan =
            ragRetrievalAndSynthesisResult.topicKnowledgeEnrichmentPlan;
          const topicRetrievedSupportKnowledge =
            ragRetrievalAndSynthesisResult.topicRetrievedSupportKnowledge;
          const topicRetrievedKnowledgeSynthesis =
            ragRetrievalAndSynthesisResult.topicRetrievedKnowledgeSynthesis;
          const topicRagUsage = ragRetrievalAndSynthesisResult.topicRagUsage;

          const plannerKnowledgeInput = toPlannerKnowledgeInput(
            topicRetrievedKnowledgeSynthesis?.supportKnowledgeSummary ?? null
          );
          appendNamedDebugOutput({
            debugState: internalRuntime.debugState,
            name: "plannerKnowledgeInput",
            output: {
              proposalId: topicBranchSource.branchId,
              topicId: topicBranchSource.topicId,
              topicRetrievedKnowledgeSynthesis: plannerKnowledgeInput
            }
          });
          const topicResponsePlan = await runStep(
            internalRuntime,
            "planSupportResponse",
            pipelineSteps.planSupportResponse,
            {
              topicUserMessageContent,
              topicEvidence,
              targetLanguage: rendererLanguage,
              selectedCatalogKnowledge,
              topicKnowledgeEnrichmentPlan,
              topicRetrievedKnowledgeSynthesis: plannerKnowledgeInput,
              responsePlanningPolicy,
              channel: latestUserMessage.channel
            }
          );

          return {
            branchId: topicBranchSource.branchId,
            topicId: topicBranchSource.topicId,
            topicEvidence,
            selectedCatalogKnowledge,
            topicKnowledgeEnrichmentPlan,
            topicRetrievedSupportKnowledge,
            topicRetrievedKnowledgeSynthesis,
            ragUsage: topicRagUsage,
            topicResponsePlan
          };
        })
      );

      topicResponsePlans = assignTopicResponsePlanIds(
        topicBranchResults.map((result) => ({
          proposalId: result.branchId,
          responsePlan: isUsableResponsePlan(result.topicResponsePlan)
            ? result.topicResponsePlan
            : buildFallbackTopicResponsePlan({
                branchId: result.branchId,
                topicId: result.topicId
              })
        }))
      );
      topicKnowledgeEnrichmentPlans = topicBranchResults.map((result) => ({
        proposalId: result.branchId,
        topicId: result.topicId,
        plan: result.topicKnowledgeEnrichmentPlan
      }));
      topicRetrievedSupportKnowledge = topicBranchResults.map((result) => ({
        proposalId: result.branchId,
        topicId: result.topicId,
        knowledgeChunks: result.topicRetrievedSupportKnowledge
      }));
      topicRetrievedKnowledgeSyntheses = topicBranchResults.map((result) => ({
        proposalId: result.branchId,
        topicId: result.topicId,
        synthesis: result.topicRetrievedKnowledgeSynthesis
      }));
      ragUsage = topicBranchResults.map((result) => result.ragUsage);
      mergedTopicSnapshots = mergedTopicSnapshots?.map((snapshot) => {
        const result = topicBranchResults.find((candidate) => {
          return candidate.branchId === snapshot.snapshotId ||
            candidate.topicId === snapshot.topicId;
        });
        const supportKnowledgeSummary = mergeSupportKnowledgeSummary({
          existing: snapshot.supportKnowledgeSummary,
          next: result?.topicRetrievedKnowledgeSynthesis?.supportKnowledgeSummary
        });
        const responsePlan = result
          ? isUsableResponsePlan(result.topicResponsePlan)
            ? result.topicResponsePlan
            : buildFallbackTopicResponsePlan({
                branchId: result.branchId,
                topicId: result.topicId
              })
          : null;
        const unansweredRequestedFieldNames = result && responsePlan
          ? buildUnansweredRequestedFieldNamesForTopic({
              snapshot,
              topicResponsePlan: responsePlan,
              previousUnansweredRequestedFieldNames:
                snapshot.unansweredRequestedFieldNames
            })
          : snapshot.unansweredRequestedFieldNames ?? [];
        const nextSnapshot = supportKnowledgeSummary
          ? { ...snapshot, supportKnowledgeSummary }
          : snapshot;

        return unansweredRequestedFieldNames.length > 0
          ? { ...nextSnapshot, unansweredRequestedFieldNames }
          : (() => {
              const {
                unansweredRequestedFieldNames: _unansweredRequestedFieldNames,
                ...snapshotWithoutUnansweredFields
              } = nextSnapshot;

              return snapshotWithoutUnansweredFields;
            })();
      });
      // Legacy singular fields expose the first topic branch temporarily.
      knowledgeEnrichmentPlan =
        topicBranchResults[0]?.topicKnowledgeEnrichmentPlan;
      retrievedSupportKnowledge =
        topicBranchResults[0]?.topicRetrievedSupportKnowledge ?? [];
      synthesizedRetrievedKnowledge =
        topicBranchResults[0]?.topicRetrievedKnowledgeSynthesis ?? null;
    }
  }

  composedSupportResponsePlan = await runStep(
    internalRuntime,
    "composeSupportResponsePlan",
    pipelineSteps.composeSupportResponsePlan,
    {
      standardResponseFragments,
      topicResponsePlans: topicResponsePlans ?? [],
      supportResponseCues: supportResponseCues ?? [],
      channel: latestUserMessage.channel,
      recentInteractionContext,
      responsePlanningPolicy
    }
  );

  const renderSupportResponseInput: RenderSupportResponseInput = {
    composedSupportResponsePlan,
    targetLanguage: rendererLanguage,
    channel: latestUserMessage.channel
  };

  const renderedSupportResponse = await runStep(
    internalRuntime,
    "renderSupportResponse",
    pipelineSteps.renderSupportResponse,
    renderSupportResponseInput
  );

  const userResponse = await runStep(
    internalRuntime,
    "buildUserResponse",
    pipelineSteps.buildUserResponse,
    {
      renderedSupportResponse
    }
  );
  const persistenceEffects = await runStep(
    internalRuntime,
    "buildSupportProcessingPersistenceEffects",
    pipelineSteps.buildSupportProcessingPersistenceEffects,
    {
      promptSecuritySignals,
      turnAnalysisPlan,
      supportTopicKnowledge,
      latestUserMessageContent: latestUserMessage.content,
      ...(typeof textUnderstandings !== "undefined"
        ? { textUnderstandings }
        : {}),
      ...(typeof supportResponseCues !== "undefined"
        ? { supportResponseCues }
        : {}),
      ...(typeof topicUpdateProposals !== "undefined"
        ? { topicUpdateProposals }
        : {}),
      ...(typeof topicPatches !== "undefined"
        ? { topicPatches }
        : {}),
      ...(typeof mergedTopicSnapshots !== "undefined"
        ? { mergedTopicSnapshots }
        : {}),
      ...(typeof knowledgeEnrichmentPlan !== "undefined"
        ? { knowledgeEnrichmentPlan }
        : {}),
      ...(typeof retrievedSupportKnowledge !== "undefined"
        ? { retrievedSupportKnowledge }
        : {}),
      ...(typeof synthesizedRetrievedKnowledge !== "undefined"
        ? { synthesizedRetrievedKnowledge }
        : {}),
      ...(typeof topicKnowledgeEnrichmentPlans !== "undefined"
        ? { topicKnowledgeEnrichmentPlans }
        : {}),
      ...(typeof topicRetrievedSupportKnowledge !== "undefined"
        ? { topicRetrievedSupportKnowledge }
        : {}),
      ...(typeof topicRetrievedKnowledgeSyntheses !== "undefined"
        ? { topicRetrievedKnowledgeSyntheses }
        : {}),
      ...(typeof ragUsage !== "undefined"
        ? { ragUsage }
        : {}),
      topicResponsePlans,
      ...(typeof composedSupportResponsePlan !== "undefined"
        ? { composedSupportResponsePlan }
        : {}),
      ...(textSurfaceAnalysis?.userLanguage
        ? { rawUserLanguage: textSurfaceAnalysis.userLanguage }
        : {}),
      userResponse
    }
  );

  return {
    userResponse,
    persistenceEffects,
    ...(typeof textUnderstandings !== "undefined"
      ? { textUnderstandings }
      : {}),
    ...(typeof supportResponseCues !== "undefined"
      ? { supportResponseCues }
      : {}),
    ...(typeof topicUpdateProposals !== "undefined"
      ? { topicUpdateProposals }
      : {}),
    ...(typeof topicUpdateOps !== "undefined"
      ? { topicUpdateOps }
      : {}),
    ...(typeof topicPatches !== "undefined"
      ? { topicPatches }
      : {}),
    ...(typeof mergedTopicSnapshots !== "undefined"
      ? { mergedTopicSnapshots }
      : {}),
    ...(typeof knowledgeEnrichmentPlan !== "undefined"
      ? { knowledgeEnrichmentPlan }
      : {}),
    ...(typeof retrievedSupportKnowledge !== "undefined"
      ? { retrievedSupportKnowledge }
      : {}),
    ...(typeof synthesizedRetrievedKnowledge !== "undefined"
      ? { synthesizedRetrievedKnowledge }
      : {}),
    ...(typeof topicKnowledgeEnrichmentPlans !== "undefined"
      ? { topicKnowledgeEnrichmentPlans }
      : {}),
    ...(typeof topicRetrievedSupportKnowledge !== "undefined"
      ? { topicRetrievedSupportKnowledge }
      : {}),
    ...(typeof topicRetrievedKnowledgeSyntheses !== "undefined"
      ? { topicRetrievedKnowledgeSyntheses }
      : {}),
    ...(typeof ragUsage !== "undefined"
      ? { ragUsage }
      : {}),
    ...(typeof topicResponsePlans !== "undefined"
      ? {
          topicResponsePlans
        }
      : {}),
    ...(typeof composedSupportResponsePlan !== "undefined"
      ? {
          composedSupportResponsePlan
        }
      : {})
  };
}

async function runSupportProcessingPipelineV2Optimized(
  inputSupportProcessingPipeline: SupportProcessingPipelineV2Input,
  steps: SupportProcessingPipelineV2Steps = {},
  runtime: SupportProcessingPipelineV2Runtime = {}
): Promise<SupportProcessingPipelineV2Output> {
  return runSupportProcessingPipelineV2OptimizedInternal(
    inputSupportProcessingPipeline,
    steps,
    runtime
  );
}

export {
  isSupportProcessingPipelineV2DebugStop,
  runSupportProcessingPipelineV2OptimizedInternal,
  runSupportProcessingPipelineV2Optimized
};

export type {
  SupportProcessingPipelineV2DebugStop,
  SupportProcessingPipelineV2InternalDebugState
};
