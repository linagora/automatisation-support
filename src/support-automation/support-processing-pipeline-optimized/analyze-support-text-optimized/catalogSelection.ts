import {
  attemptedActionOutcomeCatalog,
  caseDetailFieldCatalog,
  supportDomainCatalog,
  supportOtherKeyCatalog
} from "../../support-catalog-optimized/supportDeep.catalog";

// Prompt displays only the canonical key.
const key = {prompt: ["key"]} as const;

// Prompt displays the canonical key plus extractionGuidance from the canonical catalog.
const keyWithExtraction = {prompt: ["key", "extractionGuidance"]} as const;

type Selection = typeof key | typeof keyWithExtraction;
type Catalog = Record<string, {extractionGuidance?: unknown}>;
type PromptItem = {key: string; extractionGuidance?: string};

// Local selection follows the output order:
// extractedFields -> attemptedActions -> other -> supportDomain.

// Structured support dossier fields.
// Support-exchange metadata is intentionally not here; it goes to `other`.
const extractableFieldSelection = {
  user_identifier: keyWithExtraction,
  account_identifier: keyWithExtraction,
  account_status: keyWithExtraction,
  organization_name: keyWithExtraction,
  workspace_name: keyWithExtraction,
  product_or_service: keyWithExtraction,
  feature_or_page: keyWithExtraction,
  platform: keyWithExtraction,
  operating_system: keyWithExtraction,
  browser: keyWithExtraction,
  app_version: keyWithExtraction,
  device: keyWithExtraction,
  notification_permission_status: keyWithExtraction,
  notification_channel_status: keyWithExtraction,
  pre_problem_state: keyWithExtraction,
  trigger_action: keyWithExtraction,
  failure_step: keyWithExtraction,
  reproduction_steps: keyWithExtraction,
  workflow_context: keyWithExtraction,
  error_message: keyWithExtraction,
  observed_result: keyWithExtraction,
  expected_result: keyWithExtraction,
  available_workaround: keyWithExtraction,
  issue_started_at: keyWithExtraction,
  issue_duration: keyWithExtraction,
  deadline_or_expected_date: keyWithExtraction,
  frequency: keyWithExtraction,
  affected_scope: keyWithExtraction,
  affected_users: keyWithExtraction,
  user_impact: keyWithExtraction,
  access_action: keyWithExtraction,
  auth_method: keyWithExtraction,
  server_or_instance: keyWithExtraction,
  recovery_channel: keyWithExtraction,
  user_role_or_permission: keyWithExtraction,
  mfa_status: keyWithExtraction,
  integration_or_connector: keyWithExtraction,
  sync_target: keyWithExtraction,
  sync_status: keyWithExtraction,
  plan_or_subscription: keyWithExtraction,
  billing_or_payment_status: keyWithExtraction,
  billing_issue_type: keyWithExtraction,
  duplicate_billing_impact: keyWithExtraction,
  billing_provider: keyWithExtraction,
  amount: keyWithExtraction,
  currency: keyWithExtraction,
  billing_date_or_period: keyWithExtraction,
  payment_method: keyWithExtraction,
  question_intent: keyWithExtraction,
  gap_observed: keyWithExtraction,
  assistive_technology: keyWithExtraction,
  accessibility_barrier: keyWithExtraction,
  inaccessible_element: keyWithExtraction,
  migration_or_transition_context: keyWithExtraction,
  previous_product_or_service: keyWithExtraction,
  provided_url: keyWithExtraction,
  reference_id: keyWithExtraction,
  visual_evidence: keyWithExtraction
} as const;

// Outcome is a compact enum. Keys are enough; the prompt explains when to create actions.
const attemptedActionOutcomeSelection = {
  success: key,
  failed: key,
  partial: key,
  unknown: key
} as const;

// Useful support information that does not fit extractedFields or attemptedActions.
const otherKeySelection = {
  fact: keyWithExtraction,
  limitation: keyWithExtraction,
  attachment_reference: keyWithExtraction,
  uncertainty: keyWithExtraction,
  other: keyWithExtraction
} as const;

