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

function toKnowledgeEnrichmentPlan(
  decision: KnowledgeEnrichmentDecision
): KnowledgeEnrichmentPlan {
  return {
    route: decision.route,
    retrievalRequests: [],
    reason: decision.reason
  } as unknown as KnowledgeEnrichmentPlan;
}

function getKnowledgeEnrichmentRoute(
  plan: KnowledgeEnrichmentPlan
): KnowledgeEnrichmentRoute {
  const route = (plan as { route?: unknown }).route;

  if (
    route === "none" ||
    route === "catalog_only" ||
    route === "rag_only" ||
    route === "catalog_and_rag"
  ) {
    return route;
  }

  return "none";
}

function shouldRunCatalogFromKnowledgeEnrichment(
  plan: KnowledgeEnrichmentPlan
): boolean {
  const route = getKnowledgeEnrichmentRoute(plan);

  return route === "catalog_only" || route === "catalog_and_rag";
}

function shouldRunRagFromKnowledgeEnrichment(
  plan: KnowledgeEnrichmentPlan
): boolean {
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
    route: "catalog_only",
    reason: `knowledge_enrichment_format_failed:${formattedOutput.reason}`
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
