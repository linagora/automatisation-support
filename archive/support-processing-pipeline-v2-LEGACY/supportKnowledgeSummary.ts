import type {
  PlannerKnowledgeInput,
  SupportKnowledgeSummary
} from "./typesSupportProcessingPipelineV2.types";

function compactString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function joinParts(parts: Array<string | null | undefined>): string | null {
  const values = Array.from(new Set(parts.flatMap((part) => {
    const compacted = compactString(part);

    return compacted ? [compacted] : [];
  })));

  return values.length > 0 ? values.join("\n") : null;
}

function normalizeSupportKnowledgeSummary(
  value: unknown
): SupportKnowledgeSummary | null {
  if (typeof value === "string") {
    const summary = compactString(value);

    return summary
      ? {
          summary,
          customerFacing: null,
          supportFacing: null
        }
      : null;
  }

  if (!isRecord(value)) {
    return null;
  }

  const summary = compactString(value.summary);
  const customerFacing = compactString(value.customerFacing);
  const supportFacing = compactString(value.supportFacing);

  if (!summary && !customerFacing && !supportFacing) {
    return null;
  }

  return {
    summary,
    customerFacing,
    supportFacing
  };
}

function mergeSupportKnowledgeSummary(params: {
  existing?: unknown;
  next?: unknown;
}): SupportKnowledgeSummary | null {
  const existing = normalizeSupportKnowledgeSummary(params.existing);
  const next = normalizeSupportKnowledgeSummary(params.next);

  if (!existing) {
    return next;
  }

  if (!next) {
    return existing;
  }

  return normalizeSupportKnowledgeSummary({
    summary: next.summary ?? existing.summary,
    customerFacing: joinParts([
      existing.customerFacing,
      next.customerFacing
    ]),
    supportFacing: joinParts([
      existing.supportFacing,
      next.supportFacing
    ])
  });
}

function toPlannerKnowledgeInput(
  value: unknown
): PlannerKnowledgeInput | null {
  const summary = normalizeSupportKnowledgeSummary(value);

  if (!summary) {
    return null;
  }

  return {
    summary: summary.summary,
    customerFacing: summary.customerFacing
  };
}

export {
  mergeSupportKnowledgeSummary,
  normalizeSupportKnowledgeSummary,
  toPlannerKnowledgeInput
};
