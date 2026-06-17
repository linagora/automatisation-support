import {
  BLOCKING_ISSUE_VALUES,
  TOPIC_STATUS_HINTS,
  TOPIC_UPDATE_ACTIONS,
  TOPIC_UPDATE_RELATIONSHIPS
} from "./proposeTopicUpdates.schema";

import type {
  FormatProposeTopicUpdatesOutputInput,
  ProposeTopicUpdatesValidationResult
} from "./typesProposeTopicUpdates.types";
import type {
  BlockingIssueValue,
  NewTopicDraft,
  TextUnderstanding,
  TopicStatusHint,
  TopicUpdateAction,
  TopicUpdateIntent,
  TopicUpdateProposal,
  TopicUpdateRelationship
} from "../typesSupportProcessingPipelineV2.types";

type DraftProposal = Omit<TopicUpdateProposal, "proposalId">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function oneOf<TValue extends string>(
  value: unknown,
  allowedValues: readonly TValue[]
): value is TValue {
  return typeof value === "string" && allowedValues.includes(value as TValue);
}

function nullableString(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }

  return isNonEmptyString(value) ? value.trim() : undefined;
}

function topicIdFromUnknown(topic: unknown): string | undefined {
  if (!isRecord(topic)) {
    return undefined;
  }

  const topicId =
    topic.id_topic ??
    topic.topicId ??
    topic.id ??
    topic.topic_id;

  if (typeof topicId === "string" && topicId.trim() !== "") {
    return topicId.trim();
  }

  if (typeof topicId === "number" && Number.isFinite(topicId)) {
    return String(topicId);
  }

  return undefined;
}

function buildFallbackProposal(
  understanding: TextUnderstanding
): DraftProposal {
  return {
    action: "needs_review",
    fromUnderstandingIds: [understanding.understandingId],
    topicId: null,
    selectedSourceVerbatims: [],
    updateIntent: {
      relationship: "unclear",
      blockingIssue: "unknown",
      statusHint: "unclear",
      userGoal: null,
      correctionNote: null
    },
    newTopic: null,
    reason: "No valid topic update proposal covered this understanding."
  };
}

function buildFallbackProposals(
  textUnderstandings: TextUnderstanding[]
): TopicUpdateProposal[] {
  return textUnderstandings.map((understanding, index) => ({
    proposalId: `topic_update_proposal_${index + 1}`,
    ...buildFallbackProposal(understanding)
  }));
}

function parseStringArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    return undefined;
  }

  const output: string[] = [];

  for (const item of value) {
    if (!isNonEmptyString(item)) {
      return undefined;
    }

    output.push(item.trim());
  }

  return output;
}

function parseNonEmptyStringArray(value: unknown): string[] | undefined {
  const output = parseStringArray(value);

  if (output === undefined || output.length === 0) {
    return undefined;
  }

  return output;
}

