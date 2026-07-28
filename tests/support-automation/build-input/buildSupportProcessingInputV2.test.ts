import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildSupportProcessingInputV2
} from "../../../src/support-automation/build-input/buildSupportProcessingInputV2";
import {
  buildSupportTurnIdentityV2
} from "../../../src/support-automation/build-input/buildSupportTurnIdentityV2";
import { JsonTicketRepository } from "../../../src/archive/repositories/json/jsonTicketRepository";
import { JsonUserRepository } from "../../../src/archive/repositories/json/jsonUserRepository";

import type {
  BufferedMessages
} from "../../../src/support-automation/buffer/typesMessaging.types";
import type {
  JsonTicket
} from "../../../src/archive/repositories/json/typesJsonRepositories.types";
import type {
  ConversationHistory
} from "../../../src/support-automation/support-processing-pipeline-v2-LEGACY/typesConversationContext.types";
import type {
  LiveMemoryContext
} from "../../../src/infrastructure/live-memory/typesLiveMemoryContext.types";

function buildConversationHistory(params: {
  userSummary: string;
  botSummary: string;
  botQuestionFieldNames?: string[];
}): ConversationHistory {
  return [
    {
      id: "history_user_1",
      message_id: "$user_1",
      created_at: "2026-06-22T10:00:00.000Z",
      role: "user",
      summary: params.userSummary,
      turnUnderstandingDelta: {
        user_language: "french",
        segments_lack_comprehension: [],
        segments_topic: [],
        segments_signal: [],
        segments_scope_boundary: [],
        segments_suspicious: []
      }
    },
    {
      id: "history_bot_1",
      message_id: "$bot_1",
      created_at: "2026-06-22T10:00:01.000Z",
      role: "bot",
      summary: params.botSummary,
      responsePlan: {
        responseLanguage: "french",
        messagesPlan: {
          scopeBoundaryPlanMessages: [],
          topicPlanMessages: [],
          signalPlanMessages: [],
          handoverPlanMessages: []
        },
        ...(params.botQuestionFieldNames
          ? {
              metadata: {
                v2ResponsePlan: {
                  questionDecision: {
                    fieldNames: params.botQuestionFieldNames
                  }
                }
              }
            }
          : {})
      }
    }
  ] as ConversationHistory;
}

function buildTicket(params: {
  ticketId: string;
  roomId?: string;
  threadId: string | null;
  userSummary: string;
  botSummary: string;
  botQuestionFieldNames?: string[];
  supportTopicKnowledge?: JsonTicket["supportTopicKnowledge"];
}): JsonTicket {
  return {
    ticketId: params.ticketId,
    channel: "matrix",
    roomId: params.roomId ?? "!room:example.org",
    threadId: params.threadId,
    userId: "@user:example.org",
    status: "active",
    supportTopicKnowledge: params.supportTopicKnowledge ?? {
      segments_topic: []
    },
    conversationHistory:
      buildConversationHistory(params) as JsonTicket["conversationHistory"],
    createdAt: "2026-06-22T10:00:00.000Z",
    updatedAt: "2026-06-22T10:00:01.000Z"
  };
}

function buildBufferedMessages(params: {
  roomId?: string;
  threadId: string | null;
}): BufferedMessages {
  const roomId = params.roomId ?? "!room:example.org";

  return {
    channel: "matrix",
    roomId,
    threadId: params.threadId,
    userId: "@user:example.org",
    messages: [
      {
        channel: "matrix",
        roomId,
        ...(params.threadId ? { threadId: params.threadId } : {}),
        userId: "@user:example.org",
        messageId: "$current",
        content: "Oui",
        createdAt: "2026-06-22T10:01:00.000Z"
      }
    ],
    firstMessageAt: "2026-06-22T10:01:00.000Z",
    lastMessageAt: "2026-06-22T10:01:00.000Z",
    flushedAt: "2026-06-22T10:01:02.000Z"
  };
}

function buildInputParams(bufferedMessages: BufferedMessages) {
  return {
    bufferedMessages,
    turnIdentity: buildSupportTurnIdentityV2(bufferedMessages)
  };
}

