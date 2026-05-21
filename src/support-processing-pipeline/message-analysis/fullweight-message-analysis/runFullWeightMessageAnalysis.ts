// src/support-processing-pipeline/message-analysis/fullweight-message-analysis/runFullWeightMessageAnalysis.ts

/**
 * Full Weight Message Analysis
 *
 * Orchestrates the full-weight analysis of the latest user message.
 *
 * Steps:
 * - build full-weight prompt
 * - request full-weight LLM analysis
 * - format and validate output
 */

import {
  buildFullWeightPrompt
} from "./buildFullWeightPrompt";

import {
  requestFullWeightAnalysis
} from "./requestFullWeightAnalysis";

import {
  formatFullWeightMessageAnalysisOutput
} from "./formatFullWeightMessageAnalysisOutput";

import type {
  BuildFullWeightPromptInput,
  FormatFullWeightMessageAnalysisOutputInput,
  FullWeightMessageAnalysisInput,
  FullWeightMessageAnalysisOutput,
  RequestFullWeightAnalysisInput
} from "./typesFullWeightMessageAnalysis.types";

async function runFullWeightMessageAnalysis(
  fullWeightMessageAnalysisInput: FullWeightMessageAnalysisInput
): Promise<FullWeightMessageAnalysisOutput> {
  const buildFullWeightPromptInput: BuildFullWeightPromptInput = {
    latestUserMessage: fullWeightMessageAnalysisInput.latestUserMessage,
    supportTopicKnowledge: fullWeightMessageAnalysisInput.supportTopicKnowledge,
    conversationHistory: fullWeightMessageAnalysisInput.conversationHistory,
    attachmentAnalysis: fullWeightMessageAnalysisInput.attachmentAnalysis,
    lightWeightMessageAnalysis:
      fullWeightMessageAnalysisInput.lightWeightMessageAnalysis
  };

  const fullWeightPrompt = buildFullWeightPrompt(
    buildFullWeightPromptInput
  );

  const requestFullWeightAnalysisInput: RequestFullWeightAnalysisInput = {
    fullWeightPrompt
  };

  const rawFullWeightMessageAnalysis = await requestFullWeightAnalysis(
    requestFullWeightAnalysisInput
  );

  const formatFullWeightMessageAnalysisOutputInput:
    FormatFullWeightMessageAnalysisOutputInput = {
      rawFullWeightMessageAnalysis
    };

  const fullWeightMessageAnalysisOutput =
    formatFullWeightMessageAnalysisOutput(
      formatFullWeightMessageAnalysisOutputInput
    );

  return fullWeightMessageAnalysisOutput;
}

export {
  runFullWeightMessageAnalysis
};