import type {LiveMemoryTopicOptimized} from "../../../infrastructure/live-memory/liveMemoryContextOptimized.template";
import type {RunSupportProcessingPipelineV3OptimizedIntermOutputs} from "../runSupportProcessingPipelineOptimized";
import type {
  AnalyzeSupportTextAttemptedAction,
  AnalyzeSupportTextCaseDetail,
  AnalyzeSupportTextOther
} from "../analyze-support-text-optimized/runAnalyzeSupportText";

export type BuildLiveMemoryPatchesInput = {
  latestUserMessage: {
    content: string;
    channel?: string;
  };

  latestUserAttachments: unknown[];

  liveMemory: {
    handover: {
      handoverReason: string | null;
    };
  };

  intermOutputs: RunSupportProcessingPipelineV3OptimizedIntermOutputs;
};

export type BuildLiveMemoryPatchesOutput = {
  handover: {
    isHandover: boolean;
    handoverReason: string | null;
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

type RagFailure = {
  source: "rag";
  reason: "rag_failed";
  errorName: string | null;
  errorMessage: string;
};

type AtomicSupportFacts = {
  caseDetailsExtracted: AnalyzeSupportTextCaseDetail[];
  attemptedActionsExtracted: AnalyzeSupportTextAttemptedAction[];
  otherExtracted: AnalyzeSupportTextOther[];
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
      handoverReason: buildMergedHandoverReason({
        existingReason: input.liveMemory.handover.handoverReason,
        newReasons: ["asked_by_user"]
      })
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

  patch.failedPipelineMessages = buildNonBlockingFailedPipelineMessages(input);

  return patch;
}

function buildNonBlockingFailedPipelineMessages(
  input: BuildLiveMemoryPatchesInput
): Array<{
  concernedUserMessage: string[];
  concernedAttachment: unknown;
  fallbackReason: unknown;
}> | null {
  const ragFailures = collectRagFailures(input);

  if (ragFailures.length === 0) {
    return null;
  }

  return ragFailures.map((ragFailure) => {
    return {
      concernedUserMessage: [input.latestUserMessage.content],
      concernedAttachment: input.latestUserAttachments,
      fallbackReason: ragFailure
    };
  });
}

function collectRagFailures(
  input: BuildLiveMemoryPatchesInput
): RagFailure[] {
  const topicManagerOutputs = input.intermOutputs.topicManagerOutputs ?? [];

  return topicManagerOutputs.flatMap((topicManagerOutput) => {
    const retrieveKnowledgeOutput =
      extractRetrieveKnowledgeOutput(topicManagerOutput);

    const ragFailure = retrieveKnowledgeOutput?.ragFailure;

    return ragFailure ? [ragFailure] : [];
  });
}

function extractRetrieveKnowledgeOutput(
  topicManagerOutput: unknown
): {
  ragFailure?: RagFailure;
} | null {
  if (!topicManagerOutput || typeof topicManagerOutput !== "object") {
    return null;
  }

  const candidate = topicManagerOutput as {
    intermediateOutputs?: {
      issueResolutionBranchOutput?: {
        internalOutputs?: {
          retrieveKnowledgeOutput?: {
            ragFailure?: RagFailure;
          };
        };
      };
    };
  };

  return candidate.intermediateOutputs
    ?.issueResolutionBranchOutput
    ?.internalOutputs
    ?.retrieveKnowledgeOutput ?? null;
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
  const supportTextFacts = collectAnalyzeSupportTextFacts(
    input.intermOutputs.analyzeSupportTextOutput
  );

  const surfaceHandoverRequested = hasHandoverRequestedSurface(
    input.intermOutputs.analyzeTextSurfaceOutput
  );

  const topicPatches: BuildLiveMemoryTopicPatch[] = [];

  for (const [topicIndex, topicUpdatePlan] of proposeTopicUpdatesOutput.topicUpdatePlans.entries()) {
    const topicManagerOutput = topicManagerOutputs[topicIndex];

    if (!topicManagerOutput || topicManagerOutput.status !== "processed") {
      throw new Error("Missing processed topicManagerOutput for topic patch");
    }

    const relatedFacts = selectSourceFacts({
      facts: supportTextFacts,
      topicUpdatePlan
    });

    const sourceTopicManager = applySurfaceHandoverIfNeeded(
      topicManagerOutput.sourceTopicManager,
      surfaceHandoverRequested
    );

    topicPatches.push({
      status: resolveTopicStatus(sourceTopicManager),

      sourceAnalyzeSupportText: {
        caseDetailsExtracted: relatedFacts.caseDetailsExtracted.map((caseDetail) => {
          return {
            key: caseDetail.key,
            value: caseDetail.value,
            evidence: caseDetail.evidence,
            status: caseDetail.status
          };
        }),

        attemptedActionsExtracted: relatedFacts.attemptedActionsExtracted.map((attemptedAction) => {
          return {
            action: attemptedAction.action,
            outcome: attemptedAction.outcome,
            evidence: attemptedAction.evidence,
            status: attemptedAction.status
          };
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
    const newHandoverReasons = [
      ...collectTopicHandoverReasons(topicPatches),
      ...(surfaceHandoverRequested ? ["asked_by_user"] : [])
    ];

    patch.handover = {
      isHandover: true,
      handoverReason: buildMergedHandoverReason({
        existingReason: input.liveMemory.handover.handoverReason,
        newReasons: newHandoverReasons
      })
    };
  }

  return patch;
}

function collectTopicHandoverReasons(
  topicPatches: BuildLiveMemoryTopicPatch[]
): string[] {
  return topicPatches
    .map((topic) => topic.sourceTopicManager.handover)
    .filter((handover) => handover.isRequested)
    .map((handover) => handover.reason)
    .filter((reason): reason is string => {
      return typeof reason === "string" && reason.trim() !== "";
    })
    .map((reason) => reason.trim());
}

function buildMergedHandoverReason(input: {
  existingReason: string | null | undefined;
  newReasons: string[];
}): string {
  return mergeHandoverReasons(input) ?? "detected_by_system";
}

function mergeHandoverReasons(input: {
  existingReason: string | null | undefined;
  newReasons: string[];
}): string | null {
  const mergedReasons: string[] = [];

  for (const reason of [
    ...splitHandoverReason(input.existingReason),
    ...input.newReasons.flatMap((reason) => splitHandoverReason(reason))
  ]) {
    const trimmedReason = reason.trim();

    if (trimmedReason.length === 0) {
      continue;
    }

    if (!mergedReasons.includes(trimmedReason)) {
      mergedReasons.push(trimmedReason);
    }
  }

  return mergedReasons.length > 0 ? mergedReasons.join("; ") : null;
}

function splitHandoverReason(reason: string | null | undefined): string[] {
  if (typeof reason !== "string") {
    return [];
  }

  return reason
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
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

  if (sourceTopicManager.handover.isRequested) {
    return sourceTopicManager;
  }

  return {
    ...sourceTopicManager,
    handover: {
      isRequested: true,
      reason: "asked_by_user"
    }
  };
}

function collectAnalyzeSupportTextFacts(
  output: RunSupportProcessingPipelineV3OptimizedIntermOutputs["analyzeSupportTextOutput"]
): AtomicSupportFacts {
  if (output?.status !== "analyzed") {
    return {
      caseDetailsExtracted: [],
      attemptedActionsExtracted: [],
      otherExtracted: []
    };
  }

  return {
    caseDetailsExtracted: output.caseDetailsExtracted,
    attemptedActionsExtracted: output.attemptedActionsExtracted,
    otherExtracted: output.otherExtracted
  };
}

function selectSourceFacts(params: {
  facts: AtomicSupportFacts;
  topicUpdatePlan: {
    sourceCaseDetailIds: string[];
    sourceAttemptedActionIds: string[];
    sourceOtherIds: string[];
  };
}): AtomicSupportFacts {
  const caseDetailIdSet = new Set(params.topicUpdatePlan.sourceCaseDetailIds);
  const attemptedActionIdSet = new Set(params.topicUpdatePlan.sourceAttemptedActionIds);
  const otherIdSet = new Set(params.topicUpdatePlan.sourceOtherIds);

  return {
    caseDetailsExtracted: params.facts.caseDetailsExtracted.filter((fact) => {
      return caseDetailIdSet.has(fact.caseDetailId);
    }),
    attemptedActionsExtracted: params.facts.attemptedActionsExtracted.filter((fact) => {
      return attemptedActionIdSet.has(fact.attemptedActionId);
    }),
    otherExtracted: params.facts.otherExtracted.filter((fact) => {
      return otherIdSet.has(fact.otherId);
    })
  };
}
