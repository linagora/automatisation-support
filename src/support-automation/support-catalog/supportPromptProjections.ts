import {
  getCaseDetailFieldsByName,
  getSupportMetadataFieldsByName
} from "./supportFields.catalog";
import {
  BROAD_CATEGORY_HINT_DEFINITIONS,
  BROAD_CATEGORY_HINTS,
  BROAD_INTENT_DEFINITIONS,
  BROAD_INTENT_MODES,
  MESSAGE_KIND_DEFINITIONS,
  MESSAGE_KIND_VALUES
} from "./supportTaxonomy.catalog";
import {
  ANALYZE_SUPPORT_TEXT_CASE_DETAIL_FIELD_NAMES,
  ANALYZE_SUPPORT_TEXT_SUPPORT_METADATA_FIELD_NAMES
} from "./supportFieldSelection.catalog";

import type {
  SupportCatalogField
} from "./supportFields.catalog";

type PromptFieldDefinition = {
  key: string;
  label: string;
  description: string;
  extractionGuidance?: string;
  /** Backward-compatible alias. Prefer extractionGuidance. */
  promptHint?: string;
  askGuidance?: string;
  askable: boolean;
};

function toPromptFieldDefinition(
  field: SupportCatalogField
): PromptFieldDefinition {
  return {
    key: field.key,
    label: field.label,
    description: field.description,
    ...(field.extractionGuidance ? { extractionGuidance: field.extractionGuidance } : {}),
    ...(field.extractionGuidance ? { promptHint: field.extractionGuidance } : {}),
    ...(field.askGuidance ? { askGuidance: field.askGuidance } : {}),
    askable: field.askable ?? true
  };
}

function getAnalysisPromptFields(): {
  caseDetailFields: PromptFieldDefinition[];
  supportMetadataFields: PromptFieldDefinition[];
} {
  return {
    caseDetailFields: getCaseDetailFieldsByName(ANALYZE_SUPPORT_TEXT_CASE_DETAIL_FIELD_NAMES).map(toPromptFieldDefinition),
    supportMetadataFields: getSupportMetadataFieldsByName(ANALYZE_SUPPORT_TEXT_SUPPORT_METADATA_FIELD_NAMES).map(toPromptFieldDefinition)
  };
}

function getTopicUpdatePromptTaxonomy(): {
  broadCategoryHints: readonly typeof BROAD_CATEGORY_HINTS[number][];
  broadCategoryDefinitions: typeof BROAD_CATEGORY_HINT_DEFINITIONS;
  messageKindValues: readonly typeof MESSAGE_KIND_VALUES[number][];
  messageKindDefinitions: typeof MESSAGE_KIND_DEFINITIONS;
} {
  return {
    broadCategoryHints: BROAD_CATEGORY_HINTS,
    broadCategoryDefinitions: BROAD_CATEGORY_HINT_DEFINITIONS,
    messageKindValues: MESSAGE_KIND_VALUES,
    messageKindDefinitions: MESSAGE_KIND_DEFINITIONS
  };
}

function getPlanKnowledgeEnrichmentPromptTaxonomy(): {
  broadCategoryHints: readonly typeof BROAD_CATEGORY_HINTS[number][];
  broadCategoryDefinitions: typeof BROAD_CATEGORY_HINT_DEFINITIONS;
  broadIntentModes: readonly typeof BROAD_INTENT_MODES[number][];
  broadIntentDefinitions: typeof BROAD_INTENT_DEFINITIONS;
} {
  return {
    broadCategoryHints: BROAD_CATEGORY_HINTS,
    broadCategoryDefinitions: BROAD_CATEGORY_HINT_DEFINITIONS,
    broadIntentModes: BROAD_INTENT_MODES,
    broadIntentDefinitions: BROAD_INTENT_DEFINITIONS
  };
}

function renderFieldDefinitionsForPrompt(
  fields: readonly PromptFieldDefinition[]
): string {
  return fields.map((field) => {
    const lines = [
      `- ${field.key} — ${field.label}`,
      `  Definition: ${field.description}`
    ];

    if (field.extractionGuidance ?? field.promptHint) {
      lines.push(`  Extraction guidance: ${field.extractionGuidance ?? field.promptHint}`);
    }

    if (!field.askable) {
      lines.push("  User question guidance: Do not ask the user for this field directly.");
    }

    return lines.join("\n");
  }).join("\n");
}

function renderFieldAskGuidanceForPrompt(
  fields: readonly PromptFieldDefinition[]
): string {
  return fields
    .filter((field) => field.askable && field.askGuidance)
    .map((field) => {
      return [
        `- ${field.key} — ${field.label}`,
        `  Ask guidance: ${field.askGuidance}`
      ].join("\n");
    }).join("\n");
}

function renderBroadCategoryDefinitionsForPrompt(): string {
  return BROAD_CATEGORY_HINT_DEFINITIONS.map((definition) => {
    return `- ${definition.value} — ${definition.label}: ${definition.promptDefinition}`;
  }).join("\n");
}

function renderBroadIntentDefinitionsForPrompt(): string {
  return BROAD_INTENT_DEFINITIONS.map((definition) => {
    return `- ${definition.value} — ${definition.label}: ${definition.promptDefinition}`;
  }).join("\n");
}

function renderMessageKindDefinitionsForPrompt(): string {
  return MESSAGE_KIND_DEFINITIONS.map((definition) => {
    return `- ${definition.value} — ${definition.label}: ${definition.promptDefinition}`;
  }).join("\n");
}

export {
  getAnalysisPromptFields,
  getPlanKnowledgeEnrichmentPromptTaxonomy,
  getTopicUpdatePromptTaxonomy,
  renderBroadCategoryDefinitionsForPrompt,
  renderBroadIntentDefinitionsForPrompt,
  renderFieldAskGuidanceForPrompt,
  renderFieldDefinitionsForPrompt,
  renderMessageKindDefinitionsForPrompt
};

export type {
  PromptFieldDefinition
};
