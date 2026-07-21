import type {RoutedBranchOutput, TopicBranchContext, TopicPlannerOutput} from "../runTopicBranch";

export type IssueFieldStatus =
  | "missing_not_asked"
  | "asked_once"
  | "asked_again"
  | "obtained"
  | "user_declared_unavailable";

export type IssueFieldRequirement = "required" | "recommended";

export type IssueFieldSpec = {
  key: string;
  label: string;
  requirement: IssueFieldRequirement;
  askPrompt: string;
};

export type IssueQualificationField = {
  key: string;
  label: string;
  requirement: IssueFieldRequirement;
  value: string | number | boolean | null;
  evidence: string | null;
  status: IssueFieldStatus;
  askedCount: number;
};

export type SimilarIssueTopicCandidate = {
  topicId: string;
  title: string;
  summary: string;
  score: number | null;
  usefulDeepFieldKeys: string[];
  solutionSummary?: string | null;
};

export type IssueProgressState = {
  basicQualification: {
    complete: boolean;
    fields: IssueQualificationField[];
    missingRequiredFields: string[];
    missingRecommendedFields: string[];
    nextAskFields: string[];
  };
  similarTopic: {
    complete: boolean;
    status: "not_searched" | "identified" | "unclear" | "absent" | "fallback";
    candidateTopics: SimilarIssueTopicCandidate[];
    selectedTopic: SimilarIssueTopicCandidate | null;
    disambiguationQuestion: string | null;
  };
  deepQualification: {
    complete: boolean;
    mode: "similar_topic_guided" | "domain_generic" | null;
    fields: IssueQualificationField[];
    missingFields: string[];
    nextAskFields: string[];
  };
  solution: {
    complete: boolean;
    status: "not_started" | "available" | "not_found" | "not_relevant" | "provided" | "awaiting_user_result" | "fallback";
    solution: string | null;
    confidence: number | null;
  };
};

export type IssueResolutionBranchInput = {
  topicBranchContext: TopicBranchContext;
};

export type IssueResolutionBranchOutput = RoutedBranchOutput & {
  issueProgressState?: IssueProgressState;
};

export type IssueStepPlan = {
  topicPlannerOutput: TopicPlannerOutput;
  nextIssueProgressState: IssueProgressState;
};
