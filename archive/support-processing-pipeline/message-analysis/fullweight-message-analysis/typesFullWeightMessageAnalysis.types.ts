import type {
  ConversationHistory,
  LatestUserMessage,
  SupportTopicKnowledge,
  TurnUnderstandingDelta,
} from "../../typesSupportProcessingPipeline.types";
import type {
  AttachmentAnalysis
} from "../typesMessageAnalysis.types";

export type LightWeightMessageAnalysis = Partial<
  Pick<
    TurnUnderstandingDelta,
    | "user_language"
    | "segments_signal"
    | "segments_scope_boundary"
    | "segments_suspicious"
  >
> & {
  shouldRunSupportMessageAnalysis?: boolean;
};

export type FullWeightMessageAnalysisInput = {
  latestUserMessage: LatestUserMessage;
  supportTopicKnowledge: SupportTopicKnowledge;
  conversationHistory: ConversationHistory;
  attachmentAnalysis?: AttachmentAnalysis;
  lightWeightMessageAnalysis?: LightWeightMessageAnalysis;
};

export type BuildFullWeightPromptInput = {
  latestUserMessage: LatestUserMessage;
  supportTopicKnowledge: SupportTopicKnowledge;
  conversationHistory: ConversationHistory;
  attachmentAnalysis?: AttachmentAnalysis;
  lightWeightMessageAnalysis?: LightWeightMessageAnalysis;
};

export type FullWeightPrompt = {
  systemPrompt: string;
  userPrompt: string;
};

export type RequestTextAnalysisInput = {
  fullWeightPrompt: FullWeightPrompt;
};

export type RawFullWeightMessageAnalysis = {
  status: "completed" | "failed";
  parsedResponse?: unknown;
  rawResponse?: string;
  error?: {
    message: string;
  };
};

export type FormatFullWeightMessageAnalysisOutputInput = {
  rawFullWeightMessageAnalysis: RawFullWeightMessageAnalysis;
};

export type FullWeightOutputCheckName =
  | "llm_call_completed"
  | "llm_response_parsed"
  | "analysis_is_object"
  | "user_language_valid"
  | "segments_lack_comprehension_valid"
  | "segments_topic_valid"
  | "segments_signal_valid"
  | "segments_scope_boundary_valid"
  | "segments_suspicious_valid";

export type FullWeightCleanAnalysis = Partial<
  Pick<
    TurnUnderstandingDelta,
    | "user_language"
    | "segments_lack_comprehension"
    | "segments_topic"
    | "segments_signal"
    | "segments_scope_boundary"
    | "segments_suspicious"
  >
>;

export type FullWeightMessageAnalysisOutput = {
  decision: {
    route: "continue" | "stop";
  };
  history: {
    checked: FullWeightOutputCheckName[];
    failed: FullWeightOutputCheckName[];
    refusalReason?: string;
  };
  analysis?: FullWeightCleanAnalysis;
  error?: {
    message: string;
    rawResponse?: string;
  };
};

export type RequestFullWeightAnalysisInput = {
  fullWeightPrompt: FullWeightPrompt;
};
