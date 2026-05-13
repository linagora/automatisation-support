/**
 * Shared types for the message analysis pipeline.
 */

import type {
  AccountTrustStatus,
  ConversationHistory,
  InputCleaningCheckName,
  LatestUserAttachment,
  LatestUserMessage,
  MessageAnalysisInput,
  MessageAnalysisOutput,
  SupportTopicKnowledge,
  TurnUnderstandingDelta
} from "../typesSupportProcessingPipeline.types";

type MaybePromise<T> = T | Promise<T>;

type MessageAnalysisStep<TInput, TOutput> = (
  input: TInput
) => MaybePromise<TOutput>;

/* =====================================================
 * 1, 2, 3.1, 4, 5. messageAnalysisInput
 * ===================================================== */

export type {
  MessageAnalysisInput,
  MessageAnalysisOutput
};

/* =====================================================
 * 6.1 rawInputSafetyGate
 * ===================================================== */

export type RawInputSafetyGateInput = {
  latestUserMessage: LatestUserMessage;
  latestUserAttachments: LatestUserAttachment[];
};

export type RawInputSafetyGate = {
  inputClean: boolean;
  failedChecks: InputCleaningCheckName[];
};

/* =====================================================
 * 6.2 rawInputTrustDecision
 * ===================================================== */

export type RawInputTrustConsistencyInput = {
  rawInputSafetyGate: RawInputSafetyGate;
  accountTrustStatus: AccountTrustStatus;
};

export type RawInputTrustDecision =
  | {
      status: "decided";
      route:
        | "continue"
        | "stop"
        | "review_with_llm_truster";
    }
  | {
      status: "skipped";
    };

/* =====================================================
 * 6.3 rawInputSafetyReview
 * ===================================================== */

export type RawInputSafetyReviewInput = {
  latestUserMessage: LatestUserMessage;
  rawInputSafetyGate: RawInputSafetyGate;
  accountTrustStatus: AccountTrustStatus;
};

export type RawInputSafetyReview =
  | {
      status: "reviewed";
      route:
        | "continue"
        | "stop";
      reason: string;
    }
  | {
      status: "skipped";
    };

/* =====================================================
 * 6.4 attachmentAnalysis
 * ===================================================== */

export type AttachmentAnalysisInput = {
  latestUserMessage: LatestUserMessage;
  latestUserAttachments: LatestUserAttachment[];
};

export type AttachmentAnalysis = {
  status: "analyzed" | "failed" | "skipped";
  analysis?: {
    summary: string;
    other?: string;
  };
};

/* =====================================================
 * 6.5 attachmentAnalysisSafetyGate
 * ===================================================== */

export type AttachmentAnalysisSafetyGateInput = {
  attachmentAnalysis: AttachmentAnalysis;
};

export type AttachmentAnalysisSafetyGate =
  | {
      status: "checked";
      inputClean: boolean;
      failedChecks: InputCleaningCheckName[];
    }
  | {
      status: "skipped";
    };

/* =====================================================
 * 6.6 attachmentTrustDecision
 * ===================================================== */

export type AttachmentTrustConsistencyInput = {
  attachmentAnalysisSafetyGate: AttachmentAnalysisSafetyGate;
  accountTrustStatus: AccountTrustStatus;
};

export type AttachmentTrustDecision =
  | {
      status: "decided";
      route:
        | "continue"
        | "stop"
        | "review_with_llm_truster";
    }
  | {
      status: "skipped";
    };

/* =====================================================
 * 6.7 attachmentSafetyReview
 * ===================================================== */

export type AttachmentSafetyReviewInput = {
  attachmentAnalysis: AttachmentAnalysis;
  attachmentAnalysisSafetyGate: AttachmentAnalysisSafetyGate;
  accountTrustStatus: AccountTrustStatus;
};

export type AttachmentSafetyReview =
  | {
      status: "reviewed";
      route:
        | "continue"
        | "stop";
      reason: string;
    }
  | {
      status: "skipped";
    };

/* =====================================================
 * 6.8 analysisGate
 * ===================================================== */

export type AnalysisGateInput = {
  latestUserMessage: LatestUserMessage;
  supportTopicKnowledge: SupportTopicKnowledge;
  conversationHistory: ConversationHistory;
  attachmentAnalysis: AttachmentAnalysis;
};

export type AnalysisGate =
  | {
      status: "checked";
      shouldRunLightweightMessageAnalysis: boolean;
    }
  | {
      status: "skipped";
    };

