import {
  buildProposeTopicUpdatesPrompt
} from "./buildProposeTopicUpdatesPrompt";
import {
  buildTopicPatchesAndSnapshots
} from "./buildTopicPatchesAndSnapshots";
import {
  formatProposeTopicUpdatesOutput
} from "./formatProposeTopicUpdatesOutput";
import {
  requestProposeTopicUpdates
} from "./requestProposeTopicUpdates";

import type {
  ProposeTopicUpdatesInput,
  ProposeTopicUpdatesResult
} from "./typesProposeTopicUpdates.types";
import type {
  MergedTopicSnapshot,
  TopicPatch,
  TopicUpdateProposal
} from "../typesSupportProcessingPipelineV2.types";

function getExistingTopics(input: ProposeTopicUpdatesInput): unknown[] {
  return input.existingTopics ?? input.supportTopicKnowledge.segments_topic;
}

function buildTopicUpdateIntent(
  patch: TopicPatch
): TopicUpdateProposal["updateIntent"] {
  if (patch.op === "review") {
    return {
      relationship: "unclear",
      blockingIssue: "unknown",
      statusHint: "unclear",
      userGoal: null,
      correctionNote: patch.review
    };
  }

  if (patch.op === "none") {
    return null;
  }

  return {
    relationship: patch.op === "create"
      ? "creates_distinct_topic"
      : "adds_new_information",
    blockingIssue: "unknown",
    statusHint: "unclear",
    userGoal: null,
    correctionNote: null
  };
}

function findSnapshotForPatch(params: {
  patch: TopicPatch;
  snapshots: MergedTopicSnapshot[];
}): MergedTopicSnapshot | undefined {
  return params.snapshots.find((snapshot) => {
    return snapshot.sourceOpIndex + 1 === Number(
      params.patch.patchId.replace("topic_patch_", "")
    );
  });
}

function buildTopicUpdateProposals(params: {
  topicPatches: TopicPatch[];
  mergedTopicSnapshots: MergedTopicSnapshot[];
}): TopicUpdateProposal[] {
  return params.topicPatches.map((patch) => {
    const snapshot = findSnapshotForPatch({
      patch,
      snapshots: params.mergedTopicSnapshots
    });

    return {
      proposalId: patch.patchId,
      action: patch.op === "create"
        ? "create_new_topic"
        : patch.op === "update"
          ? "update_existing_topic"
          : patch.op === "review"
            ? "needs_review"
            : "no_topic_update",
      fromUnderstandingIds: patch.sourceUnderstandingIds,
      topicId: patch.topicId,
      selectedSourceVerbatims: patch.selectedSourceVerbatims,
      updateIntent: buildTopicUpdateIntent(patch),
      newTopic: patch.op === "create"
        ? {
            title: snapshot?.title ?? patch.topic?.title ?? "New support topic",
            broadCategoryHint:
              snapshot?.broadCategoryHint ?? patch.topic?.broadCategoryHint ?? null,
            userGoal: null,
            blockingIssue: "unknown"
          }
        : null,
      reason: patch.review ??
        (patch.op === "create"
          ? "Create topic update op."
          : patch.op === "update"
            ? "Update topic update op."
            : "No topic update op.")
    };
  });
}

async function proposeTopicUpdates(
  input: ProposeTopicUpdatesInput
): Promise<ProposeTopicUpdatesResult> {
  if (input.textUnderstandings.length === 0) {
    return {
      topicUpdateOps: [],
      topicUpdateProposals: [],
      topicPatches: [],
      mergedTopicSnapshots: []
    };
  }

  const existingTopics = getExistingTopics(input);
  const prompt = buildProposeTopicUpdatesPrompt({
    existingTopics,
    textUnderstandings: input.textUnderstandings,
    recentInteractionContext: input.recentInteractionContext,
    latestUserMessageContent: input.latestUserMessageContent
  });
  const rawProposeTopicUpdates = await requestProposeTopicUpdates({
    prompt
  });
  const formattedOutput = formatProposeTopicUpdatesOutput({
    existingTopics,
    textUnderstandings: input.textUnderstandings,
    rawProposeTopicUpdates
  });
  const {
    topicPatches,
    mergedTopicSnapshots
  } = buildTopicPatchesAndSnapshots({
    existingTopics,
    textUnderstandings: input.textUnderstandings,
    topicUpdateOps: formattedOutput.topicUpdateOps
  });

  return {
    topicUpdateOps: formattedOutput.topicUpdateOps,
    topicUpdateProposals: buildTopicUpdateProposals({
      topicPatches,
      mergedTopicSnapshots
    }),
    topicPatches,
    mergedTopicSnapshots
  };
}

export {
  proposeTopicUpdates
};
