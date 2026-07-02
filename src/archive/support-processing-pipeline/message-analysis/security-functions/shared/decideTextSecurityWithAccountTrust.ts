import type {
  AccountTrustStatus
} from "../../../typesSupportProcessingPipeline.types";

import type {
  TextSecurityCheckOutput
} from "./runTextSecurityChecks";

type TextSecurityTrustDecisionInput = {
  textSecurityChecks: TextSecurityCheckOutput;
  accountTrustStatus: AccountTrustStatus;
};

type TextSecurityTrustDecisionOutput = {
  route: "continue" | "stop" | "review_with_llm_truster";
  reason?: string;
};

function decideTextSecurityWithAccountTrust(
  input: TextSecurityTrustDecisionInput
): TextSecurityTrustDecisionOutput {
  const hasFailedCheck = input.textSecurityChecks.failed.length > 0;
  const accountStatus = input.accountTrustStatus.status;

  if (!hasFailedCheck && accountStatus !== "suspicious") {
    return {
      route: "continue",
      reason: "no_failed_check_with_trusted_or_neutral_account"
    };
  }

  if (!hasFailedCheck && accountStatus === "suspicious") {
    return {
      route: "review_with_llm_truster",
      reason: "no_failed_check_but_suspicious_account"
    };
  }

  if (hasFailedCheck && accountStatus !== "suspicious") {
    return {
      route: "review_with_llm_truster",
      reason: "failed_check_with_trusted_or_neutral_account"
    };
  }

  return {
    route: "stop",
    reason: "failed_check_with_suspicious_account"
  };
}

export {
  decideTextSecurityWithAccountTrust
};

export type {
  TextSecurityTrustDecisionInput,
  TextSecurityTrustDecisionOutput
};
