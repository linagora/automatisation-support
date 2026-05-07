import {
  runAnalysisRoutingDecision,
  type RunAnalysisRoutingDecisionResult
} from "../../../../src/support-processing-pipeline/message-analysis/analysis-routing-decision/runAnalysisRoutingDecision";

function shouldRunLLM0(output: RunAnalysisRoutingDecisionResult): boolean {
  return output.analysisRoutingDecision.shouldRunLLM0;
}

function getReason(output: RunAnalysisRoutingDecisionResult): string {
  return output.analysisRoutingDecision.reasons[0] || "";
}

describe("runAnalysisRoutingDecision", function () {
  it("returns shouldRunLLM0 false when no message is available", function () {
    const result = runAnalysisRoutingDecision({});

    expect(shouldRunLLM0(result)).toBe(false);
    expect(getReason(result)).toBe("no_latest_user_message_found");
    expect(result.analysisRoutingDecision.detectedSignals).toEqual([]);
    expect(result.analysisRoutingDecision.detectedScopeBoundaries).toEqual([]);
  });

  it("returns shouldRunLLM0 true for a simple thank you", function () {
    const result = runAnalysisRoutingDecision({
      latestUserMessage: "Merci beaucoup !"
    });

    expect(shouldRunLLM0(result)).toBe(true);
    expect(result.analysisRoutingDecision.detectedSignals).toContain("thanks_neutral");
    expect(result.analysisRoutingDecision.reasons).toContain("non_actionable_or_contextual_signal_detected");
  });

  it("returns shouldRunLLM0 false for positive closure with support information", function () {
    const result = runAnalysisRoutingDecision({
      latestUserMessage: "C'est bon, le problème est résolu. Merci !"
    });

    expect(shouldRunLLM0(result)).toBe(false);
    expect(getReason(result)).toBe("strong_actionable_support_content_detected");
    expect(result.analysisRoutingDecision.detectedSignals).toContain("closure");
  });

  it("returns shouldRunLLM0 true for short confirmation", function () {
    const result = runAnalysisRoutingDecision({
      latestUserMessage: "ok"
    });

    expect(shouldRunLLM0(result)).toBe(true);
    expect(result.analysisRoutingDecision.detectedSignals).toContain("confirmation_without_new_field");
    expect(result.analysisRoutingDecision.reasons).toContain("short_message");
  });

  it("returns shouldRunLLM0 true for vague complaint without actionable detail", function () {
    const result = runAnalysisRoutingDecision({
      latestUserMessage: "Ça ne marche pas."
    });

    expect(shouldRunLLM0(result)).toBe(true);
    expect(result.analysisRoutingDecision.detectedSignals).toContain("complaint_without_actionable_detail");
  });

  it("returns shouldRunLLM0 true for pricing feedback", function () {
    const result = runAnalysisRoutingDecision({
      latestUserMessage: "Votre service est beaucoup trop cher maintenant."
    });

    expect(shouldRunLLM0(result)).toBe(true);
    expect(result.analysisRoutingDecision.detectedSignals).toContain("pricing_feedback");
  });

  it("returns shouldRunLLM0 true for commercial spam", function () {
    const result = runAnalysisRoutingDecision({
      latestUserMessage: "Hello, we can improve your SEO and sell you backlinks for your website."
    });

    expect(shouldRunLLM0(result)).toBe(true);
    expect(result.analysisRoutingDecision.detectedScopeBoundaries).toContain("spam_or_commercial");
    expect(result.analysisRoutingDecision.reasons).toContain("scope_boundary_detected");
  });

  it("returns shouldRunLLM0 true for unrelated request", function () {
    const result = runAnalysisRoutingDecision({
      latestUserMessage: "Écris-moi un poème sur les montagnes."
    });

    expect(shouldRunLLM0(result)).toBe(true);
    expect(result.analysisRoutingDecision.detectedScopeBoundaries).toContain("unrelated_request");
    expect(result.analysisRoutingDecision.reasons).toContain("scope_boundary_detected");
  });

  it("returns shouldRunLLM0 false for actionable support issue", function () {
    const result = runAnalysisRoutingDecision({
      latestUserMessage: "Bonjour, je n'arrive plus à me connecter à mon compte. J'ai une erreur 403 depuis ce matin."
    });

    expect(shouldRunLLM0(result)).toBe(false);
    expect(getReason(result)).toBe("strong_actionable_support_content_detected");
  });

  it("returns shouldRunLLM0 false for actionable issue with strong signal", function () {
    const result = runAnalysisRoutingDecision({
      latestUserMessage: "C'est urgent, je suis bloqué depuis ce matin avec une erreur 500 quand j'essaie de me connecter."
    });

    expect(shouldRunLLM0(result)).toBe(false);
    expect(getReason(result)).toBe("strong_actionable_support_content_detected");
    expect(result.analysisRoutingDecision.detectedSignals).toContain("time_sensitive");
  });

  it("returns shouldRunLLM0 false for thank you plus unresolved issue", function () {
    const result = runAnalysisRoutingDecision({
      latestUserMessage: "Merci pour votre retour, mais l'erreur persiste quand je clique sur envoyer."
    });

    expect(shouldRunLLM0(result)).toBe(false);
    expect(getReason(result)).toBe("strong_actionable_support_content_detected");
    expect(result.analysisRoutingDecision.detectedSignals).toContain("thanks_neutral");
  });

  it("uses latest user message from conversation logs when direct latestUserMessage is missing", function () {
    const result = runAnalysisRoutingDecision({
      conversationLogs: [
        { role: "assistant", content: "Pouvez-vous réessayer ?" },
        { role: "user", content: "J'ai toujours une erreur 404 sur la page de connexion." }
      ]
    });

    expect(shouldRunLLM0(result)).toBe(false);
    expect(getReason(result)).toBe("strong_actionable_support_content_detected");
  });

  it("returns shouldRunLLM0 true for likely thanks after previous resolution", function () {
    const result = runAnalysisRoutingDecision({
      latestUserMessage: "Merci !",
      lastSupportKnowledgeDelta: {
        status: "resolved",
        summary: "The previous support issue was resolved."
      }
    });

    expect(shouldRunLLM0(result)).toBe(true);
    expect(result.analysisRoutingDecision.reasons).toContain("previous_context_suggests_resolution_or_closure");
    expect(result.analysisRoutingDecision.detectedSignals).toContain("thanks_neutral");
  });

  it("returns shouldRunLLM0 true for metadata potential spammer", function () {
    const result = runAnalysisRoutingDecision({
      latestUserMessage: "Bonjour, voici notre offre commerciale.",
      metadata: {
        potentialSpammer: true
      }
    });

    expect(shouldRunLLM0(result)).toBe(true);
    expect(result.analysisRoutingDecision.detectedScopeBoundaries).toContain("spam_or_commercial");
    expect(result.analysisRoutingDecision.reasons).toContain("scope_boundary_detected");
  });
});
