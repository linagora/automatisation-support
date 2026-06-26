import * as path from "path";

import { JsonFileStore } from "./jsonFileStore";

import type {
  TopicEvidence
} from "../../support-processing-pipeline/v2/typesSupportProcessingPipelineV2.types";
import type {
  JsonKnowledgeItem
} from "./typesJsonRepositories.types";

export type SearchRelevantKnowledgeInput = {
  topicEvidence: TopicEvidence;
  selectedFieldNames?: string[];
  limit?: number;
};

export type RankedJsonKnowledgeItem = {
  item: JsonKnowledgeItem;
  score: number;
  matchedTerms: string[];
};

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesTerm(searchText: string, value: string): boolean {
  const normalizedValue = normalizeSearchText(value);

  return normalizedValue !== "" && searchText.includes(normalizedValue);
}

function buildTopicSearchText(topicEvidence: TopicEvidence): string {
  return normalizeSearchText([
    ...topicEvidence.topicSourceVerbatims,
    ...topicEvidence.relatedTextUnderstandings.flatMap((understanding) => [
      understanding.summary,
      ...(understanding.messageKinds ?? []).map((messageKind) => {
        return messageKind.evidence;
      }),
      ...(understanding.caseDetails ?? []).flatMap((detail) => {
        return [
          detail.key,
          String(detail.value ?? ""),
          detail.evidence
        ];
      }),
      ...(understanding.attemptedActions ?? []).flatMap((action) => {
        return [
          action.action,
          action.outcome,
          action.evidence
        ];
      }),
      ...(understanding.supportMetadata ?? []).flatMap((metadata) => {
        return [
          metadata.key,
          String(metadata.value ?? ""),
          metadata.evidence
        ];
      })
    ])
  ].join(" "));
}

function rankKnowledgeItem(params: {
  item: JsonKnowledgeItem;
  searchText: string;
  selectedFieldNames: Set<string>;
}): RankedJsonKnowledgeItem | undefined {
  let score = 0;
  let specificMatch = false;
  const matchedTerms = new Set<string>();
  const addMatches = (
    values: string[] | undefined,
    weight: number,
    specific = false
  ): void => {
    for (const value of values ?? []) {
      if (!includesTerm(params.searchText, value)) {
        continue;
      }

      score += weight;
      specificMatch ||= specific;
      matchedTerms.add(value);
    }
  };

  addMatches(
    params.item.scope.topicKeywords?.filter((value) => {
      return !["android", "mobile", "bug"].includes(
        normalizeSearchText(value)
      );
    }),
    4,
    true
  );
  addMatches(
    params.item.scope.topicKeywords?.filter((value) => {
      return ["android", "mobile", "bug"].includes(
        normalizeSearchText(value)
      );
    }),
    2
  );
  addMatches(params.item.scope.productOrService, 3);
  addMatches(params.item.scope.broadCategoryHints, 2);
  addMatches(params.item.scope.supportNeeds, 2);

  for (const fieldName of params.item.scope.relatedFieldNames ?? []) {
    if (!params.selectedFieldNames.has(fieldName)) {
      continue;
    }

    score += 1;
    matchedTerms.add(fieldName);
  }

  if (!specificMatch || score < 3) {
    return undefined;
  }

  return {
    item: params.item,
    score,
    matchedTerms: [...matchedTerms]
  };
}

class JsonKnowledgeRepository {
  private readonly store: JsonFileStore<JsonKnowledgeItem>;

  constructor(filePath = path.resolve("data/knowledge.json")) {
    this.store = new JsonFileStore<JsonKnowledgeItem>(filePath);
  }

  async listActive(): Promise<JsonKnowledgeItem[]> {
    const items = await this.store.readAll();

    return items.filter((item) => item.status === "active");
  }

  async findById(
    knowledgeId: string
  ): Promise<JsonKnowledgeItem | undefined> {
    const items = await this.store.readAll();

    return items.find((item) => item.knowledgeId === knowledgeId);
  }

  async searchRelevant(
    input: SearchRelevantKnowledgeInput
  ): Promise<RankedJsonKnowledgeItem[]> {
    const searchText = buildTopicSearchText(input.topicEvidence);
    const selectedFieldNames = new Set(input.selectedFieldNames ?? []);
    const rankedItems = (await this.listActive()).flatMap((item) => {
      const rankedItem = rankKnowledgeItem({
        item,
        searchText,
        selectedFieldNames
      });

      return rankedItem ? [rankedItem] : [];
    });

    return rankedItems
      .sort((first, second) => {
        return second.score - first.score ||
          first.item.knowledgeId.localeCompare(second.item.knowledgeId);
      })
      .slice(0, input.limit ?? 3);
  }
}

export {
  JsonKnowledgeRepository
};
