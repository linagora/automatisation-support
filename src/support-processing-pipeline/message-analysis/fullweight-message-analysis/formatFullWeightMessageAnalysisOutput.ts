/**
 * Full Weight Message Analysis Output Formatter
 *
 * Structural formatter only:
 * - checks LLM call status
 * - checks parsed response shape
 * - converts raw LLM topic_details array into internal object format
 * - converts raw tested_actions { action, outcome } into internal format
 *
 * It does not perform delta logic against supportTopicKnowledge.
 */

import type {
  FormatFullWeightMessageAnalysisOutputInput,
  FullWeightMessageAnalysisOutput,
  FullWeightOutputCheckName,
  FullWeightCleanAnalysis,
} from "./typesFullWeightMessageAnalysis.types";

type UnknownRecord = Record<string, unknown>;

const USER_LANGUAGES = ["French", "English", "Other", "Unknown"];
const TOPIC_CATEGORIES = ["billing", "access_security", "bug", "request", "question_faq", "other"];
const YES_NO = ["yes", "no"];
const OUTCOMES = ["worked", "failed", "partially_worked", "not_tried", "unclear"];

const SIGNAL_TYPES = [
  "thanks_neutral", "thanks_positive", "positive_feedback", "negative_feedback",
  "disappointment", "churn_intent", "waiting", "apology", "closure",
  "time_sensitive", "impolite", "complaint_without_actionable_detail",
  "communication_feedback", "pricing_feedback", "feature_loss_feedback",
  "confirmation_without_new_field",
];

const SCOPE_BOUNDARY_TYPES = [
  "generic_out_of_scope", "non_support_linagora", "unrelated_request", "spam_or_commercial",
];

const SUSPICIOUS_CHECKS = [
  "empty_message", "prompt_injection_attempt", "internal_information_request",
  "sensitive_data_request", "spam_like_message", "suspicious_attachments",
  "account_trust_status",
];

const TOPIC_DETAIL_FIELDS = [
  "feature_or_page", "provided_url", "pre_problem_state", "observed_result",
  "expected_result", "error_message", "platform", "account_context",
  "frequency", "affected_scope", "additional_context", "trigger_action",
  "access_action", "auth_method", "os", "device", "browser", "app_version",
  "server_or_instance", "affected_users", "logs_available", "video_available",
  "image_available", "billing_issue_type", "billing_provider", "offer_or_plan",
  "amount", "currency", "billing_date_or_period", "gap_observed", "question_intent",
];

function shouldDebugFullWeightAnalysis(): boolean {
  return process.env.SUPPORT_PROCESSING_DEBUG === "true";
}

