/**
 * Shared types for the support processing pipeline.
 */

type MaybePromise<T> = T | Promise<T>;

type PipelineStep<TInput, TOutput> = (
  input: TInput
) => MaybePromise<TOutput>;

/* =====================================================
 * Shared internal value types
 * ===================================================== */

type TopicCategory =
  | "billing"
  | "access_security"
  | "bug"
  | "request"
  | "question_faq"
  | "other";

type OutcomeTestedAction =
  | "worked"
  | "failed"
  | "partially_worked"
  | "not_tried"
  | "unclear";

type SignalType =
  | "thanks_neutral"
  | "thanks_positive"
  | "positive_feedback"
  | "negative_feedback"
  | "disappointment"
  | "churn_intent"
  | "waiting"
  | "apology"
  | "closure"
  | "time_sensitive"
  | "impolite"
  | "complaint_without_actionable_detail"
  | "communication_feedback"
  | "pricing_feedback"
  | "feature_loss_feedback"
  | "confirmation_without_new_field";

type ScopeBoundaryType =
  | "generic_out_of_scope"
  | "non_support_linagora"
  | "unrelated_request"
  | "spam_or_commercial";

type ResponseMessageType =
  | "normal"
  | "warning"
  | "support_handover"
  | "error"
  | "success";

/* =====================================================
 * 1. latestUserMessage
 * ===================================================== */

export type LatestUserMessage = {
  id: string;
  content: string;
  channel: "email" | "twake_chat" | "other";
  sentAt: string;
};

/* =====================================================
 * 2. latestUserAttachments
 * ===================================================== */

export type LatestUserAttachment = {
  id: string;
  filename: string;
  sizeInBytes: number;
  accessUrl?: string;
  channel: "email" | "twake_chat" | "other";
  sentAt: string;
};

/* =====================================================
 * 3.1 accountTrustStatus
 * ===================================================== */

export type AccountTrustStatus = {
  status: "trusted" | "neutral" | "suspicious";
  reasons: (
    | "longHistory"
    | "noSuspiciousActivity"
    | "payingCustomer"
    | "highValueAccount"
    | "legitimateSupportInteractions"
    | "repeatedValidIssues"
    | "verifiedEmailDomain"
    | "recentAccountCreation"
    | "suspiciousActivity"
    | "paymentFailure"
    | "abusiveBehavior"
  )[];
};

/* =====================================================
 * 3.2 accountProfile
 * ===================================================== */

export type AccountProfile = {
  accountType: "individual" | "company";
  actualPlan: "free" | "paid" | "custom";
  paymentStatus: "up_to_date" | "late" | "failed" | "refunded" | "unknown";
  planHistory: {
    plan: "free" | "paid" | "custom";
    startedAt: string;
    endedAt: string | null;
  }[];
  createdAt: string;
  daysSinceCreation: number;
};

/* =====================================================
 * 3.3 accountInteractionTraits
 * ===================================================== */

export type AccountInteractionTraits = {
  labels: (
    | "autonomous"
    | "needsGuidance"
    | "complicated"
    | "satisfied"
    | "unsatisfied"
    | "impatient"
    | "technical"
    | "nonTechnical"
    | "recurrentRequester"
    | "atRisk"
  )[];
  lastUpdatedAt: string;
};

/* =====================================================
 * 4. supportTopicKnowledge
 * ===================================================== */

type TopicDetails = {
  feature_or_page?: string;
  provided_url?: string;
  pre_problem_state?: string;
  observed_result?: string;
  expected_result?: string;
  error_message?: string;
  platform?: string;
  account_context?: string;
  frequency?: string;
  affected_scope?: string;
  additional_context?: string;
  trigger_action?: string;
  access_action?: string;
  auth_method?: string;
  os?: string;
  device?: string;
  browser?: string;
  app_version?: string;
  server_or_instance?: string;
  affected_users?: string;
  video_available?: "yes" | "no";
  logs_available?: "yes" | "no";
  billing_issue_type?: string;
  billing_provider?: string;
  offer_or_plan?: string;
  amount?: string;
  currency?: string;
  billing_date_or_period?: string;
  gap_observed?: string;
  question_intent?: "how_to" | "is_it_possible" | "future_availability";
};

