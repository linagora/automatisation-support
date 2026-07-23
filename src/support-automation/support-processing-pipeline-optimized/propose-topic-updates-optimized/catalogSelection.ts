import {supportDomainCatalog} from "../../support-catalog-optimized/supportDeep.catalog";

const keyWithExtraction = {
  prompt: ["key", "extractionGuidance"]
} as const;

type SelectionEntry = {
  extractionGuidance?: unknown;
};

type Catalog = Record<string, SelectionEntry>;
type PromptItem = {key: string; extractionGuidance: string};

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
//   supportDomains: ["product_behavior", "access_security", "billing", ..., "other"]
// }
const formatCatalogSelection = resolveFormatCatalogSelection();

// Example shape:
// {
//   supportDomains: [
//     {key: "product_behavior", extractionGuidance: "..."},
//     {key: "access_security", extractionGuidance: "..."}
//   ]
// }
const promptCatalogSelection = resolvePromptCatalogSelection();

function resolveFormatCatalogSelection() {
  return {
    supportDomains: buildCatalogKeys(supportDomainCatalog, "support domain", supportDomainSelection)
  };
}

function resolvePromptCatalogSelection() {
  return {
    supportDomains: buildCatalogPromptItems(supportDomainCatalog, "support domain", supportDomainSelection)
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
