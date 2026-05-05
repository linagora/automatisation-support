import {
  runMessageAnalysis
} from "../../../src/support-processing-pipeline/message-analysis/runMessageAnalysis";

describe("runMessageAnalysis", function () {
  it("runs all message-analysis steps and returns currentAnalysisOutput", function () {
    const input = {
      latestUserMessage: {
        text: "Bonjour, je n'arrive pas à me connecter."
      },
      attachments: [
        {
          type: "image",
          name: "screenshot.png"
        }
      ],
      previousAnalysisOutput: null,
      conversationLogs: [],
      attemptHistory: [],
      userInformations: {
        userId: "user_123"
      }
    };

    const callOrder: string[] = [];

    const steps = {
      runDeterministicRouting: function () {
        callOrder.push("deterministic-routing");

        return {
          shouldAnalyzeMessage: true,
          shouldRunAttachmentAnalysis: true,
          reason: "message_has_attachment"
        };
      },

      runAttachmentAnalysis: function ({ decisionRoute }: any) {
        callOrder.push("attachment-analysis");

        return {
          status: decisionRoute.shouldRunAttachmentAnalysis ? "analyzed" : "skipped",
          extractedText: "Erreur de connexion visible sur la capture."
        };
      },

      runAnalysisRouting: function () {
        callOrder.push("analysis-routing");

        return {
          shouldRunPreAnalysis: true,
          shouldRunFullAnalysis: false,
          reason: "pre_analysis_needed"
        };
      },

      runPreAnalysis: function () {
        callOrder.push("pre-analysis");

        return {
          route: "run_full_analysis",
          shouldRunFullAnalysis: true,
          reason: "support_request_confirmed"
        };
      },

      runFullAnalysis: function () {
        callOrder.push("full-analysis");

        return {
          userLanguage: "fr",
          topics: [
            {
              topicLabel: "Problème de connexion",
              category: "login_issue"
            }
          ]
        };
      },

      assembleCurrentAnalysisOutput: function ({
        decisionRoute,
        deterministicRoutingResult,
        attachmentAnalysisResult,
        analysisRoutingResult,
        preAnalysisResult,
        fullAnalysisResult
      }: any) {
        callOrder.push("analysis-assembler");

        return {
          analysisStatus: "completed",
          decisionRoute,
          deterministicRoutingResult,
          attachmentAnalysisResult,
          analysisRoutingResult,
          preAnalysisResult,
          fullAnalysisResult
        };
      }
    };

    const output = runMessageAnalysis(input, steps);

    expect(callOrder).toEqual([
      "deterministic-routing",
      "attachment-analysis",
      "analysis-routing",
      "pre-analysis",
      "full-analysis",
      "analysis-assembler"
    ]);

    expect(output.analysisStatus).toBe("completed");

    expect(output.decisionRoute).toEqual({
      shouldAnalyzeMessage: true,
      shouldRunAttachmentAnalysis: true,
      shouldRunPreAnalysis: true,
      shouldRunFullAnalysis: true,
      reason: "support_request_confirmed"
    });

    expect(output.attachmentAnalysisResult).toEqual({
      status: "analyzed",
      extractedText: "Erreur de connexion visible sur la capture."
    });

    expect(output.fullAnalysisResult).toEqual({
      userLanguage: "fr",
      topics: [
        {
          topicLabel: "Problème de connexion",
          category: "login_issue"
        }
      ]
    });
  });

  it("throws an explicit error when a required step is missing", function () {
    const input = {
      latestUserMessage: {
        text: "Bonjour"
      },
      attachments: [],
      previousAnalysisOutput: null,
      conversationLogs: [],
      attemptHistory: [],
      userInformations: {}
    };

    expect(function () {
      runMessageAnalysis(input);
    }).toThrow("runDeterministicRouting is not implemented yet");
  });
});