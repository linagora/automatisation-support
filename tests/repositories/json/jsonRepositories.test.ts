import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";

import { JsonFileStore } from "../../../src/repositories/json/jsonFileStore";
import { JsonMessageRepository } from "../../../src/repositories/json/jsonMessageRepository";
import { JsonTicketRepository } from "../../../src/repositories/json/jsonTicketRepository";
import { JsonUserRepository } from "../../../src/repositories/json/jsonUserRepository";

import type {
  AccountInteractionTraits,
  AccountProfile,
  AccountTrustStatus,
  ConversationHistory,
  SupportTopicKnowledge
} from "../../../src/support-processing-pipeline/typesSupportProcessingPipeline.types";
import type {
  JsonStoredMessage,
  JsonTicket,
  JsonUser
} from "../../../src/repositories/json/typesJsonRepositories.types";

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
  planHistory: [
    {
      plan: "paid",
      startedAt: "2026-01-01T00:00:00.000Z",
      endedAt: null
    }
  ],
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

function buildMessage(
  overrides: Partial<JsonStoredMessage> = {}
): JsonStoredMessage {
  return {
    messageId: "$message_1",
    channel: "matrix",
    roomId: "!room:example.org",
    userId: "@user:example.org",
    ticketId: "ticket_1",
    direction: "incoming",
    content: "Bonjour",
    createdAt: "2026-06-05T10:00:00.000Z",
    ...overrides
  };
}

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "json-repositories-test-"));
}

describe("JSON repositories", function () {
  let tempDir: string;

  beforeEach(async function () {
    tempDir = await createTempDir();
  });

  afterEach(async function () {
    await fs.rm(tempDir, {
      recursive: true,
      force: true
    });
  });

  it("creates an empty array when reading a missing JSON file", async function () {
    const filePath = path.join(tempDir, "missing", "items.json");
    const store = new JsonFileStore<{ id: string }>(filePath);

    await expect(store.readAll()).resolves.toEqual([]);
    await expect(fs.readFile(filePath, "utf8")).resolves.toBe("[]\n");
  });

  it("creates and updates a ticket with upsert", async function () {
    const repository = new JsonTicketRepository(
      path.join(tempDir, "tickets.json")
    );
    const ticket = buildTicket();
    const updatedTicket = buildTicket({
      status: "inactive",
      updatedAt: "2026-06-05T11:00:00.000Z"
    });

    await expect(repository.upsert(ticket)).resolves.toEqual(ticket);
    await expect(repository.list()).resolves.toEqual([ticket]);

    await expect(repository.upsert(updatedTicket)).resolves.toEqual(
      updatedTicket
    );
    await expect(repository.list()).resolves.toEqual([updatedTicket]);
    await expect(repository.findById("ticket_1")).resolves.toEqual(
      updatedTicket
    );
  });

  it("finds only an active ticket by room and user", async function () {
    const repository = new JsonTicketRepository(
      path.join(tempDir, "tickets.json")
    );

    await repository.upsert(buildTicket({
      ticketId: "inactive_ticket",
      status: "inactive"
    }));
    await repository.upsert(buildTicket({
      ticketId: "active_ticket",
      status: "active"
    }));

    await expect(
      repository.findActiveByRoomAndUser(
        "!room:example.org",
        "@user:example.org"
      )
    ).resolves.toMatchObject({
      ticketId: "active_ticket",
      status: "active"
    });
    await expect(repository.findByRoomId("!room:example.org")).resolves
      .toHaveLength(2);
  });

  it("finds active tickets only within the exact conversation scope", async function () {
    const repository = new JsonTicketRepository(
      path.join(tempDir, "tickets.json")
    );
    const tickets = [
      buildTicket({
        ticketId: "matrix_main",
        channel: "matrix",
        threadId: null
      }),
      buildTicket({
        ticketId: "matrix_thread_one",
        channel: "matrix",
        threadId: "$thread-one"
      }),
      buildTicket({
        ticketId: "matrix_thread_two",
        channel: "matrix",
        threadId: "$thread-two"
      }),
      buildTicket({
        ticketId: "twake_main",
        channel: "twake_chat",
        threadId: null
      }),
      buildTicket({
        ticketId: "other_room",
        roomId: "!other-room:example.org"
      }),
      buildTicket({
        ticketId: "other_user",
        userId: "@other:example.org"
      })
    ];

    for (const ticket of tickets) {
      await repository.upsert(ticket);
    }

    await expect(repository.findActiveByConversationScope({
      channel: "matrix",
      roomId: "!room:example.org",
      threadId: "$thread-two",
      userId: "@user:example.org"
    })).resolves.toMatchObject({
      ticketId: "matrix_thread_two"
    });
    await expect(repository.findActiveByConversationScope({
      channel: "twake_chat",
      roomId: "!room:example.org",
      threadId: null,
      userId: "@user:example.org"
    })).resolves.toMatchObject({
      ticketId: "twake_main"
    });
  });

  it("creates and updates a user with upsert", async function () {
    const repository = new JsonUserRepository(path.join(tempDir, "users.json"));
    const user = buildUser();
    const updatedUser = buildUser({
      linkedTicketIds: ["ticket_1", "ticket_2"],
      updatedAt: "2026-06-05T11:00:00.000Z"
    });

    await expect(repository.upsert(user)).resolves.toEqual(user);
    await expect(repository.list()).resolves.toEqual([user]);

    await expect(repository.upsert(updatedUser)).resolves.toEqual(updatedUser);
    await expect(repository.findById("@user:example.org")).resolves.toEqual(
      updatedUser
    );
    await expect(repository.list()).resolves.toEqual([updatedUser]);
  });

  it("appends messages without overwriting previous messages", async function () {
    const repository = new JsonMessageRepository(
      path.join(tempDir, "messages.json")
    );
    const firstMessage = buildMessage({
      messageId: "$message_1",
      content: "First"
    });
    const secondMessage = buildMessage({
      messageId: "$message_2",
      content: "Second",
      direction: "outgoing",
      providerMessageId: "$provider_2"
    });

    await expect(repository.append(firstMessage)).resolves.toEqual(firstMessage);
    await expect(repository.append(secondMessage)).resolves.toEqual(
      secondMessage
    );

    await expect(repository.list()).resolves.toEqual([
      firstMessage,
      secondMessage
    ]);
    await expect(repository.findByRoomId("!room:example.org")).resolves.toEqual([
      firstMessage,
      secondMessage
    ]);
    await expect(repository.findByTicketId("ticket_1")).resolves.toEqual([
      firstMessage,
      secondMessage
    ]);
    await expect(repository.findByMessageId("$message_2")).resolves.toEqual(
      secondMessage
    );
    await expect(repository.findByMessageId("$missing")).resolves
      .toBeUndefined();
  });
});
