import {
  buildPlanKnowledgeEnrichmentPrompt
} from "./buildPlanKnowledgeEnrichmentPrompt";
import {
  formatKnowledgeEnrichmentPlanOutput
} from "./formatKnowledgeEnrichmentPlanOutput";
import {
  requestKnowledgeEnrichmentPlan
} from "./requestKnowledgeEnrichmentPlan";

import type {
  KnowledgeEnrichmentDecision,
  KnowledgeEnrichmentRoute
} from "./typesPlanKnowledgeEnrichment.types";
import type {
  KnowledgeEnrichmentPlan,
  PlanKnowledgeEnrichmentInput
} from "../typesSupportProcessingPipelineV2.types";

function deriveRoute(decision: KnowledgeEnrichmentDecision): KnowledgeEnrichmentRoute {
  return decision.rag.shouldRetrieve ? "catalog_and_rag" : "catalog_only";
}

function toKnowledgeEnrichmentPlan(
  decision: KnowledgeEnrichmentDecision
): KnowledgeEnrichmentPlan {
  return {
    broadIntent: decision.broadIntent,
    rag: decision.rag,
    route: deriveRoute(decision),
    retrievalRequests: []
  } as unknown as KnowledgeEnrichmentPlan;
}

function getKnowledgeEnrichmentRoute(
  plan: KnowledgeEnrichmentPlan
): KnowledgeEnrichmentRoute {
  const rag = (plan as { rag?: { shouldRetrieve?: unknown } }).rag;

  if (rag?.shouldRetrieve === true) {
    return "catalog_and_rag";
  }

  if (rag?.shouldRetrieve === false) {
    return "catalog_only";
  }

  const legacyRoute = (plan as { route?: unknown }).route;

  if (
    legacyRoute === "none" ||
    legacyRoute === "catalog_only" ||
    legacyRoute === "rag_only" ||
    legacyRoute === "catalog_and_rag"
  ) {
    return legacyRoute;
  }

  return "catalog_only";
}

function shouldRunCatalogFromKnowledgeEnrichment(
  _plan: KnowledgeEnrichmentPlan
): boolean {
  return true;
}

function shouldRunRagFromKnowledgeEnrichment(
  plan: KnowledgeEnrichmentPlan
): boolean {
  const rag = (plan as { rag?: { shouldRetrieve?: unknown } }).rag;

  if (typeof rag?.shouldRetrieve === "boolean") {
    return rag.shouldRetrieve;
  }

  const route = getKnowledgeEnrichmentRoute(plan);

  return route === "rag_only" || route === "catalog_and_rag";
}

async function planKnowledgeEnrichment(
  input: PlanKnowledgeEnrichmentInput
): Promise<KnowledgeEnrichmentPlan> {
  const prompt = buildPlanKnowledgeEnrichmentPrompt({
    input
  });
  const rawKnowledgeEnrichmentPlan = await requestKnowledgeEnrichmentPlan({
    prompt
  });
  const formattedOutput = formatKnowledgeEnrichmentPlanOutput({
    rawKnowledgeEnrichmentPlan
  });

  if (formattedOutput.status === "valid") {
    return toKnowledgeEnrichmentPlan(formattedOutput.decision);
  }

  return toKnowledgeEnrichmentPlan({
    broadIntent: {
      mode: "unclear",
      reason: `knowledge_enrichment_format_failed:${formattedOutput.reason}`
    },
    rag: {
      shouldRetrieve: false,
      mode: null,
      reason: `knowledge_enrichment_format_failed:${formattedOutput.reason}`
    }
  });
}

export {
  getKnowledgeEnrichmentRoute,
  planKnowledgeEnrichment,
  shouldRunCatalogFromKnowledgeEnrichment,
  shouldRunRagFromKnowledgeEnrichment
};

export type {
  KnowledgeEnrichmentRoute
};
