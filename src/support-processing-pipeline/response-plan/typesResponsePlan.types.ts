import type {
  TurnAttachments
} from "../typesSupportProcessingPipeline.types";

type UnknownRecord = Record<string, unknown>;

type SegmentList<T = UnknownRecord> = T[];

type TopicCategory =
  | "billing"
  | "access_security"
  | "bug"
  | "request"
  | "question_faq"
  | "other";

type TopicDetails = UnknownRecord;

type TestedSolution = UnknownRecord;

type SupportTopicKnowledgeForResponsePlan = {
  segments_topic: {
    id_topic: number;
    topic_category: TopicCategory;
    tool_or_product?: string;
    topic_action?: string;
    topic_object?: string;
    topic_label?: string;
  }[];
};

type TopicSegment = {
  matched_historical_topic: "yes" | "no";
  id_topic: number;
  topic_category?: TopicCategory;
  tool_or_product?: string;
  topic_action?: string;
  topic_object?: string;
  topic_label?: string;
  topic_details?: TopicDetails;
  tested_solutions?: TestedSolution[];
};

type TurnUnderstandingDeltaForResponsePlan = {
  user_language?: string | null;
  segments_lack_comprehension: SegmentList;
  segments_topic: SegmentList<TopicSegment>;
  segments_signal: SegmentList;
  segments_scope_boundary: SegmentList;
  segments_suspicious: SegmentList;
  attachments?: TurnAttachments;
};

export type SecurityGateSummary = {
  gateChecked: Record<string, unknown>;
  gateFailed: unknown[];
};

export type SecurityGatePlanMessage = {
  gateFailed: unknown[];
};

export type SuspiciousPlanMessage = {
  segments_suspicious: SegmentList;
};

export type LackComprehensionPlanMessage = {
  segments_lack_comprehension: SegmentList;
};

export type TopicMainResponse =
  | {
      type: "ask_fields";
      details: {
        fields_requested: [string, ...string[]];
      };
    }
  | {
      type: "propose_solution";
      details: {
        solutions: [TopicSolution, ...TopicSolution[]];
      };
    }
  | {
      type: "acknowledgement";
    };

export type TopicSolution = {
  id: string;
  solution: string;
};

export type TopicNextStep =
  | "wait_more_info"
  | "wait_apply_solution"
  | "close_if_resolved"
  | "handover"
  | "wait_for_support";

export type OptionalEvidenceRequest = {
  types: ("screenshot" | "video")[];
  reason: "bug_visual_context_helpful";
};

export type DecisionSearchingSolutionForResponsePlan = {
  topics: {
    topic_id: number;
    type: "ask_more_info" | "acknowledgement" | "solution_searching";
    missing_fields?: string[];
    optional_evidence_requested?: OptionalEvidenceRequest;
  }[];
};

export type TopicPlanMessage = {
  politeness_opening:
    | "understanding_1"
    | "understanding_2"
    | "salutation_and_understanding_1"
    | "salutation_and_understanding_2";
  topic_relation_acknowledgement: {
    no_matched_historical_topic_count: number;
    matched_historical_topic_count: number;
  };
  attachments?: TurnAttachments;
  topics_responses: {
    topic_response: {
      title: {
        topic_id: number;
        topic_category?: TopicCategory;
        tool_or_product?: string;
        topic_action?: string;
        topic_object?: string;
        matched_historical_topic: boolean;
      };
      updated_fields_acknowledgement: {
        topic_details?: TopicDetails;
        tested_solutions?: TestedSolution[];
      };
      optional_evidence_requested?: OptionalEvidenceRequest;
      main_response: TopicMainResponse;
      next_step: TopicNextStep;
    };
  }[];
  politeness_closure:
    | "thanks_for_cooperation1"
    | "thanks_for_cooperation2";
};

export type HandoverPlanMessage = UnknownRecord;

export type MessagesPlan = {
  securityGatePlanMessage?: SecurityGatePlanMessage;
  suspiciousPlanMessage?: SuspiciousPlanMessage;
  lackComprehensionPlanMessage?: LackComprehensionPlanMessage;
  scopeBoundaryPlanMessages: SegmentList;
  topicPlanMessages: TopicPlanMessage[];
  signalPlanMessages: SegmentList;
  handoverPlanMessages: HandoverPlanMessage[];
};

export type ResponsePlan = {
  responseLanguage: string;
  messagesPlan: MessagesPlan;
};

export type ResponsePlanInput = {
  securityGateSummary: SecurityGateSummary;
  accountTrustStatus: unknown;
  accountProfile: unknown;
  accountInteractionTraits: unknown;
  supportTopicKnowledge: SupportTopicKnowledgeForResponsePlan;
  turnUnderstandingDelta: TurnUnderstandingDeltaForResponsePlan;
  possibleSolutions: TopicSolution[];
  decisionSearchingSolution: DecisionSearchingSolutionForResponsePlan;
};

export type TopicPlanInput = {
  supportTopicKnowledge: SupportTopicKnowledgeForResponsePlan;
  turnUnderstandingDelta: TurnUnderstandingDeltaForResponsePlan;
  possibleSolutions: TopicSolution[];
  decisionSearchingSolution: DecisionSearchingSolutionForResponsePlan;
};

export type HandoverPlanInput = {
  turnUnderstandingDelta: TurnUnderstandingDeltaForResponsePlan;
  responsePlan: ResponsePlan;
  securityGateSummary: SecurityGateSummary;
  accountTrustStatus: unknown;
  accountProfile: unknown;
  accountInteractionTraits: unknown;
};
