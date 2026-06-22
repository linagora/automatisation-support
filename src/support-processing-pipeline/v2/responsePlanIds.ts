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

export function assignTopicResponsePlanIds(
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

export function buildTopicResponsePlanDebug(
  responsePlan: ResponsePlanV2 | undefined
): { responsePlanId: string } | undefined {
  return responsePlan
    ? { responsePlanId: responsePlan.responsePlanId }
    : undefined;
}
