import {
  buildAnalyzeSupportTextPrompt
} from "./buildAnalyzeSupportTextPrompt";
import {
  formatSupportTextAnalysisOutput
} from "./formatSupportTextAnalysisOutput";
import {
  requestSupportTextAnalysis
} from "./requestSupportTextAnalysis";

import type {
  AnalyzeSupportTextOutput,
  AnalyzeSupportTextInput,
  SupportTextSegment
} from "./typesAnalyzeSupportText.types";

function selectSupportSegments(
  input: AnalyzeSupportTextInput
): SupportTextSegment[] {
  return input.textSurfaceAnalysis.segments.filter(
    (segment): segment is SupportTextSegment => {
      return segment.category === "support_relevant";
    }
  );
}

async function analyzeSupportText(
  input: AnalyzeSupportTextInput
): Promise<AnalyzeSupportTextOutput> {
  const supportSegments = selectSupportSegments(input);

  if (supportSegments.length === 0) {
    return {
      textUnderstandings: [],
      supportResponseCues: []
    };
  }

  const prompt = buildAnalyzeSupportTextPrompt({
    supportSegments,
    recentInteractionContext: input.recentInteractionContext,
    extractableFieldCatalog: input.extractableFieldCatalog
  });
  const rawSupportTextAnalysis = await requestSupportTextAnalysis({
    prompt
  });
  const formattedOutput = formatSupportTextAnalysisOutput({
    supportSegments,
    extractableFieldCatalog: input.extractableFieldCatalog,
    rawSupportTextAnalysis
  });

  return {
    textUnderstandings: formattedOutput.textUnderstandings,
    supportResponseCues: formattedOutput.supportResponseCues
  };
}

export {
  analyzeSupportText,
  selectSupportSegments
};
