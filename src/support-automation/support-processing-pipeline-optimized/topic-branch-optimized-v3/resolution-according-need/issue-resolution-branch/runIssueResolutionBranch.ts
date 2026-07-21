import {assessIssueBasicQualification, type IssueBasicQualificationAssessOutput} from "./basic-qualification/assess/assessIssueBasicQualification";
import {planIssueBasicQualificationAsk} from "./basic-qualification/planner/planIssueBasicQualificationAsk";
import {assessIssueDeepQualification, type IssueDeepQualificationAssessOutput} from "./deep-qualification/assess/assessIssueDeepQualification";
import {planIssueDeepQualificationAsk} from "./deep-qualification/planner/planIssueDeepQualificationAsk";
import {analyzeSimilarIssueTopics, type SimilarIssueTopicAnalysisOutput} from "./similar-topic/rag-search-analyze/assess/analyzeSimilarIssueTopics";
import {planSimilarTopicDisambiguationAsk} from "./similar-topic/rag-search-analyze/planner/planSimilarTopicDisambiguationAsk";
import {searchSimilarIssueTopics, type SimilarIssueTopicSearchOutput} from "./similar-topic/rag-search/searchSimilarIssueTopics";
import {extractIssueSolution, type IssueSolutionExtractionOutput} from "./solution/assess/extractIssueSolution";
import {planIssueSolutionResponse} from "./solution/planner/planIssueSolutionResponse";

import type {Primitive, RoutedTopicBranchInput, RoutedTopicBranchOutput, SupportUnderstanding} from "../../runTopicBranch";

type IssueFieldStatus =
  | "missing_not_asked"
  | "asked_once"
  | "asked_again"
  | "obtained"
  | "user_declared_unavailable";

type IssueFieldRequirement = "required" | "recommended";

type IssueFieldSpec = {
  key: string;
  label: string;
  requirement: IssueFieldRequirement;
  askPrompt: string;
};

type IssueQualificationField = {
  key: string;
  label: string;
  requirement: IssueFieldRequirement;
  value: Primitive;
  evidence: string | null;
  status: IssueFieldStatus;
  askPrompt: string;
  askedCount: number;
};

type IssueAttemptedActionSignal = {
  status: "present" | "missing";
  attemptedActions: Array<{action: string; outcome: string | null; evidence: string | null}>;
  shouldAskForAttemptedActions: boolean;
};

type SimilarIssueTopicCandidate = {
  similarTopicId: string;
  title: string;
  summary: string;
  score: number | null;
  usefulDeepFieldKeys: string[];
  solutionSummary?: string | null;
  internalKnowledgeSummary?: string | null;
};

type IssueProgressState = {
  basicQualification: {
    fields: IssueQualificationField[];
    missingRequiredFields: string[];
    missingRecommendedFields: string[];
    nextAskFields: string[];
    attemptedActionSignal: IssueAttemptedActionSignal;
  };
  similarTopic: {
    ragSearch: {
      status: "not_started" | "completed" | "fallback";
      retrievedCandidates: SimilarIssueTopicCandidate[];
      fallbackReason: unknown | null;
    };
    analysis: {
      status: "not_started" | "identified" | "unclear" | "absent" | "fallback";
      confirmedTopics: SimilarIssueTopicCandidate[];
      selectedTopic: SimilarIssueTopicCandidate | null;
      disambiguationQuestion: string | null;
      reason: string | null;
      fallbackReason: unknown | null;
    };
  };
  deepQualification: {
    mode: "similar_topic_guided" | "domain_generic" | null;
    fields: IssueQualificationField[];
    missingRequiredFields: string[];
    missingRecommendedFields: string[];
    nextAskFields: string[];
  };
  solution: {
    status: "not_started" | "available" | "not_found" | "not_relevant" | "provided" | "awaiting_user_result" | "fallback";
    customerFacingSolution: string | null;
    supportFacingSummary: string | null;
    confidence: number | null;
    fallbackReason: unknown | null;
  };
};

