import {
  callLLM
} from "../../../infrastructure/llm/llm-client";
import {
  parseLLMResponse
} from "../../../infrastructure/llm/parseLLMResponse";
import {
  knowledgeEnrichmentResponseFormat
} from "./knowledgeEnrichment.schema";

import type {
  RawKnowledgeEnrichmentPlan,
  RequestKnowledgeEnrichmentPlanInput
} from "./typesPlanKnowledgeEnrichment.types";

async function requestKnowledgeEnrichmentPlan(
  input: RequestKnowledgeEnrichmentPlanInput
): Promise<RawKnowledgeEnrichmentPlan> {
  try {
    const result = await callLLM(input.prompt.messages, {
      stage: "knowledge_enrichment_plan",
      preset: "quickDecision",
      temperature: 0,
      maxTokens: 250,
      responseFormat: knowledgeEnrichmentResponseFormat
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
            ? `knowledge_enrichment_plan_error:${error.message}`
            : "knowledge_enrichment_plan_error:unknown_error"
      }
    };
  }
}

export {
  requestKnowledgeEnrichmentPlan
};
