import type {SupportNeedAssessment} from "../assess-support-need-optimized/validateAssessSupportNeedOutput";
import type {TopicReadinessAssessment} from "../assess-topic-readiness-optimized/assessTopicReadiness";

type CatalogueRoutingMode =
  | "generic_clarification"
  | "need_clarification"
  | "domain_clarification"
  | "focused_qualification"
  | "minimal_gap_check"
  | "skip";

type DerivedSupportRouting = {
  catalogueRouting: {
    shouldRun: boolean;
    mode: CatalogueRoutingMode;
    reasonCodes: string[];
  };
  similarTopicSearchRouting: {
    shouldSearch: boolean;
    reasonCodes: string[];
  };
};

type DeriveSupportRoutingInput = {
  supportNeedAssessment: SupportNeedAssessment;
  topicReadinessAssessment: TopicReadinessAssessment;
  supportDomain: string | null;
};

function deriveSupportRouting(input: DeriveSupportRoutingInput): DerivedSupportRouting {
  const supportNeed = input.supportNeedAssessment.supportNeed;
  const readiness = input.topicReadinessAssessment;
  const supportDomainIsWeak = !input.supportDomain || input.supportDomain === "other";

  if (supportNeed === "unclear") {
    return buildRouting({
      catalogueShouldRun: true,
      catalogueMode: "need_clarification",
      catalogueReasonCodes: ["support_need_unclear"],
      searchShouldRun: false,
      searchReasonCodes: ["support_need_unclear"]
    });
  }

  if (supportDomainIsWeak) {
    return buildRouting({
      catalogueShouldRun: true,
      catalogueMode: "domain_clarification",
      catalogueReasonCodes: ["support_domain_unclear"],
      searchShouldRun: false,
      searchReasonCodes: ["support_domain_unclear"]
    });
  }

  if (!readiness.hasMaterialFields) {
    return buildRouting({
      catalogueShouldRun: true,
      catalogueMode: "focused_qualification",
      catalogueReasonCodes: ["missing_material_fields"],
      searchShouldRun: false,
      searchReasonCodes: ["missing_material_fields"]
    });
  }

  if (supportNeed === "feature_request") {
    return buildRouting({
      catalogueShouldRun: false,
      catalogueMode: "skip",
      catalogueReasonCodes: [`support_need_${supportNeed}`, "material_fields_present"],
      searchShouldRun: false,
      searchReasonCodes: [`support_need_${supportNeed}`]
    });
  }

  if (supportNeed === "knowledge_answer") {
    return buildRouting({
      catalogueShouldRun: !readiness.hasSearchableDetails,
      catalogueMode: readiness.hasSearchableDetails ? "skip" : "minimal_gap_check",
      catalogueReasonCodes: buildCatalogueReasonCodes(readiness),
      searchShouldRun: shouldSearchWithKnowledgeState(readiness),
      searchReasonCodes: buildSearchReasonCodes(readiness)
    });
  }

  if (supportNeed === "support_action") {
    return buildRouting({
      catalogueShouldRun: true,
      catalogueMode: "focused_qualification",
      catalogueReasonCodes: ["support_action", ...buildCatalogueReasonCodes(readiness)],
      searchShouldRun: shouldSearchWithKnowledgeState(readiness),
      searchReasonCodes: buildSearchReasonCodes(readiness)
    });
  }

  return buildRouting({
    catalogueShouldRun: true,
    catalogueMode: readiness.hasSearchableDetails ? "minimal_gap_check" : "focused_qualification",
    catalogueReasonCodes: buildCatalogueReasonCodes(readiness),
    searchShouldRun: shouldSearchWithKnowledgeState(readiness),
    searchReasonCodes: buildSearchReasonCodes(readiness)
  });
}

function shouldSearchWithKnowledgeState(readiness: TopicReadinessAssessment): boolean {
  return readiness.hasSearchableDetails && readiness.previousKnowledgeLooksUseful !== true;
}

function buildCatalogueReasonCodes(readiness: TopicReadinessAssessment): string[] {
  const reasonCodes: string[] = [];

  if (readiness.hasMaterialFields) reasonCodes.push("has_material_fields");
  if (readiness.hasSearchableDetails) reasonCodes.push("has_searchable_details");
  if (readiness.previousKnowledgeLooksUseful === true) reasonCodes.push("previous_knowledge_useful");

  return reasonCodes;
}

function buildSearchReasonCodes(readiness: TopicReadinessAssessment): string[] {
  if (!readiness.hasSearchableDetails) return ["missing_searchable_details"];
  if (readiness.previousKnowledgeLooksUseful === true) return ["previous_knowledge_useful"];
  if (readiness.previousKnowledgeLooksEmpty === true) return ["has_searchable_details", "previous_knowledge_empty"];
  return ["has_searchable_details"];
}

function buildRouting(params: {
  catalogueShouldRun: boolean;
  catalogueMode: CatalogueRoutingMode;
  catalogueReasonCodes: string[];
  searchShouldRun: boolean;
  searchReasonCodes: string[];
}): DerivedSupportRouting {
  return {
    catalogueRouting: {
      shouldRun: params.catalogueShouldRun,
      mode: params.catalogueMode,
      reasonCodes: params.catalogueReasonCodes
    },
    similarTopicSearchRouting: {
      shouldSearch: params.searchShouldRun,
      reasonCodes: params.searchReasonCodes
    }
  };
}

export {deriveSupportRouting};

export type {
  CatalogueRoutingMode,
  DerivedSupportRouting,
  DeriveSupportRoutingInput
};
