import {
  detectSuspiciousPromptPatterns
} from "./detect-suspicious-prompt-patterns/detectSuspiciousPromptPatterns";
import {
  planTurnAnalysis
} from "./plan-turn-analysis/planTurnAnalysis";
import {
  analyzeTextSurface
} from "./analyze-text-surface/analyzeTextSurface";
import {
  buildStandardResponseFragments
} from "./build-standard-response-fragments/buildStandardResponseFragments";
import {
  analyzeSupportText
} from "./analyze-support-text/analyzeSupportText";
import {
  DEFAULT_SUPPORT_EXTRACTABLE_FIELD_CATALOG
} from "./analyze-support-text/supportExtractableFieldCatalog";
import {
  proposeTopicUpdates
} from "./propose-topic-updates/proposeTopicUpdates";
import {
  planKnowledgeEnrichment
} from "./plan-knowledge-enrichment/planKnowledgeEnrichment";
import {
  retrieveSupportKnowledge
} from "./retrieve-support-knowledge/retrieveSupportKnowledge";
import {
  synthesizeRetrievedKnowledge
} from "./synthesize-retrieved-knowledge/synthesizeRetrievedKnowledge";
import {
  selectCatalogKnowledgeForTopic
} from "./select-catalog-knowledge-for-topic/selectCatalogKnowledgeForTopic";
import {
  buildCandidateFieldsForTopicSelector
} from "./select-catalog-knowledge-for-topic/buildCandidateFieldsForTopicSelector";
import {
  planSupportResponse
} from "./plan-support-response/planSupportResponse";
import {
  composeSupportResponsePlan
} from "./compose-support-response-plan/composeSupportResponsePlan";
import {
  renderSupportResponse
} from "./response-renderer/renderSupportResponse";
import {
  buildSupportProcessingPersistenceEffectsV2
} from "./build-persistence-effects/buildSupportProcessingPersistenceEffectsV2";
import {
  buildUserResponseV2
} from "./build-user-response/buildUserResponseV2";
import {
  assignTopicResponsePlanIds
} from "./responsePlanIds";
import {
  normalizeUserLanguageForResponse
} from "./response-language/normalizeUserLanguageForResponse";

import type {
  AttachmentSurfaceAnalysis,
  AttachmentUnderstanding,
  BuildSupportPersistenceEffectsInput,
  ComposedSupportResponsePlan,
  ExtractableFieldDefinition,
  KnowledgeChunk,
  MergedTopicSnapshot,
  ProposeTopicUpdatesOutput,
  RetrievedKnowledgeSynthesis,
  RenderSupportResponseInput,
  ResponsePlanV2,
  SelectedCatalogKnowledgeForTopic,
  StandardResponseFragment,
  SupportResponseCue,
  SupportProcessingProgressEvent,
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
} from "./typesSupportProcessingPipelineV2.types";

type MaybePromise<T> = T | Promise<T>;

type PipelineStep<TInput, TOutput> = (
  input: TInput
) => MaybePromise<TOutput>;

type SupportProcessingPipelineV2DebugStop = {
  stepName: SupportProcessingStepName;
};

type SupportProcessingPipelineV2InternalDebugState = {
  stopAfterStep?: SupportProcessingStepName;
  partial: Record<string, unknown>;
};

type SupportProcessingPipelineV2InternalRuntime =
  SupportProcessingPipelineV2Runtime & {
    debugState?: SupportProcessingPipelineV2InternalDebugState;
  };

const SUPPORT_PROCESSING_PIPELINE_V2_DEBUG_STOP =
  "SupportProcessingPipelineV2DebugStop";

function isSupportProcessingPipelineV2DebugStop(
  error: unknown
): error is SupportProcessingPipelineV2DebugStop {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name ===
      SUPPORT_PROCESSING_PIPELINE_V2_DEBUG_STOP &&
    typeof (error as { stepName?: unknown }).stepName === "string"
  );
}

function appendPartialDebugOutput(params: {
  debugState?: SupportProcessingPipelineV2InternalDebugState;
  stepName: SupportProcessingStepName;
  output: unknown;
}): void {
  if (!params.debugState) {
    return;
  }

  const currentValue = params.debugState.partial[params.stepName];

  if (currentValue === undefined) {
    params.debugState.partial[params.stepName] = params.output;
    return;
  }

  if (Array.isArray(currentValue)) {
    currentValue.push(params.output);
    return;
  }

  params.debugState.partial[params.stepName] = [
    currentValue,
    params.output
  ];
}

