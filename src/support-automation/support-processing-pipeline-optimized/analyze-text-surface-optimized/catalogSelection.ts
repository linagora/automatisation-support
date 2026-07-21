import {textSurfaceCatalog} from "../../support-catalog-optimized/supportSurface.catalog";

// Any selected category/subcategory is always exposed to responseFormat.
// The selection level only controls what extra information is sent to the prompt.

// Prompt displays only the canonical key.
const key = {
  prompt: ["key"]
} as const;

// Prompt displays the canonical key plus extractionGuidance from the canonical catalog.
const keyWithExtraction = {
  prompt: ["key", "extractionGuidance"]
} as const;

// Local category selection for this LLM brick.
// These are the only surface categories exposed to the response format and prompt.
const categorySelection = {
  support_relevant: keyWithExtraction,
  standard_interaction: keyWithExtraction,
  out_of_scope: keyWithExtraction,
  safety_sensitive: keyWithExtraction,
  lack_comprehension: keyWithExtraction
} as const;

// Local subcategory selection for this LLM brick.
// Each entry decides whether the prompt receives only the key or key + extractionGuidance.
const subcategorySelectionByCategory = {
  standard_interaction: {
    greeting: key,
    thanks_neutral: key,
    thanks_positive: key,
    apology: key,
    closure: key,
    bot_identity_question: keyWithExtraction,
    support_team_question: keyWithExtraction,
    support_process_question: keyWithExtraction,
    handover_request: keyWithExtraction,
    unsupported_standard_question: keyWithExtraction,
    time_sensitive: keyWithExtraction,
    positive_feedback: key,
    waiting: key,
    negative_feedback: keyWithExtraction,
    disappointment: keyWithExtraction,
    churn_intent: keyWithExtraction,
    impolite: keyWithExtraction,
    complaint_without_actionable_detail: keyWithExtraction,
    communication_feedback: keyWithExtraction,
    support_process_feedback: keyWithExtraction,
    bot_feedback: keyWithExtraction,
    pricing_feedback: keyWithExtraction,
    feature_loss_feedback: keyWithExtraction
  },
  out_of_scope: {
    generic_out_of_scope: keyWithExtraction,
    non_support_linagora: keyWithExtraction,
    unrelated_request: keyWithExtraction,
    spam_or_commercial: keyWithExtraction
  },
  safety_sensitive: {
    prompt_injection_attempt: keyWithExtraction,
    internal_information_request: keyWithExtraction,
    sensitive_data_request: keyWithExtraction,
    credential_or_secret_leak: keyWithExtraction,
    spam_like_text: keyWithExtraction,
    suspicious_link_or_url: keyWithExtraction,
    excessive_repetition: keyWithExtraction,
    unsafe_or_suspicious_content: keyWithExtraction
  },
  lack_comprehension: {
    unclear_message: keyWithExtraction
  }
} as const;

// Resolved selection consumed by responseFormat.ts.
// Built once at module load, so bad local keys fail early.
const formatCatalogSelection = resolveFormatCatalogSelection();

// Resolved selection consumed by buildAnalyzeTextSurfacePrompt.ts.
// Built once at module load, so missing extractionGuidance fails early.
const promptCatalogSelection = resolvePromptCatalogSelection();

// Resolves the schema-facing view of the local selection.
// Expected shape:
//
// {
//   categories: {
//     support_relevant: "support_relevant",
//     standard_interaction: "standard_interaction",
//     ...
//   },
//   subcategoriesByCategory: {
//     standard_interaction: ["greeting", "thanks_neutral", "handover_request", ...],
//     out_of_scope: ["generic_out_of_scope", "unrelated_request", ...],
//     ...
//   }
// }
//
// This is consumed by responseFormat.ts.
// It validates selected keys against the canonical catalog and keeps only canonical keys.
function resolveFormatCatalogSelection() {
  return {
    categories: Object.fromEntries(
      Object.keys(categorySelection).map((categoryKey) => [
        categoryKey,
        getCategoryKey(categoryKey)
      ])
    ),
    subcategoriesByCategory: {
      standard_interaction: buildFormatSubcategoryKeys("standard_interaction"),
      out_of_scope: buildFormatSubcategoryKeys("out_of_scope"),
      safety_sensitive: buildFormatSubcategoryKeys("safety_sensitive"),
      lack_comprehension: buildFormatSubcategoryKeys("lack_comprehension")
    }
  };
}