type IssueStepPlan = {
  say: string;
  nextIssueProgressState: IssueProgressState;
  internalOutputs?: Record<string, unknown>;
};

type IssueResolutionInternalOutputs = {
  issueProgressState: IssueProgressState | null;
  basicQualificationAssessOutput: IssueBasicQualificationAssessOutput | null;
  basicQualificationPlannerOutput: IssueStepPlan | null;
  similarTopicSearchOutput: SimilarIssueTopicSearchOutput | null;
  similarTopicAnalysisOutput: SimilarIssueTopicAnalysisOutput | null;
  similarTopicDisambiguationPlannerOutput: IssueStepPlan | null;
  deepQualificationAssessOutput: IssueDeepQualificationAssessOutput | null;
  deepQualificationPlannerOutput: IssueStepPlan | null;
  solutionExtractionOutput: IssueSolutionExtractionOutput | null;
  solutionPlannerOutput: IssueStepPlan | null;
};

type IssueResolutionBranchOutput = RoutedTopicBranchOutput<IssueResolutionInternalOutputs>;

const emptyIssueProgressState: IssueProgressState = {
  basicQualification: {
    fields: [],
    missingRequiredFields: [],
    missingRecommendedFields: [],
    nextAskFields: [],
    attemptedActionSignal: {
      status: "missing",
      attemptedActions: [],
      shouldAskForAttemptedActions: true
    }
  },
  similarTopic: {
    ragSearch: {
      status: "not_started",
      retrievedCandidates: [],
      fallbackReason: null
    },
    analysis: {
      status: "not_started",
      confirmedTopics: [],
      selectedTopic: null,
      disambiguationQuestion: null,
      reason: null,
      fallbackReason: null
    }
  },
  deepQualification: {
    mode: null,
    fields: [],
    missingRequiredFields: [],
    missingRecommendedFields: [],
    nextAskFields: []
  },
  solution: {
    status: "not_started",
    customerFacingSolution: null,
    supportFacingSummary: null,
    confidence: null,
    fallbackReason: null
  }
};

