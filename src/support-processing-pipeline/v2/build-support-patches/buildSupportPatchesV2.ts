import type {
  BroadCategoryHint,
  BuildSupportPatchesInput,
  Patches,
  ResponsePlanV2,
  TextUnderstanding,
  TopicUpdateProposal,
  TopicStatusHint
} from "../typesSupportProcessingPipelineV2.types";
import type {
  ResponsePlan,
  SupportTopicKnowledge,
  TurnUnderstandingDelta
} from "../../typesSupportProcessingPipeline.types";

type TopicSegment = TurnUnderstandingDelta["segments_topic"][number];
type TopicDetails = SupportTopicKnowledge["segments_topic"][number]["topic_details"];
type TopicCategory = SupportTopicKnowledge["segments_topic"][number]["topic_category"];

const CATEGORY_MAP: Partial<Record<BroadCategoryHint, TopicCategory>> = {
  access_security: "access_security",
  accessibility: "bug",
  availability: "bug",
  billing: "billing",
  bug: "bug",
  configuration: "request",
  data_migration: "request",
  feature_request: "request",
  integration_sync: "bug",
  other: "other",
  performance: "bug",
  product_feedback: "request",
  question_faq: "question_faq",
  support_action: "request",
  support_experience_issue: "other"
};

function toTopicCategory(value: string | null | undefined): TopicCategory {
  if (value && value in CATEGORY_MAP) {
    return CATEGORY_MAP[value as BroadCategoryHint] ?? "other";
  }

  return "other";
}

function toBlockingIssue(
  value: "yes" | "no" | "unknown" | undefined
): "yes" | "no" {
  return value === "yes" ? "yes" : "no";
}

function getNextTopicId(params: {
  proposals: TopicUpdateProposal[];
  supportTopicKnowledge: SupportTopicKnowledge;
}): number {
  const numericTopicIds = params.proposals.flatMap((proposal) => {
    if (typeof proposal.topicId !== "string") {
      return [];
    }

    const match = proposal.topicId.match(/\d+/);

    return match ? [Number(match[0])] : [];
  });
  const existingTopicIds = params.supportTopicKnowledge.segments_topic.map(
    (topic) => {
      return topic.id_topic;
    }
  );
  const allTopicIds = [
    ...existingTopicIds,
    ...numericTopicIds
  ];
  const maxExistingId = allTopicIds.length > 0 ? Math.max(...allTopicIds) : 0;

  return maxExistingId + 1;
}

function parseTopicId(topicId: string | null): number | undefined {
  if (topicId === null) {
    return undefined;
  }

  const match = topicId.match(/\d+/);

  if (!match) {
    return undefined;
  }

  const parsed = Number(match[0]);

  return Number.isFinite(parsed) ? parsed : undefined;
}

function getUnderstandingsById(
  textUnderstandings: TextUnderstanding[] | undefined
): Map<string, TextUnderstanding> {
  return new Map(
    (textUnderstandings ?? []).map((understanding) => {
      return [understanding.understandingId, understanding];
    })
  );
}

function factsToTopicDetails(
  understandings: TextUnderstanding[]
): TopicDetails {
  const topicDetails: TopicDetails = {};

  for (const understanding of understandings) {
    for (const fact of understanding.facts) {
      if (fact.type !== "catalogued_field") {
        continue;
      }

      const value = String(fact.value);

      if (value.trim() === "") {
        continue;
      }

      topicDetails[fact.fieldName as keyof TopicDetails] = value as never;
    }
  }

  return topicDetails;
}

function selectedVerbatims(params: {
  proposal: TopicUpdateProposal;
  understandings: TextUnderstanding[];
}): string[] | undefined {
  const verbatims = [
    ...params.proposal.selectedSourceVerbatims,
    ...params.understandings.flatMap((understanding) => {
      return understanding.sourceVerbatims;
    })
  ];
  const uniqueVerbatims = [...new Set(verbatims)].filter((verbatim) => {
    return verbatim.trim() !== "";
  });

  return uniqueVerbatims.length > 0 ? uniqueVerbatims : undefined;
}

function getProposalUnderstandings(params: {
  proposal: TopicUpdateProposal;
  understandingsById: Map<string, TextUnderstanding>;
}): TextUnderstanding[] {
  return params.proposal.fromUnderstandingIds.flatMap((understandingId) => {
    const understanding = params.understandingsById.get(understandingId);

    return understanding ? [understanding] : [];
  });
}

function buildNewTopicSegment(params: {
  proposal: TopicUpdateProposal;
  understandings: TextUnderstanding[];
  idTopic: number;
}): TopicSegment | undefined {
  if (!params.proposal.newTopic) {
    return undefined;
  }

  return {
    matched_historical_topic: "no",
    id_topic: params.idTopic,
    topic_category: toTopicCategory(params.proposal.newTopic.broadCategoryHint),
    topic_label: params.proposal.newTopic.title,
    segment_verbatims: selectedVerbatims({
      proposal: params.proposal,
      understandings: params.understandings
    }),
    topic_details: factsToTopicDetails(params.understandings),
    user_goal: params.proposal.newTopic.userGoal ?? params.proposal.newTopic.title,
    blocking_issue: toBlockingIssue(params.proposal.newTopic.blockingIssue)
  };
}

