import type {
  RetrievedKnowledgeSynthesis,
  SynthesizeRetrievedKnowledgeInput
} from "../typesSupportProcessingPipelineV2.types";
import type {
  JsonKnowledgeItem
} from "../../../repositories/json/typesJsonRepositories.types";

function parseKnowledgeItem(content: string): JsonKnowledgeItem | undefined {
  try {
    const parsed: unknown = JSON.parse(content);

    return typeof parsed === "object" && parsed !== null &&
      typeof (parsed as { knowledgeId?: unknown }).knowledgeId === "string"
      ? parsed as JsonKnowledgeItem
      : undefined;
  } catch {
    return undefined;
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim() !== ""))];
}

function getTopicId(
  input: SynthesizeRetrievedKnowledgeInput
): string | number | null {
  return input.knowledgeChunks[0]?.topicId ??
    input.knowledgeEnrichmentPlan.retrievalRequests[0]?.topicId ??
    input.topicEvidence.topicId ??
    null;
}

function technicalLimitations(
  input: SynthesizeRetrievedKnowledgeInput
): string[] {
  return input.knowledgeRetrievalFailureReason
    ? ["Knowledge retrieval failed or timed out for this topic."]
    : [];
}

function synthesizeRetrievedKnowledge(
  input: SynthesizeRetrievedKnowledgeInput
): RetrievedKnowledgeSynthesis {
  const items = input.knowledgeChunks.flatMap((chunk) => {
    const item = parseKnowledgeItem(chunk.content);

    return item ? [item] : [];
  });
  const genericChunks = input.knowledgeChunks.filter((chunk) => {
    return !parseKnowledgeItem(chunk.content) && chunk.content.trim() !== "";
  });
  const genericFacts = genericChunks.map((chunk) => chunk.content.trim());
  const relevantFacts = unique([
    ...items.flatMap((item) => [
      ...item.knownBehavior,
      ...item.expectedBehavior,
      ...item.acceptanceCriteria
    ]),
    ...genericFacts
  ]);
  const applicableInstructions = unique(items.flatMap((item) => [
    ...item.safeResponseStrategy,
    ...item.questionsToAskFirst
  ]));
  const possibleFields = unique(items.flatMap((item) => {
    return item.scope.relatedFieldNames ?? [];
  }));
  const unresolvedPoints = unique(items.flatMap((item) => {
    return item.questionsToAskFirst;
  }));
  const sourceReferences = unique([
    ...items.map((item) => {
      return item.source.issueUrl ?? item.knowledgeId;
    }),
    ...genericChunks.map((chunk) => chunk.sourceId)
  ]);
  const doNotClaim = unique(items.flatMap((item) => item.doNotClaim));
  const limitations = unique([
    ...technicalLimitations(input),
    ...doNotClaim
  ]);
  const recommendedFirstAnswer = items.find((item) => {
    return typeof item.recommendedFirstAnswer === "string";
  })?.recommendedFirstAnswer;
  const ifUserConfirmsNotificationsEnabled = items.find((item) => {
    return typeof item.ifUserConfirmsNotificationsEnabled === "string";
  })?.ifUserConfirmsNotificationsEnabled;
  const topicId = getTopicId(input);

  return {
    relevantFacts,
    applicableInstructions,
    possibleFields,
    unresolvedPoints,
    sourceReferences,
    limitations,
    ...(recommendedFirstAnswer ? { recommendedFirstAnswer } : {}),
    ...(ifUserConfirmsNotificationsEnabled
      ? { ifUserConfirmsNotificationsEnabled }
      : {}),
    doNotClaim,
    topics: [
      {
        topicId,
        relevantFacts,
        applicableInstructions,
        possibleFields,
        unresolvedPoints,
        sourceReferences
      }
    ]
  };
}

export {
  synthesizeRetrievedKnowledge
};
