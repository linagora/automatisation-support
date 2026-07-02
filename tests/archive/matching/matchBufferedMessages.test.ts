import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";

import { matchBufferedMessages } from "../../src/archive/matching/matchBufferedMessages";
import { JsonTicketRepository } from "../../src/archive/repositories/json/jsonTicketRepository";
import { JsonUserRepository } from "../../src/archive/repositories/json/jsonUserRepository";

import type {
  BufferedMessages
} from "../../src/support-automation/buffer/typesMessaging.types";
import type {
  JsonTicket,
  JsonUser
} from "../../src/archive/repositories/json/typesJsonRepositories.types";
import type {
  AccountInteractionTraits,
  AccountProfile,
  AccountTrustStatus,
  ConversationHistory,
  SupportTopicKnowledge
} from "../../src/archive/support-processing-pipeline/typesSupportProcessingPipeline.types";

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
  createdAt: "2026-06-05T10:00:00.000Z",
  daysSinceCreation: 155
};

const accountInteractionTraits: AccountInteractionTraits = {
  labels: ["technical"],
  likelyToBeHelpedByBot: true,
  lastUpdatedAt: "2026-06-05T10:00:00.000Z"
};

function buildBufferedMessages(): BufferedMessages {
  return {
    channel: "matrix",
    roomId: "!room:example.org",
    userId: "@user:example.org",
    messages: [
      {
        channel: "matrix",
        roomId: "!room:example.org",
        userId: "@user:example.org",
        messageId: "$message_1",
        content: "Bonjour",
        createdAt: "2026-06-05T10:00:00.000Z"
      }
    ],
    firstMessageAt: "2026-06-05T10:00:00.000Z",
    lastMessageAt: "2026-06-05T10:00:00.000Z",
    flushedAt: "2026-06-05T10:00:05.000Z"
  };
}

function buildTicket(overrides: Partial<JsonTicket> = {}): JsonTicket {
  return {
    ticketId: "ticket_1",
    channel: "matrix",
    roomId: "!room:example.org",
    threadId: null,
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

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "matching-test-"));
}

describe("matchBufferedMessages", function () {
  let tempDir: string;
  let ticketRepository: JsonTicketRepository;
  let userRepository: JsonUserRepository;

  beforeEach(async function () {
    tempDir = await createTempDir();
    ticketRepository = new JsonTicketRepository(path.join(tempDir, "tickets.json"));
    userRepository = new JsonUserRepository(path.join(tempDir, "users.json"));
  });

  afterEach(async function () {
    await fs.rm(tempDir, {
      recursive: true,
      force: true
    });
  });

  it("returns the active ticket and user for the buffered room/user", async function () {
    const activeTicket = buildTicket();
    const user = buildUser();

    await ticketRepository.upsert(buildTicket({
      ticketId: "inactive_ticket",
      status: "inactive"
    }));
    await ticketRepository.upsert(activeTicket);
    await userRepository.upsert(user);

    await expect(
      matchBufferedMessages({
        bufferedMessages: buildBufferedMessages(),
        ticketRepository,
        userRepository
      })
    ).resolves.toEqual({
      channel: "matrix",
      roomId: "!room:example.org",
      threadId: null,
      userId: "@user:example.org",
      messages: buildBufferedMessages().messages,
      ticket: activeTicket,
      user
    });
  });

  it("does not create a ticket or user when none exists", async function () {
    const result = await matchBufferedMessages({
      bufferedMessages: buildBufferedMessages(),
      ticketRepository,
      userRepository
    });

    expect(result).toEqual({
      channel: "matrix",
      roomId: "!room:example.org",
      threadId: null,
      userId: "@user:example.org",
      messages: buildBufferedMessages().messages
    });
    await expect(ticketRepository.list()).resolves.toEqual([]);
    await expect(userRepository.list()).resolves.toEqual([]);
  });
});
