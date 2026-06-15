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
  SupportProcessingPipelineV2Runtime,
  SupportProcessingPipelineV2Input,
  SupportProcessingPipelineV2Output,
  SupportProcessingPipelineV2Steps,
  SupportProcessingStepName,
  SupportUnderstandingV2,
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
      steps.proposeTopicUpdates,
      "proposeTopicUpdates"
    ),
    applyTopicUpdates: resolveStep(
      steps.applyTopicUpdates,
      "applyTopicUpdates"
    ),
    planKnowledgeEnrichment: resolveStep(
      steps.planKnowledgeEnrichment,
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
      steps.planSupportResponse,
      "planSupportResponse"
    ),
    renderSupportResponse: resolveStep(
      steps.renderSupportResponse,
      "renderSupportResponse"
    ),
    buildUserResponse: resolveStep(
      steps.buildUserResponse,
      "buildUserResponse"
    ),
    buildSupportPatches: resolveStep(
      steps.buildSupportPatches,
      "buildSupportPatches"
    )
  };

  const {
    latestUserMessage,
    latestUserAttachments,
    accountTrustStatus,
    accountProfile,
    supportTopicKnowledge,
    conversationHistory,
    recentInteractionContext
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
  let supportUnderstanding: SupportUnderstandingV2 | undefined;
  let responsePlan: ResponsePlanV2 | undefined;

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
    const [textUnderstandings, attachmentUnderstandings] = await Promise.all([
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
            () => [] satisfies TextUnderstanding[]
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

    const topicUpdateProposal: TopicUpdateProposal = await runStep(
      runtime,
      "proposeTopicUpdates",
      pipelineSteps.proposeTopicUpdates,
      {
        textUnderstandings,
        attachmentUnderstandings,
        supportTopicKnowledge,
        conversationHistory
      }
    );

    supportUnderstanding = await runStep(
      runtime,
      "applyTopicUpdates",
      pipelineSteps.applyTopicUpdates,
      {
        supportTopicKnowledge,
        topicUpdateProposal,
        textUnderstandings,
        attachmentUnderstandings
      }
    );

    const knowledgeEnrichmentPlan = await runStep(
      runtime,
      "planKnowledgeEnrichment",
      pipelineSteps.planKnowledgeEnrichment,
      {
        supportUnderstanding,
        supportTopicKnowledge
      }
    );

    let retrievedKnowledgeSynthesis: RetrievedKnowledgeSynthesis | undefined;

    if (knowledgeEnrichmentPlan.route === "retrieve_knowledge") {
      const knowledgeChunks: KnowledgeChunk[] = await runStep(
        runtime,
        "retrieveSupportKnowledge",
        pipelineSteps.retrieveSupportKnowledge,
        {
          knowledgeEnrichmentPlan
        }
      );

      retrievedKnowledgeSynthesis = await runStep(
        runtime,
        "synthesizeRetrievedKnowledge",
        pipelineSteps.synthesizeRetrievedKnowledge,
        {
          supportUnderstanding,
          knowledgeEnrichmentPlan,
          knowledgeChunks
        }
      );
    } else {
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
        supportUnderstanding,
        ...(retrievedKnowledgeSynthesis
          ? { retrievedKnowledgeSynthesis }
          : { genericFieldKnowledge }),
        recentInteractionContext,
        channel: latestUserMessage.channel
      }
    );
  }

  const renderSupportResponseInput: RenderSupportResponseInput = {
    ...(responsePlan ? { responsePlan } : {}),
    standardResponseFragments,
    ...(textSurfaceAnalysis ? { textSurfaceAnalysis } : {}),
    accountProfile,
    channel: latestUserMessage.channel
  };

  const supportResponse = await runStep(
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
      supportResponse
    }
  );
  const patches = await runStep(
    runtime,
    "buildSupportPatches",
    pipelineSteps.buildSupportPatches,
    {
      promptSecuritySignals,
      turnAnalysisPlan,
      supportUnderstanding,
      responsePlan,
      userResponse
    }
  );

  return {
    userResponse,
    patches
  };
}

export {
  runSupportProcessingPipelineV2
};
