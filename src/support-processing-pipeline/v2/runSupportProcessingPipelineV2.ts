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
  selectCatalogKnowledgeForTopic
} from "./select-catalog-knowledge-for-topic/selectCatalogKnowledgeForTopic";
import {
  planSupportResponse
} from "./plan-support-response/planSupportResponse";
import {
  renderSupportResponse
} from "./response-renderer/renderSupportResponse";
import {
  buildSupportPatchesV2
} from "./build-support-patches/buildSupportPatchesV2";
import {
  buildUserResponseV2
} from "./build-user-response/buildUserResponseV2";
import {
  assignTopicResponsePlanIds
} from "./responsePlanIds";

import type {
  AttachmentSurfaceAnalysis,
  AttachmentUnderstanding,
  BuildSupportPatchesInput,
  ExtractableFieldDefinition,
  KnowledgeChunk,
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
  TopicUpdateProposal
} from "./typesSupportProcessingPipelineV2.types";

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
    for (const fact of understanding.facts) {
      if ("fieldName" in fact) {
        selectedFieldNames.add(fact.fieldName);
      }
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
  status: "started" | "completed" | "skipped" | "failed"
): Promise<void> {
  try {
    await runtime.reportProgress?.({
      step,
      status
    });
  } catch {
    // Progress reporting is observational and must not affect pipeline execution.
  }
}

async function runStep<TInput, TOutput>(
  runtime: SupportProcessingPipelineV2Runtime,
  stepName: SupportProcessingStepName,
  step: PipelineStep<TInput, TOutput>,
  input: TInput
): Promise<TOutput> {
  await reportProgress(runtime, stepName, "started");

  try {
    const output = await step(input);
    await reportProgress(runtime, stepName, "completed");

    return output;
  } catch (error) {
    await reportProgress(runtime, stepName, "failed");
    throw error;
  }
}

async function skipStep(
  runtime: SupportProcessingPipelineV2Runtime,
  stepName: SupportProcessingStepName
): Promise<void> {
  await reportProgress(runtime, stepName, "skipped");
}

async function skipSteps(
  runtime: SupportProcessingPipelineV2Runtime,
  stepNames: SupportProcessingStepName[]
): Promise<void> {
  for (const stepName of stepNames) {
    await skipStep(runtime, stepName);
  }
}

