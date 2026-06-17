import type {
  LLMMessage
} from "../../../llm/llm-client";

import type {
  ResponsePlanningPolicy,
  SupportResponsePlan
} from "../plan-support-response/typesPlanSupportResponse.types";

type JsonLike = unknown;

export type RenderedMessagePurpose =
  | "support_response"
  | "clarification_request"
  | "standard_only"
  | "handover"
  | "mixed"
  | "safety_or_boundary"
  | "fallback";

export type RenderedMessage = {
  messageId: string;
  messageOrder: number;
  purpose: RenderedMessagePurpose;
  relatedPlannedMessageOrders: number[];
  content: string;
};

export type RenderedSupportResponse = {
  renderedMessages: RenderedMessage[];
  finalResponseText: string;
  internalRenderingNotes: string;
};

export type RenderSupportResponseInput = {
  latestUserMessageContent: string;

  responsePlan?: SupportResponsePlan | null;

  textSurfaceAnalysis?: JsonLike;
  standardResponseFragments: JsonLike[];
  supportResponseCues?: JsonLike[];

  textUnderstandings?: JsonLike[];
  topicUpdateProposals?: JsonLike[];
  existingTopics?: JsonLike[];

  knowledgeEnrichmentPlan?: JsonLike;
  retrievedSupportKnowledge?: JsonLike[];
  synthesizedRetrievedKnowledge?: JsonLike | null;

  recentInteractionContext?: JsonLike;
  responsePlanningPolicy?: Partial<ResponsePlanningPolicy>;

  channel?: string;
};

export type BuildRenderSupportResponsePromptInput = RenderSupportResponseInput;

export type RenderSupportResponsePrompt = {
  messages: LLMMessage[];
};

export type RequestRenderSupportResponseInput = {
  prompt: RenderSupportResponsePrompt;
};

export type RawRenderSupportResponse = {
  status: "completed" | "failed";
  parsedResponse?: unknown;
  rawResponse?: string;
  error?: {
    message: string;
  };
};

export type RawRenderedMessage = {
  messageId?: unknown;
  messageOrder?: unknown;
  purpose?: unknown;
  relatedPlannedMessageOrders?: unknown;
  content?: unknown;
};

export type RawRenderedSupportResponse = {
  renderedMessages?: unknown;
  finalResponseText?: unknown;
  internalRenderingNotes?: unknown;
};

export type FormatRenderSupportResponseOutputInput = {
  input: RenderSupportResponseInput;
  rawRenderSupportResponse: RawRenderSupportResponse;
};

export type FormatRenderSupportResponseOutput = {
  renderedResponse: RenderedSupportResponse;
  validation: {
    status: "valid" | "fallback";
    reason?: string;
    droppedItems?: string[];
  };
};
