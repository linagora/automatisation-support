import type {
  FormatKnowledgeEnrichmentPlanOutputInput,
  KnowledgeEnrichmentDecision,
  KnowledgeEnrichmentRoute,
  KnowledgeEnrichmentValidationResult,
  RawKnowledgeEnrichmentResponse
} from "./typesPlanKnowledgeEnrichment.types";

const ALLOWED_ROUTES = new Set<KnowledgeEnrichmentRoute>([
  "none",
  "catalog_only",
  "rag_only",
  "catalog_and_rag"
]);

function invalid(reason: string): KnowledgeEnrichmentValidationResult {
  return {
    status: "invalid",
    reason
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compactText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const compacted = value.replace(/\s+/g, " ").trim();

  return compacted.length > 0 ? compacted : undefined;
}

function fallbackCatalogOnly(reason: string): KnowledgeEnrichmentDecision {
  return {
    route: "catalog_only",
    reason
  };
}

function validateRawResponse(
  value: unknown
): KnowledgeEnrichmentValidationResult {
  if (!isRecord(value)) {
    return invalid("invalid_response_shape");
  }

  const raw = value as RawKnowledgeEnrichmentResponse;
  const route = compactText(raw.route);

  if (!route || !ALLOWED_ROUTES.has(route as KnowledgeEnrichmentRoute)) {
    return invalid("invalid_route");
  }

  return {
    status: "valid",
    decision: {
      route: route as KnowledgeEnrichmentRoute,
      reason: compactText(raw.reason) ?? "knowledge_enrichment_llm_decision"
    }
  };
}

function formatKnowledgeEnrichmentPlanOutput(
  input: FormatKnowledgeEnrichmentPlanOutputInput
): KnowledgeEnrichmentValidationResult {
  if (input.rawKnowledgeEnrichmentPlan.status !== "completed") {
    return {
      status: "valid",
      decision: fallbackCatalogOnly(
        input.rawKnowledgeEnrichmentPlan.error?.message ??
          "knowledge_enrichment_llm_failed_fallback_catalog_only"
      )
    };
  }

  const validation = validateRawResponse(
    input.rawKnowledgeEnrichmentPlan.parsedResponse
  );

  if (validation.status === "valid") {
    return validation;
  }

  return {
    status: "valid",
    decision: fallbackCatalogOnly(
      `knowledge_enrichment_invalid_llm_output:${validation.reason}`
    )
  };
}

export {
  formatKnowledgeEnrichmentPlanOutput
};
