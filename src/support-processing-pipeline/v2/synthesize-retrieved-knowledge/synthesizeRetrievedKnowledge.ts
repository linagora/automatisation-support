import type {
  ExtractableFieldDefinition,
  RetrievedKnowledgeSynthesis,
  SelectedCatalogKnowledgeForTopic,
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

function getTopicId(input: SynthesizeRetrievedKnowledgeInput): number {
  return input.knowledgeChunks[0]?.topicId ??
    input.knowledgeEnrichmentPlan.retrievalRequests[0]?.topicId ??
    0;
}

function synthesizeRetrievedKnowledge(
  input: SynthesizeRetrievedKnowledgeInput
): RetrievedKnowledgeSynthesis {
  const items = input.knowledgeChunks.flatMap((chunk) => {
    const item = parseKnowledgeItem(chunk.content);

    return item ? [item] : [];
  });
  const relevantFacts = unique(items.flatMap((item) => [
    ...item.knownBehavior,
    ...item.expectedBehavior,
    ...item.acceptanceCriteria
  ]));
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
  const sourceReferences = unique(items.map((item) => {
    return item.source.issueUrl ?? item.knowledgeId;
  }));
  const doNotClaim = unique(items.flatMap((item) => item.doNotClaim));
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
    limitations: doNotClaim,
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

function enrichSelectedCatalogKnowledgeWithSynthesis(params: {
  selectedCatalogKnowledge: SelectedCatalogKnowledgeForTopic;
  extractableFieldCatalog: ExtractableFieldDefinition[];
  synthesis: RetrievedKnowledgeSynthesis | null;
}): SelectedCatalogKnowledgeForTopic {
  const possibleFields = new Set(params.synthesis?.possibleFields ?? []);
  const selectedFieldNames = new Set(
    params.selectedCatalogKnowledge.selectedFields.map((field) => {
      return field.fieldName;
    })
  );
  const knowledgeFields = params.extractableFieldCatalog.filter((field) => {
    return possibleFields.has(field.fieldName) &&
      !selectedFieldNames.has(field.fieldName);
  });
  const knowledgeFieldNames = new Set(
    knowledgeFields.map((field) => field.fieldName)
  );

  if (knowledgeFields.length === 0) {
    return params.selectedCatalogKnowledge;
  }

  return {
    ...params.selectedCatalogKnowledge,
    selectedFields: [
      ...params.selectedCatalogKnowledge.selectedFields,
      ...knowledgeFields
    ],
    rejectedFieldNames:
      params.selectedCatalogKnowledge.rejectedFieldNames.filter((fieldName) => {
        return !knowledgeFieldNames.has(fieldName);
      }),
    warnings: [
      ...(params.selectedCatalogKnowledge.warnings ?? []),
      "Some selected fields were added from topic-specific retrieved knowledge."
    ]
  };
}

export {
  enrichSelectedCatalogKnowledgeWithSynthesis,
  synthesizeRetrievedKnowledge
};