function parseUpdateIntent(value: unknown): TopicUpdateIntent | null | undefined {
  if (value === null) {
    return null;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  const userGoal = nullableString(value.userGoal);
  const correctionNote = nullableString(value.correctionNote);

  if (
    !oneOf(value.relationship, TOPIC_UPDATE_RELATIONSHIPS) ||
    !oneOf(value.blockingIssue, BLOCKING_ISSUE_VALUES) ||
    !oneOf(value.statusHint, TOPIC_STATUS_HINTS) ||
    userGoal === undefined ||
    correctionNote === undefined
  ) {
    return undefined;
  }

  return {
    relationship: value.relationship as TopicUpdateRelationship,
    blockingIssue: value.blockingIssue as BlockingIssueValue,
    statusHint: value.statusHint as TopicStatusHint,
    userGoal,
    correctionNote
  };
}

function parseNewTopic(value: unknown): NewTopicDraft | null | undefined {
  if (value === null) {
    return null;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  const broadCategoryHint = nullableString(value.broadCategoryHint);
  const userGoal = nullableString(value.userGoal);

  if (
    !isNonEmptyString(value.title) ||
    broadCategoryHint === undefined ||
    userGoal === undefined ||
    !oneOf(value.blockingIssue, BLOCKING_ISSUE_VALUES)
  ) {
    return undefined;
  }

  return {
    title: value.title.trim(),
    broadCategoryHint,
    userGoal,
    blockingIssue: value.blockingIssue as BlockingIssueValue
  };
}

function validateReferencedVerbatims(params: {
  selectedSourceVerbatims: string[];
  fromUnderstandingIds: string[];
  understandingById: Map<string, TextUnderstanding>;
}): boolean {
  const allowedVerbatims = new Set<string>();

  for (const understandingId of params.fromUnderstandingIds) {
    const understanding = params.understandingById.get(understandingId);

    if (!understanding) {
      return false;
    }

    for (const sourceVerbatim of understanding.sourceVerbatims) {
      allowedVerbatims.add(sourceVerbatim);
    }
  }

  return params.selectedSourceVerbatims.every((sourceVerbatim) => {
    return allowedVerbatims.has(sourceVerbatim);
  });
}

function normalizeProposal(params: {
  rawProposal: unknown;
  understandingById: Map<string, TextUnderstanding>;
  existingTopicIds: Set<string>;
}): DraftProposal | undefined {
  if (!isRecord(params.rawProposal)) {
    return undefined;
  }

  if (!oneOf(params.rawProposal.action, TOPIC_UPDATE_ACTIONS)) {
    return undefined;
  }

  const fromUnderstandingIds = parseNonEmptyStringArray(
    params.rawProposal.fromUnderstandingIds
  );
  const selectedSourceVerbatims = parseStringArray(
    params.rawProposal.selectedSourceVerbatims
  );
  const updateIntent = parseUpdateIntent(params.rawProposal.updateIntent);
  const newTopic = parseNewTopic(params.rawProposal.newTopic);

  if (
    !fromUnderstandingIds ||
    !selectedSourceVerbatims ||
    updateIntent === undefined ||
    newTopic === undefined ||
    !isNonEmptyString(params.rawProposal.reason)
  ) {
    return undefined;
  }

  if (!fromUnderstandingIds.every((understandingId) => {
    return params.understandingById.has(understandingId);
  })) {
    return undefined;
  }

  if (!validateReferencedVerbatims({
    selectedSourceVerbatims,
    fromUnderstandingIds,
    understandingById: params.understandingById
  })) {
    return undefined;
  }

  const action = params.rawProposal.action as TopicUpdateAction;
  const rawTopicId = params.rawProposal.topicId;
  const topicId = rawTopicId === null
    ? null
    : isNonEmptyString(rawTopicId)
      ? rawTopicId.trim()
      : undefined;

  if (topicId === undefined) {
    return undefined;
  }

  if (action === "update_existing_topic") {
    if (topicId === null || !params.existingTopicIds.has(topicId) || newTopic !== null) {
      return undefined;
    }
  }

  if (action === "create_new_topic") {
    if (topicId !== null || newTopic === null) {
      return undefined;
    }
  }

  if (
    (action === "no_topic_update" || action === "needs_review") &&
    newTopic !== null
  ) {
    return undefined;
  }

  if (
    topicId !== null &&
    !params.existingTopicIds.has(topicId)
  ) {
    return undefined;
  }

  return {
    action,
    fromUnderstandingIds,
    topicId,
    selectedSourceVerbatims,
    updateIntent,
    newTopic,
    reason: params.rawProposal.reason.trim()
  };
}

function assignProposalIds(
  proposals: DraftProposal[]
): TopicUpdateProposal[] {
  return proposals.map((proposal, index) => ({
    proposalId: `topic_update_proposal_${index + 1}`,
    ...proposal
  }));
}

function formatProposeTopicUpdatesOutput(
  input: FormatProposeTopicUpdatesOutputInput
): ProposeTopicUpdatesValidationResult {
  if (input.rawProposeTopicUpdates.status !== "completed") {
    const reason = "llm_call_failed";

    return {
      status: "invalid",
      reason,
      topicUpdateProposals: buildFallbackProposals(input.textUnderstandings)
    };
  }

  const parsedResponse = input.rawProposeTopicUpdates.parsedResponse;

  if (!isRecord(parsedResponse) || !Array.isArray(parsedResponse.proposals)) {
    const reason = "invalid_json";

    return {
      status: "invalid",
      reason,
      topicUpdateProposals: buildFallbackProposals(input.textUnderstandings)
    };
  }

  const understandingById = new Map(
    input.textUnderstandings.map((understanding) => [
      understanding.understandingId,
      understanding
    ])
  );
  const existingTopicIds = new Set(
    input.existingTopics.flatMap((topic) => {
      const topicId = topicIdFromUnknown(topic);

      return topicId ? [topicId] : [];
    })
  );
  const draftProposals: DraftProposal[] = [];
  const coveredUnderstandingIds = new Set<string>();
  let rejectedProposalCount = 0;

  for (const rawProposal of parsedResponse.proposals) {
    const proposal = normalizeProposal({
      rawProposal,
      understandingById,
      existingTopicIds
    });

    if (!proposal) {
      rejectedProposalCount += 1;
      continue;
    }

    draftProposals.push(proposal);

    for (const understandingId of proposal.fromUnderstandingIds) {
      coveredUnderstandingIds.add(understandingId);
    }
  }

  for (const understanding of input.textUnderstandings) {
    if (!coveredUnderstandingIds.has(understanding.understandingId)) {
      draftProposals.push(buildFallbackProposal(understanding));
    }
  }

  const topicUpdateProposals = assignProposalIds(draftProposals);

  if (rejectedProposalCount > 0 || topicUpdateProposals.some((proposal) => {
    return proposal.action === "needs_review" &&
      proposal.reason === "No valid topic update proposal covered this understanding.";
  })) {
    return {
      status: "invalid",
      reason: "invalid_proposals",
      topicUpdateProposals
    };
  }

  return {
    status: "valid",
    topicUpdateProposals
  };
}

export {
  buildFallbackProposals,
  formatProposeTopicUpdatesOutput
};
