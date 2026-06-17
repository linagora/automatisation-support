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
  proposeTopicUpdates
} from "./propose-topic-updates/proposeTopicUpdates";
import {
  planKnowledgeEnrichment
} from "./plan-knowledge-enrichment/planKnowledgeEnrichment";
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

import type {
  AttachmentSurfaceAnalysis,
  AttachmentUnderstanding,
  BuildSupportPatchesInput,
  ExtractableFieldDefinition,
  GenericFieldKnowledge,
  KnowledgeChunk,
  RetrievedKnowledgeSynthesis,
  RenderSupportResponseInput,
  ResponsePlanV2,
  StandardResponseFragment,
  SupportResponseCue,
  SupportProcessingPipelineV2Runtime,
  SupportProcessingPipelineV2Input,
  SupportProcessingPipelineV2Output,
  SupportProcessingPipelineV2Steps,
  SupportProcessingStepName,
  TextSurfaceAnalysis,
  TextUnderstanding,
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
          const result = await planSupportResponse({
            latestUserMessageContent: input.latestUserMessageContent,
            textSurfaceAnalysis: input.textSurfaceAnalysis ?? null,
            standardResponseFragments: input.standardResponseFragments,
            supportResponseCues: input.supportResponseCues,
            textUnderstandings: input.textUnderstandings,
            topicUpdateProposals: input.topicUpdateProposals,
            existingTopics: input.existingTopics ??
              input.supportTopicKnowledge.segments_topic,
            knowledgeEnrichmentPlan: input.knowledgeEnrichmentPlan,
            retrievedSupportKnowledge: input.retrievedSupportKnowledge,
            synthesizedRetrievedKnowledge:
              input.synthesizedRetrievedKnowledge,
            recentInteractionContext: input.recentInteractionContext,
            extractableFieldCatalog: input.extractableFieldCatalog,
            responsePlanningPolicy: input.responsePlanningPolicy
          });

          return result.responsePlan;
        }),
      "planSupportResponse"
    ),
    renderSupportResponse: resolveStep(
      steps.renderSupportResponse ||
        (async (input) => {
          const result = await renderSupportResponse({
            latestUserMessageContent: input.latestUserMessageContent,
            responsePlan: input.responsePlan ?? null,
            textSurfaceAnalysis: input.textSurfaceAnalysis,
            standardResponseFragments: input.standardResponseFragments,
            supportResponseCues: input.supportResponseCues ?? [],
            textUnderstandings: input.textUnderstandings ?? [],
            topicUpdateProposals: input.topicUpdateProposals ?? [],
            existingTopics: input.existingTopics ?? [],
            knowledgeEnrichmentPlan: input.knowledgeEnrichmentPlan,
            retrievedSupportKnowledge: input.retrievedSupportKnowledge ?? [],
            synthesizedRetrievedKnowledge:
              input.synthesizedRetrievedKnowledge ?? null,
            recentInteractionContext: input.recentInteractionContext,
            responsePlanningPolicy: input.responsePlanningPolicy,
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

  const extractableFieldCatalog: ExtractableFieldDefinition[] = [];
  const genericFieldKnowledge: GenericFieldKnowledge = {};

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
  let responsePlan: ResponsePlanV2 | undefined;
  let textUnderstandings: TextUnderstanding[] | undefined;
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
      "retrieveSupportKnowledge",
      "synthesizeRetrievedKnowledge",
      "planSupportResponse"
    ]);
  } else {
    const [analyzedSupportText] = await Promise.all([
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

    knowledgeEnrichmentPlan = await runStep(
      runtime,
      "planKnowledgeEnrichment",
      pipelineSteps.planKnowledgeEnrichment,
      {
        ...(textSurfaceAnalysis ? { textSurfaceAnalysis } : {}),
        standardResponseFragments,
        textUnderstandings,
        supportResponseCues,
        topicUpdateProposals,
        supportTopicKnowledge,
        recentInteractionContext,
        latestUserMessage,
        extractableFieldCatalog
      }
    );

    if (knowledgeEnrichmentPlan.route === "retrieve_knowledge") {
      retrievedSupportKnowledge = await runStep(
        runtime,
        "retrieveSupportKnowledge",
        pipelineSteps.retrieveSupportKnowledge,
        {
          knowledgeEnrichmentPlan
        }
      );

      synthesizedRetrievedKnowledge = await runStep(
        runtime,
        "synthesizeRetrievedKnowledge",
        pipelineSteps.synthesizeRetrievedKnowledge,
        {
          knowledgeEnrichmentPlan,
          knowledgeChunks: retrievedSupportKnowledge
        }
      );
    } else {
      retrievedSupportKnowledge = [];
      synthesizedRetrievedKnowledge = null;
      await skipSteps(runtime, [
        "retrieveSupportKnowledge",
        "synthesizeRetrievedKnowledge"
      ]);
    }

    responsePlan = await runStep(
      runtime,
      "planSupportResponse",
      pipelineSteps.planSupportResponse,
      {
        latestUserMessageContent: latestUserMessage.content,
        ...(textSurfaceAnalysis ? { textSurfaceAnalysis } : {}),
        standardResponseFragments,
        textUnderstandings,
        supportResponseCues,
        topicUpdateProposals,
        supportTopicKnowledge,
        existingTopics: supportTopicKnowledge.segments_topic,
        knowledgeEnrichmentPlan,
        retrievedSupportKnowledge: retrievedSupportKnowledge ?? [],
        synthesizedRetrievedKnowledge: synthesizedRetrievedKnowledge ?? null,
        genericFieldKnowledge,
        extractableFieldCatalog,
        recentInteractionContext,
        responsePlanningPolicy,
        channel: latestUserMessage.channel
      }
    );
  }

  const renderSupportResponseInput: RenderSupportResponseInput = {
    latestUserMessageContent: latestUserMessage.content,
    responsePlan: responsePlan ?? null,
    standardResponseFragments,
    ...(textSurfaceAnalysis ? { textSurfaceAnalysis } : {}),
    ...(typeof supportResponseCues !== "undefined"
      ? { supportResponseCues }
      : {}),
    ...(typeof textUnderstandings !== "undefined"
      ? { textUnderstandings }
      : {}),
    ...(typeof topicUpdateProposals !== "undefined"
      ? { topicUpdateProposals }
      : {}),
    existingTopics: supportTopicKnowledge.segments_topic,
    ...(typeof knowledgeEnrichmentPlan !== "undefined"
      ? { knowledgeEnrichmentPlan }
      : {}),
    ...(typeof retrievedSupportKnowledge !== "undefined"
      ? { retrievedSupportKnowledge }
      : {}),
    ...(typeof synthesizedRetrievedKnowledge !== "undefined"
      ? { synthesizedRetrievedKnowledge }
      : {}),
    recentInteractionContext,
    responsePlanningPolicy,
    accountProfile,
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
      responsePlan,
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
    ...(typeof responsePlan !== "undefined"
      ? { responsePlan }
      : {})
  };
}

export {
  runSupportProcessingPipelineV2
};
