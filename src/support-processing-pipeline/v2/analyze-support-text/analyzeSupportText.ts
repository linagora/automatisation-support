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
  AnalyzeSupportTextInput,
  SupportTextSegment,
  TextUnderstanding
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
): Promise<TextUnderstanding[]> {
  const supportSegments = selectSupportSegments(input);

  if (supportSegments.length === 0) {
    return [];
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

  return formattedOutput.textUnderstandings;
}

export {
  analyzeSupportText,
  selectSupportSegments
};
