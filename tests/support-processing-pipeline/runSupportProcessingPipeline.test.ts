import {
  runSupportProcessingPipeline
} from "../../src/support-processing-pipeline/runSupportProcessingPipeline";

describe("runSupportProcessingPipeline", function () {
  it("runs all pipeline steps and returns the final output", function () {
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
      attachments: [],
      ticketMemoryBeforeTurn
    };

    const supportKnowledgeAfterTurn = {
      userLanguage: "fr",
      topics: [
        {
          id_topic: 1,
          topic_label: "Problème de connexion"
        }
      ]
    };

    const supportKnowledgeDelta = {
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
    };

    const possibleSolutions = {
      status: "solutions_found",
      solutions: [
        {
          title: "Solution de test"
        }
      ]
    };

    const responsePlan = {
      userLanguage: "fr",
      messages: [
        {
          messageType: "topic_response",
          topicId: 1
        }
      ]
    };

    const userResponse = {
      messages: [
        "Réponse automatique"
      ]
    };

    const ticketMemoryAfterTurn = {
      supportKnowledge: supportKnowledgeAfterTurn,
      supportKnowledgeDeltaHistory: [
        supportKnowledgeDelta
      ],
      conversationLogs: [],
      userInformations: {
        userId: "user_123"
      }
    };

    const callOrder: string[] = [];

    const steps = {
      runMessageAnalysis: function (stepInput: any) {
        callOrder.push("message-analysis");

        expect(stepInput.latestUserMessage).toEqual(input.latestUserMessage);
        expect(stepInput.attachments).toEqual(input.attachments);
        expect(stepInput.ticketMemoryBeforeTurn).toEqual(ticketMemoryBeforeTurn);

        return {
          supportKnowledgeAfterTurn,
          supportKnowledgeDelta
        };
      },

      runSearchDecision: function (stepInput: any) {
        callOrder.push("search-decision");

        expect(stepInput.supportKnowledgeAfterTurn).toEqual(supportKnowledgeAfterTurn);
        expect(stepInput.supportKnowledgeDelta).toEqual(supportKnowledgeDelta);
        expect(stepInput.ticketMemoryBeforeTurn).toEqual(ticketMemoryBeforeTurn);

        return true;
      },

      runSolutionRetrieval: function (stepInput: any) {
        callOrder.push("solution-retrieval");

        expect(stepInput.decisionSearchingSolution).toBe(true);
        expect(stepInput.supportKnowledgeAfterTurn).toEqual(supportKnowledgeAfterTurn);
        expect(stepInput.supportKnowledgeDelta).toEqual(supportKnowledgeDelta);
        expect(stepInput.ticketMemoryBeforeTurn).toEqual(ticketMemoryBeforeTurn);

        return possibleSolutions;
      },

      runResponseDecision: function (stepInput: any) {
        callOrder.push("response-decision");

        expect(stepInput.supportKnowledgeAfterTurn).toEqual(supportKnowledgeAfterTurn);
        expect(stepInput.supportKnowledgeDelta).toEqual(supportKnowledgeDelta);
        expect(stepInput.ticketMemoryBeforeTurn).toEqual(ticketMemoryBeforeTurn);
        expect(stepInput.possibleSolutions).toEqual(possibleSolutions);

        return responsePlan;
      },

      runResponseProduction: function (stepInput: any) {
        callOrder.push("response-production");

        expect(stepInput.responsePlan).toEqual(responsePlan);

        return userResponse;
      },

      runDataProduction: function (stepInput: any) {
        callOrder.push("data-production");

        expect(stepInput.ticketMemoryBeforeTurn).toEqual(ticketMemoryBeforeTurn);
        expect(stepInput.supportKnowledgeAfterTurn).toEqual(supportKnowledgeAfterTurn);
        expect(stepInput.supportKnowledgeDelta).toEqual(supportKnowledgeDelta);
        expect(stepInput.conversationLogs).toEqual(ticketMemoryBeforeTurn.conversationLogs);
        expect(stepInput.userInformations).toEqual(ticketMemoryBeforeTurn.userInformations);
        expect(stepInput.responsePlan).toEqual(responsePlan);

        return ticketMemoryAfterTurn;
      }
    };

    const output = runSupportProcessingPipeline(input, steps);

    expect(callOrder).toEqual([
      "message-analysis",
      "search-decision",
      "solution-retrieval",
      "response-decision",
      "response-production",
      "data-production"
    ]);

    expect(output).toEqual({
      userResponse,
      ticketMemoryAfterTurn
    });
  });
});