// NEED TO CLEAN CONTENT : we have to delete content and keep say.
import {textSurfaceCatalog} from "../../support-catalog-optimized/supportSurface.catalog";

import type {TextSurfaceCategory} from "../../support-catalog-optimized/supportSurface.catalog";
import type {AnalyzeTextSurfaceSegment} from "../analyze-text-surface-optimized/runAnalyzeTextSurface";

type BuildStandardResponseFragmentsInput = {
  textSurfaceAnalysis?: {
    segments: AnalyzeTextSurfaceSegment[];
  };
};

type StandardSurfaceCategory = Exclude<TextSurfaceCategory, "support_relevant">;

type StandardTextSurfaceSegment = AnalyzeTextSurfaceSegment & {
  category: StandardSurfaceCategory;
  standardSubcategory: string;
};

type StandardResponseFragment = StandardTextSurfaceSegment & {
  say: string;

  // Temporary legacy alias for existing composer/runner compatibility.
  // New optimized code should use say.
  content: string;
};

type BuildStandardResponseFragmentsOutput = StandardResponseFragment[];

function buildStandardResponseFragments(
  input: BuildStandardResponseFragmentsInput
): BuildStandardResponseFragmentsOutput {
  const fragments: BuildStandardResponseFragmentsOutput = [];

  for (const segment of input.textSurfaceAnalysis?.segments ?? []) {
    const fragment = buildStandardResponseFragment(segment);

    if (fragment) {
      fragments.push(fragment);
    }
  }

  return fragments;
}

function buildStandardResponseFragment(
  segment: AnalyzeTextSurfaceSegment
): StandardResponseFragment | null {
  if (!isStandardTextSurfaceSegment(segment)) {
    return null;
  }

  const say = getSayForStandardSegment(segment);

  if (!say) {
    return null;
  }

  return {
    ...segment,
    say,
    content: say
  };
}

function isStandardTextSurfaceSegment(
  segment: AnalyzeTextSurfaceSegment
): segment is StandardTextSurfaceSegment {
  return segment.category !== "support_relevant" &&
    typeof segment.standardSubcategory === "string";
}

function getSayForStandardSegment(
  segment: StandardTextSurfaceSegment
): string | null {
  const categoryCatalog = textSurfaceCatalog[segment.category];

  if (categoryCatalog.subcategories === null) {
    return null;
  }

  const subcategories = categoryCatalog.subcategories as Record<string, {say?: string}>;
  const subcategoryCatalog = subcategories[segment.standardSubcategory];

  return subcategoryCatalog?.say ?? null;
}

export {
  buildStandardResponseFragments
};

export type {
  BuildStandardResponseFragmentsInput,
  BuildStandardResponseFragmentsOutput,
  StandardResponseFragment,
  StandardSurfaceCategory,
  StandardTextSurfaceSegment
};
