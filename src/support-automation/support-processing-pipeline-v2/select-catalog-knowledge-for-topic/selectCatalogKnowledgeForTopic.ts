import {
  buildSelectCatalogKnowledgeForTopicPrompt
} from "./buildSelectCatalogKnowledgeForTopicPrompt";
import {
  formatSelectCatalogKnowledgeForTopicOutput
} from "./formatSelectCatalogKnowledgeForTopicOutput";
import {
  requestSelectCatalogKnowledgeForTopic
} from "./requestSelectCatalogKnowledgeForTopic";

import type {
  SelectCatalogKnowledgeForTopicInput,
  SelectedCatalogKnowledgeForTopic
} from "./typesSelectCatalogKnowledgeForTopic.types";

async function selectCatalogKnowledgeForTopic(
  input: SelectCatalogKnowledgeForTopicInput
): Promise<SelectedCatalogKnowledgeForTopic> {
  const prompt = buildSelectCatalogKnowledgeForTopicPrompt(input);
  const rawSelectCatalogKnowledgeForTopic =
    await requestSelectCatalogKnowledgeForTopic({
      prompt
    });

  const selectedCatalogKnowledge = formatSelectCatalogKnowledgeForTopicOutput({
    input,
    rawSelectCatalogKnowledgeForTopic
  });

  if (
    selectedCatalogKnowledge.scopeReason.startsWith(
      "catalog_selection_fallback:"
    )
  ) {
    throw new Error(selectedCatalogKnowledge.scopeReason);
  }

  return selectedCatalogKnowledge;
}

export {
  selectCatalogKnowledgeForTopic
};
