import {formatCatalogSelection} from "./catalogSelection";

// Response format contract for this LLM brick.
// This schema constrains the JSON shape returned by the LLM.
// It enforces only the major structural rule:
// - support_relevant must have standardSubcategory: null
// - every other category must have one selected non-support subcategory
//
// Fine category/subcategory coherence is still validated deterministically
// in validateAnalyzeTextSurfaceOutput.ts.

const nonSupportCategories = [
  formatCatalogSelection.categories.standard_interaction,
  formatCatalogSelection.categories.out_of_scope,
  formatCatalogSelection.categories.safety_sensitive,
  formatCatalogSelection.categories.lack_comprehension
] as const;

const nonSupportSubcategories = [
  ...formatCatalogSelection.subcategoriesByCategory.standard_interaction,
  ...formatCatalogSelection.subcategoriesByCategory.out_of_scope,
  ...formatCatalogSelection.subcategoriesByCategory.safety_sensitive,
  ...formatCatalogSelection.subcategoriesByCategory.lack_comprehension
] as const;

const outputJsonShapeForPrompt = buildOutputJsonShapeForPrompt();

const responseFormat = {
  type: "json_schema",
  json_schema: {
    name: "text_surface_analysis",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["userLanguage", "segments"],
      properties: {
        userLanguage: {
          type: "string"
        },
        segments: {
          type: "array",
          items: {
            oneOf: [
              {
                type: "object",
                additionalProperties: false,
                required: ["verbatim", "category", "standardSubcategory"],
                properties: {
                  verbatim: {type: "string"},
                  category: {const: formatCatalogSelection.categories.support_relevant},
                  standardSubcategory: {type: "null"}
                }
              },
              {
                type: "object",
                additionalProperties: false,
                required: ["verbatim", "category", "standardSubcategory"],
                properties: {
                  verbatim: {type: "string"},
                  category: {enum: nonSupportCategories},
                  standardSubcategory: {enum: nonSupportSubcategories}
                }
              }
            ]
          }
        }
      }
    }
  }
} as const;

function buildOutputJsonShapeForPrompt(): string {
  const categories = Object.values(formatCatalogSelection.categories).join(" | ");

  return `
{
  "userLanguage": "<detected user language string, or unknown>",
  "segments": [
    {
      "verbatim": "<exact substring copied from the latest user message>",
      "category": "<${categories}>",
      "standardSubcategory": "<allowed subcategory for this category, or null for support_relevant>"
    }
  ]
}
`.trim();
}

export {
  outputJsonShapeForPrompt,
  responseFormat
};
