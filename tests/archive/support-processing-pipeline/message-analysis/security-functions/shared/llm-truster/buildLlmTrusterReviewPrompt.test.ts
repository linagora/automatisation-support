import { describe, expect, it } from "vitest";

import {
  buildLlmTrusterReviewPrompt
} from "../../../../../../src/archive/support-processing-pipeline/message-analysis/security-functions/shared/llm-truster/buildLlmTrusterReviewPrompt";

import type {
  AccountTrustStatus
} from "../../../../../../src/archive/support-processing-pipeline/typesSupportProcessingPipeline.types";

const suspiciousAccount: AccountTrustStatus = {
  status: "suspicious",
  reasons: ["suspiciousActivity"]
};

const trustedAccount: AccountTrustStatus = {
  status: "trusted",
  reasons: ["legitimateSupportInteractions"]
};

describe("buildLlmTrusterReviewPrompt", function () {
  it("includes account trust status and useful content for latest user message reviews", function () {
    const prompt = buildLlmTrusterReviewPrompt({
      reviewKind: "latest_user_message_text_security_checks",
      latestUserMessageContent: "Bonjour, voici un lien suspect.",
      textSecurityChecks: {
        checked: ["spam_like_text"],
        failed: ["suspicious_link_or_url"]
      },
      trustDecision: {
        route: "review_with_llm_truster",
        reason: "failed_check_with_trusted_or_neutral_account"
      },
      accountTrustStatus: trustedAccount
    });

    expect(prompt.userPrompt).toContain("latest_user_message_text_security_checks");
    expect(prompt.userPrompt).toContain('"status": "trusted"');
    expect(prompt.userPrompt).toContain("Bonjour, voici un lien suspect.");
    expect(prompt.userPrompt).toContain('failed: [\n  "suspicious_link_or_url"\n]');
    expect(prompt.userPrompt).not.toContain("checked:");
  });

  it("keeps empty failed checks explicit for suspicious account text reviews", function () {
    const prompt = buildLlmTrusterReviewPrompt({
      reviewKind: "latest_user_message_text_security_checks",
      latestUserMessageContent: "Message de support normal.",
      textSecurityChecks: {
        checked: ["prompt_injection_attempt"],
        failed: []
      },
      trustDecision: {
        route: "review_with_llm_truster",
        reason: "no_failed_check_but_suspicious_account"
      },
      accountTrustStatus: suspiciousAccount
    });

    expect(prompt.userPrompt).toContain('"status": "suspicious"');
    expect(prompt.userPrompt).toContain("failed: []");
    expect(prompt.userPrompt).toContain("no_failed_check_but_suspicious_account");
    expect(prompt.userPrompt).not.toContain("checked:");
  });

  it("includes account trust status and useful content for attachment text reviews", function () {
    const prompt = buildLlmTrusterReviewPrompt({
      reviewKind: "attachment_text_security_checks",
      latestUserMessageContent: "Je joins une capture de mon problème.",
      attachmentAnalysisDescription: "The attachment contains a suspicious URL.",
      textSecurityChecks: {
        checked: ["spam_like_text"],
        failed: ["suspicious_link_or_url"]
      },
      trustDecision: {
        route: "review_with_llm_truster",
        reason: "failed_check_with_trusted_or_neutral_account"
      },
      accountTrustStatus: trustedAccount
    });

    expect(prompt.userPrompt).toContain("attachment_text_security_checks");
    expect(prompt.userPrompt).toContain('"status": "trusted"');
    expect(prompt.userPrompt).toContain("Je joins une capture de mon problème.");
    expect(prompt.userPrompt).toContain("The attachment contains a suspicious URL.");
    expect(prompt.userPrompt).toContain('failed: [\n  "suspicious_link_or_url"\n]');
    expect(prompt.userPrompt).not.toContain("checked:");
  });

  it("includes account trust status and useful content for suspicious attachment reviews", function () {
    const prompt = buildLlmTrusterReviewPrompt({
      reviewKind: "attachment_analysis_suspicious",
      latestUserMessageContent: "Pouvez-vous regarder cette capture ?",
      attachmentAnalysisDescription: "The image may contain unsafe visual content.",
      attachmentAnalysisSuspicion: {
        status: "suspicious",
        reason: "suspicious_visual_content"
      },
      accountTrustStatus: suspiciousAccount
    });

    expect(prompt.userPrompt).toContain("attachment_analysis_suspicious");
    expect(prompt.userPrompt).toContain('"status": "suspicious"');
    expect(prompt.userPrompt).toContain("Pouvez-vous regarder cette capture ?");
    expect(prompt.userPrompt).toContain("The image may contain unsafe visual content.");
    expect(prompt.userPrompt).toContain("reason: suspicious_visual_content");
  });

  it("states that account trust status is contextual, not automatic", function () {
    const prompt = buildLlmTrusterReviewPrompt({
      reviewKind: "attachment_analysis_suspicious",
      attachmentAnalysisDescription: "Suspicious attachment.",
      attachmentAnalysisSuspicion: {
        status: "suspicious"
      },
      accountTrustStatus: suspiciousAccount
    });

    expect(prompt.systemPrompt).toContain(
      "The account trust status is contextual information, not an automatic decision."
    );
  });
});
