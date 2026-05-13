/**
 * Shared types for the support processing pipeline.
 */

type MaybePromise<T> = T | Promise<T>;

type PipelineStep<TInput, TOutput> = (
  input: TInput
) => MaybePromise<TOutput>;

type NonEmptyArray<T> = [T, ...T[]];

/* =====================================================
 * Shared internal value types
 * ===================================================== */

export type InputCleaningCheckName =
  | "empty_message"
  | "prompt_injection_attempt"
  | "internal_information_request"
  | "sensitive_data_request"
  | "spam_like_message"
  | "suspicious_attachments"
  | "account_trust_status";

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
  | "unrelated_request";

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
  logs_available?: "yes" | "no";
  billing_issue_type?: string;
  billing_provider?: string;
  offer_or_plan?: string;
  amount?: string;
  currency?: string;
  billing_date_or_period?: string;
  gap_observed?: string;
  question_intent?: "how_to" | "is_it_possible" | "future_availability";
  video_available?: "yes" | "no";
  image_available?: "yes" | "no";
};

export type SupportTopicKnowledge = {
  segments_topic: {
    id_topic: number;
    topic_category: TopicCategory;
    tool_or_product?: string;
    topic_action?: string;
    topic_object?: string;
    topic_label: string;
    topic_details: TopicDetails;
    tested_actions?: {
      tested_action: string;
      outcome_tested_action: OutcomeTestedAction;
    }[];
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

type ExistingTopicDelta = {
  matched_historical_topic: "yes";
  id_topic: number;
  topic_category?: TopicCategory;
  tool_or_product?: string;
  topic_action?: string;
  topic_object?: string;
  topic_label?: string;
  topic_details?: Partial<TopicDetails>;
  tested_actions?: {
    tested_action: string;
    outcome_tested_action: OutcomeTestedAction;
  }[];
  user_goal?: string;
  blocking_issue?: "yes" | "no";
};

type NewTopicDelta = {
  matched_historical_topic: "no";
  id_topic: number;
  topic_category: TopicCategory;
  tool_or_product?: string;
  topic_action?: string;
  topic_object?: string;
  topic_label: string;
  topic_details: TopicDetails;
  tested_actions?: {
    tested_action: string;
    outcome_tested_action: OutcomeTestedAction;
  }[];
  user_goal: string;
  blocking_issue: "yes" | "no";
};

type TurnUnderstandingTopicSegment =
  | ExistingTopicDelta
  | NewTopicDelta;

export type TurnUnderstandingDelta = {
  user_language: string;
  warning_comprehension: "yes" | "no";
  warning_comprehension_verbatim?: string[];
  input_cleaning_detected?: InputCleaningCheckName[];
  segments_topic: TurnUnderstandingTopicSegment[];
  segments_signal: SignalSegment[];
  segments_scope_boundary: ScopeBoundarySegment[];
};

/* =====================================================
 * 5. conversationHistory
 * ===================================================== */

type BaseConversationHistoryEvent = {
  id: string;
  message_id: string;
  created_at: string;
};

type UserConversationHistoryEvent = BaseConversationHistoryEvent & {
  role: "user";
  turnUnderstandingDelta: TurnUnderstandingDelta;
  responsePlan?: never;
};

type BotConversationHistoryEvent = BaseConversationHistoryEvent & {
  role: "bot";
  responsePlan: ResponsePlan;
  turnUnderstandingDelta?: never;
};

type SystemConversationHistoryEvent = BaseConversationHistoryEvent & {
  role: "system";
  note: string;
  turnUnderstandingDelta?: never;
  responsePlan?: never;
};

type ConversationHistoryEvent =
  | UserConversationHistoryEvent
  | BotConversationHistoryEvent
  | SystemConversationHistoryEvent;

export type ConversationHistory = ConversationHistoryEvent[];

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

type WarningComprehensionPlanMessage = {
  warning_comprehension: "yes";
  unclear_segments_verbatim?: string[];
};

type InputCleaningPlanMessage = {
  detected_checks: InputCleaningCheckName[];
};

type ScopeBoundaryPlanMessage = ScopeBoundarySegment;

type SignalPlanMessage = SignalSegment;

type HandoverPlanMessage = {
  topic_id?: number;
  reason?: string;
};

type TopicAskFieldsResponse = {
  main_response: "ask_fields";
  fields_requested: NonEmptyArray<string>;
  next_step: "wait_more_info" | "handover";
};

type TopicProposeSolutionResponse = {
  main_response: "propose_solution";
  solutions: NonEmptyArray<{
    id: string;
    solution: string;
  }>;
  next_step:
    | "wait_apply_solution"
    | "close_if_resolved"
    | "handover";
};

type TopicAcknowledgementResponse = {
  main_response: "acknowledgement";
  next_step: "wait_more_info" | "close_if_resolved" | "handover";
};

type TopicMainResponse =
  | TopicAskFieldsResponse
  | TopicProposeSolutionResponse
  | TopicAcknowledgementResponse;

type TopicPlanMessage = {
  politeness_opening?:
    | "understanding_1"
    | "understanding_2"
    | "salutation_and_understanding_1"
    | "salutation_and_understanding_2";

  topic_relation_acknowledgement?: {
    new_topics_count: number;
    matched_historical_topic_count: number;
  };

  topic_response: {
    topic_id: number;
    topic_category: TopicCategory;
    topic_label: string;
    updated_fields_acknowledgement?: Partial<TopicDetails>;
  } & TopicMainResponse;

  politeness_closure?:
    | "thanks_for_cooperation"
    | "available_if_needed"
    | "wait_for_user"
    | "handover_announced";
};

export type ResponsePlan = {
  responseLanguage: "french" | "english";

  // runResponseProduction must generate messages in this order:
  // 1. warningComprehensionPlanMessage
  // 2. inputCleaningPlanMessages
  // 3. scopeBoundaryPlanMessages
  // 4. topicPlanMessages
  // 5. signalPlanMessages
  // 6. handoverPlanMessages
  messagesPlan: {
    warningComprehensionPlanMessage?: WarningComprehensionPlanMessage;
    inputCleaningPlanMessages: InputCleaningPlanMessage[];
    scopeBoundaryPlanMessages: ScopeBoundaryPlanMessage[];
    topicPlanMessages: TopicPlanMessage[];
    signalPlanMessages: SignalPlanMessage[];
    handoverPlanMessages: HandoverPlanMessage[];
  };
};

/* =====================================================
 * 10. userResponse
 * ===================================================== */

export type UserResponse = {
  messages: {
    type:
      | "warning_comprehension"
      | "input_cleaning"
      | "scope_boundary"
      | "topic_response"
      | "signal_response"
      | "handover";
    content: string;
  }[];
};

/* =====================================================
 * 11. Patches
 * ===================================================== */

type SupportTopicKnowledgePatch = {
  topicSegmentDeltas: TurnUnderstandingTopicSegment[];
};

type ConversationHistoryPatch = ConversationHistoryEvent[];

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

export type MessageAnalysisOutput = TurnUnderstandingDelta;

export type SearchDecisionInput = {
  supportTopicKnowledge: SupportTopicKnowledge;
  turnUnderstandingDelta: TurnUnderstandingDelta;
};

export type SearchDecisionOutput = DecisionSearchingSolution;

export type SolutionRetrievalInput = {
  supportTopicKnowledge: SupportTopicKnowledge;
  turnUnderstandingDelta: TurnUnderstandingDelta;
};

export type SolutionRetrievalOutput = PossibleSolution[];

export type ResponseDecisionInput = {
  accountTrustStatus: AccountTrustStatus;
  accountProfile: AccountProfile;
  accountInteractionTraits: AccountInteractionTraits;
  supportTopicKnowledge: SupportTopicKnowledge;
  turnUnderstandingDelta: TurnUnderstandingDelta;
  possibleSolutions: PossibleSolution[];
};

export type ResponseDecisionOutput = ResponsePlan;

export type ResponseProductionInput = {
  responsePlan: ResponsePlan;
};

export type ResponseProductionOutput = UserResponse;

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
  runMessageAnalysis?: PipelineStep<MessageAnalysisInput, MessageAnalysisOutput>;
  runSearchDecision?: PipelineStep<SearchDecisionInput, SearchDecisionOutput>;
  runSolutionRetrieval?: PipelineStep<
    SolutionRetrievalInput,
    SolutionRetrievalOutput
  >;
  runResponseDecision?: PipelineStep<ResponseDecisionInput, ResponseDecisionOutput>;
  runResponseProduction?: PipelineStep<
    ResponseProductionInput,
    ResponseProductionOutput
  >;
  runDataProduction?: PipelineStep<DataProductionInput, DataProductionOutput>;
};