import {callLLM} from "../../../../../../../infrastructure/llm/llm-client";
import {parseLLMResponse} from "../../../../../../../infrastructure/llm/parseLLMResponse";
import {buildSegmentationKnowledgePrompt} from "./buildSegmentationKnowledgePrompt";
import {segmentationKnowledgeResponseFormat} from "./responseFormat";
import {validateSegmentationKnowledgeOutput} from "./validateSegmentationKnowledgeOutput";

import type {LiveMemoryTopicOptimized} from "../../../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";

type SegmentationKnowledge = LiveMemoryTopicOptimized["sourceTopicManager"]["retrieveKnowledge"]["segmentationKnowledge"];

export type RunSegmentationKnowledgeInput = {
  summaryTopic: string;
  selectedfilteredRagKnowledge: unknown;
};

async function runSegmentationKnowledge(
  input: RunSegmentationKnowledgeInput
): Promise<SegmentationKnowledge> {
  const fallback = buildFallbackSegmentation();
  const {messages} = buildSegmentationKnowledgePrompt(input);

  try {
    const result = await callLLM(messages, {
      stage: "retrieve_knowledge_segmentation",
      preset: "standard",
      temperature: 0,
      maxTokens: 900,
      responseFormat: segmentationKnowledgeResponseFormat
    });

    if (!result.success || !result.content) {
      return fallback;
    }

    const parsed = parseLLMResponse(result.content);
    const validated = validateSegmentationKnowledgeOutput(parsed);

    return validated ?? fallback;
  } catch {
    return fallback;
  }
}

function buildFallbackSegmentation(): SegmentationKnowledge {
  return {
    isSegmented: true,
    userFacingInformation: null,
    supportFacingInformation: null
  };
}

export {runSegmentationKnowledge};