// Broad technical category, chosen after understanding the support unit.
// This is not topic identity and may remain unknown in responseFormat.
const supportDomainSelection = {
  product_behavior: keyWithExtraction,
  access_security: keyWithExtraction,
  billing: keyWithExtraction,
  configuration: keyWithExtraction,
  integration_sync: keyWithExtraction,
  performance: keyWithExtraction,
  availability: keyWithExtraction,
  data_migration: keyWithExtraction,
  accessibility: keyWithExtraction,
  support_process: keyWithExtraction,
  product_capability: keyWithExtraction,
  other: keyWithExtraction
} as const;

// Resolved selection consumed by responseFormat.ts.
// Built once at module load, so bad local keys fail early.
//
// Example shape:
// {
//   extractableFields: ["browser", "error_message", "observed_result", ...],
//   attemptedActionOutcomes: ["success", "failed", "partial", "unknown"],
//   otherKeys: ["fact", "limitation", ...],
//   supportDomains: ["product_behavior", "access_security", "billing", ..., "other"]
// }
const formatCatalogSelection = resolveFormatCatalogSelection();

// Resolved selection consumed by buildAnalyzeSupportTextPrompt.ts.
// Extraction guidance is included only where the local selection asks for it.
//
// Example shape:
// {
//   extractableFields: [
//     {key: "browser", extractionGuidance: "..."},
//     {key: "error_message", extractionGuidance: "..."},
//     ...
//   ],
//   attemptedActionOutcomes: [
//     {key: "success"},
//     {key: "failed"},
//     ...
//   ],
//   otherKeys: [
//     {key: "fact", extractionGuidance: "..."},
//     ...
//   ],
//   supportDomains: [
//     {key: "product_behavior", extractionGuidance: "..."},
//     {key: "access_security", extractionGuidance: "..."},
//     ...
//   ]
// }
const promptCatalogSelection = resolvePromptCatalogSelection();

function resolveFormatCatalogSelection() {
  return {
    extractableFields: buildFormatKeys(caseDetailFieldCatalog, "extractable field", extractableFieldSelection),
    attemptedActionOutcomes: buildFormatKeys(attemptedActionOutcomeCatalog, "attempted action outcome", attemptedActionOutcomeSelection),
    otherKeys: buildFormatKeys(supportOtherKeyCatalog, "other key", otherKeySelection),
    supportDomains: buildFormatKeys(supportDomainCatalog, "support domain", supportDomainSelection)
  };
}

function resolvePromptCatalogSelection() {
  return {
    extractableFields: buildPromptItems(caseDetailFieldCatalog, "extractable field", extractableFieldSelection),
    attemptedActionOutcomes: buildPromptItems(attemptedActionOutcomeCatalog, "attempted action outcome", attemptedActionOutcomeSelection),
    otherKeys: buildPromptItems(supportOtherKeyCatalog, "other key", otherKeySelection),
    supportDomains: buildPromptItems(supportDomainCatalog, "support domain", supportDomainSelection)
  };
}

function buildFormatKeys(catalog: Catalog, label: string, selection: Record<string, Selection>): string[] {
  return Object.keys(selection).map((selectedKey) => getCatalogKey(catalog, label, selectedKey));
}

function buildPromptItems(catalog: Catalog, label: string, selection: Record<string, Selection>): PromptItem[] {
  return Object.entries(selection).map(([selectedKey, selectedValue]) => {
    const item = {key: getCatalogKey(catalog, label, selectedKey)};

    return hasExtractionGuidance(selectedValue)
      ? {...item, extractionGuidance: getExtractionGuidance(catalog, label, selectedKey)}
      : item;
  });
}

function hasExtractionGuidance(selection: Selection): boolean {
  return selection === keyWithExtraction;
}

function getCatalogKey(catalog: Catalog, label: string, selectedKey: string): string {
  getCatalogEntry(catalog, label, selectedKey);
  return selectedKey;
}

function getExtractionGuidance(catalog: Catalog, label: string, selectedKey: string): string {
  const extractionGuidance = getCatalogEntry(catalog, label, selectedKey).extractionGuidance;

  if (typeof extractionGuidance === "string" && extractionGuidance.trim() !== "") return extractionGuidance;

  throw new Error(`Missing extractionGuidance for support-text ${label} ${selectedKey}`);
}

function getCatalogEntry(catalog: Catalog, label: string, selectedKey: string) {
  const entry = catalog[selectedKey];

  if (entry) return entry;

  throw new Error(`Unknown support-text ${label} in local catalog selection: ${selectedKey}`);
}

export {
  formatCatalogSelection,
  promptCatalogSelection
};
