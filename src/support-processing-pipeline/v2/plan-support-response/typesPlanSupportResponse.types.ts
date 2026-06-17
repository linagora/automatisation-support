import type {
  LLMMessage
} from "../../../llm/llm-client";

type JsonLike = unknown;

export type ResponsePlanningPolicy = {
  supportStrictness: "low" | "standard" | "high";
  botAutonomy: "low" | "standard" | "high";
  userAutonomy: "unknown" | "low" | "standard" | "high";
  customerToneProfile: "standard" | "institutional" | "friendly" | "concise";
  maxQuestionsPerTopic: number;
  maxTotalQuestions: number;
};

export type KnowledgeMode =
  | "knowledge_available"
  | "knowledge_missing"
  | "rag_not_enabled";

export type AllowedResponseMove =
  | "acknowledge"
  | "ask_missing_fields"
  | "answer_with_knowledge"
  | "standard_acknowledgement"
  | "handover_acknowledgement"
  | "safety_or_boundary";

export type KnowledgeGate = {
  knowledgeMode: KnowledgeMode;
  solutionAllowed: boolean;
  allowedMoves: AllowedResponseMove[];
  reason: string;
};

export type QuestionDecision = {
  shouldAskQuestion: boolean;
  plannedQuestionCount: number;
  fieldNames: string[];
  questionInstruction: string | null;
  reason: string;
};

export type RendererTask = {
  targetLanguage: string;
  prompt: string;
  questionFieldNames: string[];
  forbiddenClaims: string[];
};

export type SupportResponsePlan = {
  responsePlanId: string;
  knowledgeGate: KnowledgeGate;
  questionDecision: QuestionDecision;
  rendererTask: RendererTask;
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

export type RawKnowledgeGate = {
  knowledgeMode?: unknown;
  solutionAllowed?: unknown;
  allowedMoves?: unknown;
  reason?: unknown;
};

export type RawQuestionDecision = {
  shouldAskQuestion?: unknown;
  plannedQuestionCount?: unknown;
  fieldNames?: unknown;
  questionInstruction?: unknown;
  reason?: unknown;
};

export type RawRendererTask = {
  targetLanguage?: unknown;
  prompt?: unknown;
  questionFieldNames?: unknown;
  forbiddenClaims?: unknown;
};

export type RawSupportResponsePlan = {
  responsePlanId?: unknown;
  knowledgeGate?: unknown;
  questionDecision?: unknown;
  rendererTask?: unknown;
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
