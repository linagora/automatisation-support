import {supportDomainCatalog} from "../../support-catalog-optimized/supportDeep.catalog";

const keyWithExtraction = {
  prompt: ["key", "extractionGuidance"]
} as const;

type SelectionEntry = {
  extractionGuidance?: unknown;
};

type Catalog = Record<string, SelectionEntry>;
type PromptItem = {key: string; extractionGuidance: string};

const topicOperationSelection = {
  update: {
    extractionGuidance: "Use when the latest understanding continues, clarifies, corrects, confirms, denies, or adds information to an existing persistent support topic."
  },
  create: {
    extractionGuidance: "Use only when the latest understanding describes a distinct new support issue, request, question, feedback, or objective not covered by existing topics."
  }
} as const;

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

// Example shape:
// {
//   topicOperations: ["update", "create"],
//   supportDomains: ["product_behavior", "access_security", "billing", ..., "other"]
// }
const formatCatalogSelection = resolveFormatCatalogSelection();

// Example shape:
// {
//   topicOperations: [
//     {key: "update", extractionGuidance: "..."},
//     {key: "create", extractionGuidance: "..."}
//   ],
//   supportDomains: [
//     {key: "product_behavior", extractionGuidance: "..."},
//     {key: "access_security", extractionGuidance: "..."}
//   ]
// }
const promptCatalogSelection = resolvePromptCatalogSelection();

function resolveFormatCatalogSelection() {
  return {
    topicOperations: buildLocalKeys(topicOperationSelection, "topic operation"),
    supportDomains: buildCatalogKeys(supportDomainCatalog, "support domain", supportDomainSelection)
  };
}

function resolvePromptCatalogSelection() {
  return {
    topicOperations: buildLocalPromptItems(topicOperationSelection, "topic operation"),
    supportDomains: buildCatalogPromptItems(supportDomainCatalog, "support domain", supportDomainSelection)
  };
}

function buildLocalKeys<TSelection extends Record<string, SelectionEntry>>(
  selection: TSelection,
  label: string
): string[] {
  return Object.keys(selection).map((selectedKey) => {
    getExtractionGuidance(selection, label, selectedKey);
    return selectedKey;
  });
}

function buildLocalPromptItems<TSelection extends Record<string, SelectionEntry>>(
  selection: TSelection,
  label: string
): PromptItem[] {
  return Object.keys(selection).map((selectedKey) => ({
    key: selectedKey,
    extractionGuidance: getExtractionGuidance(selection, label, selectedKey)
  }));
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

  throw new Error(`Missing extractionGuidance for optimized topic update ${label} ${selectedKey}`);
}

function getCatalogEntry(catalog: Catalog, label: string, selectedKey: string): SelectionEntry {
  const entry = catalog[selectedKey];

  if (entry) {
    return entry;
  }

  throw new Error(`Unknown optimized topic update ${label} in local catalog selection: ${selectedKey}`);
}

export {
  formatCatalogSelection,
  promptCatalogSelection
};
