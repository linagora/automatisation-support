import type {
  BroadIntentMode,
  FormatKnowledgeEnrichmentPlanOutputInput,
  KnowledgeEnrichmentDecision,
  KnowledgeEnrichmentValidationResult,
  RagRetrievalMode,
  RawKnowledgeEnrichmentResponse
} from "./typesPlanKnowledgeEnrichment.types";
import {
  BROAD_INTENT_MODES
} from "../../support-catalog-LEGACY";

const ALLOWED_BROAD_INTENTS = new Set<BroadIntentMode>(BROAD_INTENT_MODES);

const ALLOWED_RAG_MODES = new Set<Exclude<RagRetrievalMode, null>>([
  "answer",
  "answer_and_soft_probe"
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

function fallbackNoRag(reason: string): KnowledgeEnrichmentDecision {
  return {
    broadIntent: {
      mode: "unclear",
      reason
    },
    rag: {
      shouldRetrieve: false,
      mode: null,
      reason
    }
  };
}

function validateBroadIntent(value: unknown):
  | KnowledgeEnrichmentDecision["broadIntent"]
  | null {
  if (!isRecord(value)) {
    return null;
  }

  const mode = compactText(value.mode);

  if (!mode || !ALLOWED_BROAD_INTENTS.has(mode as BroadIntentMode)) {
    return null;
  }

  return {
    mode: mode as BroadIntentMode,
    reason: compactText(value.reason) ?? "broad_intent_llm_decision"
  };
}

function validateRag(value: unknown): KnowledgeEnrichmentDecision["rag"] | null {
  if (!isRecord(value) || typeof value.shouldRetrieve !== "boolean") {
    return null;
  }

  if (!value.shouldRetrieve) {
    return {
      shouldRetrieve: false,
      mode: null,
      reason: compactText(value.reason) ?? "rag_not_needed"
    };
  }

  const mode = compactText(value.mode);

  if (!mode || !ALLOWED_RAG_MODES.has(mode as Exclude<RagRetrievalMode, null>)) {
    return null;
  }

  return {
    shouldRetrieve: true,
    mode: mode as Exclude<RagRetrievalMode, null>,
    reason: compactText(value.reason) ?? "rag_may_be_useful"
  };
}

function validateRawResponse(
  value: unknown
): KnowledgeEnrichmentValidationResult {
  if (!isRecord(value)) {
    return invalid("invalid_response_shape");
  }

  const raw = value as RawKnowledgeEnrichmentResponse;
  const broadIntent = validateBroadIntent(raw.broadIntent);

  if (!broadIntent) {
    return invalid("invalid_broad_intent");
  }

  const rag = validateRag(raw.rag);

  if (!rag) {
    return invalid("invalid_rag_decision");
  }

  if (broadIntent.mode === "unclear" && rag.shouldRetrieve) {
    return invalid("unclear_intent_cannot_run_rag");
  }

  return {
    status: "valid",
    decision: {
      broadIntent,
      rag
    }
  };
}

function formatKnowledgeEnrichmentPlanOutput(
  input: FormatKnowledgeEnrichmentPlanOutputInput
): KnowledgeEnrichmentValidationResult {
  if (input.rawKnowledgeEnrichmentPlan.status !== "completed") {
    return {
      status: "valid",
      decision: fallbackNoRag(
        input.rawKnowledgeEnrichmentPlan.error?.message ??
          "knowledge_enrichment_llm_failed_fallback_no_rag"
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
    decision: fallbackNoRag(
      `knowledge_enrichment_invalid_llm_output:${validation.reason}`
    )
  };
}

export {
  formatKnowledgeEnrichmentPlanOutput
};
