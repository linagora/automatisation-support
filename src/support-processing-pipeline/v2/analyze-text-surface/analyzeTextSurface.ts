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
  TextSurfaceStandardSubcategory,
  TurnAnalysisPlan
} from "./typesAnalyzeTextSurface.types";

const STRONG_SECURITY_PATTERN_TO_SUBCATEGORY = new Map<
  string,
  TextSurfaceStandardSubcategory
>([
  [
    "prompt_injection_attempt",
    "prompt_injection_attempt"
  ],
  [
    "internal_information_request",
    "internal_information_request"
  ],
  [
    "sensitive_data_request",
    "sensitive_data_request"
  ],
  [
    "credential_or_secret_leak",
    "credential_or_secret_leak"
  ]
]);

function getStrongSecuritySubcategory(
  matchedPatternIds: string[]
): TextSurfaceStandardSubcategory | undefined {
  for (const patternId of matchedPatternIds) {
    const subcategory = STRONG_SECURITY_PATTERN_TO_SUBCATEGORY.get(patternId);

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
        category: "safety_sensitive",
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
        category: "lack_comprehension",
        standardSubcategory: "unclear_message"
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
