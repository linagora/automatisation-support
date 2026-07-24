import type {LiveMemoryTopicOptimized} from "../../../infrastructure/live-memory/liveMemoryContextOptimized.template";
import type {RunSupportProcessingPipelineV3OptimizedIntermOutputs} from "../runSupportProcessingPipelineOptimized";

export type BuildLiveMemoryPatchesInput = {
  latestUserMessage: {
    content: string;
    channel?: string;
  };

  latestUserAttachments: unknown[];

  intermOutputs: RunSupportProcessingPipelineV3OptimizedIntermOutputs;
};

export type BuildLiveMemoryPatchesOutput = {
  handover: {
    isHandover: boolean;
    handoverReason: "asked_by_user" | "detected_by_system" | null;
  } | null;

  previousConversationTurn: {
    previousUserMessage: string | null;
    previousBotMessage: string | null;
  } | null;

  failedPipelineMessages: Array<{
    concernedUserMessage: string[];
    concernedAttachment: unknown;
    fallbackReason: unknown;
  }> | null;

  securityAlerts: Array<{
    concernedUserMessage: string[];
    concernedAttachment: unknown[];
    flags: string[];
  }> | null;

  userState: {
    status: null;
    flags: string[];
  } | null;

  topics: BuildLiveMemoryTopicPatch[] | null;
};

export type BuildLiveMemoryTopicPatch = {
  status: LiveMemoryTopicOptimized["status"];

  sourceAnalyzeSupportText: LiveMemoryTopicOptimized["sourceAnalyzeSupportText"];

  sourceProposeTopicUpdates: Omit<
    LiveMemoryTopicOptimized["sourceProposeTopicUpdates"],
    "topicId"
  > & {
    topicId: number | null;
  };

  sourceTopicManager: LiveMemoryTopicOptimized["sourceTopicManager"];
};

export function buildLiveMemoryPatches(
  input: BuildLiveMemoryPatchesInput
): BuildLiveMemoryPatchesOutput {
  const patch: BuildLiveMemoryPatchesOutput = {
    handover: null,
    previousConversationTurn: null,
    failedPipelineMessages: null,
    securityAlerts: null,
    userState: null,
    topics: null
  };

  buildGlobalLiveMemoryPatch(input, patch);

  if (
    input.intermOutputs.proposeTopicUpdatesOutput !== null &&
    input.intermOutputs.proposeTopicUpdatesOutput !== undefined
  ) {
    buildTopicLiveMemoryPatch(input, patch);
  }

  return patch;
}

function buildGlobalLiveMemoryPatch(
  input: BuildLiveMemoryPatchesInput,
  patch: BuildLiveMemoryPatchesOutput
): BuildLiveMemoryPatchesOutput {
  const flags: string[] = [];

  if (input.intermOutputs.detectSuspiciousPromptPatternsOutput) {
    flags.push(
      ...input.intermOutputs.detectSuspiciousPromptPatternsOutput.matchedPatternIds
    );
  }

  if (input.intermOutputs.analyzeTextSurfaceOutput?.status === "analyzed") {
    for (const segment of input.intermOutputs.analyzeTextSurfaceOutput.segments) {
      if (
        segment.category === "safety_sensitive" &&
        typeof segment.standardSubcategory === "string"
      ) {
        flags.push(segment.standardSubcategory);
      }
    }
  }

  const dedupedFlags = [...new Set(flags)];

  if (input.intermOutputs.translateMessageOutput?.status === "processed") {
    patch.previousConversationTurn = {
      previousUserMessage: input.latestUserMessage.content,
      previousBotMessage: input.intermOutputs.translateMessageOutput.message
    };
  }

  if (hasHandoverRequestedSurface(input.intermOutputs.analyzeTextSurfaceOutput)) {
    patch.handover = {
      isHandover: true,
      handoverReason: "asked_by_user"
    };
  }

  if (dedupedFlags.length > 0) {
    patch.userState = {
      status: null,
      flags: dedupedFlags
    };

    patch.securityAlerts = [
      {
        concernedUserMessage: [input.latestUserMessage.content],
        concernedAttachment: input.latestUserAttachments,
        flags: dedupedFlags
      }
    ];
  }

  patch.failedPipelineMessages = null;

  return patch;
}

