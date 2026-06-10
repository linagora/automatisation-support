const TOPIC_DETAIL_FIELD_NAMES = [
  "feature_or_page", "provided_url", "pre_problem_state", "observed_result",
  "expected_result", "error_message", "platform", "account_context",
  "frequency", "affected_scope", "additional_context", "trigger_action",
  "access_action", "auth_method", "os", "device", "browser", "app_version",
  "server_or_instance", "affected_users", "logs_available",
  "billing_issue_type", "billing_provider", "offer_or_plan",
  "amount", "currency", "billing_date_or_period", "gap_observed",
  "question_intent"
] as const;

const TOPIC_CATEGORIES = [
  "billing", "access_security", "bug", "request", "question_faq", "other"
] as const;

const SIGNAL_TYPES = [
  "thanks_neutral", "thanks_positive", "positive_feedback", "negative_feedback",
  "disappointment", "churn_intent", "waiting", "apology", "closure",
  "time_sensitive", "impolite", "complaint_without_actionable_detail",
  "communication_feedback", "pricing_feedback", "feature_loss_feedback",
  "confirmation_without_new_field", "bot_identity_question",
  "support_team_question", "appreciation_positive",
  "concern_support_continuity"
] as const;

const SCOPE_BOUNDARY_TYPES = [
  "generic_out_of_scope", "non_support_linagora", "unrelated_request",
  "spam_or_commercial"
] as const;

const SUSPICIOUS_CHECK_NAMES = [
  "empty_message", "prompt_injection_attempt", "internal_information_request",
  "sensitive_data_request", "spam_like_message", "suspicious_attachments",
  "account_trust_status"
] as const;

const OUTCOMES = [
  "worked", "failed", "partially_worked", "not_tried", "unclear"
] as const;

const stringSchema = { type: "string" } as const;
const stringOrNull = { anyOf: [{ type: "string" }, { type: "null" }] } as const;
const stringArraySchema = arrayOf(
  stringSchema,
  "Exact non-empty latest-user-message fragments that support this topic, in original order. Use [] when none exists."
);

function enumSchema(
  values: readonly string[],
  description?: string
): Record<string, unknown> {
  return description ? { enum: values, description } : { enum: values };
}

function enumOrNull(values: readonly string[]) {
  return { anyOf: [{ enum: values }, { type: "null" }] };
}

function arrayOf(
  items: Record<string, unknown>,
  description?: string
): Record<string, unknown> {
  return description ? { type: "array", description, items } : { type: "array", items };
}

function objectOf(
  properties: Record<string, unknown>,
  required: string[]
) {
  return {
    type: "object",
    additionalProperties: false,
    properties,
    required
  };
}

const topicDetailItemSchema = objectOf(
  {
    field_name: enumSchema(
      TOPIC_DETAIL_FIELD_NAMES,
      "Allowed topic detail field name. Select the field that best represents one explicit detail from the latest user message or attachment analysis."
    ),
    value: {
      type: "string",
      description:
        "Explicit useful value for the selected field. Do not use empty strings, placeholders, unknown, inferred, or guessed values."
    }
  },
  ["field_name", "value"]
);

const testedActionItemSchema = objectOf(
  {
    action: {
      type: "string",
      description:
        "Explicit action performed by the user to test, retry, verify, or work around the issue."
    },
    outcome: enumSchema(
      OUTCOMES,
      "Outcome of the action."
    )
  },
  ["action", "outcome"]
);

const topicSegmentSchema = objectOf(
  {
    matched_historical_topic: enumSchema(["yes", "no"]),
    id_topic: { type: "integer" },
    topic_category: enumOrNull(TOPIC_CATEGORIES),
    tool_or_product: stringOrNull,
    topic_action: stringOrNull,
    topic_object: stringOrNull,
    segment_verbatims: stringArraySchema,
    topic_details: arrayOf(
      topicDetailItemSchema,
      "Raw list of explicit useful details for this topic. Use one item per detail and [] when there is no useful detail."
    ),
    tested_actions: arrayOf(
      testedActionItemSchema,
      "Raw list of explicit user-performed tested actions. Use [] when none exists."
    ),
    user_goal: stringOrNull,
    blocking_issue: enumOrNull(["yes", "no"])
  },
  [
    "matched_historical_topic",
    "id_topic",
    "topic_category",
    "tool_or_product",
    "topic_action",
    "topic_object",
    "segment_verbatims",
    "topic_details",
    "tested_actions",
    "user_goal",
    "blocking_issue"
  ]
);

const lackComprehensionSegmentSchema = objectOf(
  {
    segment_verbatim: stringSchema
  },
  ["segment_verbatim"]
);

const signalSegmentSchema = objectOf(
  {
    signal_verbatim: stringSchema,
    signal_types: arrayOf(enumSchema(SIGNAL_TYPES))
  },
  ["signal_verbatim", "signal_types"]
);

const scopeBoundarySegmentSchema = objectOf(
  {
    signal_verbatim: stringSchema,
    scope_boundary_type: enumSchema(SCOPE_BOUNDARY_TYPES)
  },
  ["signal_verbatim", "scope_boundary_type"]
);

const suspiciousSegmentSchema = objectOf(
  {
    segment_verbatim: stringOrNull,
    checkName: enumSchema(SUSPICIOUS_CHECK_NAMES)
  },
  ["segment_verbatim", "checkName"]
);

export const fullWeightMessageAnalysisResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "full_weight_message_analysis",
    strict: true,
    schema: objectOf(
      {
        user_language: enumSchema(["French", "English", "Other", "Unknown"]),
        segments_lack_comprehension: arrayOf(lackComprehensionSegmentSchema),
        segments_topic: arrayOf(topicSegmentSchema),
        segments_signal: arrayOf(signalSegmentSchema),
        segments_scope_boundary: arrayOf(scopeBoundarySegmentSchema),
        segments_suspicious: arrayOf(suspiciousSegmentSchema)
      },
      [
        "user_language",
        "segments_lack_comprehension",
        "segments_topic",
        "segments_signal",
        "segments_scope_boundary",
        "segments_suspicious"
      ]
    )
  }
} as const;
