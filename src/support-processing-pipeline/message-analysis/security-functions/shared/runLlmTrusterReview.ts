import type {
  AccountTrustStatus
} from "../../../typesSupportProcessingPipeline.types";
import type {
  TextSecurityCheckOutput
} from "./runTextSecurityChecks";

type LlmTrusterReviewInput =
  | {
      reviewKind: "attachment_analysis_suspicious";
      attachmentAnalysisDescription: string;
      attachmentAnalysisSuspicion: {
        status: "suspicious";
        reason?: string;
      };
      accountTrustStatus: AccountTrustStatus;
      latestUserMessageContent?: string;
    }
  | {
      reviewKind: "attachment_text_security_checks";
      attachmentAnalysisDescription: string;
      textSecurityChecks: TextSecurityCheckOutput;
      trustDecision: {
        route: "review_with_llm_truster";
        reason?: string;
      };
      accountTrustStatus: AccountTrustStatus;
      latestUserMessageContent?: string;
    }
  | {
      reviewKind: "latest_user_message_text_security_checks";
      latestUserMessageContent: string;
      textSecurityChecks: TextSecurityCheckOutput;
      trustDecision: {
        route: "review_with_llm_truster";
        reason?: string;
      };
      accountTrustStatus: AccountTrustStatus;
    };

type LlmTrusterReviewOutput = {
  route: "continue" | "stop" | "failed";
  reason?: string;
};

async function runLlmTrusterReview(
  input: LlmTrusterReviewInput
): Promise<LlmTrusterReviewOutput> {
  void input.reviewKind;

  if (input.accountTrustStatus.status === "trusted") {
    return {
      route: "continue",
      reason: "trusted_account_review_mock"
    };
  }

  return {
    route: "stop",
    reason: "non_trusted_account_review_mock"
  };
}

export {
  runLlmTrusterReview
};

export type {
  LlmTrusterReviewInput,
  LlmTrusterReviewOutput
};
