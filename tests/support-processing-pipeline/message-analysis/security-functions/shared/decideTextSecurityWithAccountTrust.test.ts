import { describe, expect, it } from "vitest";

import {
  decideTextSecurityWithAccountTrust
} from "../../../../../src/archive/support-processing-pipeline/message-analysis/security-functions/shared/decideTextSecurityWithAccountTrust";

import type {
  AccountTrustStatus
} from "../../../../../src/archive/support-processing-pipeline/typesSupportProcessingPipeline.types";
import type {
  TextSecurityCheckOutput
} from "../../../../../src/archive/support-processing-pipeline/message-analysis/security-functions/shared/runTextSecurityChecks";

const cleanTextSecurityChecks: TextSecurityCheckOutput = {
  checked: ["prompt_injection_attempt"],
  failed: []
};

const failedTextSecurityChecks: TextSecurityCheckOutput = {
  checked: [],
  failed: ["prompt_injection_attempt"]
};

function buildAccountTrustStatus(
  status: AccountTrustStatus["status"]
): AccountTrustStatus {
  return {
    status,
    reasons: []
  };
}

describe("decideTextSecurityWithAccountTrust", function () {
  it("continues when there is no failed check and the account is trusted", function () {
    const output = decideTextSecurityWithAccountTrust({
      textSecurityChecks: cleanTextSecurityChecks,
      accountTrustStatus: buildAccountTrustStatus("trusted")
    });

    expect(output).toEqual({
      route: "continue",
      reason: "no_failed_check_with_trusted_or_neutral_account"
    });
  });

  it("continues when there is no failed check and the account is neutral", function () {
    const output = decideTextSecurityWithAccountTrust({
      textSecurityChecks: cleanTextSecurityChecks,
      accountTrustStatus: buildAccountTrustStatus("neutral")
    });

    expect(output).toEqual({
      route: "continue",
      reason: "no_failed_check_with_trusted_or_neutral_account"
    });
  });

  it("reviews when there is no failed check but the account is suspicious", function () {
    const output = decideTextSecurityWithAccountTrust({
      textSecurityChecks: cleanTextSecurityChecks,
      accountTrustStatus: buildAccountTrustStatus("suspicious")
    });

    expect(output).toEqual({
      route: "review_with_llm_truster",
      reason: "no_failed_check_but_suspicious_account"
    });
  });

  it("reviews when there is a failed check and the account is trusted", function () {
    const output = decideTextSecurityWithAccountTrust({
      textSecurityChecks: failedTextSecurityChecks,
      accountTrustStatus: buildAccountTrustStatus("trusted")
    });

    expect(output).toEqual({
      route: "review_with_llm_truster",
      reason: "failed_check_with_trusted_or_neutral_account"
    });
  });

  it("reviews when there is a failed check and the account is neutral", function () {
    const output = decideTextSecurityWithAccountTrust({
      textSecurityChecks: failedTextSecurityChecks,
      accountTrustStatus: buildAccountTrustStatus("neutral")
    });

    expect(output).toEqual({
      route: "review_with_llm_truster",
      reason: "failed_check_with_trusted_or_neutral_account"
    });
  });

  it("stops when there is a failed check and the account is suspicious", function () {
    const output = decideTextSecurityWithAccountTrust({
      textSecurityChecks: failedTextSecurityChecks,
      accountTrustStatus: buildAccountTrustStatus("suspicious")
    });

    expect(output).toEqual({
      route: "stop",
      reason: "failed_check_with_suspicious_account"
    });
  });
});
