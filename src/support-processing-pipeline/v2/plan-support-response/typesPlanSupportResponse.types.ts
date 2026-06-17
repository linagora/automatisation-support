import type {
  LLMMessage
} from "../../../llm/llm-client";

type JsonLike = unknown;

export type ResponseStrategy =
  | "single_response"
  | "multi_part_response"
  | "multiple_messages"
  | "human_review_needed";

export type ResponseMode =
  | "answer_support_request"
  | "ask_clarifying_questions"
  | "confirm_information_received"
  | "provide_next_steps"
  | "acknowledge_and_wait"
  | "handover_or_escalation"
  | "mixed";

export type PlannedMessageRole =
  | "support_answer"
  | "clarification_request"
  | "standard_acknowledgement"
  | "handover_response"
  | "follow_up"
  | "safety_or_boundary";

export type KnowledgeStatus =
  | "no_knowledge_needed"
  | "knowledge_missing"
  | "knowledge_available"
  | "rag_not_enabled";

export type QuestionPriority = "high" | "medium" | "low";

export type ResponsePlanningPolicy = {
  supportStrictness: "low" | "standard" | "high";
  botAutonomy: "low" | "standard" | "high";
  userAutonomy: "unknown" | "low" | "standard" | "high";
  customerToneProfile: "standard" | "institutional" | "friendly" | "concise";
  maxQuestionsPerTopic: number;
  maxTotalQuestions: number;
};

export type PlannedResponseMessage = {
  messageOrder: number;
  messageRole: PlannedMessageRole;
  relatedTopicIds: string[];
  relatedProposalIds: string[];
  relatedUnderstandingIds: string[];
  goal: string;
  instructionsToRenderer: string;
  mustMention: string[];
  mustAsk: string[];
  mustAvoid: string[];
  knowledgeStatus: KnowledgeStatus;
  internalRationale: string;
};

export type PlannedQuestion = {
  questionId: string;
  appliesToTopicIds: string[];
  fieldNames: string[];
  wordingInstruction: string;
  reason: string;
  priority: QuestionPriority;
};

export type SupportResponsePlan = {
  responsePlanId: string;
  responseStrategy: ResponseStrategy;
  responseMode: ResponseMode;
  rendererInstructions: string;
  plannedMessages: PlannedResponseMessage[];
  commonQuestions: PlannedQuestion[];
  topicSpecificQuestions: PlannedQuestion[];
  globalMustInclude: string[];
  globalMustAvoid: string[];
  standardHandlingInstructions: string | null;
  cueHandlingInstructions: string | null;
  internalRationale: string;
};

export type BuildPlanSupportResponsePromptInput = {
  latestUserMessageContent: string;
  textSurfaceAnalysis: JsonLike;
  standardResponseFragments: JsonLike[];
  supportResponseCues: JsonLike[];
  textUnderstandings: JsonLike[];
  topicUpdateProposals: JsonLike[];
  existingTopics: JsonLike[];
  knowledgeEnrichmentPlan: JsonLike;
  retrievedSupportKnowledge: JsonLike[];
  synthesizedRetrievedKnowledge: JsonLike | null;
  recentInteractionContext: JsonLike;
  extractableFieldCatalog?: JsonLike;
  responsePlanningPolicy?: Partial<ResponsePlanningPolicy>;
};

export type PlanSupportResponseInput = BuildPlanSupportResponsePromptInput;

export type PlanSupportResponsePrompt = {
  messages: LLMMessage[];
};

export type RequestPlanSupportResponseInput = {
  prompt: PlanSupportResponsePrompt;
};

export type RawPlanSupportResponse = {
  status: "completed" | "failed";
  parsedResponse?: unknown;
  rawResponse?: string;
  error?: {
    message: string;
  };
};

export type RawPlannedResponseMessage = {
  messageOrder?: unknown;
  messageRole?: unknown;
  relatedTopicIds?: unknown;
  relatedProposalIds?: unknown;
  relatedUnderstandingIds?: unknown;
  goal?: unknown;
  instructionsToRenderer?: unknown;
  mustMention?: unknown;
  mustAsk?: unknown;
  mustAvoid?: unknown;
  knowledgeStatus?: unknown;
  internalRationale?: unknown;
};

export type RawPlannedQuestion = {
  questionId?: unknown;
  appliesToTopicIds?: unknown;
  fieldNames?: unknown;
  wordingInstruction?: unknown;
  reason?: unknown;
  priority?: unknown;
};

export type RawSupportResponsePlan = {
  responsePlanId?: unknown;
  responseStrategy?: unknown;
  responseMode?: unknown;
  rendererInstructions?: unknown;
  plannedMessages?: unknown;
  commonQuestions?: unknown;
  topicSpecificQuestions?: unknown;
  globalMustInclude?: unknown;
  globalMustAvoid?: unknown;
  standardHandlingInstructions?: unknown;
  cueHandlingInstructions?: unknown;
  internalRationale?: unknown;
};

export type FormatPlanSupportResponseOutputInput = {
  input: PlanSupportResponseInput;
  rawPlanSupportResponse: RawPlanSupportResponse;
};

export type FormatPlanSupportResponseOutput = {
  responsePlan: SupportResponsePlan;
  validation: {
    status: "valid" | "fallback";
    reason?: string;
    droppedItems?: string[];
  };
};
