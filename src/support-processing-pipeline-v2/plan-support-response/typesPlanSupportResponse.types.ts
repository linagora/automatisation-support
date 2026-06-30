import type {
  LLMMessage
} from "../../llm/llm-client";
import type {
  TopicEvidence
} from "../typesSupportProcessingPipelineV2.types";

type JsonLike = unknown;

export type ResponsePlanningPolicy = {
  supportStrictness: "low" | "standard" | "high";
  botAutonomy: "low" | "standard" | "high";
  userAutonomy: "unknown" | "low" | "standard" | "high";
  customerToneProfile: "standard" | "institutional" | "friendly" | "concise";
  maxQuestionsPerTopic: number;
  maxTotalQuestions: number;
};

export type PlannedAnswerSupport =
  | "retrieved_knowledge"
  | "selected_catalog_knowledge"
  | "topic"
  | "attachment"
  | "policy";

export type PlannedAnswerPoint = {
  point: string;
  support: PlannedAnswerSupport;
};

export type PlannedAskField = {
  fieldName: string;
  goal: string;
};

export type PlannedTopicResponse = {
  topicId: string | null;
  acknowledge: string[];
  answer: PlannedAnswerPoint[];
  ask: PlannedAskField[];
  say: string[];
  review: string | null;
};

export type SupportResponsePlan = PlannedTopicResponse & {
  responsePlanId?: string;
};

export type BuildPlanSupportResponsePromptInput = {
  topicUserMessageContent: string;
  topicEvidence: TopicEvidence;
  targetLanguage?: string;
  selectedCatalogKnowledge: JsonLike;
  topicKnowledgeEnrichmentPlan: JsonLike;
  topicRetrievedKnowledgeSynthesis?: JsonLike | null;
  responsePlanningPolicy?: Partial<ResponsePlanningPolicy>;
  channel?: string;
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

export type RawPlannedAnswerPoint = {
  point?: unknown;
  support?: unknown;
};

export type RawPlannedAskField = {
  fieldName?: unknown;
  goal?: unknown;
};

export type RawSupportResponsePlan = {
  topicId?: unknown;
  acknowledge?: unknown;
  answer?: unknown;
  ask?: unknown;
  say?: unknown;
  review?: unknown;
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
