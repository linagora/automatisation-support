import {
  TEXT_SURFACE_CATEGORIES,
  TEXT_SURFACE_LACK_COMPREHENSION_SUBCATEGORIES,
  TEXT_SURFACE_OUT_OF_SCOPE_SUBCATEGORIES,
  TEXT_SURFACE_SAFETY_SENSITIVE_SUBCATEGORIES,
  TEXT_SURFACE_STANDARD_INTERACTION_SUBCATEGORIES
} from "./textSurfaceAnalysis.taxonomy";

function objectOf(
  properties: Record<string, unknown>,
  required: string[]
): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    properties,
    required
  };
}

function segmentSchemaFor(params: {
  category: typeof TEXT_SURFACE_CATEGORIES[number];
  standardSubcategory: Record<string, unknown>;
}): Record<string, unknown> {
  return objectOf(
    {
      verbatim: {
        type: "string",
        description:
          "Exact substring from latestUserMessage.content. Preserve original casing, accents, punctuation, and spacing."
      },
      category: {
        const: params.category
      },
      standardSubcategory: params.standardSubcategory
    },
    ["verbatim", "category", "standardSubcategory"]
  );
}

const textSurfaceSegmentSchema = {
  oneOf: [
    segmentSchemaFor({
      category: "support_relevant",
      standardSubcategory: { type: "null" }
    }),
    segmentSchemaFor({
      category: "standard_interaction",
      standardSubcategory: {
        enum: TEXT_SURFACE_STANDARD_INTERACTION_SUBCATEGORIES
      }
    }),
    segmentSchemaFor({
      category: "out_of_scope",
      standardSubcategory: {
        enum: TEXT_SURFACE_OUT_OF_SCOPE_SUBCATEGORIES
      }
    }),
    segmentSchemaFor({
      category: "safety_sensitive",
      standardSubcategory: {
        enum: TEXT_SURFACE_SAFETY_SENSITIVE_SUBCATEGORIES
      }
    }),
    segmentSchemaFor({
      category: "lack_comprehension",
      standardSubcategory: {
        enum: TEXT_SURFACE_LACK_COMPREHENSION_SUBCATEGORIES
      }
    })
  ]
} as const;

const textSurfaceAnalysisResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "text_surface_analysis",
    strict: true,
    schema: objectOf(
      {
        userLanguage: {
          enum: ["French", "English", "Other", "Unknown"]
        },
        segments: {
          type: "array",
          items: textSurfaceSegmentSchema
        }
      },
      ["userLanguage", "segments"]
    )
  }
} as const;

export {
  TEXT_SURFACE_CATEGORIES,
  textSurfaceAnalysisResponseFormat
};
