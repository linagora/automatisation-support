const {
  runMessageAnalysis
} = require("../../../src/support-processing-pipeline/message-analysis/runMessageAnalysis");

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
      },
      dataCollectorProcessing: {}
    };

    const callOrder = [];

    const steps = {
      runDeterministicRouting: function ({ decisionRoute, dataCollectorProcessing }) {
        callOrder.push("deterministic-routing");

        dataCollectorProcessing.deterministicRoutingCalled = true;

        return {
          shouldAnalyzeMessage: true,
          shouldRunAttachmentAnalysis: true,
          reason: "message_has_attachment"
        };
      },

      runAttachmentAnalysis: function ({ decisionRoute, dataCollectorProcessing }) {
        callOrder.push("attachment-analysis");

        dataCollectorProcessing.attachmentAnalysisCalled = true;

        return {
          status: decisionRoute.shouldRunAttachmentAnalysis ? "analyzed" : "skipped",
          extractedText: "Erreur de connexion visible sur la capture."
        };
      },

      runAnalysisRouting: function ({ decisionRoute, dataCollectorProcessing }) {
        callOrder.push("analysis-routing");

        dataCollectorProcessing.analysisRoutingCalled = true;

        return {
          shouldRunPreAnalysis: true,
          shouldRunFullAnalysis: false,
          reason: "pre_analysis_needed"
        };
      },

      runPreAnalysis: function ({ decisionRoute, dataCollectorProcessing }) {
        callOrder.push("pre-analysis");

        dataCollectorProcessing.preAnalysisCalled = true;

        return {
          route: "run_full_analysis",
          shouldRunFullAnalysis: true,
          reason: "support_request_confirmed"
        };
      },

      runFullAnalysis: function ({ decisionRoute, dataCollectorProcessing }) {
        callOrder.push("full-analysis");

        dataCollectorProcessing.fullAnalysisCalled = true;

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
        fullAnalysisResult,
        dataCollectorProcessing
      }) {
        callOrder.push("analysis-assembler");

        dataCollectorProcessing.analysisAssemblerCalled = true;

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

    expect(input.dataCollectorProcessing).toEqual({
      deterministicRoutingCalled: true,
      attachmentAnalysisCalled: true,
      analysisRoutingCalled: true,
      preAnalysisCalled: true,
      fullAnalysisCalled: true,
      analysisAssemblerCalled: true
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
      userInformations: {},
      dataCollectorProcessing: {}
    };

    expect(function () {
      runMessageAnalysis(input);
    }).toThrow("runDeterministicRouting is not implemented yet");
  });
});