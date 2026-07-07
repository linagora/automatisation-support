import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  runSupportAutomationTurnV2
} from "../../src/support-automation/runSupportAutomationPipelineV2";
import {
  buildSupportTurnIdentityV2
} from "../../src/support-automation/build-input/buildSupportTurnIdentityV2";
import {
  writeLiveMemoryContext
} from "../../src/infrastructure/live-memory/liveMemoryContextStore";
import { JsonMessageRepository } from "../../src/archive/repositories/json/jsonMessageRepository";
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
  LiveMemoryContext
} from "../../src/infrastructure/live-memory/typesLiveMemoryContext.types";
import type {
  SupportProcessingPipelineV2Steps,
  SupportProcessingPersistenceEffectsV2
} from "../../src/support-automation/support-processing-pipeline-v2/typesSupportProcessingPipelineV2.types";
import type {
  UserResponse
} from "../../src/support-automation/support-processing-pipeline-v2/typesSupportMessaging.types";
import type {
  RenderedSupportResponse
} from "../../src/support-automation/support-processing-pipeline-v2/response-renderer/typesRenderSupportResponse.types";

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
    finalResponseText: "Bonjour."
  };
  const userResponse: UserResponse = {
    messages: [
      {
        type: "signal_response",
        content: "Bonjour."
      }
    ]
  };
  const persistenceEffects: SupportProcessingPersistenceEffectsV2 = {
    liveMemoryUpdate: {
      mode: "merge",
      topics: [],
      lastUserVerbatim: "Bonjour",
      lastBotVerbatim: "Bonjour.",
      userState: {
        status: "normal",
        flags: []
      }
    },
    openTelemetry: {
      status: "mocked_empty",
      spans: [],
      metrics: [],
      events: [],
      resourceAttributes: {}
    },
    otherSupportPipelineInformation: {}
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
    buildSupportProcessingPersistenceEffects: vi.fn(
      async () => persistenceEffects
    ),
    ...overrides
  };
}

