import {
  supportNeedCatalog,
  supportNeedUnclearReasonCatalog
} from "../../support-catalog-optimized/supportDeep.catalog";

const keyWithExtraction = {
  prompt: ["key", "extractionGuidance"]
} as const;

type SelectionEntry = {
  extractionGuidance?: unknown;
};

type Catalog = Record<string, SelectionEntry>;
type PromptItem = {key: string; extractionGuidance?: string};

const supportNeedSelection = {
  issue_resolution: keyWithExtraction,
  knowledge_answer: keyWithExtraction,
  support_action: keyWithExtraction,
  feature_request: keyWithExtraction,
  product_feedback: keyWithExtraction,
  unclear: keyWithExtraction
} as const;

const supportNeedUnclearReasonSelection = {
  knowledge_answer_or_issue_resolution: keyWithExtraction,
  knowledge_answer_or_support_action: keyWithExtraction,
  issue_resolution_or_support_action: keyWithExtraction,
  feature_request_or_issue_resolution: keyWithExtraction,
  feature_request_or_knowledge_answer: keyWithExtraction,
  feedback_or_issue_resolution: keyWithExtraction,
  too_ambiguous: keyWithExtraction
} as const;

// Example shape:
// {
//   supportNeeds: ["issue_resolution", "knowledge_answer", "support_action", "feature_request", "product_feedback", "unclear"],
//   supportNeedUnclearReasons: ["knowledge_answer_or_issue_resolution", "too_ambiguous"]
// }
const formatCatalogSelection = resolveFormatCatalogSelection();

// Example shape:
// {
//   supportNeeds: [
//     {key: "issue_resolution", extractionGuidance: "..."},
//     {key: "knowledge_answer", extractionGuidance: "..."}
//   ]
//   supportNeedUnclearReasons: [
//     {key: "knowledge_answer_or_issue_resolution", extractionGuidance: "..."}
//   ]
// }
const promptCatalogSelection = resolvePromptCatalogSelection();

function resolveFormatCatalogSelection() {
  return {
    supportNeeds: buildCatalogKeys(supportNeedCatalog, "support need", supportNeedSelection),
    supportNeedUnclearReasons: buildCatalogKeys(
      supportNeedUnclearReasonCatalog,
      "support need unclear reason",
      supportNeedUnclearReasonSelection
    )
  };
}

function resolvePromptCatalogSelection() {
  return {
    supportNeeds: buildCatalogPromptItems(supportNeedCatalog, "support need", supportNeedSelection),
    supportNeedUnclearReasons: buildCatalogPromptItems(
      supportNeedUnclearReasonCatalog,
      "support need unclear reason",
      supportNeedUnclearReasonSelection
    )
  };
}

function buildCatalogKeys<TSelection extends Record<string, typeof keyWithExtraction>>(
  catalog: Catalog,
  label: string,
  selection: TSelection
): string[] {
  return Object.keys(selection).map((selectedKey) => getCatalogKey(catalog, label, selectedKey));
}

function buildCatalogPromptItems<TSelection extends Record<string, typeof keyWithExtraction>>(
  catalog: Catalog,
  label: string,
  selection: TSelection
): PromptItem[] {
  return Object.keys(selection).map((selectedKey) => ({
    key: getCatalogKey(catalog, label, selectedKey),
    extractionGuidance: getExtractionGuidance(catalog, label, selectedKey)
  }));
}

function getCatalogKey(catalog: Catalog, label: string, selectedKey: string): string {
  getCatalogEntry(catalog, label, selectedKey);
  return selectedKey;
}

function getExtractionGuidance(catalog: Catalog, label: string, selectedKey: string): string {
  const extractionGuidance = getCatalogEntry(catalog, label, selectedKey).extractionGuidance;

  if (typeof extractionGuidance === "string" && extractionGuidance.trim() !== "") {
    return extractionGuidance;
  }

  throw new Error(`Missing extractionGuidance for optimized support need assessment ${label} ${selectedKey}`);
}

function getCatalogEntry(catalog: Catalog, label: string, selectedKey: string): SelectionEntry {
  const entry = catalog[selectedKey];

  if (entry) {
    return entry;
  }

  throw new Error(`Unknown optimized support need assessment ${label} in local catalog selection: ${selectedKey}`);
}

export {
  formatCatalogSelection,
  promptCatalogSelection
};
