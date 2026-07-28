import {
  TEXT_SURFACE_CATEGORIES,
  TEXT_SURFACE_SUBCATEGORIES_BY_CATEGORY
} from "./textSurfaceAnalysis.taxonomy";
import {
  normalizeDetectedUserLanguage
} from "../response-language/normalizeUserLanguageForResponse";

import type {
  FormatTextSurfaceAnalysisOutputInput,
  RawTextSurfaceSegment,
  SurfaceCategory,
  TextSurfaceStandardSubcategory,
  TextSurfaceValidationResult
} from "./typesAnalyzeTextSurface.types";

type LocatedSegment = {
  start: number;
  end: number;
  verbatim: string;
  category: SurfaceCategory;
  standardSubcategory?: TextSurfaceStandardSubcategory;
};

type ValidatedRawSegment = {
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

function validateRawSegments(
  rawSegments: RawTextSurfaceSegment[]
): ValidatedRawSegment[] | string {
  const validatedSegments: ValidatedRawSegment[] = [];

  for (const rawSegment of rawSegments) {
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

    validatedSegments.push({
      verbatim: rawSegment.verbatim,
      category: rawSegment.category,
      ...(standardSubcategory ? { standardSubcategory } : {})
    });
  }

  return validatedSegments;
}

function locateSegmentsSequentially(params: {
  message: string;
  segments: ValidatedRawSegment[];
}): LocatedSegment[] | string {
  const locatedSegments: LocatedSegment[] = [];
  let searchStart = 0;

  for (const segment of params.segments) {
    const start = params.message.indexOf(segment.verbatim, searchStart);

    if (start === -1) {
      return "verbatim_not_found";
    }

    const end = start + segment.verbatim.length;

    if (start < searchStart) {
      return "overlapping_segments";
    }

    locatedSegments.push({
      start,
      end,
      verbatim: segment.verbatim,
      category: segment.category,
      ...(segment.standardSubcategory
        ? { standardSubcategory: segment.standardSubcategory }
        : {})
    });

    searchStart = end;
  }

  return locatedSegments;
}

function findAllOccurrences(params: {
  message: string;
  verbatim: string;
}): number[] {
  const occurrences: number[] = [];
  let searchStart = 0;

  while (searchStart <= params.message.length) {
    const start = params.message.indexOf(params.verbatim, searchStart);

    if (start === -1) {
      break;
    }

    occurrences.push(start);
    searchStart = start + 1;
  }

  return occurrences;
}

function locateSegmentsByUniquePosition(params: {
  message: string;
  segments: ValidatedRawSegment[];
}): LocatedSegment[] | string {
  const locatedSegments: LocatedSegment[] = [];

  for (const segment of params.segments) {
    const occurrences = findAllOccurrences({
      message: params.message,
      verbatim: segment.verbatim
    });

    if (occurrences.length === 0) {
      return "verbatim_not_found";
    }

    if (occurrences.length > 1) {
      return "ambiguous_verbatim";
    }

    const start = occurrences[0] as number;
    const end = start + segment.verbatim.length;

    locatedSegments.push({
      start,
      end,
      verbatim: segment.verbatim,
      category: segment.category,
      ...(segment.standardSubcategory
        ? { standardSubcategory: segment.standardSubcategory }
        : {})
    });
  }

  return locatedSegments
    .sort((left, right) => left.start - right.start);
}

function hasNoOverlap(locatedSegments: LocatedSegment[]): boolean {
  let previousEnd = 0;

  for (const segment of locatedSegments) {
    if (segment.start < previousEnd) {
      return false;
    }

    previousEnd = segment.end;
  }

  return true;
}

function isRepairableGap(gap: string): boolean {
  return gap.length > 0 &&
    gap.length <= 8 &&
    /^[\s\p{P}]+$/u.test(gap);
}

function repairCoverageGaps(params: {
  message: string;
  locatedSegments: LocatedSegment[];
}): LocatedSegment[] | string {
  if (params.locatedSegments.length === 0) {
    return params.message.trim() === "" ? [] : "message_not_fully_covered";
  }

  const repairedSegments = params.locatedSegments.map((segment) => ({
    ...segment
  }));
  const firstSegment = repairedSegments[0] as LocatedSegment;
  const leadingGap = params.message.slice(0, firstSegment.start);

  if (leadingGap !== "") {
    if (!isRepairableGap(leadingGap)) {
      return "message_not_fully_covered";
    }

    firstSegment.start = 0;
    firstSegment.verbatim = leadingGap + firstSegment.verbatim;
  }

  for (let index = 1; index < repairedSegments.length; index += 1) {
    const previousSegment = repairedSegments[index - 1] as LocatedSegment;
    const currentSegment = repairedSegments[index] as LocatedSegment;
    const gap = params.message.slice(previousSegment.end, currentSegment.start);

    if (gap === "") {
      continue;
    }

    if (!isRepairableGap(gap)) {
      return "message_not_fully_covered";
    }

    previousSegment.end = currentSegment.start;
    previousSegment.verbatim += gap;
  }

  const lastSegment = repairedSegments[
    repairedSegments.length - 1
  ] as LocatedSegment;
  const trailingGap = params.message.slice(lastSegment.end);

  if (trailingGap !== "") {
    if (!isRepairableGap(trailingGap)) {
      return "message_not_fully_covered";
    }

    lastSegment.end = params.message.length;
    lastSegment.verbatim += trailingGap;
  }

  return repairedSegments;
}

function coversFullMessage(params: {
  message: string;
  locatedSegments: LocatedSegment[];
}): boolean {
  if (params.locatedSegments.length === 0) {
    return params.message.trim() === "";
  }

  const firstSegment = params.locatedSegments[0] as LocatedSegment;
  const lastSegment = params.locatedSegments[
    params.locatedSegments.length - 1
  ] as LocatedSegment;

  if (firstSegment.start !== 0 || lastSegment.end !== params.message.length) {
    return false;
  }

  for (let index = 0; index < params.locatedSegments.length; index += 1) {
    const segment = params.locatedSegments[index] as LocatedSegment;

    if (segment.verbatim !== params.message.slice(segment.start, segment.end)) {
      return false;
    }

    if (index > 0) {
      const previousSegment = params.locatedSegments[
        index - 1
      ] as LocatedSegment;

      if (previousSegment.end !== segment.start) {
        return false;
      }
    }
  }

  return true;
}

function locateAndRepairSegments(params: {
  message: string;
  rawSegments: RawTextSurfaceSegment[];
}): LocatedSegment[] | string {
  const validatedSegments = validateRawSegments(params.rawSegments);

  if (typeof validatedSegments === "string") {
    return validatedSegments;
  }

  let locatedSegments = locateSegmentsSequentially({
    message: params.message,
    segments: validatedSegments
  });

  if (typeof locatedSegments === "string") {
    locatedSegments = locateSegmentsByUniquePosition({
      message: params.message,
      segments: validatedSegments
    });
  }

  if (typeof locatedSegments === "string") {
    return locatedSegments === "ambiguous_verbatim"
      ? "verbatim_not_found"
      : locatedSegments;
  }

  if (!hasNoOverlap(locatedSegments)) {
    return "overlapping_segments";
  }

  const repairedSegments = repairCoverageGaps({
    message: params.message,
    locatedSegments
  });

  if (typeof repairedSegments === "string") {
    return repairedSegments;
  }

  if (
    !hasNoOverlap(repairedSegments) ||
    !coversFullMessage({
      message: params.message,
      locatedSegments: repairedSegments
    })
  ) {
    return "message_not_fully_covered";
  }

  return repairedSegments;
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

  const userLanguage = normalizeDetectedUserLanguage(
    parsedResponse.userLanguage
  );

  if (!Array.isArray(parsedResponse.segments)) {
    return invalid("invalid_segments");
  }

  const locatedSegments = locateAndRepairSegments({
    message: input.latestUserMessageContent,
    rawSegments: parsedResponse.segments as RawTextSurfaceSegment[]
  });

  if (typeof locatedSegments === "string") {
    return invalid(locatedSegments);
  }

  return {
    status: "valid",
    analysis: {
      userLanguage,
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
