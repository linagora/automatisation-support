import type {AnalyzeSupportTextUnderstanding} from "../../analyze-support-text-optimized/runAnalyzeSupportText";
import type {SupportNeedAssessment} from "../assess-support-need-optimized/validateAssessSupportNeedOutput";

type AssessTopicReadinessInput = {
  supportNeedAssessment: SupportNeedAssessment;
  supportDomain: string | null;
  sourceUnderstandings: AnalyzeSupportTextUnderstanding[];
  previousSupportKnowledgeSummary: string | null;
};

type TopicReadinessAssessment = {
  hasMaterialFields: boolean;
  hasSearchableDetails: boolean;
  hasAttemptedActions: boolean;
  hasPreviousKnowledge: boolean;
  previousKnowledgeLooksUseful: boolean | null;
  previousKnowledgeLooksEmpty: boolean | null;
  reasonCodes: string[];
};

const SEARCHABLE_DETAIL_KEYS = new Set([
  "error_message",
  "feature_or_page",
  "product_or_service",
  "platform",
  "browser",
  "operating_system",
  "integration_or_connector",
  "sync_target",
  "billing_issue_type",
  "payment_method",
  "amount",
  "reference_id",
  "server_or_instance",
  "auth_method",
  "mfa_status",
  "reproduction_steps",
  "trigger_action",
  "observed_result",
  "expected_result"
]);

const EMPTY_KNOWLEDGE_PATTERNS = [
  "no useful",
  "nothing found",
  "not provide specific",
  "no relevant",
  "no specific information"
];

function assessTopicReadiness(input: AssessTopicReadinessInput): TopicReadinessAssessment {
  const materialItems = input.sourceUnderstandings.flatMap((understanding) => [
    ...understanding.extractedFields,
    ...understanding.other.filter((item) => item.key !== "support_context")
  ]);
  const hasMaterialFields = materialItems.length > 0;
  const hasAttemptedActions = input.sourceUnderstandings.some(
    (understanding) => understanding.attemptedActions.length > 0
  );
  const hasSearchableDetails = materialItems.some((item) => SEARCHABLE_DETAIL_KEYS.has(item.key));
  const previousKnowledge = input.previousSupportKnowledgeSummary?.trim() ?? "";
  const hasPreviousKnowledge = previousKnowledge !== "";
  const previousKnowledgeLooksEmpty = hasPreviousKnowledge
    ? EMPTY_KNOWLEDGE_PATTERNS.some((pattern) => previousKnowledge.toLowerCase().includes(pattern))
    : null;
  const previousKnowledgeLooksUseful = hasPreviousKnowledge
    ? previousKnowledgeLooksEmpty === true
      ? false
      : true
    : null;

  return {
    hasMaterialFields,
    hasSearchableDetails,
    hasAttemptedActions,
    hasPreviousKnowledge,
    previousKnowledgeLooksUseful,
    previousKnowledgeLooksEmpty,
    reasonCodes: buildReasonCodes({
      ...input,
      hasMaterialFields,
      hasSearchableDetails,
      hasAttemptedActions,
      hasPreviousKnowledge,
      previousKnowledgeLooksUseful,
      previousKnowledgeLooksEmpty
    })
  };
}

function buildReasonCodes(
  input: AssessTopicReadinessInput & Omit<TopicReadinessAssessment, "reasonCodes">
): string[] {
  const reasonCodes: string[] = [];

  if (input.supportNeedAssessment.supportNeed === "unclear") reasonCodes.push("support_need_unclear");
  if (!input.supportDomain || input.supportDomain === "other") reasonCodes.push("support_domain_unclear");
  if (input.hasMaterialFields) reasonCodes.push("has_material_fields");
  if (!input.hasMaterialFields) reasonCodes.push("missing_material_fields");
  if (input.hasSearchableDetails) reasonCodes.push("has_searchable_details");
  if (input.hasAttemptedActions) reasonCodes.push("has_attempted_actions");
  if (input.hasPreviousKnowledge) reasonCodes.push("has_previous_knowledge");
  if (input.previousKnowledgeLooksUseful === true) reasonCodes.push("previous_knowledge_useful");
  if (input.previousKnowledgeLooksEmpty === true) reasonCodes.push("previous_knowledge_empty");

  return reasonCodes;
}

export {assessTopicReadiness};

export type {
  AssessTopicReadinessInput,
  TopicReadinessAssessment
};