// Resolves the prompt-facing view of the local selection.
// Expected shape:
//
// {
//   categories: [
//     {
//       key: "support_relevant",
//       extractionGuidance: "..."
//     },
//     {
//       key: "standard_interaction",
//       extractionGuidance: "..."
//     }
//   ],
//   subcategoriesByCategory: {
//     standard_interaction: [
//       {key: "greeting"},
//       {
//         key: "handover_request",
//         extractionGuidance: "..."
//       }
//     ],
//     out_of_scope: [...],
//     ...
//   }
// }
//
// This is consumed by buildAnalyzeTextSurfacePrompt.ts.
// It validates selected keys against the canonical catalog and adds extractionGuidance only for entries marked as keyWithExtraction.
function resolvePromptCatalogSelection() {
  return {
    categories: Object.entries(categorySelection).map(([categoryKey, selection]) => {
      const item = {key: getCategoryKey(categoryKey)};

      return hasExtractionGuidance(selection)
        ? {...item, extractionGuidance: getCategoryExtractionGuidance(categoryKey)}
        : item;
    }),
    subcategoriesByCategory: {
      standard_interaction: buildPromptSubcategoryItems("standard_interaction"),
      out_of_scope: buildPromptSubcategoryItems("out_of_scope"),
      safety_sensitive: buildPromptSubcategoryItems("safety_sensitive"),
      lack_comprehension: buildPromptSubcategoryItems("lack_comprehension")
    }
  };
}

// Builds the enum list used by responseFormat for one standard category.
function buildFormatSubcategoryKeys(categoryKey: keyof typeof subcategorySelectionByCategory): string[] {
  return Object.keys(subcategorySelectionByCategory[categoryKey]).map((subcategoryKey) =>
    getSubcategoryKey(categoryKey, subcategoryKey)
  );
}

// Builds the prompt items for one standard category.
// Each item contains its canonical key and maybe extractionGuidance.
function buildPromptSubcategoryItems(categoryKey: keyof typeof subcategorySelectionByCategory) {
  const selectionBySubcategory = subcategorySelectionByCategory[categoryKey] as Record<string, typeof key | typeof keyWithExtraction>;

  return Object.entries(selectionBySubcategory).map(([subcategoryKey, selection]) => {
    const item = {key: getSubcategoryKey(categoryKey, subcategoryKey)};

    return hasExtractionGuidance(selection)
      ? {...item, extractionGuidance: getSubcategoryExtractionGuidance(categoryKey, subcategoryKey)}
      : item;
  });
}

// Tells whether a selected entry should include extractionGuidance in the prompt.
function hasExtractionGuidance(selection: typeof key | typeof keyWithExtraction): boolean {
  return selection === keyWithExtraction;
}

// Validates that a selected category exists in the canonical catalog,
// then returns the same canonical key.
function getCategoryKey(categoryKey: string): string {
  getCategoryCatalogEntry(categoryKey);
  return categoryKey;
}

// Validates that a selected subcategory exists in the canonical catalog,
// then returns the same canonical key.
function getSubcategoryKey(categoryKey: string, subcategoryKey: string): string {
  getSubcategoryCatalogEntry(categoryKey, subcategoryKey);
  return subcategoryKey;
}

// Reads category extractionGuidance from the canonical catalog.
// Throws if the selected category has no usable extractionGuidance.
function getCategoryExtractionGuidance(categoryKey: string): string {
  const extractionGuidance = getCategoryCatalogEntry(categoryKey).extractionGuidance;

  if (typeof extractionGuidance === "string" && extractionGuidance.trim() !== "") return extractionGuidance;

  throw new Error(`Missing extractionGuidance for text-surface category ${categoryKey}`);
}

// Reads subcategory extractionGuidance from the canonical catalog.
// Throws if the selected subcategory has no usable extractionGuidance.
function getSubcategoryExtractionGuidance(categoryKey: string, subcategoryKey: string): string {
  const extractionGuidance = getSubcategoryCatalogEntry(categoryKey, subcategoryKey).extractionGuidance;

  if (typeof extractionGuidance === "string" && extractionGuidance.trim() !== "") return extractionGuidance;

  throw new Error(`Missing extractionGuidance for text-surface subcategory ${categoryKey}.${subcategoryKey}`);
}

// Returns the canonical catalog entry for a selected category.
// This makes local selection errors fail immediately and explicitly.
function getCategoryCatalogEntry(categoryKey: string) {
  const category = textSurfaceCatalog[categoryKey as keyof typeof textSurfaceCatalog];

  if (category) return category;

  throw new Error(`Unknown text-surface category in local catalog selection: ${categoryKey}`);
}

// Returns the canonical catalog entry for a selected subcategory.
// This makes local selection errors fail immediately and explicitly.
function getSubcategoryCatalogEntry(categoryKey: string, subcategoryKey: string) {
  const category = getCategoryCatalogEntry(categoryKey);
  const subcategories = category.subcategories as Record<string, {extractionGuidance?: unknown}> | undefined;
  const subcategory = subcategories?.[subcategoryKey];

  if (subcategory) return subcategory;

  throw new Error(`Unknown text-surface subcategory in local catalog selection: ${categoryKey}.${subcategoryKey}`);
}

export {
  formatCatalogSelection,
  promptCatalogSelection
};
