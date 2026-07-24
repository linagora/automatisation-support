import {
  callLLM
} from "../../../infrastructure/llm/llm-client";
import {
  parseLLMResponse
} from "../../../infrastructure/llm/parseLLMResponse";
import {
  selectCatalogKnowledgeForTopicResponseFormat
} from "./selectCatalogKnowledgeForTopic.schema";

import type {
  RawSelectCatalogKnowledgeForTopic,
  RequestSelectCatalogKnowledgeForTopicInput
} from "./typesSelectCatalogKnowledgeForTopic.types";

async function requestSelectCatalogKnowledgeForTopic(
  input: RequestSelectCatalogKnowledgeForTopicInput
): Promise<RawSelectCatalogKnowledgeForTopic> {
  try {
    const result = await callLLM(input.prompt.messages, {
      stage: "catalog_field_selection",
      preset: "fullWeightMessageAnalysis",
      temperature: 0,
      maxTokens: 1600,
      responseFormat: selectCatalogKnowledgeForTopicResponseFormat
    });

    if (!result.success || !result.content) {
      return {
        status: "failed",
        rawResponse: result.content,
        error: {
          message: result.error || "llm_call_failed"
        }
      };
    }

    return {
      status: "completed",
      parsedResponse: parseLLMResponse(result.content),
      rawResponse: result.content
    };
  } catch (error) {
    return {
      status: "failed",
      error: {
        message:
          error instanceof Error
            ? `select_catalog_knowledge_for_topic_error:${error.message}`
            : "select_catalog_knowledge_for_topic_error:unknown_error"
      }
    };
  }
}

export {
  requestSelectCatalogKnowledgeForTopic
};
