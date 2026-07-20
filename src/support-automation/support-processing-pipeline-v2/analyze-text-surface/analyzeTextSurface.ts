import {
  buildAnalyzeTextSurfacePrompt
} from "./buildAnalyzeTextSurfacePrompt";
import {
  formatTextSurfaceAnalysisOutput
} from "./formatTextSurfaceAnalysisOutput";
import {
  requestTextSurfaceAnalysis
} from "./requestTextSurfaceAnalysis";
import {
  LACK_COMPREHENSION_FALLBACK_CATEGORY,
  SAFETY_SENSITIVE_FALLBACK_CATEGORY,
  UNCLEAR_MESSAGE_SUBCATEGORY,
  getStrongSecuritySurfaceSubcategory
} from "../../support-catalog";

import type {
  AnalyzeTextSurfaceInput,
  TextSurfaceAnalysis,
  TextSurfaceStandardSubcategory,
  TurnAnalysisPlan
} from "./typesAnalyzeTextSurface.types";

// Legacy implementation. The global pipeline now uses analyze-text-surface-optimized.

function getStrongSecuritySubcategory(
  matchedPatternIds: string[]
): TextSurfaceStandardSubcategory | undefined {
  for (const patternId of matchedPatternIds) {
    const subcategory = getStrongSecuritySurfaceSubcategory(patternId);

    if (subcategory) {
      return subcategory;
    }
  }

  return undefined;
}

function buildSafetySensitiveFallback(params: {
  latestUserMessageContent: string;
  standardSubcategory: TextSurfaceStandardSubcategory;
}): TextSurfaceAnalysis {
  return {
    userLanguage: "unknown",
    segments: [
      {
        segmentId: "text_segment_1",
        verbatim: params.latestUserMessageContent,
        category: SAFETY_SENSITIVE_FALLBACK_CATEGORY,
        standardSubcategory: params.standardSubcategory
      }
    ]
  };
}

function buildLackComprehensionFallback(params: {
  latestUserMessageContent: string;
}): TextSurfaceAnalysis {
  return {
    userLanguage: "unknown",
    segments: [
      {
        segmentId: "text_segment_1",
        verbatim: params.latestUserMessageContent,
        category: LACK_COMPREHENSION_FALLBACK_CATEGORY,
        standardSubcategory: UNCLEAR_MESSAGE_SUBCATEGORY
      }
    ]
  };
}

function buildFallbackTextSurfaceAnalysis(params: {
  latestUserMessageContent: string;
  turnAnalysisPlan: TurnAnalysisPlan;
}): TextSurfaceAnalysis {
  const latestUserMessageContent = params.latestUserMessageContent;

  if (latestUserMessageContent.trim() === "") {
    return {
      userLanguage: "unknown",
      segments: []
    };
  }

  const strongSecuritySubcategory = getStrongSecuritySubcategory(
    params.turnAnalysisPlan.matchedPatternIds
  );

  if (strongSecuritySubcategory) {
    return buildSafetySensitiveFallback({
      latestUserMessageContent,
      standardSubcategory: strongSecuritySubcategory
    });
  }

  return buildLackComprehensionFallback({
    latestUserMessageContent
  });
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
