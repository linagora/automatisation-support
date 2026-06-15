import {
  TEXT_SURFACE_CATEGORIES,
  TEXT_SURFACE_SUBCATEGORIES_BY_CATEGORY
} from "./textSurfaceAnalysis.taxonomy";

import type {
  FormatTextSurfaceAnalysisOutputInput,
  RawTextSurfaceSegment,
  SurfaceCategory,
  TextSurfaceStandardSubcategory,
  TextSurfaceValidationResult,
  TextSurfaceUserLanguage
} from "./typesAnalyzeTextSurface.types";

const USER_LANGUAGES: TextSurfaceUserLanguage[] = [
  "French",
  "English",
  "Other",
  "Unknown"
];

type LocatedSegment = {
  start: number;
  end: number;
  verbatim: string;
  category: SurfaceCategory;
  standardSubcategory?: TextSurfaceStandardSubcategory;
};

function invalid(reason: string): TextSurfaceValidationResult {
  return {
    status: "invalid",
    reason
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUserLanguage(value: unknown): value is TextSurfaceUserLanguage {
  return typeof value === "string" && USER_LANGUAGES.includes(
    value as TextSurfaceUserLanguage
  );
}

function isSurfaceCategory(value: unknown): value is SurfaceCategory {
  return typeof value === "string" && TEXT_SURFACE_CATEGORIES.includes(
    value as SurfaceCategory
  );
}

function validateStandardSubcategory(params: {
  category: SurfaceCategory;
  standardSubcategory: unknown;
}): TextSurfaceStandardSubcategory | undefined | null {
  if (params.category === "support_relevant") {
    return params.standardSubcategory === null
      ? undefined
      : null;
  }

  if (typeof params.standardSubcategory !== "string") {
    return null;
  }

  const allowed = TEXT_SURFACE_SUBCATEGORIES_BY_CATEGORY[
    params.category
  ] as readonly string[];
  const standardSubcategory =
    params.standardSubcategory as TextSurfaceStandardSubcategory;

  return allowed.includes(standardSubcategory)
    ? standardSubcategory
    : null;
}

function locateSegments(params: {
  message: string;
  rawSegments: RawTextSurfaceSegment[];
}): LocatedSegment[] | string {
  const locatedSegments: LocatedSegment[] = [];
  let searchStart = 0;

  for (const rawSegment of params.rawSegments) {
    if (typeof rawSegment.verbatim !== "string" || rawSegment.verbatim === "") {
      return "invalid_verbatim";
    }

    if (!isSurfaceCategory(rawSegment.category)) {
      return "invalid_category";
    }

    const standardSubcategory = validateStandardSubcategory({
      category: rawSegment.category,
      standardSubcategory: rawSegment.standardSubcategory
    });

    if (standardSubcategory === null) {
      return "invalid_standard_subcategory";
    }

    const start = params.message.indexOf(rawSegment.verbatim, searchStart);

    if (start === -1) {
      return "verbatim_not_found";
    }

    const end = start + rawSegment.verbatim.length;

    if (start < searchStart) {
      return "overlapping_segments";
    }

    locatedSegments.push({
      start,
      end,
      verbatim: rawSegment.verbatim,
      category: rawSegment.category,
      ...(standardSubcategory ? { standardSubcategory } : {})
    });
    searchStart = end;
  }

  return locatedSegments;
}

function hasOnlyWhitespaceUncovered(params: {
  message: string;
  locatedSegments: LocatedSegment[];
}): boolean {
  const covered = Array.from({
    length: params.message.length
  }, () => false);

  for (const segment of params.locatedSegments) {
    for (let index = segment.start; index < segment.end; index += 1) {
      if (covered[index]) {
        return false;
      }

      covered[index] = true;
    }
  }

  for (let index = 0; index < params.message.length; index += 1) {
    if (!covered[index] && /\S/u.test(params.message[index] ?? "")) {
      return false;
    }
  }

  return true;
}

function formatTextSurfaceAnalysisOutput(
  input: FormatTextSurfaceAnalysisOutputInput
): TextSurfaceValidationResult {
  if (input.rawTextSurfaceAnalysis.status !== "completed") {
    return invalid("llm_call_failed");
  }

  const parsedResponse = input.rawTextSurfaceAnalysis.parsedResponse;

  if (!isRecord(parsedResponse)) {
    return invalid("invalid_json");
  }

  if (!isUserLanguage(parsedResponse.userLanguage)) {
    return invalid("invalid_user_language");
  }

  if (!Array.isArray(parsedResponse.segments)) {
    return invalid("invalid_segments");
  }

  const locatedSegments = locateSegments({
    message: input.latestUserMessageContent,
    rawSegments: parsedResponse.segments as RawTextSurfaceSegment[]
  });

  if (typeof locatedSegments === "string") {
    return invalid(locatedSegments);
  }

  if (
    !hasOnlyWhitespaceUncovered({
      message: input.latestUserMessageContent,
      locatedSegments
    })
  ) {
    return invalid("message_not_fully_covered");
  }

  return {
    status: "valid",
    analysis: {
      userLanguage: parsedResponse.userLanguage,
      segments: locatedSegments.map((segment, index) => ({
        segmentId: `text_segment_${index + 1}`,
        verbatim: segment.verbatim,
        category: segment.category,
        ...(segment.standardSubcategory
          ? { standardSubcategory: segment.standardSubcategory }
          : {})
      }))
    }
  };
}

export {
  formatTextSurfaceAnalysisOutput
};