export type SupportTopicKnowledge = {
  segments_topic: {
    matched_historical_topic: "yes" | "no";
    id_topic: number;
    topic_category: TopicCategory;
    tool_or_product?: string;
    topic_action?: string;
    topic_object?: string;
    topic_label?: string;
    topic_details: TopicDetails;
    tested_action?: string;
    outcome_tested_action?: OutcomeTestedAction;
    user_goal: string;
    blocking_issue: "yes" | "no";
  }[];
};

/* =====================================================
 * 6. TurnUnderstandingDelta
 * ===================================================== */

type SignalSegment = {
  signal_verbatim: string;
  signal_types: SignalType[];
};

type ScopeBoundarySegment = {
  signal_verbatim: string;
  scope_boundary_type: ScopeBoundaryType;
};

type TurnUnderstandingTopicSegment = {
  matched_historical_topic: "yes" | "no";
  id_topic: number;
  topic_category?: TopicCategory;
  tool_or_product?: string;
  topic_action?: string;
  topic_object?: string;
  topic_label?: string;
  topic_details?: Partial<TopicDetails>;
  tested_action?: string;
  outcome_tested_action?: OutcomeTestedAction;
  user_goal?: string;
  blocking_issue?: "yes" | "no";
};

export type TurnUnderstandingDelta = {
  user_language: string;
  warning_comprehension: "yes" | "no";
  segments_topic: TurnUnderstandingTopicSegment[];
  segments_signal: SignalSegment[];
  segments_scope_boundary: ScopeBoundarySegment[];
};

/* =====================================================
 * 5. conversationHistory
 * ===================================================== */

export type ConversationHistory = {
  id: string;
  message_id: string;
  role: "user" | "bot" | "system";
  created_at: string;
  turnUnderstandingDelta?: TurnUnderstandingDelta;
  responsePlan?: ResponsePlan;
}[];

/* =====================================================
 * 7. decisionSearchingSolution
 * ===================================================== */

export type DecisionSearchingSolution = {
  shouldSearchSolution: boolean;
  detected: {
    topicsQualificationResult: "qualified" | "unqualified" | "partial";
    solutionLikelihoodResult: "likely" | "unlikely" | "unknown";
  };
};

/* =====================================================
 * 8. possibleSolutions
 * ===================================================== */

export type PossibleSolution = {
  id: string;
  solution: string;
  confidence?: number;
  source?: "rag_base" | "ticket_base" | "documentation" | "manual" | "other";
};

/* =====================================================
 * 9. responsePlan
 * ===================================================== */

type MainResponse =
  | {
      type: "ask_info";
      fields_requested: string[];
    }
  | {
      type: "direct_answer";
      solution: {
        id: string;
        solution: string;
      };
    }
  | {
      type: "acknowledgement";
    };

export type ResponsePlan = {
  userLanguage: "french" | "english";
  messages: {
    type: ResponseMessageType;
    response_structure: {
      warning_comprehension?: "yes" | "no";

      signal_response_alone?: SignalSegment;
      scope_boundary_response_alone?: ScopeBoundarySegment;

      politeness_opening?:
        | "understanding_1"
        | "understanding_2"
        | "salutation_and_understanding_1"
        | "none";

      topic_relation_acknowledgement?: {
        new_topics_count: number;
        existing_topic_ids: number[];
      };

      topic_response?: {
        topic_id: number;
        topic_category: TopicCategory;
        topic_label: string;
        updated_fields_acknowledgement?: Partial<TopicDetails>;
        main_response: MainResponse;
        next_step:
          | "wait_more_info"
          | "wait_apply_solution"
          | "handover_to_support"
          | "close_if_resolved";
      };

      signal_response?: SignalSegment;
      scope_boundary_response?: ScopeBoundarySegment;

      politeness_closure?:
        | "thanks_for_cooperation"
        | "available_if_needed"
        | "wait_for_user"
        | "handover_announced"
        | "none";
    };
  }[];
};

