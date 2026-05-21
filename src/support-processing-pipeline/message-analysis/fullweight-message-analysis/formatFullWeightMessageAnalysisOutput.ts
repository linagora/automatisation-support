// src/support-processing-pipeline/message-analysis/fullweight-message-analysis/formatFullWeightMessageAnalysisOutput.ts

/**
 * Full Weight Message Analysis Output Formatter
 *
 * Validates the raw LLM output at a light contract level,
 * cleans empty values, and returns either:
 * - a normalized analysis
 * - a structured stop output
 */

import type {
  FormatFullWeightMessageAnalysisOutputInput,
  FullWeightMessageAnalysisOutput,
  FullWeightOutputCheckName,
  FullWeightCleanAnalysis,
} from "./typesFullWeightMessageAnalysis.types";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function cleanEmptyValues(value: unknown): unknown {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  if (Array.isArray(value)) {
    const cleanedArray = value
      .map(cleanEmptyValues)
      .filter((item) => item !== undefined);

    return cleanedArray.length > 0 ? cleanedArray : undefined;
  }

  if (isRecord(value)) {
    const cleanedRecord: UnknownRecord = {};

    for (const [key, item] of Object.entries(value)) {
      const cleanedItem = cleanEmptyValues(item);

      if (cleanedItem !== undefined) {
        cleanedRecord[key] = cleanedItem;
      }
    }

    return Object.keys(cleanedRecord).length > 0
      ? cleanedRecord
      : undefined;
  }

  return value;
}

function getOptionalArray(
  source: UnknownRecord,
  fieldName: string
): unknown[] | null {
  const value = source[fieldName];

  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    return null;
  }

  return value;
}

function stopOutput(params: {
  checked: FullWeightOutputCheckName[];
  failed: FullWeightOutputCheckName[];
  refusalReason: string;
  rawResponse?: string;
}): FullWeightMessageAnalysisOutput {
  return {
    decision: {
      route: "stop",
    },
    history: {
      checked: params.checked,
      failed: params.failed,
      refusalReason: params.refusalReason,
    },
    error: {
      message: params.refusalReason,
      rawResponse: params.rawResponse,
    },
  };
}

function formatFullWeightMessageAnalysisOutput(
  input: FormatFullWeightMessageAnalysisOutputInput
): FullWeightMessageAnalysisOutput {
  const checked: FullWeightOutputCheckName[] = [];
  const failed: FullWeightOutputCheckName[] = [];

  const raw = input.rawFullWeightMessageAnalysis;

  if (raw.status !== "completed") {
    failed.push("llm_call_completed");

    return stopOutput({
      checked,
      failed,
      refusalReason: raw.error?.message || "llm_call_failed",
      rawResponse: raw.rawResponse,
    });
  }

  checked.push("llm_call_completed");

  const cleanedResponse = cleanEmptyValues(raw.parsedResponse);

  if (!isRecord(cleanedResponse)) {
    failed.push("llm_response_parsed");

    return stopOutput({
      checked,
      failed,
      refusalReason: "invalid_or_missing_parsed_llm_response",
      rawResponse: raw.rawResponse,
    });
  }

  checked.push("llm_response_parsed");
  checked.push("analysis_is_object");

  if (
    cleanedResponse.user_language !== undefined &&
    !isNonEmptyString(cleanedResponse.user_language)
  ) {
    failed.push("user_language_valid");

    return stopOutput({
      checked,
      failed,
      refusalReason: "invalid_user_language",
      rawResponse: raw.rawResponse,
    });
  }

  checked.push("user_language_valid");

  const segmentsLackComprehension = getOptionalArray(
    cleanedResponse,
    "segments_lack_comprehension"
  );

  const segmentsTopic = getOptionalArray(
    cleanedResponse,
    "segments_topic"
  );

  const segmentsSignal = getOptionalArray(
    cleanedResponse,
    "segments_signal"
  );

  const segmentsScopeBoundary = getOptionalArray(
    cleanedResponse,
    "segments_scope_boundary"
  );

  const segmentsSuspicious = getOptionalArray(
    cleanedResponse,
    "segments_suspicious"
  );

  if (segmentsLackComprehension === null) {
    failed.push("segments_lack_comprehension_valid");
  }

  if (segmentsTopic === null) {
    failed.push("segments_topic_valid");
  }

  if (segmentsSignal === null) {
    failed.push("segments_signal_valid");
  }

  if (segmentsScopeBoundary === null) {
    failed.push("segments_scope_boundary_valid");
  }

  if (segmentsSuspicious === null) {
    failed.push("segments_suspicious_valid");
  }

  if (failed.length > 0) {
    return stopOutput({
      checked,
      failed,
      refusalReason: "invalid_segments_format",
      rawResponse: raw.rawResponse,
    });
  }

  checked.push(
    "segments_lack_comprehension_valid",
    "segments_topic_valid",
    "segments_signal_valid",
    "segments_scope_boundary_valid",
    "segments_suspicious_valid"
  );

  const analysis: FullWeightCleanAnalysis = {};

if (isNonEmptyString(cleanedResponse.user_language)) {
  analysis.user_language = cleanedResponse.user_language;
}

analysis.segments_lack_comprehension =
  segmentsLackComprehension as FullWeightCleanAnalysis["segments_lack_comprehension"];

analysis.segments_topic =
  segmentsTopic as FullWeightCleanAnalysis["segments_topic"];

analysis.segments_signal =
  segmentsSignal as FullWeightCleanAnalysis["segments_signal"];

analysis.segments_scope_boundary =
  segmentsScopeBoundary as FullWeightCleanAnalysis["segments_scope_boundary"];

analysis.segments_suspicious =
  segmentsSuspicious as FullWeightCleanAnalysis["segments_suspicious"];

  return {
    decision: {
      route: "continue",
    },
    history: {
      checked,
      failed,
    },
    analysis,
  };
}

export {
  formatFullWeightMessageAnalysisOutput
};