async function runIssueResolutionBranch(input: RoutedTopicBranchInput): Promise<IssueResolutionBranchOutput> {
  const internalOutputs = buildEmptyIssueResolutionInternalOutputs();
  const supportDomain = input.supportNeedResolution.supportDomain;

  if (supportDomain === null) {
    return buildFallback({source: "issue_resolution_branch", reason: "missing_support_domain"}, internalOutputs);
  }

  // 1. État issue initial : on relit seulement l'état existant du topic courant, sans resolver externe.
  let issueProgressState = mergeStoredIssueProgressState(input.topicBranchInput.currentTopic?.issueProgressState);
  internalOutputs.issueProgressState = issueProgressState;

  // 2. Basic qualification : déterministe. Si les champs bloquants manquent, le planner LLM formule la question.
  if (!isBasicQualificationSufficient(issueProgressState)) {
    const basicQualificationAssessOutput = assessIssueBasicQualification({
      supportDomain,
      issueProgressState,
      currentTopic: input.topicBranchInput.currentTopic,
      sourceUnderstandings: input.topicBranchInput.sourceUnderstandings
    });

    internalOutputs.basicQualificationAssessOutput = basicQualificationAssessOutput;
    issueProgressState = basicQualificationAssessOutput.issueProgressState;
    internalOutputs.issueProgressState = issueProgressState;
  }

  if (!isBasicQualificationSufficient(issueProgressState)) {
    const basicQualificationPlannerOutput = await planIssueBasicQualificationAsk({
      issueProgressState,
      currentUserMessage: input.topicBranchInput.currentUserMessage,
      previousConversationTurn: input.topicBranchInput.previousConversationTurn
    });

    internalOutputs.basicQualificationPlannerOutput = basicQualificationPlannerOutput;
    internalOutputs.issueProgressState = basicQualificationPlannerOutput.nextIssueProgressState;

    return buildProcessed(basicQualificationPlannerOutput, internalOutputs);
  }

  // 3. Similar topic RAG search : on lance la recherche brute une seule fois.
  if (issueProgressState.similarTopic.ragSearch.status === "not_started") {
    const similarTopicSearchOutput = await searchSimilarIssueTopics({
      issueProgressState,
      supportDomain,
      topicSummary: buildIssueTopicSummary(input.topicBranchInput),
      sourceUnderstandings: input.topicBranchInput.sourceUnderstandings
    });

    internalOutputs.similarTopicSearchOutput = similarTopicSearchOutput;
    issueProgressState = similarTopicSearchOutput.issueProgressState;
    internalOutputs.issueProgressState = issueProgressState;
  }

  if (issueProgressState.similarTopic.ragSearch.status === "fallback") {
    return buildFallback(issueProgressState.similarTopic.ragSearch.fallbackReason, internalOutputs);
  }

  // 4. Similar topic analysis : peut être relancé si une clarification utilisateur arrive après un état unclear.
  if (issueProgressState.similarTopic.analysis.status === "not_started" || issueProgressState.similarTopic.analysis.status === "unclear") {
    const similarTopicAnalysisOutput = await analyzeSimilarIssueTopics({
      issueProgressState,
      currentUserMessage: input.topicBranchInput.currentUserMessage,
      previousConversationTurn: input.topicBranchInput.previousConversationTurn
    });

    internalOutputs.similarTopicAnalysisOutput = similarTopicAnalysisOutput;
    issueProgressState = similarTopicAnalysisOutput.issueProgressState;
    internalOutputs.issueProgressState = issueProgressState;
  }

  if (issueProgressState.similarTopic.analysis.status === "fallback") {
    return buildFallback(issueProgressState.similarTopic.analysis.fallbackReason, internalOutputs);
  }

  if (issueProgressState.similarTopic.analysis.status === "unclear") {
    const similarTopicDisambiguationPlannerOutput = planSimilarTopicDisambiguationAsk({issueProgressState});
    internalOutputs.similarTopicDisambiguationPlannerOutput = similarTopicDisambiguationPlannerOutput;
    internalOutputs.issueProgressState = similarTopicDisambiguationPlannerOutput.nextIssueProgressState;

    return buildProcessed(similarTopicDisambiguationPlannerOutput, internalOutputs);
  }

  // 5. Deep qualification : déterministe. Elle peut être guidée par un topic similaire confirmé.
  if (!isDeepQualificationSufficient(issueProgressState)) {
    const deepQualificationAssessOutput = assessIssueDeepQualification({
      issueProgressState,
      currentTopic: input.topicBranchInput.currentTopic,
      sourceUnderstandings: input.topicBranchInput.sourceUnderstandings,
      supportDomain
    });

    internalOutputs.deepQualificationAssessOutput = deepQualificationAssessOutput;
    issueProgressState = deepQualificationAssessOutput.issueProgressState;
    internalOutputs.issueProgressState = issueProgressState;
  }

  if (!isDeepQualificationSufficient(issueProgressState)) {
    const deepQualificationPlannerOutput = await planIssueDeepQualificationAsk({
      issueProgressState,
      currentUserMessage: input.topicBranchInput.currentUserMessage,
      previousConversationTurn: input.topicBranchInput.previousConversationTurn
    });

    internalOutputs.deepQualificationPlannerOutput = deepQualificationPlannerOutput;
    internalOutputs.issueProgressState = deepQualificationPlannerOutput.nextIssueProgressState;

    return buildProcessed(deepQualificationPlannerOutput, internalOutputs);
  }

  // 6. Solution extraction : RAG/LLM-oriented placeholder. Elle ne doit pas relancer si une solution a déjà été extraite.
  if (issueProgressState.solution.status === "not_started") {
    const solutionExtractionOutput = await extractIssueSolution({
      issueProgressState,
      currentUserMessage: input.topicBranchInput.currentUserMessage
    });

    internalOutputs.solutionExtractionOutput = solutionExtractionOutput;
    issueProgressState = solutionExtractionOutput.issueProgressState;
    internalOutputs.issueProgressState = issueProgressState;
  }

  if (issueProgressState.solution.status === "fallback") {
    return buildFallback(issueProgressState.solution.fallbackReason, internalOutputs);
  }

  // 7. Final issue response : déterministe. Il dit soit la solution, soit qu'aucune réponse fiable n'a été trouvée automatiquement.
  const solutionPlannerOutput = planIssueSolutionResponse({issueProgressState});
  internalOutputs.solutionPlannerOutput = solutionPlannerOutput;
  internalOutputs.issueProgressState = solutionPlannerOutput.nextIssueProgressState;

  return buildProcessed(solutionPlannerOutput, internalOutputs);
}

