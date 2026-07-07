/**
 * Shared types for the message analysis pipeline.
 */

import type {
  AccountTrustStatus,
  ConversationHistory,
  LatestUserAttachment,
  LatestUserMessage,
  MessageAnalysisInput,
  MessageAnalysisOutput,
  SupportTopicKnowledge,
  TurnUnderstandingDelta
} from "../typesSupportProcessingPipeline.types";
import type {
  TextSecurityCheckName
} from "./security-functions/shared/runTextSecurityChecks";
import type {
  AttachmentAnalysis,
  AttachmentAnalysisInput,
  AttachmentReadinessCheckName
} from "./attachment-analysis/typesAttachmentAnalysis.types";
import type {
  FullWeightMessageAnalysisOutput
} from "./fullweight-message-analysis/typesFullWeightMessageAnalysis.types";

export type {
  FullWeightMessageAnalysisOutput
} from "./fullweight-message-analysis/typesFullWeightMessageAnalysis.types";

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
 * 6.1 latestUserMessageSecurityDecision
 * ===================================================== */

type SecurityDecisionRoute =
  | "continue"
  | "stop";

export type SecurityLlmReviewRoute =
  | "continue"
  | "stop"
  | "failed";

export type SecurityLlmReview = {
  route: SecurityLlmReviewRoute;
  reason?: string;
};

export type LatestUserMessageSecurityCheckName =
  TextSecurityCheckName;

export type AttachmentAnalysisSecurityCheckName =
  | TextSecurityCheckName
  | AttachmentReadinessCheckName
  | "attachment_analysis_failed"
  | "attachment_refused"
  | "suspicious_attachment_content";

type SecurityDecisionHistory<TCheckName extends string> = {
  checked: TCheckName[];
  failed: TCheckName[];
  llmReview?: SecurityLlmReview;
};

export type LatestUserMessageSecurityInput = {
  latestUserMessage: LatestUserMessage;
  accountTrustStatus: AccountTrustStatus;
};

export type LatestUserMessageSecurityDecision = {
  decision: {
    route: SecurityDecisionRoute;
  };
  history: SecurityDecisionHistory<LatestUserMessageSecurityCheckName>;
};

export type {
  AttachmentAnalysis,
  AttachmentAnalysisInput
};

/* =====================================================
 * 6.3 attachmentAnalysisSecurityDecision
 * ===================================================== */

export type AttachmentAnalysisSecurityInput = {
  attachmentAnalysis: AttachmentAnalysis;
  accountTrustStatus: AccountTrustStatus;
  latestUserMessageContent: string;
};

export type AttachmentAnalysisSecurityDecision = {
  decision: {
    route: SecurityDecisionRoute;
  };
  history: SecurityDecisionHistory<AttachmentAnalysisSecurityCheckName>;
};

/* =====================================================
 * 6. securityGateSummary
 * ===================================================== */

export type SecurityGateSummary = {
  gateChecked: {
    latestUserMessageSecurityDecision?: LatestUserMessageSecurityDecision;
    attachmentAnalysisSecurityDecision?: AttachmentAnalysisSecurityDecision;
  };
  gateFailed: {
    latestUserMessageSecurityDecision?: LatestUserMessageSecurityDecision;
    attachmentAnalysisSecurityDecision?: AttachmentAnalysisSecurityDecision;
  };
};

/* =====================================================
 * 6.4 analysisGate
 * ===================================================== */

export type AnalysisGateRoute =
  | "light_weight_first"
  | "full_weight_direct";

export type AnalysisGateCheckName =
  | "empty_message"
  | "short_message"
  | "pure_signal_message"
  | "closure_or_confirmation_message"
  | "scope_boundary_candidate"
  | "vague_complaint_without_actionable_detail"
  | "ambiguous_message_without_actionable_detail"
  | "explicit_bug_or_error"
  | "explicit_access_security_issue"
  | "explicit_billing_issue"
  | "explicit_question_or_request"
  | "actionable_trigger_context"
  | "error_code_detected"
  | "detailed_actionable_message";

