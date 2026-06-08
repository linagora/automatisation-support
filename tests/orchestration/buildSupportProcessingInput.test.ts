import {
  buildSupportProcessingInput
} from "../../src/orchestration/buildSupportProcessingInput";

import type {
  MatchingResult
} from "../../src/matching/typesMatching.types";
import type {
  JsonTicket,
  JsonUser
} from "../../src/repositories/json/typesJsonRepositories.types";
import type {
  AccountInteractionTraits,
  AccountProfile,
  AccountTrustStatus,
  ConversationHistory,
  SupportTopicKnowledge
} from "../../src/support-processing-pipeline/typesSupportProcessingPipeline.types";

const supportTopicKnowledge: SupportTopicKnowledge = {
  segments_topic: [
    {
      id_topic: 1,
      topic_category: "bug",
      tool_or_product: "Drive",
      topic_action: "create",
      topic_object: "folder",
      topic_details: {
        observed_result: "The create button stays disabled"
      },
      user_goal: "Create a Drive folder",
      blocking_issue: "yes"
    }
  ]
};

const conversationHistory = [] as ConversationHistory;

const accountTrustStatus: AccountTrustStatus = {
  status: "trusted",
  reasons: ["known_customer"]
};

const accountProfile: AccountProfile = {
  accountType: "company",
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
  likelyToBeHelpedByBot: true,
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
        messageId: "$message_1",
        content: "Premier message",
        createdAt: "2026-06-05T10:00:00.000Z"
      },
      {
        channel: "matrix",
        roomId: "!room:example.org",
        userId: "@user:example.org",
        messageId: "$message_2",
        content: "Dernier message",
        createdAt: "2026-06-05T10:00:03.000Z",
        attachments: [
          {
            id: "attachment_1",
            filename: "capture.png",
            mimeType: "image/png",
            sizeInBytes: 1234,
            accessUrl: "https://files.example.org/capture.png",
            kind: "image"
          },
          {
            id: "attachment_without_metadata"
          }
        ]
      }
    ],
    ...overrides
  };
}

