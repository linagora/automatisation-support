import {
  DEFAULT_SUPPORT_EXTRACTABLE_FIELD_CATALOG
} from "./analyze-support-text/supportExtractableFieldCatalog";

import type {
  ExtractableFieldDefinition
} from "./typesSupportProcessingPipelineV2.types";

type SupportTextAnalysisCatalogField = ExtractableFieldDefinition & {
  promptHint?: string;
};

const MESSAGE_KIND_VALUES = [
  "issue_report",
  "question",
  "action_request",
  "info_update",
  "confirmation",
  "denial",
  "feedback",
  "support_context"
] as const;

const ATTEMPTED_ACTION_OUTCOME_VALUES = [
  "success",
  "failed",
  "partial",
  "unknown"
] as const;

const CASE_DETAIL_FIELD_HINTS: Record<string, string> = {
  platform: "Execution channel: web, site, browser, mobile app, desktop app. May be explicit or reasonably inferred from current text.",
  operating_system: "Operating system only: Android, iOS, Windows, macOS, Linux, etc.",
  browser: "Browser name only.",
  trigger_action: "Normal product action/event revealing the issue; not troubleshooting.",
  observed_result: "What actually happens.",
  expected_result: "What should happen instead. May be explicit or obvious from a negative observed_result.",
  error_message: "Exact displayed error text/code only.",
  available_workaround: "Workaround explicitly available or unavailable.",
  notification_permission_status: "OS notification permission: granted, denied, or unknown.",
  notification_channel_status: "App notification setting/channel: enabled, disabled, or unknown.",
  access_action: "Login, reset, invite, unlock, permission, recovery, or access action.",
  billing_issue_type: "Invoice, payment, duplicate charge, refund, renewal, or subscription issue."
};

const CASE_DETAIL_FIELD_CATALOG: SupportTextAnalysisCatalogField[] =
  DEFAULT_SUPPORT_EXTRACTABLE_FIELD_CATALOG.map((field) => ({
    ...field,
    ...(CASE_DETAIL_FIELD_HINTS[field.fieldName]
      ? { promptHint: CASE_DETAIL_FIELD_HINTS[field.fieldName] }
      : {})
  }));

const SUPPORT_METADATA_FIELD_CATALOG: SupportTextAnalysisCatalogField[] = [
  {
    fieldName: "visual_evidence_available",
    description: "Whether screenshot, photo or video evidence can be provided.",
    promptHint: "Use for screenshot/photo/video/proof availability about the support exchange, not for product facts."
  },
  {
    fieldName: "attachment_available",
    description: "Whether an attachment can be provided."
  },
  {
    fieldName: "logs_available",
    description: "Whether logs can be provided."
  },
  {
    fieldName: "user_availability",
    description: "When or whether the user can test, answer, meet, or provide information."
  },
  {
    fieldName: "support_constraint",
    description: "Constraint affecting the support exchange, such as inability to provide proof or test now."
  },
  {
    fieldName: "proof_available",
    description: "Whether proof can be provided."
  }
];

export {
  ATTEMPTED_ACTION_OUTCOME_VALUES,
  CASE_DETAIL_FIELD_CATALOG,
  MESSAGE_KIND_VALUES,
  SUPPORT_METADATA_FIELD_CATALOG
};

export type {
  SupportTextAnalysisCatalogField
};
