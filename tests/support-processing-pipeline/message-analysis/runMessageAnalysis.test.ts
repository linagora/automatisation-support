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
      runInputCleaning: function (stepInput: any) {
        callOrder.push("input-cleaning");

        expect(stepInput.latestUserMessage).toEqual(input.latestUserMessage);
        expect(stepInput.attachments).toEqual(input.attachments);
        expect(stepInput.ticketMemoryBeforeTurn).toEqual(ticketMemoryBeforeTurn);

        return {
          shouldAnalyzeMessage: true,
          shouldDescribeAttachments: true,
          reason: "message_has_attachment"
        };
      },

      runAttachmentAnalysis: function (stepInput: any) {
        callOrder.push("attachment-analysis");

        expect(stepInput.inputCleaning).toEqual({
          shouldAnalyzeMessage: true,
          shouldDescribeAttachments: true,
          reason: "message_has_attachment"
        });

        return {
          status: stepInput.inputCleaning.shouldDescribeAttachments ? "described" : "skipped",
          extractedText: "Erreur de connexion visible sur la capture."
        };
      },

      decideRunPreAnalysis: function (stepInput: any) {
        callOrder.push("run-decision-pre-analysis");

        expect(stepInput.attachmentAnalysis).toEqual({
          status: "described",
          extractedText: "Erreur de connexion visible sur la capture."
        });

        return {
          shouldRunPreAnalysisLlm0: true,
          shouldRunSupportAnalysisLlm1: true,
          reason: "support_request_confirmed"
        };
      },

      runPreAnalysisLlm0: function (stepInput: any) {
        callOrder.push("pre-analysis-llm0");

        expect(stepInput.runDecisionPreAnalysis).toEqual({
          shouldRunPreAnalysisLlm0: true,
          shouldRunSupportAnalysisLlm1: true,
          reason: "support_request_confirmed"
        });

        return {
          route: "run_support_analysis_llm1",
          reason: "support_request_confirmed"
        };
      },

      runSupportAnalysisLlm1: function (stepInput: any) {
        callOrder.push("support-analysis-llm1");

        expect(stepInput.preAnalysisLlm0).toEqual({
          route: "run_support_analysis_llm1",
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

      assembleSupportKnowledge: function (stepInput: any) {
        callOrder.push("support-knowledge-assembly");

        expect(stepInput.inputCleaning).toEqual({
          shouldAnalyzeMessage: true,
          shouldDescribeAttachments: true,
          reason: "message_has_attachment"
        });

        expect(stepInput.attachmentAnalysis).toEqual({
          status: "described",
          extractedText: "Erreur de connexion visible sur la capture."
        });

        expect(stepInput.runDecisionPreAnalysis).toEqual({
          shouldRunPreAnalysisLlm0: true,
          shouldRunSupportAnalysisLlm1: true,
          reason: "support_request_confirmed"
        });

        expect(stepInput.preAnalysisLlm0).toEqual({
          route: "run_support_analysis_llm1",
          reason: "support_request_confirmed"
        });

        expect(stepInput.supportAnalysisLlm1).toEqual({
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
      "input-cleaning",
      "attachment-analysis",
      "run-decision-pre-analysis",
      "pre-analysis-llm0",
      "support-analysis-llm1",
      "support-knowledge-assembly"
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
    }).toThrow("runInputCleaning is not implemented yet");
  });
});