import {formatCatalogSelection} from "./catalogSelection";

import type {
  TextSurfaceCategory as SurfaceCategory
} from "../../support-catalog-optimized/supportSurface.catalog";

// LLM output validation:
// Validates the parsed JSON returned by the surface analysis LLM.
// This file does not call the LLM, build prompts, repair output, or decide fallbacks.

type AnalyzeTextSurfaceSegment = {
  segmentId: string;
  verbatim: string;
  category: SurfaceCategory;
  standardSubcategory?: string;
};

type ValidatedAnalyzeTextSurfaceOutput = {
  userLanguage: string;
  segments: AnalyzeTextSurfaceSegment[];
};

// Validates the top-level LLM payload and assigns deterministic segment ids.
function validateAnalyzeTextSurfaceOutput(
  parsedResponse: unknown
): ValidatedAnalyzeTextSurfaceOutput | null {
  if (!isRecord(parsedResponse)) return null;
  if (typeof parsedResponse.userLanguage !== "string") return null;
  if (!Array.isArray(parsedResponse.segments)) return null;
  if (parsedResponse.segments.length === 0) return null;

  const segments: AnalyzeTextSurfaceSegment[] = [];

  for (const [index, rawSegment] of parsedResponse.segments.entries()) {
    const segment = validateSurfaceSegment(rawSegment, index);
    if (!segment) return null;
    segments.push(segment);
  }

  return {
    userLanguage: parsedResponse.userLanguage,
    segments
  };
}

// Validates one LLM segment and category/subcategory coherence.
function validateSurfaceSegment(rawSegment: unknown, index: number): AnalyzeTextSurfaceSegment | null {
  if (!isRecord(rawSegment)) return null;

  if (typeof rawSegment.verbatim !== "string" || rawSegment.verbatim.trim() === "") return null;
  if (!isSurfaceCategory(rawSegment.category)) return null;

  const standardSubcategory = validateStandardSubcategory({
    category: rawSegment.category,
    standardSubcategory: rawSegment.standardSubcategory
  });

  if (standardSubcategory === null) return null;

  return {
    segmentId: `text_segment_${index + 1}`,
    verbatim: rawSegment.verbatim,
    category: rawSegment.category,
    ...(standardSubcategory ? {standardSubcategory} : {})
  };
}

// support_relevant must return null; standard categories must use an exposed subcategory.
function validateStandardSubcategory(params: {
  category: SurfaceCategory;
  standardSubcategory: unknown;
}): string | undefined | null {
  if (params.category === formatCatalogSelection.categories.support_relevant) {
    return params.standardSubcategory === null ? undefined : null;
  }

  if (typeof params.standardSubcategory !== "string") return null;

  const allowed = formatCatalogSelection.subcategoriesByCategory[
    params.category as keyof typeof formatCatalogSelection.subcategoriesByCategory
  ] as readonly string[] | undefined;

  return allowed?.includes(params.standardSubcategory)
    ? params.standardSubcategory
    : null;
}

function isSurfaceCategory(value: unknown): value is SurfaceCategory {
  return typeof value === "string" && Object.values(formatCatalogSelection.categories).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export {
  validateAnalyzeTextSurfaceOutput
};

export type {
  AnalyzeTextSurfaceSegment,
  ValidatedAnalyzeTextSurfaceOutput
};