async function runSupportProcessingPipelineV2(
  inputSupportProcessingPipeline: SupportProcessingPipelineV2Input,
  steps: SupportProcessingPipelineV2Steps = {},
  runtime: SupportProcessingPipelineV2Runtime = {}
): Promise<SupportProcessingPipelineV2Output> {
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

          return result.topicUpdateProposals;
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
      steps.retrieveSupportKnowledge,
      "retrieveSupportKnowledge"
    ),
    synthesizeRetrievedKnowledge: resolveStep(
      steps.synthesizeRetrievedKnowledge,
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
    renderSupportResponse: resolveStep(
      steps.renderSupportResponse ||
        (async (input) => {
          const result = await renderSupportResponse({
            latestUserMessageContent: input.latestUserMessageContent,
            targetLanguage: input.targetLanguage,
            standardResponseFragments: input.standardResponseFragments,
            topicResponsePlans: input.topicResponsePlans,
            channel: input.channel
          });

          return result.renderedResponse;
        }),
      "renderSupportResponse"
    ),
    buildUserResponse: resolveStep(
      steps.buildUserResponse || buildUserResponseV2,
      "buildUserResponse"
    ),
    buildSupportPatches: resolveStep(
      steps.buildSupportPatches || buildSupportPatchesV2,
      "buildSupportPatches"
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
    runtime,
    "detectSuspiciousPromptPatterns",
    pipelineSteps.detectSuspiciousPromptPatterns,
    {
      latestUserMessage
    }
  );

  const turnAnalysisPlan = await runStep(
    runtime,
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
          runtime,
          "analyzeTextSurface",
          pipelineSteps.analyzeTextSurface,
          {
            latestUserMessage,
            turnAnalysisPlan,
            recentInteractionContext
          }
        )
      : skipStep(runtime, "analyzeTextSurface").then(() => undefined),
    turnAnalysisPlan.analyzeAttachments
      ? runStep(
          runtime,
          "analyzeAttachmentSurface",
          pipelineSteps.analyzeAttachmentSurface,
          {
            latestUserMessage,
            latestUserAttachments,
            turnAnalysisPlan
          }
        )
      : skipStep(runtime, "analyzeAttachmentSurface").then(() => undefined)
  ]);

  const standardResponseFragments = await runStep(
    runtime,
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
  let topicResponsePlans: ResponsePlanV2[] | undefined;
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
    await skipSteps(runtime, [
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
            runtime,
            "analyzeSupportText",
            pipelineSteps.analyzeSupportText,
            {
              turnAnalysisPlan,
              textSurfaceAnalysis,
              recentInteractionContext,
              extractableFieldCatalog
            }
          )
        : skipStep(runtime, "analyzeSupportText").then(
            () => ({
              textUnderstandings: [] satisfies TextUnderstanding[],
              supportResponseCues: [] satisfies SupportResponseCue[]
            })
          ),
      runAttachmentDeepAnalysis
        ? runStep(
            runtime,
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
        : skipStep(runtime, "analyzeSupportAttachments").then(
            () => [] satisfies AttachmentUnderstanding[]
          )
    ]);
    textUnderstandings = analyzedSupportText.textUnderstandings;
    supportResponseCues = analyzedSupportText.supportResponseCues;
    attachmentUnderstandings = analyzedSupportAttachments;

    topicUpdateProposals = await runStep(
      runtime,
      "proposeTopicUpdates",
      pipelineSteps.proposeTopicUpdates,
      {
        textUnderstandings,
        supportTopicKnowledge,
        recentInteractionContext,
        latestUserMessageContent: latestUserMessage.content
      }
    );

    await skipStep(runtime, "applyTopicUpdates");

    const actionableTopicUpdateProposals = topicUpdateProposals.filter(
      isActionableTopicUpdateProposal
    );

    if (actionableTopicUpdateProposals.length === 0) {
      topicResponsePlans = [];
      topicKnowledgeEnrichmentPlans = [];
      topicRetrievedSupportKnowledge = [];
      topicRetrievedKnowledgeSyntheses = [];
      await skipSteps(runtime, [
        "planKnowledgeEnrichment",
        "selectCatalogKnowledgeForTopic",
        "retrieveSupportKnowledge",
        "synthesizeRetrievedKnowledge",
        "planSupportResponse"
      ]);
    } else {
      const topicBranchResults = await Promise.all(
        actionableTopicUpdateProposals.map(async (topicUpdateProposal) => {
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
          const topicUserMessageContent =
            buildTopicUserMessageContent(topicEvidence);
          const selectedCatalogKnowledgePromise = runStep(
            runtime,
            "selectCatalogKnowledgeForTopic",
            pipelineSteps.selectCatalogKnowledgeForTopic,
            {
              topicUserMessageContent,
              topicEvidence,
              extractableFieldCatalog,
              recentInteractionContext,
              ...(textSurfaceAnalysis?.userLanguage
                ? { targetLanguage: textSurfaceAnalysis.userLanguage }
                : {})
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
            runtime,
            "planKnowledgeEnrichment",
            pipelineSteps.planKnowledgeEnrichment,
            {
              topicEvidence,
              extractableFieldCatalog,
              recentInteractionContext,
              ...(textSurfaceAnalysis?.userLanguage
                ? { targetLanguage: textSurfaceAnalysis.userLanguage }
                : {})
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
            topicRetrievedSupportKnowledge = await runStep(
              runtime,
              "retrieveSupportKnowledge",
              pipelineSteps.retrieveSupportKnowledge,
              {
                knowledgeEnrichmentPlan: topicKnowledgeEnrichmentPlan,
                topicEvidence,
                selectedCatalogKnowledge,
                topicKnowledgeEnrichmentPlan
              }
            );
            topicRetrievedKnowledgeSynthesis = await runStep(
              runtime,
              "synthesizeRetrievedKnowledge",
              pipelineSteps.synthesizeRetrievedKnowledge,
              {
                knowledgeEnrichmentPlan: topicKnowledgeEnrichmentPlan,
                knowledgeChunks: topicRetrievedSupportKnowledge,
                topicEvidence,
                selectedCatalogKnowledge,
                topicKnowledgeEnrichmentPlan
              }
            );
          } else {
            await skipSteps(runtime, [
              "retrieveSupportKnowledge",
              "synthesizeRetrievedKnowledge"
            ]);
          }

          const topicResponsePlan = await runStep(
            runtime,
            "planSupportResponse",
            pipelineSteps.planSupportResponse,
            {
              topicUserMessageContent,
              topicEvidence,
              ...(textSurfaceAnalysis?.userLanguage
                ? { targetLanguage: textSurfaceAnalysis.userLanguage }
                : {}),
              selectedCatalogKnowledge,
              topicKnowledgeEnrichmentPlan,
              topicRetrievedKnowledgeSynthesis,
              responsePlanningPolicy,
              channel: latestUserMessage.channel
            }
          );

          return {
            topicUpdateProposal,
            topicEvidence,
            topicKnowledgeEnrichmentPlan,
            topicRetrievedSupportKnowledge,
            topicRetrievedKnowledgeSynthesis,
            topicResponsePlan
          };
        })
      );

      topicResponsePlans = assignTopicResponsePlanIds(
        topicBranchResults.map((result) => ({
          proposalId: result.topicUpdateProposal.proposalId,
          responsePlan: result.topicResponsePlan
        }))
      );
      topicKnowledgeEnrichmentPlans = topicBranchResults.map((result) => ({
        proposalId: result.topicUpdateProposal.proposalId,
        topicId: result.topicUpdateProposal.topicId,
        plan: result.topicKnowledgeEnrichmentPlan
      }));
      topicRetrievedSupportKnowledge = topicBranchResults.map((result) => ({
        proposalId: result.topicUpdateProposal.proposalId,
        topicId: result.topicUpdateProposal.topicId,
        knowledgeChunks: result.topicRetrievedSupportKnowledge
      }));
      topicRetrievedKnowledgeSyntheses = topicBranchResults.map((result) => ({
        proposalId: result.topicUpdateProposal.proposalId,
        topicId: result.topicUpdateProposal.topicId,
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

  const renderSupportResponseInput: RenderSupportResponseInput = {
    latestUserMessageContent: latestUserMessage.content,
    ...(textSurfaceAnalysis?.userLanguage
      ? { targetLanguage: textSurfaceAnalysis.userLanguage }
      : {}),
    standardResponseFragments,
    topicResponsePlans: topicResponsePlans ?? [],
    channel: latestUserMessage.channel
  };

  const renderedSupportResponse = await runStep(
    runtime,
    "renderSupportResponse",
    pipelineSteps.renderSupportResponse,
    renderSupportResponseInput
  );

  const userResponse = await runStep(
    runtime,
    "buildUserResponse",
    pipelineSteps.buildUserResponse,
    {
      renderedSupportResponse
    }
  );
  const patches = await runStep(
    runtime,
    "buildSupportPatches",
    pipelineSteps.buildSupportPatches,
    {
      promptSecuritySignals,
      turnAnalysisPlan,
      supportTopicKnowledge,
      ...(typeof textUnderstandings !== "undefined"
        ? { textUnderstandings }
        : {}),
      ...(typeof supportResponseCues !== "undefined"
        ? { supportResponseCues }
        : {}),
      ...(typeof topicUpdateProposals !== "undefined"
        ? { topicUpdateProposals }
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
      // TODO V2 cleanup: remove legacy responsePlan once downstream consumers
      // use topicResponsePlans.
      responsePlan: topicResponsePlans?.[0],
      userResponse
    }
  );

  return {
    userResponse,
    patches,
    ...(typeof textUnderstandings !== "undefined"
      ? { textUnderstandings }
      : {}),
    ...(typeof supportResponseCues !== "undefined"
      ? { supportResponseCues }
      : {}),
    ...(typeof topicUpdateProposals !== "undefined"
      ? { topicUpdateProposals }
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
          topicResponsePlans,
          // TODO V2 cleanup: remove legacy responsePlan once downstream
          // consumers use topicResponsePlans.
          ...(topicResponsePlans[0]
            ? { responsePlan: topicResponsePlans[0] }
            : {})
        }
      : {})
  };
}

export {
  runSupportProcessingPipelineV2
};
