/**
 * Temporary Lightweight Message Analysis
 *
 * Mock implementation used while testing the message analysis pipeline.
 *
 * It returns an empty lightweight analysis and asks the pipeline
 * to continue with full-weight message analysis.
 */

import type {
  LightWeightMessageAnalysis,
  LightWeightMessageAnalysisInput
} from "../typesMessageAnalysis.types";

async function runLightWeightMessageAnalysis(
  input: LightWeightMessageAnalysisInput
): Promise<LightWeightMessageAnalysis> {
  void input;

  return {
    shouldRunSupportMessageAnalysis: true,
    segments_signal: [],
    segments_scope_boundary: [],
    segments_suspicious: []
  };
}

export {
  runLightWeightMessageAnalysis
};