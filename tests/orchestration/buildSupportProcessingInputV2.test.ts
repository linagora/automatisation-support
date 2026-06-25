import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { matchBufferedMessages } from "../../src/matching/matchBufferedMessages";
import {
  buildSupportProcessingInputV2
} from "../../src/orchestration/buildSupportProcessingInputV2";
import { JsonTicketRepository } from "../../src/repositories/json/jsonTicketRepository";
import { JsonUserRepository } from "../../src/repositories/json/jsonUserRepository";

import type {
  BufferedMessages
} from "../../src/messaging/typesMessaging.types";
import type {
  JsonTicket
} from "../../src/repositories/json/typesJsonRepositories.types";
import type {
  ConversationHistory
} from "../../src/support-processing-pipeline/typesSupportProcessingPipeline.types";

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
}): JsonTicket {
  return {
    ticketId: params.ticketId,
    channel: "matrix",
    roomId: params.roomId ?? "!room:example.org",
    threadId: params.threadId,
    userId: "@user:example.org",
    status: "active",
    supportTopicKnowledge: {
      segments_topic: []
    },
    conversationHistory: buildConversationHistory(params),
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

  it("uses distinct latest user and bot summaries from the same conversation", async function () {
    await ticketRepository.upsert(buildTicket({
      ticketId: "thread_one",
      threadId: "$thread-one",
      userSummary: "Le compte reste bloqué.",
      botSummary: "Le bot a demandé si une erreur est affichée.",
      botQuestionFieldNames: ["error_message"]
    }));

    const matchingResult = await matchBufferedMessages({
      bufferedMessages: buildBufferedMessages({
        threadId: "$thread-one"
      }),
      ticketRepository,
      userRepository
    });
    const input = buildSupportProcessingInputV2(matchingResult);

    expect(input.latestUserMessage.content).toBe("Oui");
    expect(input.conversationScope).toEqual({
      channel: "matrix",
      roomId: "!room:example.org",
      threadId: "$thread-one",
      userId: "@user:example.org"
    });
    expect(input.recentInteractionContext).toEqual({
      previousUserMessageSummary: "Le compte reste bloqué.",
      previousBotResponseSummary:
        "Le bot a demandé si une erreur est affichée.",
      previousBotQuestionFieldNames: ["error_message"]
    });
  });

  it("does not reuse recent context from another thread or room", async function () {
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

    const otherThreadMatch = await matchBufferedMessages({
      bufferedMessages: buildBufferedMessages({
        threadId: "$thread-two"
      }),
      ticketRepository,
      userRepository
    });
    const otherRoomMatch = await matchBufferedMessages({
      bufferedMessages: buildBufferedMessages({
        roomId: "!other-room:example.org",
        threadId: "$thread-one"
      }),
      ticketRepository,
      userRepository
    });

    expect(
      buildSupportProcessingInputV2(otherThreadMatch).recentInteractionContext
    ).toEqual({
      previousUserMessageSummary: "Contexte du second thread.",
      previousBotResponseSummary: "Réponse du second thread."
    });
    expect(
      buildSupportProcessingInputV2(otherRoomMatch).recentInteractionContext
    ).toEqual({
      previousUserMessageSummary: "No previous user message summary.",
      previousBotResponseSummary: "No previous bot response summary."
    });
  });
});
