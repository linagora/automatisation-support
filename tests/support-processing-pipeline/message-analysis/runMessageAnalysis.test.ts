import {
  runMessageAnalysis
} from "../../../src/support-processing-pipeline/message-analysis/runMessageAnalysis";

describe("runMessageAnalysis", function () {
  it("runs all message-analysis steps and returns messageAnalysisOutput", function () {
    const ticketMemoryBeforeTurn = {
      supportKnowledge: {
        topics: []
      },
      supportKnowledgeDeltaHistory: [],
      conversationLogs: [],
      userInformations: {
        userId: "user_123"
      }
    };

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
      ticketMemoryBeforeTurn
    };

    const callOrder: string[] = [];

    const steps = {
      runDeterministicRouting: function (stepInput: any) {
        callOrder.push("deterministic-routing");

        expect(stepInput.latestUserMessage).toEqual(input.latestUserMessage);
        expect(stepInput.attachments).toEqual(input.attachments);
        expect(stepInput.ticketMemoryBeforeTurn).toEqual(ticketMemoryBeforeTurn);

        return {
          shouldAnalyzeMessage: true,
          shouldRunAttachmentAnalysis: true,
          reason: "message_has_attachment"
        };
      },

      runAttachmentAnalysis: function (stepInput: any) {
        callOrder.push("attachment-analysis");

        expect(stepInput.deterministicRoutingResult).toEqual({
          shouldAnalyzeMessage: true,
          shouldRunAttachmentAnalysis: true,
          reason: "message_has_attachment"
        });

        return {
          status: stepInput.deterministicRoutingResult.shouldRunAttachmentAnalysis
            ? "analyzed"
            : "skipped",
          extractedText: "Erreur de connexion visible sur la capture."
        };
      },

      runAnalysisRouting: function (stepInput: any) {
        callOrder.push("analysis-routing");

        expect(stepInput.attachmentAnalysisResult).toEqual({
          status: "analyzed",
          extractedText: "Erreur de connexion visible sur la capture."
        });

        return {
          shouldRunPreAnalysis: true,
          shouldRunFullAnalysis: true,
          reason: "support_request_confirmed"
        };
      },

      runPreAnalysis: function (stepInput: any) {
        callOrder.push("pre-analysis");

        expect(stepInput.analysisRoutingResult).toEqual({
          shouldRunPreAnalysis: true,
          shouldRunFullAnalysis: true,
          reason: "support_request_confirmed"
        });

        return {
          route: "run_full_analysis",
          reason: "support_request_confirmed"
        };
      },

      runFullAnalysis: function (stepInput: any) {
        callOrder.push("full-analysis");

        expect(stepInput.preAnalysisResult).toEqual({
          route: "run_full_analysis",
          reason: "support_request_confirmed"
        });

        return {
          userLanguage: "fr",
          topics: [
            {
              id_topic: 1,
              topic_label: "Problème de connexion"
            }
          ]
        };
      },

      assembleCurrentAnalysisOutput: function (stepInput: any) {
        callOrder.push("analysis-assembler");

        expect(stepInput.decisionRoute).toEqual({
          shouldAnalyzeMessage: true,
          shouldRunAttachmentAnalysis: true,
          reason: "support_request_confirmed",
          shouldRunPreAnalysis: true,
          shouldRunFullAnalysis: true,
          route: "run_full_analysis"
        });

        expect(stepInput.fullAnalysisResult).toEqual({
          userLanguage: "fr",
          topics: [
            {
              id_topic: 1,
              topic_label: "Problème de connexion"
            }
          ]
        });

        return {
          supportKnowledgeAfterTurn: {
            userLanguage: "fr",
            topics: [
              {
                id_topic: 1,
                topic_label: "Problème de connexion"
              }
            ]
          },
          supportKnowledgeDelta: {
            hasNewInformation: true,
            newTopics: [
              {
                id_topic: 1,
                topic_label: "Problème de connexion"
              }
            ],
            updatedTopics: [],
            resolvedTopics: [],
            newSignals: [],
            newScopeBoundaries: [],
            warningComprehensionChanged: false
          }
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

    expect(output).toEqual({
      supportKnowledgeAfterTurn: {
        userLanguage: "fr",
        topics: [
          {
            id_topic: 1,
            topic_label: "Problème de connexion"
          }
        ]
      },
      supportKnowledgeDelta: {
        hasNewInformation: true,
        newTopics: [
          {
            id_topic: 1,
            topic_label: "Problème de connexion"
          }
        ],
        updatedTopics: [],
        resolvedTopics: [],
        newSignals: [],
        newScopeBoundaries: [],
        warningComprehensionChanged: false
      }
    });
  });

  it("throws an explicit error when a required step is missing", function () {
    const input = {
      latestUserMessage: {
        text: "Bonjour"
      },
      attachments: [],
      ticketMemoryBeforeTurn: null
    };

    expect(function () {
      runMessageAnalysis(input);
    }).toThrow("runDeterministicRouting is not implemented yet");
  });
});