export type AnalysisGateInput = {
  latestUserMessage: LatestUserMessage;
};

export type AnalysisGate = {
  decision: {
    route: AnalysisGateRoute;
  };
  history: {
    prefer_light_first: AnalysisGateCheckName[];
    prefer_full_direct: AnalysisGateCheckName[];
  };
};

/* =====================================================
 * 6.5 lightWeightMessageAnalysis
 * ===================================================== */

export type LightWeightMessageAnalysisInput = {
  latestUserMessage: LatestUserMessage;
  supportTopicKnowledge: SupportTopicKnowledge;
  conversationHistory: ConversationHistory;
};

export type LightWeightMessageAnalysis = {
  shouldRunSupportMessageAnalysis: boolean;
  user_language?: string;
  segments_signal: TurnUnderstandingDelta["segments_signal"];
  segments_scope_boundary: TurnUnderstandingDelta["segments_scope_boundary"];
  segments_suspicious: TurnUnderstandingDelta["segments_suspicious"];
};

/* =====================================================
 * 6.6 fullWeightMessageAnalysis
 * ===================================================== */

export type FullWeightMessageAnalysisInput = {
  latestUserMessage: LatestUserMessage;
  supportTopicKnowledge: SupportTopicKnowledge;
  conversationHistory: ConversationHistory;
  attachmentAnalysis?: AttachmentAnalysis;
  lightWeightMessageAnalysis?: LightWeightMessageAnalysis;
};

/* =====================================================
 * 6. turnUnderstandingDelta
 * ===================================================== */

export type SecurityGateStoppedTurnUnderstandingDeltaInput = {
  securityGateSummary: SecurityGateSummary;
  latestUserAttachments?: LatestUserAttachment[];
  attachmentAnalysis?: AttachmentAnalysis;
  supportTopicKnowledge: SupportTopicKnowledge;
  conversationHistory: ConversationHistory;
};

export type CompletedAnalysisTurnUnderstandingDeltaInput = {
  securityGateSummary: SecurityGateSummary;
  latestUserAttachments: LatestUserAttachment[];
  attachmentAnalysis?: AttachmentAnalysis;
  analysisGate?: AnalysisGate;
  lightWeightMessageAnalysis?: LightWeightMessageAnalysis;
  fullWeightMessageAnalysisOutput?: FullWeightMessageAnalysisOutput;
  supportTopicKnowledge: SupportTopicKnowledge;
  conversationHistory: ConversationHistory;
};

export type TurnUnderstandingDeltaInput =
  | SecurityGateStoppedTurnUnderstandingDeltaInput
  | CompletedAnalysisTurnUnderstandingDeltaInput;

/* =====================================================
 * Message analysis steps
 * ===================================================== */

export type MessageAnalysisSteps = {
  runLatestUserMessageSecurity?: MessageAnalysisStep<
    LatestUserMessageSecurityInput,
    LatestUserMessageSecurityDecision
  >;

  runAttachmentAnalysis?: MessageAnalysisStep<
    AttachmentAnalysisInput,
    AttachmentAnalysis
  >;

  runAttachmentAnalysisSecurity?: MessageAnalysisStep<
    AttachmentAnalysisSecurityInput,
    AttachmentAnalysisSecurityDecision
  >;

  runAnalysisGate?: MessageAnalysisStep<
    AnalysisGateInput,
    AnalysisGate
  >;

  runLightWeightMessageAnalysis?: MessageAnalysisStep<
    LightWeightMessageAnalysisInput,
    LightWeightMessageAnalysis
  >;

  runFullWeightMessageAnalysis?: MessageAnalysisStep<
    FullWeightMessageAnalysisInput,
    FullWeightMessageAnalysisOutput
  >;

  assembleTurnUnderstandingDelta?: MessageAnalysisStep<
    TurnUnderstandingDeltaInput,
    MessageAnalysisOutput
  >;
};