describe("runSupportAutomationTurnV2", function () {
  let tempDir: string;
  let previousLiveMemoryContextDir: string | undefined;
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
    previousLiveMemoryContextDir = process.env.LIVE_MEMORY_CONTEXT_DIR;
    process.env.LIVE_MEMORY_CONTEXT_DIR = path.join(
      tempDir,
      "live-memory-context"
    );
  });

  afterEach(async function () {
    if (previousLiveMemoryContextDir === undefined) {
      delete process.env.LIVE_MEMORY_CONTEXT_DIR;
    } else {
      process.env.LIVE_MEMORY_CONTEXT_DIR = previousLiveMemoryContextDir;
    }
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
      steps: buildSteps()
    });

    expect(result.supportProcessingOutput.userResponse.messages).toEqual([
      {
        type: "signal_response",
        content: "Bonjour."
      }
    ]);
    expect(result.persistenceEffects).toEqual(
      result.supportProcessingOutput.persistenceEffects
    );
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
      userLanguage: "en",
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
      userLanguage: "en",
      progressLanguageReady: true
    });
  });

  it("does not send persisted legacy conversation context to V2 on the next turn", async function () {
    await ticketRepository.upsert(buildTicket());
    await userRepository.upsert(buildUser());

    await runSupportAutomationTurnV2({
      bufferedMessages: buildBufferedMessages({
        messageId: "$message_a",
        content: "Message A",
        createdAt: "2026-06-22T10:01:00.000Z"
      }),
      steps: buildSteps()
    });

    const secondTurnResult = await runSupportAutomationTurnV2({
      bufferedMessages: buildBufferedMessages({
        messageId: "$message_b",
        content: "Message B",
        createdAt: "2026-06-22T10:01:01.000Z"
      }),
      steps: buildSteps()
    });

    expect(secondTurnResult.supportProcessingInput.latestUserMessage.content)
      .toBe("Message B");
    expect(secondTurnResult.supportProcessingInput.supportTopicKnowledge)
      .toEqual({
        topics: []
      });
    expect(secondTurnResult.supportProcessingInput.conversationHistory)
      .toEqual([]);
    expect(secondTurnResult.supportProcessingInput.recentInteractionContext)
      .toEqual({
        previousUserMessageSummary: "No relevant previous user message.",
        previousBotResponseSummary: "No relevant previous bot response.",
        previousBotQuestionFieldNames: []
      });

    const ticket = await ticketRepository.findById("ticket_1");

    expect(ticket?.conversationHistory).toEqual([]);
  });

  it("does not send polluted legacy ticket context to the V2 pipeline when live memory is absent", async function () {
    await ticketRepository.upsert({
      ...buildTicket(),
      supportTopicKnowledge: {
        segments_topic: [
          {
            id_topic: 5,
            topic_category: "bug",
            topic_label: "Legacy Pixel notification issue",
            topic_details: {
              device: "Pixel 6",
              app_version: "2.1.3"
            },
            user_goal: "Legacy notification issue",
            blocking_issue: "no"
          }
        ]
      },
      conversationHistory: [
        {
          id: "legacy_user",
          message_id: "$legacy_user",
          created_at: "2026-06-22T09:58:00.000Z",
          role: "user",
          summary: "Legacy user used Pixel 6 version 2.1.3 for notifications.",
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
          id: "legacy_bot",
          message_id: "$legacy_bot",
          created_at: "2026-06-22T09:59:00.000Z",
          role: "bot",
          summary: "Legacy bot asked for app version.",
          responsePlan: {
            responseLanguage: "french",
            messagesPlan: {
              scopeBoundaryPlanMessages: [],
              topicPlanMessages: [],
              signalPlanMessages: [],
              handoverPlanMessages: []
            },
            metadata: {
              v2ResponsePlan: {
                questionDecision: {
                  fieldNames: ["device", "app_version"]
                }
              }
            }
          }
        }
      ] as JsonTicket["conversationHistory"]
    });
    await userRepository.upsert(buildUser());

    const result = await runSupportAutomationTurnV2({
      bufferedMessages: buildBufferedMessages({
        content: "Je n'arrive pas a ouvrir mon Drive."
      }),
      steps: buildSteps()
    });

    expect(result.supportProcessingInput.supportTopicKnowledge).toEqual({
      topics: []
    });
    expect(result.supportProcessingInput.conversationHistory).toEqual([]);
    expect(result.supportProcessingInput.recentInteractionContext).toEqual({
      previousUserMessageSummary: "No relevant previous user message.",
      previousBotResponseSummary: "No relevant previous bot response.",
      previousBotQuestionFieldNames: []
    });
    expect(JSON.stringify(result.supportProcessingInput)).not.toContain(
      "Pixel 6"
    );
    expect(JSON.stringify(result.supportProcessingInput)).not.toContain(
      "2.1.3"
    );
    expect(JSON.stringify(result.supportProcessingInput)).not.toContain(
      "notifications"
    );
  });

  it("loads live memory as the next turn topic and short-context source", async function () {
    await ticketRepository.upsert({
      ...buildTicket(),
      supportTopicKnowledge: {
        segments_topic: [
          {
            id_topic: 7,
            topic_category: "billing",
            topic_label: "Legacy billing topic",
            topic_details: {},
            user_goal: "Legacy issue",
            blocking_issue: "no"
          }
        ]
      }
    });
    await userRepository.upsert(buildUser());

    const liveMemoryContext: LiveMemoryContext = {
      topics: [
        {
          topicId: 12,
          title: "Connexion impossible",
          broadCategoryHint: "access_security",
          summary: "Le compte refuse la connexion.",
          caseDetails: [
            {
              key: "auth_method",
              value: "SSO",
              evidence: "SSO"
            }
          ],
          attemptedActions: []
        }
      ],
      lastUserVerbatim: "Je suis toujours bloqué avec le SSO.",
      lastBotVerbatim: "Le bot a demandé le fournisseur SSO.",
      userState: {
        status: "normal",
        flags: []
      }
    };

    await writeLiveMemoryContext(
      buildSupportTurnIdentityV2(buildBufferedMessages()).conversationKey,
      liveMemoryContext
    );

    const result = await runSupportAutomationTurnV2({
      bufferedMessages: buildBufferedMessages(),
      steps: buildSteps()
    });

    expect(result.supportProcessingInput.supportTopicKnowledge.topics)
      .toEqual([
        {
          topicId: 12,
          title: "Connexion impossible",
          broadCategoryHint: "access_security",
          summary: "Le compte refuse la connexion.",
          caseDetails: [
            {
              key: "auth_method",
              value: "SSO",
              evidence: "SSO"
            }
          ],
          attemptedActions: [],
          supportKnowledgeSummary: null
        }
      ]);
    expect(result.supportProcessingInput.conversationHistory).toEqual([]);
    expect(result.supportProcessingInput.recentInteractionContext).toEqual({
      previousUserMessageSummary: "Je suis toujours bloqué avec le SSO.",
      previousBotResponseSummary: "Le bot a demandé le fournisseur SSO.",
      previousBotQuestionFieldNames: []
    });
  });
});
