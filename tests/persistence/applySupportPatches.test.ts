import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";

import { describe, expect, it, beforeEach, afterEach } from "vitest";

import { matchBufferedMessages } from "../../src/matching/matchBufferedMessages";
import { applySupportPatches } from "../../src/persistence/applySupportPatches";
import { JsonMessageRepository } from "../../src/repositories/json/jsonMessageRepository";
import { JsonTicketRepository } from "../../src/repositories/json/jsonTicketRepository";
import { JsonUserRepository } from "../../src/repositories/json/jsonUserRepository";

import type {
  MatchingResult
} from "../../src/matching/typesMatching.types";
import type {
  DeliveryMessage
} from "../../src/orchestration/typesOrchestration.types";
import type {
  JsonTicket,
  JsonUser
} from "../../src/repositories/json/typesJsonRepositories.types";
import type {
  AccountInteractionTraits,
  AccountProfile,
  AccountTrustStatus,
  ConversationHistory,
  SupportProcessingPipelineOutput,
  SupportTopicKnowledge
} from "../../src/support-processing-pipeline/typesSupportProcessingPipeline.types";

const supportTopicKnowledge: SupportTopicKnowledge = {
  segments_topic: []
};

const conversationHistory = [] as ConversationHistory;

const accountTrustStatus: AccountTrustStatus = {
  status: "trusted",
  reasons: ["test"]
};

const accountProfile: AccountProfile = {
  accountType: "individual",
  actualPlan: "paid",
  paymentStatus: "up_to_date",
  planHistory: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  daysSinceCreation: 155
};

const accountInteractionTraits: AccountInteractionTraits = {
  labels: ["technical"],
  lastUpdatedAt: "2026-06-05T10:00:00.000Z"
};

function buildTicket(overrides: Partial<JsonTicket> = {}): JsonTicket {
  return {
    ticketId: "ticket_1",
    roomId: "!room:example.org",
    userId: "@user:example.org",
    status: "active",
    supportTopicKnowledge,
    conversationHistory,
    createdAt: "2026-06-05T10:00:00.000Z",
    updatedAt: "2026-06-05T10:00:00.000Z",
    ...overrides
  };
}

function buildUser(overrides: Partial<JsonUser> = {}): JsonUser {
  return {
    userId: "@user:example.org",
    accountTrustStatus,
    accountProfile,
    accountInteractionTraits,
    linkedTicketIds: ["ticket_1"],
    createdAt: "2026-06-05T10:00:00.000Z",
    updatedAt: "2026-06-05T10:00:00.000Z",
    ...overrides
  };
}

function buildMatchingResult(
  overrides: Partial<MatchingResult> = {}
): MatchingResult {
  return {
    channel: "matrix",
    roomId: "!room:example.org",
    userId: "@user:example.org",
    messages: [
      {
        channel: "matrix",
        roomId: "!room:example.org",
        userId: "@user:example.org",
        messageId: "$incoming_1",
        content: "Premier message",
        createdAt: "2026-06-05T10:00:00.000Z"
      },
      {
        channel: "matrix",
        roomId: "!room:example.org",
        userId: "@user:example.org",
        messageId: "$incoming_2",
        content: "Deuxième message",
        createdAt: "2026-06-05T10:00:02.000Z"
      }
    ],
    ...overrides
  };
}

function buildDeliveryMessages(): DeliveryMessage[] {
  return [
    {
      localId: "delivery_1",
      channel: "matrix",
      roomId: "!room:example.org",
      userId: "@user:example.org",
      content: "Réponse support",
      metadata: {
        userResponseMessageType: "topic_response"
      }
    }
  ];
}

function buildSupportProcessingOutput(
  overrides: Partial<SupportProcessingPipelineOutput["patches"]["analysisPatch"]["turnUnderstandingDelta"]> = {}
): SupportProcessingPipelineOutput {
  const turnUnderstandingDelta = {
    user_language: "french",
    securityGateSummary: {
      gateChecked: {},
      gateFailed: []
    },
    segments_lack_comprehension: [],
    segments_topic: [],
    segments_signal: [],
    segments_scope_boundary: [],
    segments_suspicious: [],
    ...overrides
  };
  const responsePlan = {
    responseLanguage: "french",
    messagesPlan: {
      scopeBoundaryPlanMessages: [],
      topicPlanMessages: [],
      signalPlanMessages: [],
      handoverPlanMessages: []
    }
  };

  return {
    userResponse: {
      messages: [
        {
          type: "topic_response",
          content: "Réponse support"
        }
      ]
    },
    patches: {
      analysisPatch: {
        turnUnderstandingDelta
      },
      securityPatch: {
        securityGateSummary: {
          gateChecked: {},
          gateFailed: []
        }
      },
      responsePatch: {
        responsePlan
      },
      metadataPatch: {
        generatedAt: "2026-06-05T10:00:05.000Z",
        source: "support-processing-pipeline"
      }
    }
  };
}

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "apply-support-patches-test-"));
}

