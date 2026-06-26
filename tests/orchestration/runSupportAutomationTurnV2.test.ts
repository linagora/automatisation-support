import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  runSupportAutomationTurnV2
} from "../../src/orchestration/runSupportAutomationTurnV2";
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
  SupportProcessingPipelineV2Steps
} from "../../src/support-processing-pipeline/v2/typesSupportProcessingPipelineV2.types";
import type {
  Patches,
  UserResponse
} from "../../src/support-processing-pipeline/typesSupportProcessingPipeline.types";
import type {
  RenderedSupportResponse
} from "../../src/support-processing-pipeline/v2/response-renderer/typesRenderSupportResponse.types";

function buildTicket(): JsonTicket {
  return {
    ticketId: "ticket_1",
    channel: "matrix",
    roomId: "!room:example.org",
    threadId: "$thread",
    userId: "@user:example.org",
    status: "active",
    supportTopicKnowledge: {
      segments_topic: []
    },
    conversationHistory: [],
    createdAt: "2026-06-22T10:00:00.000Z",
    updatedAt: "2026-06-22T10:00:00.000Z"
  };
}

function buildUser(): JsonUser {
  return {
    userId: "@user:example.org",
    accountTrustStatus: {
      status: "trusted",
      reasons: ["test"]
    },
    accountProfile: {
      accountType: "individual",
      actualPlan: "free",
      paymentStatus: "unknown",
      planHistory: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      daysSinceCreation: 172
    },
    accountInteractionTraits: {
      labels: [],
      lastUpdatedAt: "2026-06-22T10:00:00.000Z"
    },
    linkedTicketIds: ["ticket_1"],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-06-22T10:00:00.000Z"
  };
}

function buildBufferedMessages(
  overrides: Partial<BufferedMessages["messages"][number]> = {}
): BufferedMessages {
  const message = {
    channel: "matrix" as const,
    roomId: "!room:example.org",
    threadId: "$thread",
    userId: "@user:example.org",
    messageId: "$message",
    content: "Bonjour",
    createdAt: "2026-06-22T10:01:00.000Z",
    ...overrides
  };

  return {
    channel: "matrix",
    roomId: "!room:example.org",
    threadId: "$thread",
    userId: "@user:example.org",
    messages: [message],
    firstMessageAt: message.createdAt,
    lastMessageAt: message.createdAt,
    flushedAt: "2026-06-22T10:01:02.000Z"
  };
}

function buildSteps(
  overrides: Partial<SupportProcessingPipelineV2Steps> = {}
): SupportProcessingPipelineV2Steps {
  const renderedSupportResponse: RenderedSupportResponse = {
    renderedMessages: [
      {
        messageId: "rendered_1",
        messageOrder: 1,
        purpose: "standard_only",
        relatedPlannedMessageOrders: [],
        content: "Bonjour."
      }
    ],
    finalResponseText: "Bonjour.",
    internalRenderingNotes: "Dry-run test."
  };
  const userResponse: UserResponse = {
    messages: [
      {
        type: "signal_response",
        content: "Bonjour."
      }
    ]
  };
  const patches: Patches = {
    analysisPatch: {
      turnUnderstandingDelta: {
        user_language: "french",
        segments_lack_comprehension: [],
        segments_topic: [],
        segments_signal: [],
        segments_scope_boundary: [],
        segments_suspicious: []
      }
    },
    securityPatch: {
      securityGateSummary: {
        gateChecked: {
          matchedPatternIds: []
        },
        gateFailed: []
      }
    },
    responsePatch: {
      responsePlan: {
        responseLanguage: "french",
        messagesPlan: {
          scopeBoundaryPlanMessages: [],
          topicPlanMessages: [],
          signalPlanMessages: [],
          handoverPlanMessages: []
        }
      }
    },
    metadataPatch: {
      generatedAt: "2026-06-22T10:01:03.000Z",
      source: "support-processing-pipeline"
    }
  };

  return {
    detectSuspiciousPromptPatterns: vi.fn(async () => ({
      matchedPatternIds: []
    })),
    planTurnAnalysis: vi.fn(async () => ({
      analyzeText: false,
      analyzeAttachments: false,
      matchedPatternIds: []
    })),
    buildStandardResponseFragments: vi.fn(async () => []),
    renderSupportResponse: vi.fn(async () => renderedSupportResponse),
    buildUserResponse: vi.fn(async () => userResponse),
    buildSupportPatches: vi.fn(async () => patches),
    ...overrides
  };
}