function stopAfterStepIfRequested(params: {
  debugState?: SupportProcessingPipelineV2InternalDebugState;
  stepName: SupportProcessingStepName;
}): void {
  if (params.debugState?.stopAfterStep !== params.stepName) {
    return;
  }

  throw Object.assign(new Error(`Stopped after ${params.stepName}`), {
    name: SUPPORT_PROCESSING_PIPELINE_V2_DEBUG_STOP,
    stepName: params.stepName
  });
}

function createMissingStep<TInput, TOutput>(
  stepName: string
): PipelineStep<TInput, TOutput> {
  return function missingStep(): never {
    throw new Error(`${stepName} is not implemented yet`);
  };
}

function resolveStep<TInput, TOutput>(
  providedStep: PipelineStep<TInput, TOutput> | undefined,
  stepName: string
): PipelineStep<TInput, TOutput> {
  return providedStep || createMissingStep<TInput, TOutput>(stepName);
}

function shouldRunDeepTextAnalysis(
  textSurfaceAnalysis: TextSurfaceAnalysis | undefined
): textSurfaceAnalysis is TextSurfaceAnalysis {
  return textSurfaceAnalysis?.segments.some((segment) => {
    return segment.category === "support_relevant";
  }) === true;
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
  topicId: string | null;
}): ResponsePlanV2 {
  return {
    topicId: params.topicId ?? params.branchId,
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

  return supportTopicKnowledge.segments_topic.find((topic) => {
    return String(topic.id_topic) === proposal.topicId;
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
    topicId: params.snapshot.topicId ?? params.snapshot.temporaryTopicId,
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

function buildTemporarySelectedCatalogKnowledge(params: {
  relatedTextUnderstandings: TextUnderstanding[];
  relatedAttachmentUnderstandings: AttachmentUnderstanding[];
}): unknown {
  const selectedFieldNames = new Set<string>();

  for (const understanding of params.relatedTextUnderstandings) {
    const caseDetailKeys = new Set(
      (understanding.caseDetails ?? []).map((detail) => detail.key)
    );

    for (const key of caseDetailKeys) {
      selectedFieldNames.add(key);
    }

    if (understanding.broadCategoryHint === "billing") {
      selectedFieldNames.add("duplicate_billing_impact");
      selectedFieldNames.add("billing_issue_type");
      selectedFieldNames.add("billing_date_or_period");
      selectedFieldNames.add("amount");
      selectedFieldNames.add("currency");
    }

    if (understanding.broadCategoryHint === "bug") {
      selectedFieldNames.add("feature_or_page");
      selectedFieldNames.add("trigger_action");
      selectedFieldNames.add("error_message");
      selectedFieldNames.add("observed_result");
      selectedFieldNames.add("platform");
      selectedFieldNames.add("browser");
    }

    if (understanding.broadCategoryHint === "access_security") {
      selectedFieldNames.add("access_action");
      selectedFieldNames.add("auth_method");
      selectedFieldNames.add("account_status");
      selectedFieldNames.add("error_message");
    }

    if (
      caseDetailKeys.has("billing_issue_type") ||
      caseDetailKeys.has("billing_date_or_period") ||
      caseDetailKeys.has("amount") ||
      caseDetailKeys.has("currency")
    ) {
      selectedFieldNames.add("duplicate_billing_impact");
      selectedFieldNames.add("billing_issue_type");
      selectedFieldNames.add("billing_date_or_period");
      selectedFieldNames.add("amount");
      selectedFieldNames.add("currency");
    }

    if (
      caseDetailKeys.has("feature_or_page") ||
      caseDetailKeys.has("trigger_action") ||
      caseDetailKeys.has("error_message") ||
      caseDetailKeys.has("observed_result")
    ) {
      selectedFieldNames.add("feature_or_page");
      selectedFieldNames.add("trigger_action");
      selectedFieldNames.add("error_message");
      selectedFieldNames.add("observed_result");
      selectedFieldNames.add("platform");
      selectedFieldNames.add("browser");
    }

    if (
      caseDetailKeys.has("access_action") ||
      caseDetailKeys.has("auth_method") ||
      caseDetailKeys.has("account_status")
    ) {
      selectedFieldNames.add("access_action");
      selectedFieldNames.add("auth_method");
      selectedFieldNames.add("account_status");
      selectedFieldNames.add("error_message");
    }
  }

  if (params.relatedAttachmentUnderstandings.length > 0) {
    selectedFieldNames.add("visual_evidence");
  }

  return {
    selectedFields: DEFAULT_SUPPORT_EXTRACTABLE_FIELD_CATALOG.filter(
      (fieldDefinition) => {
        return selectedFieldNames.has(fieldDefinition.fieldName);
      }
    ),
    selectedGenericKnowledge: [],
    scopeReason: "temporary_topic_catalog_selection"
  };
}

async function reportProgress(
  runtime: SupportProcessingPipelineV2Runtime,
  step: SupportProcessingStepName,
  status: "started" | "completed" | "skipped" | "failed",
  details: Omit<Partial<SupportProcessingProgressEvent>, "step" | "status"> = {}
): Promise<void> {
  try {
    await runtime.reportProgress?.({
      step,
      status,
      ...details
    });
  } catch {
    // Progress reporting is observational and must not affect pipeline execution.
  }
}

async function runStep<TInput, TOutput>(
  runtime: SupportProcessingPipelineV2InternalRuntime,
  stepName: SupportProcessingStepName,
  step: PipelineStep<TInput, TOutput>,
  input: TInput,
  buildCompletedProgressDetails?: (
    output: TOutput
  ) => Omit<Partial<SupportProcessingProgressEvent>, "step" | "status">
): Promise<TOutput> {
  await reportProgress(runtime, stepName, "started");

  try {
    const output = await step(input);
    await reportProgress(
      runtime,
      stepName,
      "completed",
      buildCompletedProgressDetails?.(output)
    );
    appendPartialDebugOutput({
      debugState: runtime.debugState,
      stepName,
      output
    });
    stopAfterStepIfRequested({
      debugState: runtime.debugState,
      stepName
    });

    return output;
  } catch (error) {
    if (isSupportProcessingPipelineV2DebugStop(error)) {
      throw error;
    }

    await reportProgress(runtime, stepName, "failed");
    throw error;
  }
}

async function skipStep(
  runtime: SupportProcessingPipelineV2InternalRuntime,
  stepName: SupportProcessingStepName
): Promise<void> {
  await reportProgress(runtime, stepName, "skipped");
  appendPartialDebugOutput({
    debugState: runtime.debugState,
    stepName,
    output: "SKIPPED"
  });
  stopAfterStepIfRequested({
    debugState: runtime.debugState,
    stepName
  });
}

async function skipSteps(
  runtime: SupportProcessingPipelineV2InternalRuntime,
  stepNames: SupportProcessingStepName[]
): Promise<void> {
  for (const stepName of stepNames) {
    await skipStep(runtime, stepName);
  }
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

async function runSupportProcessingPipelineV2Internal(
  inputSupportProcessingPipeline: SupportProcessingPipelineV2Input,
  steps: SupportProcessingPipelineV2Steps = {},
  runtime: SupportProcessingPipelineV2InternalRuntime = {},
  debugState?: SupportProcessingPipelineV2InternalDebugState
): Promise<SupportProcessingPipelineV2Output> {
  const internalRuntime: SupportProcessingPipelineV2InternalRuntime =
    debugState ? { ...runtime, debugState } : runtime;
  const pipelineSteps: Required<SupportProcessingPipelineV2Steps> = {
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
            const normalizedResponseLanguage =
              normalizeUserLanguageForResponse(output.userLanguage);

            return {
              userLanguage: output.userLanguage,
              rawUserLanguage: output.userLanguage,
              normalizedResponseLanguage
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
  const responseLanguage = normalizeUserLanguageForResponse(
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
            topicId: snapshot.topicId ?? snapshot.temporaryTopicId,
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
          const selectorFields = topicBranchSource.topicSnapshot
            ? buildCandidateFieldsForTopicSelector({
                topicSnapshot: topicBranchSource.topicSnapshot,
                extractableFieldCatalog
              })
            : undefined;
          const selectedCatalogKnowledgePromise = runStep(
            internalRuntime,
            "selectCatalogKnowledgeForTopic",
            pipelineSteps.selectCatalogKnowledgeForTopic,
            {
              topicUserMessageContent,
              topicEvidence,
              ...(topicBranchSource.topicSnapshot
                ? { topicSnapshot: topicBranchSource.topicSnapshot }
                : {}),
              ...(selectorFields
                ? {
                    knownFields: selectorFields.knownFields,
                    candidateFields: selectorFields.candidateFields
                  }
                : {}),
              extractableFieldCatalog,
              recentInteractionContext,
              targetLanguage: responseLanguage
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
          const topicKnowledgeEnrichmentPlanPromise = runStep(
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
              targetLanguage: responseLanguage
            }
          );
          const [
            selectedCatalogKnowledge,
            topicKnowledgeEnrichmentPlan
          ] = await Promise.all([
            selectedCatalogKnowledgePromise,
            topicKnowledgeEnrichmentPlanPromise
          ]);
          let topicRetrievedSupportKnowledge: KnowledgeChunk[] = [];
          let topicRetrievedKnowledgeSynthesis:
            | RetrievedKnowledgeSynthesis
            | null = null;

          if (topicKnowledgeEnrichmentPlan.route === "retrieve_knowledge") {
            let knowledgeRetrievalFailureReason: string | undefined;

            try {
              topicRetrievedSupportKnowledge = await runStep(
                internalRuntime,
                "retrieveSupportKnowledge",
                pipelineSteps.retrieveSupportKnowledge,
                {
                  knowledgeEnrichmentPlan: topicKnowledgeEnrichmentPlan,
                  topicEvidence,
                  ...(topicBranchSource.topicSnapshot
                    ? { topicSnapshot: topicBranchSource.topicSnapshot }
                    : {}),
                  selectedCatalogKnowledge,
                  topicKnowledgeEnrichmentPlan
                }
              );
            } catch (error) {
              knowledgeRetrievalFailureReason =
                ragRetrievalFailureReason(error);
              topicRetrievedSupportKnowledge = [];
              debugLogRagRetrievalError(error);
            }
            topicRetrievedKnowledgeSynthesis = await runStep(
              internalRuntime,
              "synthesizeRetrievedKnowledge",
              pipelineSteps.synthesizeRetrievedKnowledge,
              {
                knowledgeEnrichmentPlan: topicKnowledgeEnrichmentPlan,
                knowledgeChunks: topicRetrievedSupportKnowledge,
                topicEvidence,
                ...(topicBranchSource.topicSnapshot
                  ? { topicSnapshot: topicBranchSource.topicSnapshot }
                  : {}),
                selectedCatalogKnowledge,
                topicKnowledgeEnrichmentPlan,
                ...(knowledgeRetrievalFailureReason
                  ? { knowledgeRetrievalFailureReason }
                  : {})
              }
            );
          } else {
            await skipSteps(internalRuntime, [
              "retrieveSupportKnowledge",
              "synthesizeRetrievedKnowledge"
            ]);
          }
          const topicResponsePlan = await runStep(
            internalRuntime,
            "planSupportResponse",
            pipelineSteps.planSupportResponse,
            {
              topicUserMessageContent,
              topicEvidence,
              targetLanguage: responseLanguage,
              selectedCatalogKnowledge,
              topicKnowledgeEnrichmentPlan,
              topicRetrievedKnowledgeSynthesis,
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
      targetLanguage: responseLanguage,
      channel: latestUserMessage.channel,
      recentInteractionContext,
      responsePlanningPolicy
    }
  );

  const renderSupportResponseInput: RenderSupportResponseInput = {
    composedSupportResponsePlan,
    targetLanguage: responseLanguage,
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
      topicResponsePlans,
      ...(typeof composedSupportResponsePlan !== "undefined"
        ? { composedSupportResponsePlan }
        : {}),
      ...(textSurfaceAnalysis?.userLanguage
        ? { rawUserLanguage: textSurfaceAnalysis.userLanguage }
        : {}),
      normalizedResponseLanguage: responseLanguage,
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

async function runSupportProcessingPipelineV2(
  inputSupportProcessingPipeline: SupportProcessingPipelineV2Input,
  steps: SupportProcessingPipelineV2Steps = {},
  runtime: SupportProcessingPipelineV2Runtime = {}
): Promise<SupportProcessingPipelineV2Output> {
  return runSupportProcessingPipelineV2Internal(
    inputSupportProcessingPipeline,
    steps,
    runtime
  );
}

export {
  isSupportProcessingPipelineV2DebugStop,
  runSupportProcessingPipelineV2Internal,
  runSupportProcessingPipelineV2
};

export type {
  SupportProcessingPipelineV2DebugStop,
  SupportProcessingPipelineV2InternalDebugState
};
