import type {
  ResponsePlanV2
} from "./typesSupportProcessingPipelineV2.types";

function normalizeResponsePlanIdPart(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function assignTopicResponsePlanIds(
  entries: {
    proposalId: string;
    responsePlan: ResponsePlanV2;
  }[]
): ResponsePlanV2[] {
  const usedIds = new Set<string>();

  return entries.map((entry, index) => {
    const normalizedProposalId =
      normalizeResponsePlanIdPart(entry.proposalId) || `topic_${index + 1}`;
    const baseId = `response_plan_${normalizedProposalId}`;
    let responsePlanId = baseId;
    let duplicateIndex = 2;

    while (usedIds.has(responsePlanId)) {
      responsePlanId = `${baseId}_${duplicateIndex}`;
      duplicateIndex += 1;
    }

    usedIds.add(responsePlanId);

    return {
      ...entry.responsePlan,
      responsePlanId
    };
  });
}

function buildTopicResponsePlanDebug(
  responsePlan: ResponsePlanV2 | undefined
): {
  responsePlanId: string;
  acknowledge: string[];
  answer: ResponsePlanV2["answer"];
  ask: ResponsePlanV2["ask"];
  say: string[];
  review: string | null;
} | undefined {
  if (!responsePlan) {
    return undefined;
  }

  return {
    responsePlanId: responsePlan.responsePlanId ?? "response_plan_unknown",
    acknowledge: Array.isArray(responsePlan.acknowledge)
      ? responsePlan.acknowledge
      : [],
    answer: Array.isArray(responsePlan.answer) ? responsePlan.answer : [],
    ask: Array.isArray(responsePlan.ask) ? responsePlan.ask : [],
    say: Array.isArray(responsePlan.say) ? responsePlan.say : [],
    review: typeof responsePlan.review === "string" ||
      responsePlan.review === null
      ? responsePlan.review
      : null
  };
}

export {
  assignTopicResponsePlanIds,
  buildTopicResponsePlanDebug
};
