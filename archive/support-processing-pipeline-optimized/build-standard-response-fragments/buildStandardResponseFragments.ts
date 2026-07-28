import {textSurfaceCatalog} from "../../support-catalog-optimized/supportSurface.catalog";

import type {AnalyzeTextSurfaceSegment} from "../analyze-text-surface-optimized/runAnalyzeTextSurface";

type BuildStandardResponseFragmentsInput = {
  textSurfaceAnalysis?: {
    segments: AnalyzeTextSurfaceSegment[];
  };
};

type BuildStandardResponseFragmentsOutput = Array<{
  category: AnalyzeTextSurfaceSegment["category"];
  standardSubcategory: string;
  say: string;
}>;

function buildStandardResponseFragments(
  input: BuildStandardResponseFragmentsInput
): BuildStandardResponseFragmentsOutput {
  const fragments: BuildStandardResponseFragmentsOutput = [];

  // We only build standard fragments from non-support segments.
  // Support-relevant segments are handled later by support understanding + topic branch.
  for (const segment of input.textSurfaceAnalysis?.segments ?? []) {
    const standardSubcategory = segment.standardSubcategory;
    if (typeof standardSubcategory !== "string" || standardSubcategory.trim() === "") {
      continue;
    }

    const say = getSayForStandardSegment(segment);

    if (say === null) {
      continue;
    }

    fragments.push({
      category: segment.category,
      standardSubcategory,
      say
    });
  }

  return fragments;
}

function getSayForStandardSegment(
  segment: AnalyzeTextSurfaceSegment
): string | null {
  // A support-relevant segment should never become a standard response fragment.
  if (segment.category === "support_relevant") {
    return null;
  }

  // Standard fragments are selected through the surface catalog subcategory.
  if (typeof segment.standardSubcategory !== "string" || segment.standardSubcategory.trim() === "") {
    return null;
  }

  const categoryCatalog = textSurfaceCatalog[segment.category];

  if (categoryCatalog.subcategories === null) {
    return null;
  }

  const subcategories: Record<string, {say?: string}> = categoryCatalog.subcategories;
  const subcategoryCatalog = subcategories[segment.standardSubcategory];

  // `say` is the only user-facing fragment we keep.
  // No legacy `content` alias.
  return typeof subcategoryCatalog?.say === "string" && subcategoryCatalog.say.trim() !== ""
    ? subcategoryCatalog.say
    : null;
}

export {buildStandardResponseFragments};

export type {
  BuildStandardResponseFragmentsInput,
  BuildStandardResponseFragmentsOutput
};