describe("buildSupportProcessingInputV2", function () {
  let tempDir: string;
  let ticketRepository: JsonTicketRepository;
  let userRepository: JsonUserRepository;

  beforeEach(async function () {
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "support-input-v2-test-")
    );
    ticketRepository = new JsonTicketRepository(
      path.join(tempDir, "tickets.json")
    );
    userRepository = new JsonUserRepository(
      path.join(tempDir, "users.json")
    );
  });

  afterEach(async function () {
    await fs.rm(tempDir, {
      recursive: true,
      force: true
    });
  });

  it("ignores legacy ticket context when live memory is absent", async function () {
    await ticketRepository.upsert(buildTicket({
      ticketId: "thread_one",
      threadId: "$thread-one",
      userSummary: "Ancien contexte Pixel 6 version 2.1.3 notifications.",
      botSummary: "Ancien bot a demandé la version Android.",
      botQuestionFieldNames: ["device", "app_version"],
      supportTopicKnowledge: {
        segments_topic: [
          {
            id_topic: 99,
            topic_category: "bug",
            topic_label: "Legacy notifications Pixel 6",
            topic_details: {
              device: "Pixel 6",
              app_version: "2.1.3"
            },
            user_goal: "Legacy notification issue",
            blocking_issue: "no"
          }
        ]
      }
    }));

    const bufferedMessages = buildBufferedMessages({
      threadId: "$thread-one"
    });
    const input = buildSupportProcessingInputV2(
      buildInputParams(bufferedMessages)
    );

    expect(input.latestUserMessage.content).toBe("Oui");
    expect(input.conversationScope).toEqual({
      channel: "matrix",
      roomId: "!room:example.org",
      threadId: "$thread-one",
      userId: "@user:example.org"
    });
    expect(input.supportTopicKnowledge).toEqual({
      topics: []
    });
    expect(input.conversationHistory).toEqual([]);
    expect(input.recentInteractionContext).toEqual({
      previousUserMessageSummary: "No relevant previous user message.",
      previousBotResponseSummary: "No relevant previous bot response.",
      previousBotQuestionFieldNames: []
    });
    expect(JSON.stringify(input)).not.toContain("Pixel 6");
    expect(JSON.stringify(input)).not.toContain("2.1.3");
    expect(JSON.stringify(input)).not.toContain("notifications");
  });

  it("uses live memory topics and recent verbatims before legacy ticket context", async function () {
    await ticketRepository.upsert({
      ...buildTicket({
        ticketId: "thread_one",
        threadId: "$thread-one",
        userSummary: "Ancien résumé utilisateur.",
        botSummary: "Ancienne réponse bot.",
        botQuestionFieldNames: ["error_message"]
      }),
      supportTopicKnowledge: {
        segments_topic: [
          {
            id_topic: 99,
            topic_category: "billing",
            topic_label: "Legacy topic",
            topic_details: {},
            user_goal: "Legacy goal",
            blocking_issue: "no"
          }
        ]
      }
    });

    const liveMemoryContext: LiveMemoryContext = {
      topics: [
        {
          topicId: 42,
          title: "Notifications Android",
          broadCategoryHint: "bug",
          summary: "Les notifications Android ne se déclenchent plus.",
          caseDetails: [
            {
              key: "platform",
              value: "Android",
              evidence: "Android"
            },
            {
              key: "error_message",
              value: null,
              evidence: "Pas de message d'erreur"
            }
          ],
          attemptedActions: [
            {
              action: "Réinstaller l'application",
              outcome: "failed",
              evidence: "déjà réinstallé"
            }
          ]
        }
      ],
      lastUserVerbatim: "Toujours rien après réinstallation.",
      lastBotVerbatim: "Pouvez-vous confirmer la version Android ?",
      userState: {
        status: "normal",
        flags: []
      }
    };
    const bufferedMessages = buildBufferedMessages({
      threadId: "$thread-one"
    });
    const input = buildSupportProcessingInputV2({
      ...buildInputParams(bufferedMessages),
      liveMemoryContext
    });

    expect(input.supportTopicKnowledge.topics).toEqual([
      {
        topicId: 42,
        title: "Notifications Android",
        broadCategoryHint: "bug",
        summary: "Les notifications Android ne se déclenchent plus.",
        caseDetails: [
          {
            key: "platform",
            value: "Android",
            evidence: "Android"
          },
          {
            key: "error_message",
            value: null,
            evidence: "Pas de message d'erreur"
          }
        ],
        attemptedActions: [
          {
            action: "Réinstaller l'application",
            outcome: "failed",
            evidence: "déjà réinstallé"
          }
        ],
        supportKnowledgeSummary: null
      }
    ]);
    expect(input.conversationHistory).toEqual([]);
    expect(input.recentInteractionContext).toEqual({
      previousUserMessageSummary: "Toujours rien après réinstallation.",
      previousBotResponseSummary:
        "Pouvez-vous confirmer la version Android ?",
      previousBotQuestionFieldNames: []
    });
    expect(JSON.stringify(input.supportTopicKnowledge)).not.toContain(
      "Legacy topic"
    );
    expect(JSON.stringify(input.recentInteractionContext)).not.toContain(
      "Ancien"
    );
  });

  it("does not reuse legacy recent context from any thread or room", async function () {
    await ticketRepository.upsert(buildTicket({
      ticketId: "thread_one",
      threadId: "$thread-one",
      userSummary: "Contexte du premier thread.",
      botSummary: "Réponse du premier thread."
    }));
    await ticketRepository.upsert(buildTicket({
      ticketId: "thread_two",
      threadId: "$thread-two",
      userSummary: "Contexte du second thread.",
      botSummary: "Réponse du second thread."
    }));

    const otherThreadMessages = buildBufferedMessages({
      threadId: "$thread-two"
    });
    const otherRoomMessages = buildBufferedMessages({
      roomId: "!other-room:example.org",
      threadId: "$thread-one"
    });

    expect(
      buildSupportProcessingInputV2(
        buildInputParams(otherThreadMessages)
      ).recentInteractionContext
    ).toEqual({
      previousUserMessageSummary: "No relevant previous user message.",
      previousBotResponseSummary: "No relevant previous bot response.",
      previousBotQuestionFieldNames: []
    });
    expect(
      buildSupportProcessingInputV2(
        buildInputParams(otherRoomMessages)
      ).recentInteractionContext
    ).toEqual({
      previousUserMessageSummary: "No relevant previous user message.",
      previousBotResponseSummary: "No relevant previous bot response.",
      previousBotQuestionFieldNames: []
    });
  });
});