/* =====================================================
 * 10. userResponse
 * ===================================================== */

export type UserResponse = {
  messages: {
    type: ResponseMessageType;
    content: string;
  }[];
};

/* =====================================================
 * 11. Patches
 * ===================================================== */

type SupportTopicKnowledgePatch = {
  segments_topic: TurnUnderstandingTopicSegment[];
};

type ConversationHistoryPatch = ConversationHistory;

type AccountTrustStatusPatch = Partial<AccountTrustStatus>;

type AccountInteractionTraitsPatch = Partial<AccountInteractionTraits>;

export type PipelinePatches = {
  supportTopicKnowledgePatch: SupportTopicKnowledgePatch;
  conversationHistoryPatch: ConversationHistoryPatch;
  accountTrustStatusPatch?: AccountTrustStatusPatch;
  accountInteractionTraitsPatch?: AccountInteractionTraitsPatch;
};

/* =====================================================
 * Pipeline inputs / outputs
 * ===================================================== */

export type SupportProcessingPipelineInput = {
  latestUserMessage: LatestUserMessage;
  latestUserAttachments: LatestUserAttachment[];
  accountTrustStatus: AccountTrustStatus;
  accountProfile: AccountProfile;
  accountInteractionTraits: AccountInteractionTraits;
  supportTopicKnowledge: SupportTopicKnowledge;
  conversationHistory: ConversationHistory;
};

export type SupportProcessingPipelineOutput = {
  userResponse: UserResponse;
  patches: PipelinePatches;
};

/* =====================================================
 * Step inputs / outputs
 * ===================================================== */

export type MessageAnalysisInput = {
  latestUserMessage: LatestUserMessage;
  latestUserAttachments: LatestUserAttachment[];
  accountTrustStatus: AccountTrustStatus;
  supportTopicKnowledge: SupportTopicKnowledge;
  conversationHistory: ConversationHistory;
};

export type SearchDecisionInput = {
  supportTopicKnowledge: SupportTopicKnowledge;
  turnUnderstandingDelta: TurnUnderstandingDelta;
};

export type SolutionRetrievalInput = {
  supportTopicKnowledge: SupportTopicKnowledge;
  turnUnderstandingDelta: TurnUnderstandingDelta;
};

export type ResponseDecisionInput = {
  accountTrustStatus: AccountTrustStatus;
  accountProfile: AccountProfile;
  accountInteractionTraits: AccountInteractionTraits;
  supportTopicKnowledge: SupportTopicKnowledge;
  turnUnderstandingDelta: TurnUnderstandingDelta;
  possibleSolutions: PossibleSolution[];
};

export type ResponseProductionInput = {
  responsePlan: ResponsePlan;
};

export type DataProductionInput = {
  turnUnderstandingDelta: TurnUnderstandingDelta;
  responsePlan: ResponsePlan;
};

export type DataProductionOutput = {
  supportTopicKnowledgePatch: SupportTopicKnowledgePatch;
  conversationHistoryPatch: ConversationHistoryPatch;
  accountTrustStatusPatch?: AccountTrustStatusPatch;
  accountInteractionTraitsPatch?: AccountInteractionTraitsPatch;
};

/* =====================================================
 * Pipeline steps
 * ===================================================== */

export type SupportProcessingPipelineSteps = {
  runMessageAnalysis?: PipelineStep<MessageAnalysisInput, TurnUnderstandingDelta>;
  runSearchDecision?: PipelineStep<SearchDecisionInput, DecisionSearchingSolution>;
  runSolutionRetrieval?: PipelineStep<SolutionRetrievalInput, PossibleSolution[]>;
  runResponseDecision?: PipelineStep<ResponseDecisionInput, ResponsePlan>;
  runResponseProduction?: PipelineStep<ResponseProductionInput, UserResponse>;
  runDataProduction?: PipelineStep<DataProductionInput, DataProductionOutput>;
};