describe("applySupportPatches", function () {
  let tempDir: string;
  let ticketRepository: JsonTicketRepository;
  let userRepository: JsonUserRepository;
  let messageRepository: JsonMessageRepository;

  beforeEach(async function () {
    tempDir = await createTempDir();
    ticketRepository = new JsonTicketRepository(path.join(tempDir, "tickets.json"));
    userRepository = new JsonUserRepository(path.join(tempDir, "users.json"));
    messageRepository = new JsonMessageRepository(path.join(tempDir, "messages.json"));
  });

  afterEach(async function () {
    await fs.rm(tempDir, {
      recursive: true,
      force: true
    });
  });

  it("stores incoming and outgoing messages", async function () {
    const ticket = buildTicket();
    const user = buildUser();

    await ticketRepository.upsert(ticket);
    await userRepository.upsert(user);

    const result = await applySupportPatches({
      matchingResult: buildMatchingResult({
        ticket,
        user
      }),
      supportProcessingOutput: buildSupportProcessingOutput(),
      deliveryMessages: buildDeliveryMessages(),
      ticketRepository,
      userRepository,
      messageRepository
    });

    expect(result.storedIncomingMessageIds).toEqual([
      "$incoming_1",
      "$incoming_2"
    ]);
    expect(result.storedOutgoingMessageIds).toEqual(["delivery_1"]);

    await expect(messageRepository.list()).resolves.toMatchObject([
      {
        messageId: "$incoming_1",
        direction: "incoming",
        ticketId: "ticket_1"
      },
      {
        messageId: "$incoming_2",
        direction: "incoming",
        ticketId: "ticket_1"
      },
      {
        messageId: "delivery_1",
        direction: "outgoing",
        ticketId: "ticket_1",
        content: "Réponse support"
      }
    ]);
  });

  it("applies patches to an existing ticket and user", async function () {
    const ticket = buildTicket();
    const user = buildUser();

    await ticketRepository.upsert(ticket);
    await userRepository.upsert(user);

    const result = await applySupportPatches({
      matchingResult: buildMatchingResult({
        ticket,
        user
      }),
      supportProcessingOutput: buildSupportProcessingOutput(),
      deliveryMessages: buildDeliveryMessages(),
      ticketRepository,
      userRepository,
      messageRepository
    });

    expect(result).toMatchObject({
      updatedTicketId: "ticket_1",
      updatedUserId: "@user:example.org",
      patchStatus: "applied"
    });
    expect(result.warnings).toEqual([]);

    await expect(ticketRepository.findById("ticket_1")).resolves.toMatchObject({
      updatedAt: "2026-06-05T10:00:05.000Z",
      metadata: {
        lastSupportProcessingPatches: buildSupportProcessingOutput().patches,
        lastSecurityGateSummary: {
          gateChecked: {},
          gateFailed: []
        },
        lastPatchGeneratedAt: "2026-06-05T10:00:05.000Z"
      },
      conversationHistory: expect.arrayContaining([
        expect.objectContaining({
          role: "user",
          message_id: "$incoming_1,$incoming_2"
        }),
        expect.objectContaining({
          role: "bot",
          message_id: "delivery_1"
        })
      ])
    });
    await expect(userRepository.findById("@user:example.org")).resolves
      .toMatchObject({
        updatedAt: "2026-06-05T10:00:05.000Z",
        metadata: {
          lastSupportProcessingMetadataPatch:
            buildSupportProcessingOutput().patches.metadataPatch
        }
      });
  });

  it("persists compact conversation logs and updates contextLLM", async function () {
    const ticket = buildTicket();
    const user = buildUser();
    const supportProcessingOutput = buildSupportProcessingOutput({
      segments_topic: [
        {
          matched_historical_topic: "yes",
          id_topic: 1,
          topic_details: {
            platform: "web"
          }
        }
      ]
    });
    supportProcessingOutput.patches.responsePatch.responsePlan = {
      responseLanguage: "french",
      messagesPlan: {
        scopeBoundaryPlanMessages: [],
        topicPlanMessages: [
          {
            politeness_opening: "understanding_1",
            topic_relation_acknowledgement: {
              no_matched_historical_topic_count: 0,
              matched_historical_topic_count: 1
            },
            topics_responses: [
              {
                topic_response: {
                  title: {
                    topic_id: 1,
                    topic_category: "bug",
                    tool_or_product: "Drive",
                    topic_action: "create",
                    topic_object: "folder",
                    matched_historical_topic: true
                  },
                  updated_fields_acknowledgement: {
                    topic_details: {
                      platform: "web"
                    }
                  },
                  main_response: {
                    type: "ask_fields",
                    details: {
                      fields_requested: ["browser"]
                    }
                  },
                  next_step: "wait_more_info"
                }
              }
            ],
            politeness_closure: "thanks_for_cooperation1"
          }
        ],
        signalPlanMessages: [],
        handoverPlanMessages: []
      }
    };

    await ticketRepository.upsert(ticket);
    await userRepository.upsert(user);

    await applySupportPatches({
      matchingResult: buildMatchingResult({
        ticket,
        user
      }),
      supportProcessingOutput,
      deliveryMessages: buildDeliveryMessages(),
      ticketRepository,
      userRepository,
      messageRepository
    });

    const updatedTicket = await ticketRepository.findById("ticket_1");

    expect(updatedTicket?.conversationHistory).toEqual(expect.arrayContaining([
      expect.objectContaining({
        role: "user"
      }),
      expect.objectContaining({
        role: "bot"
      })
    ]));
    expect(updatedTicket?.conversationHistory.compactInteractionLogs?.map(
      (log) => log.line
    )).toEqual(expect.arrayContaining([
      "User(topic): update_topic topic_id=1 fields=[platform]",
      'Bot(topic): ask_more_info topic_id=1 label="Drive : create : folder" fields=[browser]'
    ]));
    expect(updatedTicket?.conversationHistory.contextLLM).toContain(
      "User(topic): update_topic topic_id=1 fields=[platform]"
    );
    expect(updatedTicket?.metadata).toMatchObject({
      lastSupportProcessingPatches: supportProcessingOutput.patches,
      lastResponsePlan: supportProcessingOutput.patches.responsePatch.responsePlan
    });
  });

  it("keeps only the latest 50 compact conversation logs", async function () {
    const existingCompactLogs = Array.from({ length: 50 }, (_value, index) => {
      return {
        id: `old_${index + 1}`,
        created_at: "2026-06-05T09:00:00.000Z",
        line: `System(note): old_${index + 1}`
      };
    });
    const existingConversationHistory = Object.assign([], {
      compactInteractionLogs: existingCompactLogs,
      contextLLM: existingCompactLogs.map((log) => log.line).join("\n")
    }) as ConversationHistory;
    const ticket = buildTicket({
      conversationHistory: existingConversationHistory
    });
    const supportProcessingOutput = buildSupportProcessingOutput({
      segments_topic: [
        {
          matched_historical_topic: "yes",
          id_topic: 1,
          topic_details: {
            platform: "web"
          }
        }
      ]
    });

    await ticketRepository.upsert(ticket);

    await applySupportPatches({
      matchingResult: buildMatchingResult({
        ticket
      }),
      supportProcessingOutput,
      deliveryMessages: buildDeliveryMessages(),
      ticketRepository,
      userRepository,
      messageRepository
    });

    const updatedTicket = await ticketRepository.findById("ticket_1");
    const compactLogs =
      updatedTicket?.conversationHistory.compactInteractionLogs ?? [];

    expect(compactLogs).toHaveLength(50);
    expect(compactLogs.map((log) => log.id)).not.toContain("old_1");
    expect(updatedTicket?.conversationHistory.contextLLM?.split("\n"))
      .toHaveLength(20);
  });

  it("creates a ticket when no ticket exists and topic knowledge is useful", async function () {
    const supportProcessingOutput = buildSupportProcessingOutput({
      segments_topic: [
        {
          matched_historical_topic: "no",
          id_topic: 1,
          topic_category: "question_faq",
          tool_or_product: "Drive",
          topic_action: "share",
          topic_object: "folder",
          topic_details: {
            question_intent: "how_to"
          },
          user_goal: "Share a folder",
          blocking_issue: "no"
        }
      ]
    });

    const result = await applySupportPatches({
      matchingResult: buildMatchingResult(),
      supportProcessingOutput,
      deliveryMessages: buildDeliveryMessages(),
      ticketRepository,
      userRepository,
      messageRepository
    });

    expect(result).toMatchObject({
      patchStatus: "applied",
      ticketCreated: true,
      storedIncomingMessageIds: ["$incoming_1", "$incoming_2"],
      storedOutgoingMessageIds: ["delivery_1"]
    });
    expect(result.updatedTicketId).toBeDefined();
    expect(result.warnings).toEqual([
      "user patch skipped because no matched user"
    ]);

    const tickets = await ticketRepository.list();
    expect(tickets).toHaveLength(1);
    expect(tickets[0]).toMatchObject({
      ticketId: result.updatedTicketId,
      roomId: "!room:example.org",
      userId: "@user:example.org",
      status: "active",
      supportTopicKnowledge: {
        segments_topic: [
          expect.objectContaining({
            id_topic: 1,
            topic_category: "question_faq",
            tool_or_product: "Drive"
          })
        ]
      },
      metadata: {
        createdFrom: "support-processing-pipeline-patches",
        channel: "matrix",
        lastPatchGeneratedAt: "2026-06-05T10:00:05.000Z"
      }
    });
    await expect(messageRepository.list()).resolves.toMatchObject([
      {
        messageId: "$incoming_1",
        ticketId: result.updatedTicketId
      },
      {
        messageId: "$incoming_2",
        ticketId: result.updatedTicketId
      },
      {
        messageId: "delivery_1",
        ticketId: result.updatedTicketId
      }
    ]);
  });

  it("allows a second turn to match a ticket created from first-turn patches", async function () {
    const supportProcessingOutput = buildSupportProcessingOutput({
      segments_topic: [
        {
          matched_historical_topic: "no",
          id_topic: 1,
          topic_category: "bug",
          tool_or_product: "Drive",
          topic_action: "create",
          topic_object: "folder",
          topic_details: {
            observed_result: "button disabled"
          },
          user_goal: "Create a folder",
          blocking_issue: "yes"
        }
      ]
    });
    const firstTurnResult = await applySupportPatches({
      matchingResult: buildMatchingResult(),
      supportProcessingOutput,
      deliveryMessages: buildDeliveryMessages(),
      ticketRepository,
      userRepository,
      messageRepository
    });

    const secondTurnMatch = await matchBufferedMessages({
      bufferedMessages: {
        channel: "matrix",
        roomId: "!room:example.org",
        userId: "@user:example.org",
        messages: [
          {
            channel: "matrix",
            roomId: "!room:example.org",
            userId: "@user:example.org",
            messageId: "$incoming_3",
            content: "Toujours bloqué",
            createdAt: "2026-06-05T10:01:00.000Z"
          }
        ],
        firstMessageAt: "2026-06-05T10:01:00.000Z",
        lastMessageAt: "2026-06-05T10:01:00.000Z",
        flushedAt: "2026-06-05T10:01:03.000Z"
      },
      ticketRepository,
      userRepository
    });

    expect(secondTurnMatch.ticket).toMatchObject({
      ticketId: firstTurnResult.updatedTicketId,
      status: "active"
    });
  });

  it("skips ticket creation when no useful ticket knowledge is produced", async function () {
    const result = await applySupportPatches({
      matchingResult: buildMatchingResult(),
      supportProcessingOutput: buildSupportProcessingOutput(),
      deliveryMessages: buildDeliveryMessages(),
      ticketRepository,
      userRepository,
      messageRepository
    });

    expect(result).toMatchObject({
      patchStatus: "skipped",
      storedIncomingMessageIds: ["$incoming_1", "$incoming_2"],
      storedOutgoingMessageIds: ["delivery_1"]
    });
    expect(result.warnings).toEqual([
      "no useful ticket knowledge; ticket not created",
      "user patch skipped because no matched user"
    ]);
    await expect(ticketRepository.list()).resolves.toEqual([]);
    await expect(userRepository.list()).resolves.toEqual([]);
    const storedMessages = await messageRepository.list();

    expect(storedMessages).toMatchObject([
      {
        messageId: "$incoming_1"
      },
      {
        messageId: "$incoming_2"
      },
      {
        messageId: "delivery_1"
      }
    ]);
    expect(storedMessages[0]).not.toHaveProperty("ticketId");
    expect(storedMessages[1]).not.toHaveProperty("ticketId");
    expect(storedMessages[2]).not.toHaveProperty("ticketId");
  });
});