function buildTopicLiveMemoryPatch(
  input: BuildLiveMemoryPatchesInput,
  patch: BuildLiveMemoryPatchesOutput
): BuildLiveMemoryPatchesOutput {
  const proposeTopicUpdatesOutput = input.intermOutputs.proposeTopicUpdatesOutput;

  if (!proposeTopicUpdatesOutput || proposeTopicUpdatesOutput.status !== "analyzed") {
    return patch;
  }

  const topicManagerOutputs = input.intermOutputs.topicManagerOutputs ?? [];
  const supportUnderstandings =
    input.intermOutputs.analyzeSupportTextOutput?.status === "analyzed"
      ? input.intermOutputs.analyzeSupportTextOutput.understandings
      : [];

  const surfaceHandoverRequested = hasHandoverRequestedSurface(
    input.intermOutputs.analyzeTextSurfaceOutput
  );

  const topicPatches: BuildLiveMemoryTopicPatch[] = [];

  for (const [topicIndex, topicUpdatePlan] of proposeTopicUpdatesOutput.topicUpdatePlans.entries()) {
    const topicManagerOutput = topicManagerOutputs[topicIndex];

    if (!topicManagerOutput || topicManagerOutput.status !== "processed") {
      throw new Error("Missing processed topicManagerOutput for topic patch");
    }

    const relatedUnderstandings = supportUnderstandings.filter((understanding) => {
      return topicUpdatePlan.sourceUnderstandingIds.includes(understanding.understandingId);
    });

    const sourceTopicManager = applySurfaceHandoverIfNeeded(
      topicManagerOutput.sourceTopicManager,
      surfaceHandoverRequested
    );

    topicPatches.push({
      status: resolveTopicStatus(sourceTopicManager),

      sourceAnalyzeSupportText: {
        caseDetailsExtracted: relatedUnderstandings.flatMap((understanding) => {
          return understanding.caseDetailsExtracted.map((caseDetail) => {
            return {
              key: caseDetail.key,
              value: caseDetail.value,
              evidence: caseDetail.evidence,
              status: caseDetail.status
            };
          });
        }),

        attemptedActionsExtracted: relatedUnderstandings.flatMap((understanding) => {
          return understanding.attemptedActionsExtracted.map((attemptedAction) => {
            return {
              action: attemptedAction.action,
              outcome: attemptedAction.outcome,
              evidence: attemptedAction.evidence,
              status: attemptedAction.status
            };
          });
        })
      },

      sourceProposeTopicUpdates: {
        topicId: topicUpdatePlan.topicId,
        title: topicUpdatePlan.title,
        summaryTopic: topicUpdatePlan.summaryTopic,
        supportDomain: {
          value: topicUpdatePlan.supportDomain.value,
          reason: topicUpdatePlan.supportDomain.reason
        }
      },

      sourceTopicManager
    });
  }

  patch.topics = topicPatches.length > 0 ? topicPatches : null;

  if (topicPatches.some((topicPatch) => topicPatch.sourceTopicManager.handover.isRequested)) {
    patch.handover = {
      isHandover: true,
      handoverReason: surfaceHandoverRequested ? "asked_by_user" : "detected_by_system"
    };
  }

  return patch;
}

function resolveTopicStatus(
  sourceTopicManager: LiveMemoryTopicOptimized["sourceTopicManager"]
): LiveMemoryTopicOptimized["status"] {
  if (sourceTopicManager.currentStep !== "idle") {
    return "in_progress";
  }

  if (sourceTopicManager.resolutionStatus.value === "solved_by_bot") {
    return "solved_by_bot";
  }

  if (sourceTopicManager.resolutionStatus.value === "solved_by_human") {
    return "solved_by_human";
  }

  return "unsolved";
}

function hasHandoverRequestedSurface(
  output: RunSupportProcessingPipelineV3OptimizedIntermOutputs["analyzeTextSurfaceOutput"]
): boolean {
  return output?.status === "analyzed" &&
    output.segments.some((segment) => {
      const candidate = segment as {
        standardSubcategory?: unknown;
        standardAction?: unknown;
      };

      return candidate.standardSubcategory === "handover_request" ||
        candidate.standardAction === "handover_request";
    });
}

function applySurfaceHandoverIfNeeded(
  sourceTopicManager: LiveMemoryTopicOptimized["sourceTopicManager"],
  surfaceHandoverRequested: boolean
): LiveMemoryTopicOptimized["sourceTopicManager"] {
  if (!surfaceHandoverRequested) {
    return sourceTopicManager;
  }

  return {
    ...sourceTopicManager,
    handover: {
      isRequested: true,
      reason: "The user explicitly requested a human handover in the surface analysis."
    }
  };
}