describe("buildSupportProcessingInput", function () {
  it("keeps the same latestUserMessage shape for a single message batch", function () {
    const input = buildSupportProcessingInput(buildMatchingResult({
      messages: [
        {
          channel: "matrix",
          roomId: "!room:example.org",
          userId: "@user:example.org",
          messageId: "$message_1",
          content: "Message unique",
          createdAt: "2026-06-05T10:00:00.000Z"
        }
      ]
    }));

    expect(input.latestUserMessage).toEqual({
      id: "$message_1",
      content: "Message unique",
      channel: "twake_chat",
      sentAt: "2026-06-05T10:00:00.000Z"
    });
  });

  it("merges buffered message contents into latestUserMessage in chronological order", function () {
    const input = buildSupportProcessingInput(buildMatchingResult());

    expect(input.latestUserMessage).toEqual({
      id: "$message_2",
      content: "Premier message\n\nDernier message",
      channel: "twake_chat",
      sentAt: "2026-06-05T10:00:03.000Z"
    });
  });

  it("sorts out-of-order buffered messages by createdAt before merging", function () {
    const input = buildSupportProcessingInput(buildMatchingResult({
      messages: [
        {
          channel: "matrix",
          roomId: "!room:example.org",
          userId: "@user:example.org",
          messageId: "$message_2",
          content: "Deuxième message",
          createdAt: "2026-06-05T10:00:03.000Z"
        },
        {
          channel: "matrix",
          roomId: "!room:example.org",
          userId: "@user:example.org",
          messageId: "$message_1",
          content: "Premier message",
          createdAt: "2026-06-05T10:00:00.000Z"
        }
      ]
    }));

    expect(input.latestUserMessage).toEqual({
      id: "$message_2",
      content: "Premier message\n\nDeuxième message",
      channel: "twake_chat",
      sentAt: "2026-06-05T10:00:03.000Z"
    });
  });

  it("ignores empty buffered message contents when merging", function () {
    const input = buildSupportProcessingInput(buildMatchingResult({
      messages: [
        {
          channel: "matrix",
          roomId: "!room:example.org",
          userId: "@user:example.org",
          messageId: "$message_1",
          content: "Question support Twake Drive",
          createdAt: "2026-06-05T10:00:00.000Z"
        },
        {
          channel: "matrix",
          roomId: "!room:example.org",
          userId: "@user:example.org",
          messageId: "$message_empty",
          content: "   ",
          createdAt: "2026-06-05T10:00:01.000Z"
        },
        {
          channel: "matrix",
          roomId: "!room:example.org",
          userId: "@user:example.org",
          messageId: "$message_2",
          content: "Question hors scope dauphins",
          createdAt: "2026-06-05T10:00:02.000Z"
        }
      ]
    }));

    expect(input.latestUserMessage.content).toBe(
      "Question support Twake Drive\n\nQuestion hors scope dauphins"
    );
    expect(input.latestUserMessage.id).toBe("$message_2");
  });

  it("sends support and out-of-scope buffered parts together to the engine", function () {
    const input = buildSupportProcessingInput(buildMatchingResult({
      messages: [
        {
          channel: "matrix",
          roomId: "!room:example.org",
          userId: "@user:example.org",
          messageId: "$support",
          content:
            "J'ai une question, est-ce possible de créer un fichier sur Twake Drive ?",
          createdAt: "2026-06-05T10:00:00.000Z"
        },
        {
          channel: "matrix",
          roomId: "!room:example.org",
          userId: "@user:example.org",
          messageId: "$dolphins",
          content: "Combien y a-t-il de dauphins dans l'océan ?",
          createdAt: "2026-06-05T10:00:02.000Z"
        }
      ]
    }));

    expect(input.latestUserMessage).toMatchObject({
      id: "$dolphins",
      content:
        "J'ai une question, est-ce possible de créer un fichier sur Twake Drive ?\n\nCombien y a-t-il de dauphins dans l'océan ?",
      sentAt: "2026-06-05T10:00:02.000Z"
    });
  });

  it("maps complete attachments from all buffered messages", function () {
    const input = buildSupportProcessingInput(buildMatchingResult({
      messages: [
        {
          channel: "matrix",
          roomId: "!room:example.org",
          userId: "@user:example.org",
          messageId: "$message_1",
          content: "Premier message",
          createdAt: "2026-06-05T10:00:00.000Z",
          attachments: [
            {
              id: "attachment_1",
              filename: "capture-1.png",
              mimeType: "image/png",
              sizeInBytes: 1234,
              accessUrl: "https://files.example.org/capture-1.png",
              kind: "image"
            }
          ]
        },
        {
          channel: "matrix",
          roomId: "!room:example.org",
          userId: "@user:example.org",
          messageId: "$message_2",
          content: "Dernier message",
          createdAt: "2026-06-05T10:00:03.000Z",
          attachments: [
            {
              id: "attachment_2",
              filename: "capture-2.png",
              mimeType: "image/png",
              sizeInBytes: 5678,
              accessUrl: "https://files.example.org/capture-2.png",
              kind: "image"
            },
            {
              id: "attachment_without_metadata"
            }
          ]
        }
      ]
    }));

    expect(input.latestUserAttachments).toEqual([
      {
        id: "attachment_1",
        filename: "capture-1.png",
        name: "capture-1.png",
        sizeInBytes: 1234,
        sizeBytes: 1234,
        accessUrl: "https://files.example.org/capture-1.png",
        mimeType: "image/png",
        type: "image",
        channel: "twake_chat",
        sentAt: "2026-06-05T10:00:00.000Z"
      },
      {
        id: "attachment_2",
        filename: "capture-2.png",
        name: "capture-2.png",
        sizeInBytes: 5678,
        sizeBytes: 5678,
        accessUrl: "https://files.example.org/capture-2.png",
        mimeType: "image/png",
        type: "image",
        channel: "twake_chat",
        sentAt: "2026-06-05T10:00:03.000Z"
      }
    ]);
  });

  it("uses matched ticket and user data when available", function () {
    const ticket = buildTicket();
    const user = buildUser();
    const input = buildSupportProcessingInput(buildMatchingResult({
      ticket,
      user
    }));

    expect(input.accountTrustStatus).toBe(accountTrustStatus);
    expect(input.accountProfile).toBe(accountProfile);
    expect(input.accountInteractionTraits).toBe(accountInteractionTraits);
    expect(input.supportTopicKnowledge).toBe(supportTopicKnowledge);
    expect(input.conversationHistory).toBe(conversationHistory);
  });

  it("uses safe defaults when ticket or user is missing", function () {
    const input = buildSupportProcessingInput(buildMatchingResult());

    expect(input.accountTrustStatus).toEqual({
      status: "neutral",
      reasons: ["default_missing_user"]
    });
    expect(input.accountProfile).toEqual({
      accountType: "individual",
      actualPlan: "free",
      paymentStatus: "unknown",
      planHistory: [],
      createdAt: "1970-01-01T00:00:00.000Z",
      daysSinceCreation: 0
    });
    expect(input.accountInteractionTraits).toEqual({
      labels: [],
      lastUpdatedAt: "1970-01-01T00:00:00.000Z"
    });
    expect(input.supportTopicKnowledge).toEqual({
      segments_topic: []
    });
    expect(input.conversationHistory).toEqual([]);
  });

  it("fails explicitly on an empty message batch", function () {
    expect(() => {
      buildSupportProcessingInput(buildMatchingResult({
        messages: []
      }));
    }).toThrow("Cannot build SupportProcessingPipelineInput from empty messages");
  });
});
