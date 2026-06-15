import {
  buildAnalyzeTextSurfacePrompt
} from "./buildAnalyzeTextSurfacePrompt";
import {
  formatTextSurfaceAnalysisOutput
} from "./formatTextSurfaceAnalysisOutput";
import {
  requestTextSurfaceAnalysis
} from "./requestTextSurfaceAnalysis";

import type {
  AnalyzeTextSurfaceInput,
  TextSurfaceAnalysis,
  TurnAnalysisPlan
} from "./typesAnalyzeTextSurface.types";

function buildFallbackTextSurfaceAnalysis(params: {
  latestUserMessageContent: string;
  turnAnalysisPlan: TurnAnalysisPlan;
}): TextSurfaceAnalysis {
  const latestUserMessageContent = params.latestUserMessageContent;

  if (latestUserMessageContent.trim() === "") {
    return {
      userLanguage: "Unknown",
      segments: []
    };
  }

  return {
    userLanguage: "Unknown",
    segments: [
      {
        segmentId: "text_segment_1",
        verbatim: latestUserMessageContent,
        ...(params.turnAnalysisPlan.matchedPatternIds.length > 0
          ? {
              category: "safety_sensitive" as const,
              standardSubcategory: "unsafe_or_suspicious_content" as const
            }
          : {
              category: "support_relevant" as const
            })
      }
    ]
  };
}

async function analyzeTextSurface(
  input: AnalyzeTextSurfaceInput
): Promise<TextSurfaceAnalysis> {
  const latestUserMessageContent = input.latestUserMessage.content;

  if (latestUserMessageContent.trim() === "") {
    return buildFallbackTextSurfaceAnalysis({
      latestUserMessageContent,
      turnAnalysisPlan: input.turnAnalysisPlan
    });
  }

  const prompt = buildAnalyzeTextSurfacePrompt({
    latestUserMessageContent,
    turnAnalysisPlan: input.turnAnalysisPlan,
    recentInteractionContext: input.recentInteractionContext
  });
  const rawTextSurfaceAnalysis = await requestTextSurfaceAnalysis({
    prompt
  });
  const formattedOutput = formatTextSurfaceAnalysisOutput({
    latestUserMessageContent,
    rawTextSurfaceAnalysis
  });

  if (formattedOutput.status === "valid") {
    return formattedOutput.analysis;
  }

  return buildFallbackTextSurfaceAnalysis({
    latestUserMessageContent,
    turnAnalysisPlan: input.turnAnalysisPlan
  });
}

export {
  analyzeTextSurface,
  buildFallbackTextSurfaceAnalysis
};
