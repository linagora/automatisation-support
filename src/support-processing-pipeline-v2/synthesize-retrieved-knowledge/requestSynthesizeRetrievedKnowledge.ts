import {
  callLLM
} from "../../llm/llm-client";
import {
  parseLLMResponse
} from "../../llm/parseLLMResponse";
import {
  synthesizeRetrievedKnowledgeResponseFormat
} from "./synthesizeRetrievedKnowledge.schema";

import type {
  RawSynthesizeRetrievedKnowledge,
  RequestSynthesizeRetrievedKnowledgeInput
} from "./typesSynthesizeRetrievedKnowledge.types";

async function requestSynthesizeRetrievedKnowledge(
  input: RequestSynthesizeRetrievedKnowledgeInput
): Promise<RawSynthesizeRetrievedKnowledge> {
  try {
    const result = await callLLM(input.prompt.messages, {
      stage: "synthesize_retrieved_knowledge",
      preset: "fullWeightMessageAnalysis",
      temperature: 0,
      maxTokens: 1800,
      responseFormat: synthesizeRetrievedKnowledgeResponseFormat
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
        message: error instanceof Error
          ? `synthesize_retrieved_knowledge_error:${error.message}`
          : "synthesize_retrieved_knowledge_error:unknown_error"
      }
    };
  }
}

export {
  requestSynthesizeRetrievedKnowledge
};