describe("runSupportAutomationTurnV2", function () {
  let tempDir: string;
  let ticketRepository: JsonTicketRepository;
  let userRepository: JsonUserRepository;
  let messageRepository: JsonMessageRepository;

  beforeEach(async function () {
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "support-turn-v2-test-")
    );
    ticketRepository = new JsonTicketRepository(
      path.join(tempDir, "tickets.json")
    );
    userRepository = new JsonUserRepository(
      path.join(tempDir, "users.json")
    );
    messageRepository = new JsonMessageRepository(
      path.join(tempDir, "messages.json")
    );
  });

  afterEach(async function () {
    await fs.rm(tempDir, {
      recursive: true,
      force: true
    });
  });

  it("runs the pipeline without changing repositories when persistence is disabled", async function () {
    await ticketRepository.upsert(buildTicket());
    await userRepository.upsert(buildUser());
    await messageRepository.list();
    const before = {
      tickets: await ticketRepository.list(),
      users: await userRepository.list(),
      messages: await messageRepository.list()
    };

    const result = await runSupportAutomationTurnV2({
      bufferedMessages: buildBufferedMessages(),
      ticketRepository,
      userRepository,
      messageRepository,
      persist: false,
      steps: buildSteps()
    });

    expect(result.supportProcessingOutput.userResponse.messages).toEqual([
      {
        type: "signal_response",
        content: "Bonjour."
      }
    ]);
    expect(result.persistenceResult).toEqual({
      storedIncomingMessageIds: [],
      storedOutgoingMessageIds: [],
      patchStatus: "skipped",
      warnings: ["persistence disabled for dry-run"]
    });
    expect(await ticketRepository.list()).toEqual(before.tickets);
    expect(await userRepository.list()).toEqual(before.users);
    expect(await messageRepository.list()).toEqual(before.messages);
  });

  it("marks progress language ready after text surface analysis completes", async function () {
    await ticketRepository.upsert(buildTicket());
    await userRepository.upsert(buildUser());
    const stageCalls: {
      stage: string;
      userLanguage?: string;
      progressLanguageReady?: boolean;
    }[] = [];
    const progressReporter = {
      startBuffer: vi.fn(async () => undefined),
      startTurn: vi.fn(async () => undefined),
      stage: vi.fn(async (context, stage) => {
        stageCalls.push({
          stage,
          userLanguage: context.userLanguage,
          progressLanguageReady: context.progressLanguageReady
        });
      }),
      finishTurn: vi.fn(async () => undefined),
      failTurn: vi.fn(async () => undefined)
    };

    await runSupportAutomationTurnV2({
      bufferedMessages: buildBufferedMessages({
        content: "Hello, I need help."
      }),
      ticketRepository,
      userRepository,
      messageRepository,
      persist: false,
      progressReporter,
      steps: buildSteps({
        planTurnAnalysis: vi.fn(async () => ({
          analyzeText: true,
          analyzeAttachments: false,
          matchedPatternIds: []
        })),
        analyzeTextSurface: vi.fn(async () => ({
          userLanguage: "English" as const,
          segments: [
            {
              segmentId: "seg_greeting",
              verbatim: "Hello",
              category: "standard_interaction" as const,
              standardSubcategory: "greeting" as const
            }
          ]
        }))
      })
    });

    expect(stageCalls).toContainEqual({
      stage: "analyzing_surface",
      userLanguage: undefined,
      progressLanguageReady: undefined
    });
    expect(stageCalls).toContainEqual({
      stage: "analyzing_surface",
      userLanguage: "English",
      progressLanguageReady: true
    });
  });

  it("normalizes unsupported progress languages to English", async function () {
    await ticketRepository.upsert(buildTicket());
    await userRepository.upsert(buildUser());
    const stageCalls: {
      stage: string;
      userLanguage?: string;
      progressLanguageReady?: boolean;
    }[] = [];
    const progressReporter = {
      startBuffer: vi.fn(async () => undefined),
      startTurn: vi.fn(async () => undefined),
      stage: vi.fn(async (context, stage) => {
        stageCalls.push({
          stage,
          userLanguage: context.userLanguage,
          progressLanguageReady: context.progressLanguageReady
        });
      }),
      finishTurn: vi.fn(async () => undefined),
      failTurn: vi.fn(async () => undefined)
    };

    await runSupportAutomationTurnV2({
      bufferedMessages: buildBufferedMessages({
        content: "Guten mein freunde"
      }),
      ticketRepository,
      userRepository,
      messageRepository,
      persist: false,
      progressReporter,
      steps: buildSteps({
        planTurnAnalysis: vi.fn(async () => ({
          analyzeText: true,
          analyzeAttachments: false,
          matchedPatternIds: []
        })),
        analyzeTextSurface: vi.fn(async () => ({
          userLanguage: "Other" as const,
          segments: [
            {
              segmentId: "seg_unclear",
              verbatim: "Guten mein freunde",
              category: "lack_comprehension" as const,
              standardSubcategory: "unclear_message" as const
            }
          ]
        }))
      })
    });

    expect(stageCalls).toContainEqual({
      stage: "analyzing_surface",
      userLanguage: "English",
      progressLanguageReady: true
    });
  });

  it("builds the next turn context in logical support-turn order", async function () {
    await ticketRepository.upsert(buildTicket());
    await userRepository.upsert(buildUser());

    await runSupportAutomationTurnV2({
      bufferedMessages: buildBufferedMessages({
        messageId: "$message_a",
        content: "Message A",
        createdAt: "2026-06-22T10:01:00.000Z"
      }),
      ticketRepository,
      userRepository,
      messageRepository,
      steps: buildSteps()
    });

    const secondTurnResult = await runSupportAutomationTurnV2({
      bufferedMessages: buildBufferedMessages({
        messageId: "$message_b",
        content: "Message B",
        createdAt: "2026-06-22T10:01:01.000Z"
      }),
      ticketRepository,
      userRepository,
      messageRepository,
      steps: buildSteps()
    });

    expect(secondTurnResult.supportProcessingInput.latestUserMessage.content)
      .toBe("Message B");
    expect(secondTurnResult.supportProcessingInput.conversationHistory.map(
      (event) => event.role
    )).toEqual(["user", "bot"]);
    expect(secondTurnResult.supportProcessingInput.conversationHistory[0])
      .toMatchObject({
        role: "user",
        summary: "Message A"
      });
    expect(secondTurnResult.supportProcessingInput.conversationHistory[1])
      .toMatchObject({
        role: "bot",
        summary: "Bonjour."
      });
    expect(secondTurnResult.supportProcessingInput.recentInteractionContext)
      .toMatchObject({
        previousUserMessageSummary: "Message A",
        previousBotResponseSummary: "Bonjour."
      });

    const ticket = await ticketRepository.findById("ticket_1");

    expect(ticket?.conversationHistory.map((event) => event.role))
      .toEqual(["user", "bot", "user", "bot"]);
    expect(ticket?.conversationHistory.map((event) => event.summary))
      .toEqual(["Message A", "Bonjour.", "Message B", "Bonjour."]);
  });
});
