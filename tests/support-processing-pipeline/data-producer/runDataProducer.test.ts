import {
  runDataProducer
} from "../../../src/support-processing-pipeline/data-producer/runDataProducer";

describe("runDataProducer", function () {
  it("runs all data-producer steps and returns ticketMemoryAfterTurn", function () {
    const ticketMemoryBeforeTurn = {
      supportKnowledge: {
        topics: []
      },
      supportKnowledgeDeltaHistory: [],
      conversationLogs: [
        {
          role: "user",
          content: "Ancien message"
        }
      ],
      userInformations: {
        userId: "user_123"
      },
      visibility: {
        userVisible: true
      },
      metadata: {
        version: 1
      }
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
      newScopeBoundaries: []
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

    const input = {
      ticketMemoryBeforeTurn,
      supportKnowledgeAfterTurn,
      supportKnowledgeDelta,
      conversationLogs: ticketMemoryBeforeTurn.conversationLogs,
      userInformations: ticketMemoryBeforeTurn.userInformations,
      responsePlan
    };

    const conversationLogsAfterTurn = [
      ...ticketMemoryBeforeTurn.conversationLogs,
      {
        role: "assistant",
        responsePlan
      }
    ];

    const supportKnowledgeDeltaMemory = {
      supportKnowledgeDeltaHistory: [
        supportKnowledgeDelta
      ]
    };

    const visibilityAfterTurn = {
      userVisible: true,
      agentVisible: true
    };

    const cleanupResult = {
      removedObsoleteSignals: 0,
      compactedConversationLogs: false
    };

    const ticketMemoryAfterTurn = {
      supportKnowledge: supportKnowledgeAfterTurn,
      supportKnowledgeDeltaHistory: [
        supportKnowledgeDelta
      ],
      conversationLogs: conversationLogsAfterTurn,
      userInformations: {
        userId: "user_123"
      },
      visibility: visibilityAfterTurn,
      metadata: {
        version: 2
      }
    };

    const callOrder: string[] = [];

    const steps = {
      updateConversationLogs: function (stepInput: any) {
        callOrder.push("update-conversation-logs");

        expect(stepInput.conversationLogs).toEqual(input.conversationLogs);
        expect(stepInput.responsePlan).toEqual(responsePlan);
        expect(stepInput.ticketMemoryBeforeTurn).toEqual(ticketMemoryBeforeTurn);

        return conversationLogsAfterTurn;
      },

      updateSupportKnowledgeDeltaMemory: function (stepInput: any) {
        callOrder.push("update-support-knowledge-delta-memory");

        expect(stepInput.supportKnowledgeDelta).toEqual(supportKnowledgeDelta);
        expect(stepInput.ticketMemoryBeforeTurn).toEqual(ticketMemoryBeforeTurn);

        return supportKnowledgeDeltaMemory;
      },

      updateVisibility: function (stepInput: any) {
        callOrder.push("update-visibility");

        expect(stepInput.supportKnowledgeAfterTurn).toEqual(supportKnowledgeAfterTurn);
        expect(stepInput.supportKnowledgeDelta).toEqual(supportKnowledgeDelta);
        expect(stepInput.ticketMemoryBeforeTurn).toEqual(ticketMemoryBeforeTurn);

        return visibilityAfterTurn;
      },

      cleanupAndCompact: function (stepInput: any) {
        callOrder.push("cleanup-and-compact");

        expect(stepInput.ticketMemoryBeforeTurn).toEqual(ticketMemoryBeforeTurn);
        expect(stepInput.supportKnowledgeAfterTurn).toEqual(supportKnowledgeAfterTurn);
        expect(stepInput.supportKnowledgeDelta).toEqual(supportKnowledgeDelta);

        return cleanupResult;
      },

      assembleTicketMemory: function (stepInput: any) {
        callOrder.push("assemble-ticket-memory");

        expect(stepInput.ticketMemoryBeforeTurn).toEqual(ticketMemoryBeforeTurn);
        expect(stepInput.supportKnowledgeAfterTurn).toEqual(supportKnowledgeAfterTurn);
        expect(stepInput.supportKnowledgeDelta).toEqual(supportKnowledgeDelta);
        expect(stepInput.conversationLogsAfterTurn).toEqual(conversationLogsAfterTurn);
        expect(stepInput.supportKnowledgeDeltaMemory).toEqual(supportKnowledgeDeltaMemory);
        expect(stepInput.visibilityAfterTurn).toEqual(visibilityAfterTurn);
        expect(stepInput.cleanupResult).toEqual(cleanupResult);
        expect(stepInput.userInformations).toEqual(input.userInformations);
        expect(stepInput.responsePlan).toEqual(responsePlan);

        return ticketMemoryAfterTurn;
      }
    };

    const output = runDataProducer(input, steps);

    expect(callOrder).toEqual([
      "update-conversation-logs",
      "update-support-knowledge-delta-memory",
      "update-visibility",
      "cleanup-and-compact",
      "assemble-ticket-memory"
    ]);

    expect(output).toEqual(ticketMemoryAfterTurn);
  });

  it("throws an explicit error when updateConversationLogs is missing", function () {
    const input = {
      ticketMemoryBeforeTurn: null,
      supportKnowledgeAfterTurn: {},
      supportKnowledgeDelta: {},
      conversationLogs: [],
      userInformations: {},
      responsePlan: {
        messages: []
      }
    };

    expect(function () {
      runDataProducer(input);
    }).toThrow("updateConversationLogs is not implemented yet");
  });

  it("throws an explicit error when assembleTicketMemory is missing", function () {
    const input = {
      ticketMemoryBeforeTurn: null,
      supportKnowledgeAfterTurn: {},
      supportKnowledgeDelta: {},
      conversationLogs: [],
      userInformations: {},
      responsePlan: {
        messages: []
      }
    };

    const steps = {
      updateConversationLogs: function () {
        return [];
      },

      updateSupportKnowledgeDeltaMemory: function () {
        return {};
      },

      updateVisibility: function () {
        return {};
      },

      cleanupAndCompact: function () {
        return {};
      }
    };

    expect(function () {
      runDataProducer(input, steps);
    }).toThrow("assembleTicketMemory is not implemented yet");
  });
});