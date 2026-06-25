import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  runSupportAutomationTurn
} from "../../src/orchestration/runSupportAutomationTurn";
import { JsonMessageRepository } from "../../src/repositories/json/jsonMessageRepository";
import { JsonTicketRepository } from "../../src/repositories/json/jsonTicketRepository";
import { JsonUserRepository } from "../../src/repositories/json/jsonUserRepository";

import type {
  BufferedMessages
} from "../../src/messaging/typesMessaging.types";
import type {
  JsonTicket,
  JsonUser
} from "../../src/repositories/json/typesJsonRepositories.types";
import type {
  AccountInteractionTraits,
  AccountProfile,
  AccountTrustStatus,
  ConversationHistory,
  SupportProcessingPipelineSteps,
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
  accountType: "company",
  actualPlan: "paid",
  paymentStatus: "up_to_date",
  planHistory: [],
  createdAt: "2026-01-01T00:00:00.000Z",
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
        content: "Comment partager un dossier dans Drive ?",
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

function buildSteps(callOrder: string[]): SupportProcessingPipelineSteps {
  const turnUnderstandingDelta = {
    user_language: "french",
    securityGateSummary: {
      gateChecked: {},
      gateFailed: []
    },
    segments_lack_comprehension: [],
    segments_topic: [
      {
        matched_historical_topic: "no" as const,
        id_topic: 1,
        topic_category: "question_faq" as const,
        tool_or_product: "Drive",
        topic_action: "share",
        topic_object: "folder",
        topic_details: {
          question_intent: "how_to" as const
        },
        user_goal: "Share a folder",
        blocking_issue: "no" as const
      }
    ],
    segments_signal: [],
    segments_scope_boundary: [],
    segments_suspicious: []
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
    runMessageAnalysis: vi.fn(async () => {
      callOrder.push("runMessageAnalysis");
      return turnUnderstandingDelta;
    }),
    runSearchDecision: vi.fn(async () => {
      callOrder.push("runSearchDecision");
      return {
        decision: {
          route: "continue" as const,
          topics: [
            {
              topic_id: 1,
              type: "solution_searching" as const,
              missing_fields: []
            }
          ]
        },
        detected: {
          topicsQualificationResult: "evaluated" as const,
          solutionLikelihoodResult: "rag_relevant" as const
        },
        history: {
          checked: [],
          failed: []
        }
      };
    }),
    runSolutionRetrieval: vi.fn(async () => {
      callOrder.push("runSolutionRetrieval");
      return [
        {
          id: "solution_1",
          solution: "Use Drive sharing settings."
        }
      ];
    }),
    runResponsePlan: vi.fn(async () => {
      callOrder.push("runResponsePlan");
      return responsePlan;
    }),
    runResponseProduction: vi.fn(async () => {
      callOrder.push("runResponseProduction");
      return {
        messages: [
          {
            type: "topic_response" as const,
            content: "Voici comment partager un dossier."
          }
        ]
      };
    }),
    runPatchesProduction: vi.fn(async () => {
      callOrder.push("runPatchesProduction");
      return {
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
          generatedAt: "2026-06-05T10:00:06.000Z",
          source: "support-processing-pipeline" as const
        }
      };
    })
  };
}

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "support-automation-turn-test-"));
}

describe("runSupportAutomationTurn", function () {
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

  it("runs matching, pipeline, delivery mapping and persistence", async function () {
    const callOrder: string[] = [];
    const ticket = buildTicket();
    const user = buildUser();

    await ticketRepository.upsert(ticket);
    await userRepository.upsert(user);

    const result = await runSupportAutomationTurn({
      bufferedMessages: buildBufferedMessages(),
      ticketRepository,
      userRepository,
      messageRepository,
      steps: buildSteps(callOrder)
    });

    expect(callOrder).toEqual([
      "runMessageAnalysis",
      "runSearchDecision",
      "runSolutionRetrieval",
      "runResponsePlan",
      "runResponseProduction",
      "runPatchesProduction"
    ]);
    expect(result.matchingResult.ticket).toEqual(ticket);
    expect(result.matchingResult.user).toEqual(user);
    expect(result.supportProcessingInput.latestUserMessage).toMatchObject({
      id: "$message_1",
      content: "Comment partager un dossier dans Drive ?",
      channel: "twake_chat"
    });
    expect(result.supportProcessingOutput.userResponse.messages).toEqual([
      {
        type: "topic_response",
        content: "Voici comment partager un dossier."
      }
    ]);
    expect(result.deliveryMessages).toEqual([
      {
        localId:
          "delivery:matrix:!room:example.org:@user:example.org:$message_1:0",
        channel: "matrix",
        roomId: "!room:example.org",
        userId: "@user:example.org",
        content: "Voici comment partager un dossier.",
        metadata: {
          userResponseMessageType: "topic_response"
        }
      }
    ]);
    expect(result.persistenceResult).toMatchObject({
      updatedTicketId: "ticket_1",
      updatedUserId: "@user:example.org",
      storedIncomingMessageIds: ["$message_1"],
      storedOutgoingMessageIds: [
        "delivery:matrix:!room:example.org:@user:example.org:$message_1:0"
      ],
      patchStatus: "applied"
    });

    await expect(messageRepository.list()).resolves.toHaveLength(2);
  });
});