function mergeStoredIssueProgressState(storedState: unknown): IssueProgressState {
  const partialState = isRecord(storedState) ? storedState as Partial<IssueProgressState> : {};

  return {
    basicQualification: {
      ...emptyIssueProgressState.basicQualification,
      ...partialState.basicQualification,
      attemptedActionSignal: {
        ...emptyIssueProgressState.basicQualification.attemptedActionSignal,
        ...partialState.basicQualification?.attemptedActionSignal
      }
    },
    similarTopic: {
      ragSearch: {
        ...emptyIssueProgressState.similarTopic.ragSearch,
        ...partialState.similarTopic?.ragSearch
      },
      analysis: {
        ...emptyIssueProgressState.similarTopic.analysis,
        ...partialState.similarTopic?.analysis
      }
    },
    deepQualification: {
      ...emptyIssueProgressState.deepQualification,
      ...partialState.deepQualification
    },
    solution: {
      ...emptyIssueProgressState.solution,
      ...partialState.solution
    }
  };
}

function isBasicQualificationSufficient(issueProgressState: IssueProgressState): boolean {
  return issueProgressState.basicQualification.fields.length > 0 &&
    issueProgressState.basicQualification.missingRequiredFields.length === 0;
}

function isDeepQualificationSufficient(issueProgressState: IssueProgressState): boolean {
  return issueProgressState.deepQualification.fields.length > 0 &&
    issueProgressState.deepQualification.missingRequiredFields.length === 0;
}

function buildIssueTopicSummary(topicBranchInput: RoutedTopicBranchInput["topicBranchInput"]): string {
  return (
    topicBranchInput.topicUpdatePlan.topicIdentity.summary ??
    topicBranchInput.currentTopic?.summary ??
    topicBranchInput.sourceUnderstandings.map((understanding) => understanding.summary).filter(Boolean).join(" ")
  ) || topicBranchInput.currentUserMessage.content || "Support issue";
}

function buildEmptyIssueResolutionInternalOutputs(): IssueResolutionInternalOutputs {
  return {
    issueProgressState: null,
    basicQualificationAssessOutput: null,
    basicQualificationPlannerOutput: null,
    similarTopicSearchOutput: null,
    similarTopicAnalysisOutput: null,
    similarTopicDisambiguationPlannerOutput: null,
    deepQualificationAssessOutput: null,
    deepQualificationPlannerOutput: null,
    solutionExtractionOutput: null,
    solutionPlannerOutput: null
  };
}

function buildProcessed(plan: IssueStepPlan, internalOutputs: IssueResolutionInternalOutputs): IssueResolutionBranchOutput {
  return {
    status: "processed",
    fallbackReason: null,
    say: plan.say,
    internalOutputs: {
      ...internalOutputs,
      issueProgressState: plan.nextIssueProgressState
    }
  };
}

function buildFallback(fallbackReason: unknown, internalOutputs: IssueResolutionInternalOutputs): IssueResolutionBranchOutput {
  return {
    status: "fallback",
    fallbackReason,
    say: null,
    internalOutputs
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export {runIssueResolutionBranch};
export type {
  IssueAttemptedActionSignal,
  IssueFieldRequirement,
  IssueFieldSpec,
  IssueFieldStatus,
  IssueProgressState,
  IssueQualificationField,
  IssueResolutionBranchOutput,
  IssueResolutionInternalOutputs,
  IssueStepPlan,
  SimilarIssueTopicCandidate
};