function logDebugStep(title: string, value: unknown): void {
  if (!shouldDebugFullWeightAnalysis()) {
    return;
  }

  console.log(`\n--- DEBUG ${title} ---`);
  console.log(JSON.stringify(value, null, 2));
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function oneOf(value: unknown, allowed: readonly string[]): value is string {
  return typeof value === "string" && allowed.includes(value);
}

function arrayValue(source: UnknownRecord, key: string): unknown[] | null {
  const value = source[key];

  if (value === undefined || value === null) {
    return [];
  }

  return Array.isArray(value) ? value : null;
}

function clean(value: unknown): unknown {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  if (Array.isArray(value)) {
    const items = value.map(clean).filter((item) => item !== undefined);
    return items.length > 0 ? items : undefined;
  }

  if (isRecord(value)) {
    const output: UnknownRecord = {};

    for (const [key, item] of Object.entries(value)) {
      const cleanedItem = clean(item);

      if (cleanedItem !== undefined) {
        output[key] = cleanedItem;
      }
    }

    return Object.keys(output).length > 0 ? output : undefined;
  }

  return value;
}

function stop(params: {
  checked: FullWeightOutputCheckName[];
  failed: FullWeightOutputCheckName[];
  reason: string;
  rawResponse?: string;
}): FullWeightMessageAnalysisOutput {
  return {
    decision: { route: "stop" },
    history: {
      checked: params.checked,
      failed: params.failed,
      refusalReason: params.reason,
    },
    error: {
      message: params.reason,
      rawResponse: params.rawResponse,
    },
  };
}

function normalizeTopicDetailFieldName(fieldName: string): string | undefined {
  if (fieldName === "screenshot_available") {
    return "image_available";
  }

  return TOPIC_DETAIL_FIELDS.includes(fieldName) ? fieldName : undefined;
}

function normalizeTopicDetails(rawTopicDetails: unknown): UnknownRecord | undefined {
  const output: UnknownRecord = {};

  if (Array.isArray(rawTopicDetails)) {
    for (const item of rawTopicDetails) {
      if (!isRecord(item) || !isString(item.field_name) || !isString(item.value)) {
        continue;
      }

      const fieldName = normalizeTopicDetailFieldName(item.field_name);

      if (fieldName) {
        output[fieldName] = item.value;
      }
    }
  } else if (isRecord(rawTopicDetails)) {
    for (const [rawFieldName, rawValue] of Object.entries(rawTopicDetails)) {
      if (!isString(rawValue)) {
        continue;
      }

      const fieldName = normalizeTopicDetailFieldName(rawFieldName);

      if (fieldName) {
        output[fieldName] = rawValue;
      }
    }
  }

  return Object.keys(output).length > 0 ? output : undefined;
}

function normalizeTestedActions(rawTestedActions: unknown): UnknownRecord[] {
  if (!Array.isArray(rawTestedActions)) {
    return [];
  }

  const output: UnknownRecord[] = [];

  for (const item of rawTestedActions) {
    if (!isRecord(item)) {
      continue;
    }

    const action = item.action ?? item.tested_action;
    const outcome = item.outcome ?? item.outcome_tested_action;

    if (isString(action) && oneOf(outcome, OUTCOMES)) {
      output.push({
        tested_action: action,
        outcome_tested_action: outcome,
      });
    }
  }

  return output;
}

function normalizeTopicSegment(rawTopic: unknown): UnknownRecord | undefined {
  if (!isRecord(rawTopic)) {
    return undefined;
  }

  if (!oneOf(rawTopic.matched_historical_topic, YES_NO) || !isNumber(rawTopic.id_topic)) {
    return undefined;
  }

  const topic: UnknownRecord = {
    matched_historical_topic: rawTopic.matched_historical_topic,
    id_topic: rawTopic.id_topic,
  };

  if (oneOf(rawTopic.topic_category, TOPIC_CATEGORIES)) {
    topic.topic_category = rawTopic.topic_category;
  }

  for (const key of ["tool_or_product", "topic_action", "topic_object", "topic_label"]) {
    if (isString(rawTopic[key])) {
      topic[key] = rawTopic[key];
    }
  }

  const topicDetails = normalizeTopicDetails(rawTopic.topic_details);
  if (topicDetails) {
    topic.topic_details = topicDetails;
  }

  const testedActions = normalizeTestedActions(rawTopic.tested_actions);
  if (testedActions.length > 0) {
    topic.tested_actions = testedActions;
  }

  if (isString(rawTopic.user_goal)) {
    topic.user_goal = rawTopic.user_goal;
  }

  if (oneOf(rawTopic.blocking_issue, YES_NO)) {
    topic.blocking_issue = rawTopic.blocking_issue;
  }

  return topic;
}

function normalizeTopics(rawSegments: unknown[]): UnknownRecord[] {
  return rawSegments
    .map(normalizeTopicSegment)
    .filter((segment): segment is UnknownRecord => segment !== undefined);
}

function normalizeLackComprehension(rawSegments: unknown[]): UnknownRecord[] {
  return rawSegments.flatMap((segment) => {
    if (!isRecord(segment) || !isString(segment.segment_verbatim)) {
      return [];
    }

    return [{ segment_verbatim: segment.segment_verbatim }];
  });
}

function normalizeSignals(rawSegments: unknown[]): UnknownRecord[] {
  return rawSegments.flatMap((segment) => {
    if (!isRecord(segment) || !isString(segment.signal_verbatim) || !Array.isArray(segment.signal_types)) {
      return [];
    }

    const signalTypes = segment.signal_types.filter((type) => oneOf(type, SIGNAL_TYPES));

    if (signalTypes.length === 0) {
      return [];
    }

    return [{
      signal_verbatim: segment.signal_verbatim,
      signal_types: signalTypes,
    }];
  });
}

function normalizeScopeBoundaries(rawSegments: unknown[]): UnknownRecord[] {
  return rawSegments.flatMap((segment) => {
    if (!isRecord(segment) || !isString(segment.signal_verbatim)) {
      return [];
    }

    if (!oneOf(segment.scope_boundary_type, SCOPE_BOUNDARY_TYPES)) {
      return [];
    }

    return [{
      signal_verbatim: segment.signal_verbatim,
      scope_boundary_type: segment.scope_boundary_type,
    }];
  });
}

function normalizeSuspicious(rawSegments: unknown[]): UnknownRecord[] {
  return rawSegments.flatMap((segment) => {
    if (!isRecord(segment) || !oneOf(segment.checkName, SUSPICIOUS_CHECKS)) {
      return [];
    }

    const output: UnknownRecord = {
      checkName: segment.checkName,
    };

    if (isString(segment.segment_verbatim)) {
      output.segment_verbatim = segment.segment_verbatim;
    }

    return [output];
  });
}

function formatFullWeightMessageAnalysisOutput(
  input: FormatFullWeightMessageAnalysisOutputInput
): FullWeightMessageAnalysisOutput {
  const checked: FullWeightOutputCheckName[] = [];
  const failed: FullWeightOutputCheckName[] = [];

  const raw = input.rawFullWeightMessageAnalysis;

  if (raw.status !== "completed") {
    failed.push("llm_call_completed");

    return stop({
      checked,
      failed,
      reason: raw.error?.message || "llm_call_failed",
      rawResponse: raw.rawResponse,
    });
  }

  checked.push("llm_call_completed");

  const cleanedResponse = clean(raw.parsedResponse);

  logDebugStep("fullWeight cleaned parsed JSON", cleanedResponse);

  if (!isRecord(cleanedResponse)) {
    failed.push("llm_response_parsed");

    return stop({
      checked,
      failed,
      reason: "invalid_or_missing_parsed_llm_response",
      rawResponse: raw.rawResponse,
    });
  }

  checked.push("llm_response_parsed", "analysis_is_object");

  if (cleanedResponse.user_language !== undefined && !oneOf(cleanedResponse.user_language, USER_LANGUAGES)) {
    failed.push("user_language_valid");

    return stop({
      checked,
      failed,
      reason: "invalid_user_language",
      rawResponse: raw.rawResponse,
    });
  }

  checked.push("user_language_valid");

  const segmentsLackComprehension = arrayValue(cleanedResponse, "segments_lack_comprehension");
  const segmentsTopic = arrayValue(cleanedResponse, "segments_topic");
  const segmentsSignal = arrayValue(cleanedResponse, "segments_signal");
  const segmentsScopeBoundary = arrayValue(cleanedResponse, "segments_scope_boundary");
  const segmentsSuspicious = arrayValue(cleanedResponse, "segments_suspicious");

  if (segmentsLackComprehension === null) failed.push("segments_lack_comprehension_valid");
  if (segmentsTopic === null) failed.push("segments_topic_valid");
  if (segmentsSignal === null) failed.push("segments_signal_valid");
  if (segmentsScopeBoundary === null) failed.push("segments_scope_boundary_valid");
  if (segmentsSuspicious === null) failed.push("segments_suspicious_valid");

  if (failed.length > 0) {
    return stop({
      checked,
      failed,
      reason: "invalid_segments_format",
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

  const analysis: FullWeightCleanAnalysis = {
    user_language: oneOf(cleanedResponse.user_language, USER_LANGUAGES)
      ? cleanedResponse.user_language.toLowerCase()
      : undefined,
    segments_lack_comprehension: normalizeLackComprehension(segmentsLackComprehension),
    segments_topic: normalizeTopics(segmentsTopic),
    segments_signal: normalizeSignals(segmentsSignal),
    segments_scope_boundary: normalizeScopeBoundaries(segmentsScopeBoundary),
    segments_suspicious: normalizeSuspicious(segmentsSuspicious),
  };

  logDebugStep("fullWeight normalized analysis", analysis);

  return {
    decision: { route: "continue" },
    history: { checked, failed },
    analysis,
  };
}

export {
  formatFullWeightMessageAnalysisOutput,
};