/* =====================================================
 * 6.9 lightweightMessageAnalysis
 * ===================================================== */

export type LightweightMessageAnalysisInput = {
  latestUserMessage: LatestUserMessage;
  supportTopicKnowledge: SupportTopicKnowledge;
  conversationHistory: ConversationHistory;
  attachmentAnalysis: AttachmentAnalysis;
};

export type LightweightMessageAnalysis = {
  status: "analyzed" | "skipped" | "failed";
  shouldRunSupportMessageAnalysis: boolean;
  user_language?: string;
  segments_signal: TurnUnderstandingDelta["segments_signal"];
  segments_scope_boundary: TurnUnderstandingDelta["segments_scope_boundary"];
  segments_suspicious: TurnUnderstandingDelta["segments_suspicious"];
};

/* =====================================================
 * 6.10 rawFullweightMessageAnalysis
 * ===================================================== */

export type FullweightMessageAnalysisInput = {
  latestUserMessage: LatestUserMessage;
  supportTopicKnowledge: SupportTopicKnowledge;
  conversationHistory: ConversationHistory;
  attachmentAnalysis: AttachmentAnalysis;
  lightweightMessageAnalysis: LightweightMessageAnalysis;
};

export type RawFullweightMessageAnalysis = {
  status: "analyzed" | "skipped" | "failed";
  user_language?: string;
  segments_lack_comprehension: TurnUnderstandingDelta["segments_lack_comprehension"];
  segments_topic: TurnUnderstandingDelta["segments_topic"];
  segments_signal: TurnUnderstandingDelta["segments_signal"];
  segments_scope_boundary: TurnUnderstandingDelta["segments_scope_boundary"];
  segments_suspicious: TurnUnderstandingDelta["segments_suspicious"];
};

/* =====================================================
 * 6. turnUnderstandingDelta
 * ===================================================== */

export type TurnUnderstandingDeltaInput = {
  rawInputSafetyGate: RawInputSafetyGate;
  rawInputTrustDecision: RawInputTrustDecision;
  rawInputSafetyReview: RawInputSafetyReview;

  attachmentAnalysis: AttachmentAnalysis;
  attachmentAnalysisSafetyGate: AttachmentAnalysisSafetyGate;
  attachmentTrustDecision: AttachmentTrustDecision;
  attachmentSafetyReview: AttachmentSafetyReview;

  analysisGate: AnalysisGate;
  lightweightMessageAnalysis: LightweightMessageAnalysis;
  rawFullweightMessageAnalysis: RawFullweightMessageAnalysis;

  supportTopicKnowledge: SupportTopicKnowledge;
  conversationHistory: ConversationHistory;
};
/* =====================================================
 * Message analysis steps
 * ===================================================== */

export type MessageAnalysisSteps = {
  runRawInputSafetyGate?: MessageAnalysisStep<
    RawInputSafetyGateInput,
    RawInputSafetyGate
  >;

  decideRawInputTrustConsistency?: MessageAnalysisStep<
    RawInputTrustConsistencyInput,
    RawInputTrustDecision
  >;

  runRawInputSafetyReviewLlmTruster?: MessageAnalysisStep<
    RawInputSafetyReviewInput,
    RawInputSafetyReview
  >;

  runAttachmentAnalysis?: MessageAnalysisStep<
    AttachmentAnalysisInput,
    AttachmentAnalysis
  >;

  runAttachmentAnalysisSafetyGate?: MessageAnalysisStep<
    AttachmentAnalysisSafetyGateInput,
    AttachmentAnalysisSafetyGate
  >;

  decideAttachmentTrustConsistency?: MessageAnalysisStep<
    AttachmentTrustConsistencyInput,
    AttachmentTrustDecision
  >;

  runAttachmentSafetyReviewLlmTruster?: MessageAnalysisStep<
    AttachmentSafetyReviewInput,
    AttachmentSafetyReview
  >;

  runAnalysisGate?: MessageAnalysisStep<
    AnalysisGateInput,
    AnalysisGate
  >;

  runLightweightMessageAnalysis?: MessageAnalysisStep<
    LightweightMessageAnalysisInput,
    LightweightMessageAnalysis
  >;

  runFullweightMessageAnalysis?: MessageAnalysisStep<
    FullweightMessageAnalysisInput,
    RawFullweightMessageAnalysis
  >;

  assembleTurnUnderstandingDelta?: MessageAnalysisStep<
    TurnUnderstandingDeltaInput,
    MessageAnalysisOutput
  >;
};