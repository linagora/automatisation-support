import {
  runResponseDecision
} from "../../../src/support-processing-pipeline/response-decision/runResponseDecision";

describe("runResponseDecision", function () {
  it("runs all response-decision steps and returns a responsePlan", function () {
    const analysisDelta = {
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
      newScopeBoundaries: []
    };

    const input = {
      currentAnalysisOutput: {
        user_language: "fr",
        warning_comprehension: "no",
        segments: [
          {
            segment_type: "topic",
            id_topic: 1,
            topic_label: "Problème de connexion"
          }
        ],
        analysisDelta
      },
      analysisDelta,
      previousAnalysisOutput: null,
      conversationLogs: [],
      attemptHistory: [],
      userInformations: {
        userId: "user_123"
      },
      possibleSolutions: {
        status: "solutions_found",
        solutions: [
          {
            title: "Réinitialiser le mot de passe"
          }
        ]
      }
    };

    const callOrder: string[] = [];

    const steps = {
      initializeResponsePlan: function () {
        callOrder.push("initialize-response-plan");

        return {
          userLanguage: "fr",
          messages: []
        };
      },

      handleStandaloneSignalOrScopeBoundary: function () {
        callOrder.push("standalone-signal-or-scope-boundary");

        return null;
      },

      addPolitenessIntroduction: function ({ responsePlan }: any) {
        callOrder.push("add-politeness-introduction");

        return {
          ...responsePlan,
          messages: [
            ...responsePlan.messages,
            {
              messageType: "politeness_introduction"
            }
          ]
        };
      },

      addWarningComprehensionMessage: function ({ responsePlan }: any) {
        callOrder.push("add-warning-comprehension-message");

        return responsePlan;
      },

      addTopicResponseMessages: function ({ responsePlan }: any) {
        callOrder.push("add-topic-response-messages");

        return {
          ...responsePlan,
          messages: [
            ...responsePlan.messages,
            {
              messageType: "topic_response",
              topicId: 1,
              topicLabel: "Problème de connexion",
              variables: {
                mainResponseType: "direct_answer"
              }
            }
          ]
        };
      },

      addPolitenessClosure: function ({ responsePlan }: any) {
        callOrder.push("add-politeness-closure");

        return {
          ...responsePlan,
          messages: [
            ...responsePlan.messages,
            {
              messageType: "politeness_closure"
            }
          ]
        };
      },

      addSignalAndScopeBoundaryMessages: function ({ responsePlan }: any) {
        callOrder.push("add-signal-and-scope-boundary-messages");

        return responsePlan;
      }
    };

    const output = runResponseDecision(input, steps);

    expect(callOrder).toEqual([
      "initialize-response-plan",
      "standalone-signal-or-scope-boundary",
      "add-politeness-introduction",
      "add-warning-comprehension-message",
      "add-topic-response-messages",
      "add-politeness-closure",
      "add-signal-and-scope-boundary-messages"
    ]);

    expect(output).toEqual({
      userLanguage: "fr",
      messages: [
        {
          messageType: "politeness_introduction"
        },
        {
          messageType: "topic_response",
          topicId: 1,
          topicLabel: "Problème de connexion",
          variables: {
            mainResponseType: "direct_answer"
          }
        },
        {
          messageType: "politeness_closure"
        }
      ]
    });
  });

  it("stops early when standalone signal or scope boundary produces a responsePlan", function () {
    const analysisDelta = {
      hasNewInformation: true,
      newTopics: [],
      updatedTopics: [],
      resolvedTopics: [],
      newSignals: [
        {
          signal_verbatim: "Merci beaucoup",
          signal_types: ["thanks"]
        }
      ],
      newScopeBoundaries: []
    };

    const input = {
      currentAnalysisOutput: {
        user_language: "fr",
        warning_comprehension: "no",
        segments: [
          {
            segment_type: "signal",
            signal_verbatim: "Merci beaucoup",
            signal_types: ["thanks"]
          }
        ],
        analysisDelta
      },
      analysisDelta,
      previousAnalysisOutput: null,
      conversationLogs: [],
      attemptHistory: [],
      userInformations: {},
      possibleSolutions: {
        status: "not_searched"
      }
    };

    const callOrder: string[] = [];

    const steps = {
      initializeResponsePlan: function () {
        callOrder.push("initialize-response-plan");

        return {
          userLanguage: "fr",
          messages: []
        };
      },

      handleStandaloneSignalOrScopeBoundary: function () {
        callOrder.push("standalone-signal-or-scope-boundary");

        return {
          userLanguage: "fr",
          messages: [
            {
              messageType: "standalone_signal",
              variables: {
                signalType: "thanks"
              }
            }
          ]
        };
      },

      addPolitenessIntroduction: function ({ responsePlan }: any) {
        callOrder.push("add-politeness-introduction");

        return responsePlan;
      },

      addWarningComprehensionMessage: function ({ responsePlan }: any) {
        callOrder.push("add-warning-comprehension-message");

        return responsePlan;
      },

      addTopicResponseMessages: function ({ responsePlan }: any) {
        callOrder.push("add-topic-response-messages");

        return responsePlan;
      },

      addPolitenessClosure: function ({ responsePlan }: any) {
        callOrder.push("add-politeness-closure");

        return responsePlan;
      },

      addSignalAndScopeBoundaryMessages: function ({ responsePlan }: any) {
        callOrder.push("add-signal-and-scope-boundary-messages");

        return responsePlan;
      }
    };

    const output = runResponseDecision(input, steps);

    expect(callOrder).toEqual([
      "initialize-response-plan",
      "standalone-signal-or-scope-boundary"
    ]);

    expect(output).toEqual({
      userLanguage: "fr",
      messages: [
        {
          messageType: "standalone_signal",
          variables: {
            signalType: "thanks"
          }
        }
      ]
    });
  });

  it("throws an explicit error when a required step is missing", function () {
    const analysisDelta = {
      hasNewInformation: false,
      newTopics: [],
      updatedTopics: [],
      resolvedTopics: [],
      newSignals: [],
      newScopeBoundaries: []
    };

    const input = {
      currentAnalysisOutput: {
        user_language: "fr",
        warning_comprehension: "no",
        segments: [],
        analysisDelta
      },
      analysisDelta,
      previousAnalysisOutput: null,
      conversationLogs: [],
      attemptHistory: [],
      userInformations: {},
      possibleSolutions: {
        status: "not_searched"
      }
    };

    expect(function () {
      runResponseDecision(input);
    }).toThrow("initializeResponsePlan is not implemented yet");
  });
});