function isResolvedStatus(statusHint: TopicStatusHint): boolean {
  return statusHint === "resolved" || statusHint === "partially_resolved";
}

function buildExistingTopicSegment(params: {
  proposal: TopicUpdateProposal;
  understandings: TextUnderstanding[];
}): TopicSegment | undefined {
  const idTopic = parseTopicId(params.proposal.topicId);

  if (idTopic === undefined || !params.proposal.updateIntent) {
    return undefined;
  }

  const topicDetails = factsToTopicDetails(params.understandings);

  return {
    matched_historical_topic: "yes",
    id_topic: idTopic,
    segment_verbatims: selectedVerbatims({
      proposal: params.proposal,
      understandings: params.understandings
    }),
    ...(Object.keys(topicDetails).length > 0 ? { topic_details: topicDetails } : {}),
    ...(params.proposal.updateIntent.userGoal
      ? { user_goal: params.proposal.updateIntent.userGoal }
      : {}),
    blocking_issue:
      params.proposal.updateIntent.blockingIssue === "unknown" &&
      isResolvedStatus(params.proposal.updateIntent.statusHint)
        ? "no"
        : toBlockingIssue(params.proposal.updateIntent.blockingIssue)
  };
}

function topicUpdateProposalsToDeltaSegments(params: {
  topicUpdateProposals: TopicUpdateProposal[] | undefined;
  textUnderstandings: TextUnderstanding[] | undefined;
  supportTopicKnowledge: SupportTopicKnowledge;
}): {
  segmentsTopic: TopicSegment[];
  reviewProposals: TopicUpdateProposal[];
} {
  const topicUpdateProposals = params.topicUpdateProposals ?? [];
  const understandingsById = getUnderstandingsById(params.textUnderstandings);
  const segmentsTopic: TopicSegment[] = [];
  const reviewProposals: TopicUpdateProposal[] = [];
  let nextTopicId = getNextTopicId({
    proposals: topicUpdateProposals,
    supportTopicKnowledge: params.supportTopicKnowledge
  });

  for (const proposal of topicUpdateProposals) {
    const understandings = getProposalUnderstandings({
      proposal,
      understandingsById
    });

    if (proposal.action === "create_new_topic") {
      const segment = buildNewTopicSegment({
        proposal,
        understandings,
        idTopic: nextTopicId
      });

      if (segment) {
        segmentsTopic.push(segment);
        nextTopicId += 1;
      }
      continue;
    }

    if (proposal.action === "update_existing_topic") {
      const segment = buildExistingTopicSegment({
        proposal,
        understandings
      });

      if (segment) {
        segmentsTopic.push(segment);
      }
      continue;
    }

    if (proposal.action === "needs_review") {
      reviewProposals.push(proposal);
    }
  }

  return {
    segmentsTopic,
    reviewProposals
  };
}

function buildResponsePlanPatch(responsePlan: ResponsePlanV2 | undefined): ResponsePlan {
  return {
    responseLanguage:
      responsePlan?.rendererTask.targetLanguage === "French" ? "french" : "same_as_user",
    messagesPlan: {
      scopeBoundaryPlanMessages: [],
      topicPlanMessages: [],
      signalPlanMessages: [],
      handoverPlanMessages: []
    },
    ...(responsePlan
      ? {
          metadata: {
            v2ResponsePlan: responsePlan
          }
        }
      : {})
  } as ResponsePlan;
}

function buildSupportPatchesV2(input: BuildSupportPatchesInput): Patches {
  const {
    segmentsTopic,
    reviewProposals
  } = topicUpdateProposalsToDeltaSegments({
    topicUpdateProposals: input.topicUpdateProposals,
    textUnderstandings: input.textUnderstandings,
    supportTopicKnowledge: input.supportTopicKnowledge
  });
  const generatedAt = new Date().toISOString();

  return {
    analysisPatch: {
      turnUnderstandingDelta: {
        user_language: "unknown",
        segments_lack_comprehension: [],
        segments_topic: segmentsTopic,
        segments_signal: [],
        segments_scope_boundary: [],
        segments_suspicious: []
      }
    },
    securityPatch: {
      securityGateSummary: {
        gateChecked: {
          matchedPatternIds: input.promptSecuritySignals.matchedPatternIds
        },
        gateFailed: []
      }
    },
    responsePatch: {
      responsePlan: buildResponsePlanPatch(input.responsePlan)
    },
    metadataPatch: {
      generatedAt,
      source: "support-processing-pipeline",
      ...(reviewProposals.length > 0
        ? {
            reviewProposals
          }
        : {})
    }
  };
}

export {
  buildResponsePlanPatch,
  buildSupportPatchesV2,
  topicUpdateProposalsToDeltaSegments
};
