import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildLiveMemoryConversationKey
} from "../../../src/infrastructure/live-memory/buildLiveMemoryConversationKey";
import {
  buildLiveMemoryContextFromTurn
} from "../../../src/archive/persistence/buildLiveMemoryContextFromTurn";
import {
  applyLiveMemoryUpdate
} from "../../../src/support-automation/patch-live-memory/applyLiveMemoryUpdate";
import {
  readLiveMemoryContext
} from "../../../src/infrastructure/live-memory/liveMemoryContextStore";
import {
  upsertLiveMemoryContext
} from "../../../src/archive/persistence/upsertLiveMemoryContext";

import type {
  SupportAutomationTurnV2Result
} from "../../../src/support-automation/runSupportAutomationPipelineV2";
import type {
  MatrixDeliveryResult
} from "../../../src/infrastructure/matrix/typesMatrixChannel.types";
import type {
  SupportProcessingPersistenceEffectsV2
} from "../../../src/support-automation/support-processing-pipeline-v2/typesSupportProcessingPipelineV2.types";
import type {
  LiveMemoryContextUpdate
} from "../../../src/support-automation/support-processing-pipeline-v2/typesSupportProcessingPipelineV2.types";
import type {
  LiveMemoryContext
} from "../../../src/infrastructure/live-memory/typesLiveMemoryContext.types";
import type {
  MergedTopicSnapshot
} from "../../../src/support-automation/support-processing-pipeline-v2/typesSupportProcessingPipelineV2.types";

function buildSnapshot(
  overrides: Partial<MergedTopicSnapshot> = {}
): MergedTopicSnapshot {
  return {
    snapshotId: "snapshot_1",
    topicId: 1,
    temporaryTopicId: null,
    isNewTopic: false,
    title: "Compte bloque",
    broadCategoryHint: "access_security",
    summary: "L'utilisateur indique que son compte est bloque.",
    caseDetails: [
      {
        key: "error_message",
        value: "Token expired",
        evidence: "Token expired"
      }
    ],
    attemptedActions: [],
    sourceUnderstandingIds: ["understanding_1"],
    sourceVerbatims: ["Mon compte affiche Token expired."],
    sourceOpIndex: 0,
    baseTopic: null,
    ...overrides
  };
}

function buildTurnResult(params: {
  userContent: string;
  botContent?: string;
  snapshots?: MergedTopicSnapshot[];
}): SupportAutomationTurnV2Result {
  const botContent = params.botContent ?? "Reponse support.";
  const persistenceEffects: SupportProcessingPersistenceEffectsV2 = {
    liveMemoryUpdate: {
      mode: "merge",
      topics: [],
      lastUserVerbatim: params.userContent,
      lastBotVerbatim: botContent,
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
    turnIdentity: {
      channel: "matrix",
      conversationKey: buildLiveMemoryConversationKey({
        channel: "matrix",
        roomId: "!room:example.org",
        threadId: null,
        userId: "@user:example.org"
      }),
      roomId: "!room:example.org",
      threadId: null,
      userId: "@user:example.org"
    },
    supportProcessingInput: {
      latestUserMessage: {
        id: "$message",
        content: params.userContent,
        channel: "twake_chat",
        sentAt: "2026-06-30T10:00:00.000Z"
      }
    } as never,
    supportProcessingOutput: {
      userResponse: {
        messages: []
      },
      persistenceEffects,
      mergedTopicSnapshots: params.snapshots ?? []
    },
    persistenceEffects,
    deliveryMessages: [
      {
        localId: "delivery_1",
        channel: "matrix",
        roomId: "!room:example.org",
        userId: "@user:example.org",
        content: botContent
      }
    ]
  };
}

function buildMatrixDeliveryResult(content: string): MatrixDeliveryResult {
  return {
    channel: "matrix",
    roomId: "!room:example.org",
    deliveredMessages: [
      {
        localId: "delivery_1",
        providerMessageId: "$provider",
        content,
        deliveredAt: "2026-06-30T10:00:01.000Z"
      }
    ],
    failedMessages: []
  };
}

function buildLiveMemoryUpdate(
  overrides: Partial<LiveMemoryContextUpdate> = {}
): LiveMemoryContextUpdate {
  return {
    mode: "merge",
    topics: [],
    lastUserVerbatim: "Message utilisateur.",
    lastBotVerbatim: "Message bot.",
    userState: {
      status: "normal",
      flags: []
    },
    ...overrides
  };
}

describe("live memory context", function () {
  let tempDir: string;
  let previousDirectory: string | undefined;

  beforeEach(async function () {
    tempDir = await fs.mkdtemp(path.join(
      os.tmpdir(),
      "live-memory-context-test-"
    ));
    previousDirectory = process.env.LIVE_MEMORY_CONTEXT_DIR;
    process.env.LIVE_MEMORY_CONTEXT_DIR = tempDir;
  });

  afterEach(async function () {
    if (previousDirectory === undefined) {
      delete process.env.LIVE_MEMORY_CONTEXT_DIR;
    } else {
      process.env.LIVE_MEMORY_CONTEXT_DIR = previousDirectory;
    }

    await fs.rm(tempDir, {
      recursive: true,
      force: true
    });
  });

  it("builds a stable filesystem-safe conversation key", function () {
    expect(buildLiveMemoryConversationKey({
      channel: "matrix",
      roomId: "!room:example.org",
      threadId: null,
      userId: "@user:example.org"
    })).toBe("room_example_org_user_example_org");

    expect(buildLiveMemoryConversationKey({
      channel: "twake_chat",
      roomId: " room//with:::chars ",
      threadId: "$thread-1",
      userId: "@user"
    })).toBe("room_with_chars_thread_1");
  });

  it("builds the first context with minimal topics and delivered bot text", function () {
    const context = buildLiveMemoryContextFromTurn({
      previousContext: null,
      supportAutomationTurnResult: buildTurnResult({
        userContent: "Mon compte affiche Token expired.",
        snapshots: [buildSnapshot()]
      }),
      matrixDeliveryResults: [
        buildMatrixDeliveryResult("Message livre.")
      ]
    });

    expect(context).toEqual({
      topics: [
        {
          topicId: 1,
          title: "Compte bloque",
          broadCategoryHint: "access_security",
          summary: "L'utilisateur indique que son compte est bloque.",
          caseDetails: [
            {
              key: "error_message",
              value: "Token expired",
              evidence: "Token expired"
            }
          ],
          attemptedActions: []
        }
      ],
      lastUserVerbatim: "Mon compte affiche Token expired.",
      lastBotVerbatim: "Message livre.",
      userState: {
        status: "normal",
        flags: []
      }
    });
  });

  it("overlays touched topics and preserves untouched topics and user state", function () {
    const previousContext: LiveMemoryContext = {
      topics: [
        {
          topicId: 1,
          title: "Ancien titre",
          broadCategoryHint: "access_security",
          summary: "Ancien resume.",
          caseDetails: [],
          attemptedActions: []
        },
        {
          topicId: 2,
          title: "Facturation",
          broadCategoryHint: "billing",
          summary: "Sujet facture conserve.",
          caseDetails: [],
          attemptedActions: []
        }
      ],
      lastUserVerbatim: "Ancien user.",
      lastBotVerbatim: "Ancien bot.",
      userState: {
        status: "watch",
        flags: ["repeat_contact"]
      }
    };

    const context = buildLiveMemoryContextFromTurn({
      previousContext,
      supportAutomationTurnResult: buildTurnResult({
        userContent: "Nouveau message.",
        botContent: "Nouveau bot fallback.",
        snapshots: [
          buildSnapshot({
            title: "Nouveau titre",
            summary: "Nouveau resume."
          }),
          buildSnapshot({
            snapshotId: "snapshot_2",
            topicId: 1,
            temporaryTopicId: null,
            isNewTopic: true,
            title: "Nouveau sujet",
            broadCategoryHint: "bug",
            summary: "Nouveau sujet cree.",
            caseDetails: [],
            attemptedActions: [],
            sourceUnderstandingIds: [],
            sourceVerbatims: [],
            sourceOpIndex: 1
          })
        ]
      }),
      matrixDeliveryResults: []
    });

    expect(context.topics).toEqual([
      expect.objectContaining({
        topicId: 1,
        title: "Nouveau sujet",
        summary: "Nouveau sujet cree."
      }),
      expect.objectContaining({
        topicId: 2,
        title: "Facturation"
      })
    ]);
    expect(context.lastUserVerbatim).toBe("Nouveau message.");
    expect(context.lastBotVerbatim).toBe("Nouveau bot fallback.");
    expect(context.userState).toEqual({
      status: "watch",
      flags: ["repeat_contact"]
    });
  });

  it("upserts by reading previous context and overwriting the JSON file", async function () {
    const identity = {
      channel: "matrix" as const,
      roomId: "!room:example.org",
      threadId: null,
      userId: "@user:example.org"
    };
    const key = buildLiveMemoryConversationKey(identity);

    await upsertLiveMemoryContext({
      identity,
      supportAutomationTurnResult: buildTurnResult({
        userContent: "Premier user.",
        botContent: "Premier bot.",
        snapshots: [buildSnapshot()]
      }),
      matrixDeliveryResults: []
    });

    const secondContext = await upsertLiveMemoryContext({
      identity,
      supportAutomationTurnResult: buildTurnResult({
        userContent: "Deuxieme user.",
        botContent: "Deuxieme bot.",
        snapshots: []
      }),
      matrixDeliveryResults: []
    });

    expect(secondContext.topics).toHaveLength(1);
    expect(secondContext.lastUserVerbatim).toBe("Deuxieme user.");
    expect(secondContext.lastBotVerbatim).toBe("Deuxieme bot.");
    await expect(readLiveMemoryContext(key)).resolves.toEqual(secondContext);
  });

  it("merges an incoming similar topic with a different id into the existing live-memory topic", async function () {
    const turnIdentity = {
      channel: "matrix" as const,
      conversationKey: buildLiveMemoryConversationKey({
        channel: "matrix",
        roomId: "!room:example.org",
        threadId: null,
        userId: "@user:example.org"
      }),
      roomId: "!room:example.org",
      threadId: null,
      userId: "@user:example.org"
    };

    await applyLiveMemoryUpdate({
      turnIdentity,
      liveMemoryUpdate: buildLiveMemoryUpdate({
        topics: [
          {
            topicId: 1,
            title: "Twake Chat desktop messages",
            broadCategoryHint: "bug",
            summary:
              "Incoming Twake Chat desktop messages require a reload.",
            caseDetails: [
              {
                key: "product_or_service",
                value: "twake chat",
                evidence: "twake chat"
              },
              {
                key: "platform",
                value: "desktop app",
                evidence: "ordinateur"
              },
              {
                key: "observed_result",
                value: "must reload conversation to see incoming messages",
                evidence: "recharger la conversation"
              }
            ],
            attemptedActions: []
          }
        ]
      }),
      deliveryResult: {
        status: "sent",
        deliveredMessages: [{ content: "Bot 1" }]
      }
    });

    const context = await applyLiveMemoryUpdate({
      turnIdentity,
      liveMemoryUpdate: buildLiveMemoryUpdate({
        topics: [
          {
            topicId: 2,
            title: null,
            broadCategoryHint: "bug",
            summary: null,
            caseDetails: [
              {
                key: "product_or_service",
                value: "twake chat",
                evidence: "existing_topic"
              },
              {
                key: "operating_system",
                value: "ubuntu",
                evidence: "ubuntu"
              }
            ],
            attemptedActions: []
          }
        ],
        lastUserVerbatim: "ubuntu",
        lastBotVerbatim: "Bot 2"
      }),
      deliveryResult: {
        status: "sent",
        deliveredMessages: [{ content: "Bot 2" }]
      }
    });

    expect(context.topics).toHaveLength(2);
    expect(context.topics[0]).toEqual(expect.objectContaining({
      topicId: 1,
      title: "Twake Chat desktop messages"
    }));
    expect(context.topics[0]?.caseDetails).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: "product_or_service",
        value: "twake chat",
        evidence: "twake chat"
      })
    ]));
    expect(context.topics[1]).toEqual(expect.objectContaining({
      topicId: 2
    }));
    expect(context.topics[1]?.caseDetails).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: "operating_system",
        value: "ubuntu",
        evidence: "ubuntu"
      })
    ]));
  });

  it("persists supportKnowledgeSummary on live-memory topics", async function () {
    const turnIdentity = {
      channel: "matrix" as const,
      conversationKey: buildLiveMemoryConversationKey({
        channel: "matrix",
        roomId: "!room:example.org",
        threadId: null,
        userId: "@user:example.org"
      }),
      roomId: "!room:example.org",
      threadId: null,
      userId: "@user:example.org"
    };

    const context = await applyLiveMemoryUpdate({
      turnIdentity,
      liveMemoryUpdate: buildLiveMemoryUpdate({
        topics: [
          {
            topicId: 1,
            title: "Twake Chat desktop messages",
            broadCategoryHint: "bug",
            summary:
              "Twake Chat desktop messages require a reload.",
            caseDetails: [
              {
                key: "product_or_service",
                value: "twake chat",
                evidence: "twake chat"
              }
            ],
            attemptedActions: [],
            supportKnowledgeSummary: {
              summary:
                "Support knowledge lookup returned useful customer-facing knowledge for this topic.",
              customerFacing: null,
              supportFacing: null
            }
          }
        ]
      })
    });

    expect(context.topics[0]).toEqual(expect.objectContaining({
      topicId: 1,
      supportKnowledgeSummary: {
        summary:
          "Support knowledge lookup returned useful customer-facing knowledge for this topic.",
        customerFacing: null,
        supportFacing: null
      }
    }));
    await expect(
      readLiveMemoryContext(turnIdentity.conversationKey)
    ).resolves.toEqual(context);
  });

  it("keeps a Twake Chat desktop bug as one stable topic across short follow-up turns", async function () {
    const turnIdentity = {
      channel: "matrix" as const,
      conversationKey: buildLiveMemoryConversationKey({
        channel: "matrix",
        roomId: "!room:example.org",
        threadId: null,
        userId: "@user:example.org"
      }),
      roomId: "!room:example.org",
      threadId: null,
      userId: "@user:example.org"
    };

    const firstContext = await applyLiveMemoryUpdate({
      turnIdentity,
      liveMemoryUpdate: buildLiveMemoryUpdate({
        topics: [
          {
            topicId: 1,
            title: "Twake Chat desktop messages",
            broadCategoryHint: "bug",
            summary:
              "Twake Chat desktop does not show incoming messages automatically.",
            caseDetails: [
              {
                key: "product_or_service",
                value: "twake chat",
                evidence: "twake chat"
              },
              {
                key: "platform",
                value: "desktop app",
                evidence: "depuis mon ordinateur"
              },
              {
                key: "trigger_action",
                value: "receive message",
                evidence: "on m'envoie un message"
              },
              {
                key: "observed_result",
                value:
                  "must reload/reclick conversation to see incoming messages",
                evidence: "je dois souvent recharger la conversation"
              },
              {
                key: "expected_result",
                value: "message appears automatically without reload",
                evidence: "pour que le message apparaisse"
              },
              {
                key: "available_workaround",
                value: "reload/reclick conversation",
                evidence: "recharger la conversation"
              }
            ],
            attemptedActions: []
          }
        ],
        lastUserVerbatim:
          "J’ai remarqué que lorsque j’ouvre l’application twake chat depuis mon ordinateur et qu’on m’envoie un message je dois souvent recharger la conversation pour que le message apparaisse.",
        lastBotVerbatim: "Pouvez-vous préciser l'OS et la version ?"
      }),
      deliveryResult: {
        status: "sent",
        deliveredMessages: [
          { content: "Pouvez-vous préciser l'OS et la version ?" }
        ]
      }
    });

    await applyLiveMemoryUpdate({
      turnIdentity,
      liveMemoryUpdate: buildLiveMemoryUpdate({
        topics: [
          {
            topicId: 1,
            title: null,
            broadCategoryHint: "bug",
            summary: null,
            caseDetails: [
              {
                key: "product_or_service",
                value: "twake chat",
                evidence: "existing_topic"
              },
              {
                key: "operating_system",
                value: "ubuntu",
                evidence: "ubuntu"
              },
              {
                key: "app_version",
                value: "latest",
                evidence: "dernière version"
              }
            ],
            attemptedActions: []
          }
        ],
        lastUserVerbatim: "ubuntu et j’utilise la dernière version",
        lastBotVerbatim: "Merci, à quelle fréquence cela arrive ?"
      }),
      deliveryResult: {
        status: "sent",
        deliveredMessages: [
          { content: "Merci, à quelle fréquence cela arrive ?" }
        ]
      }
    });

    await applyLiveMemoryUpdate({
      turnIdentity,
      liveMemoryUpdate: buildLiveMemoryUpdate({
        topics: [
          {
            topicId: 2,
            title: null,
            broadCategoryHint: null,
            summary: null,
            caseDetails: [
              {
                key: "frequency",
                value: "about 1 in 2 messages",
                evidence: "A peu près 1 message sur 2"
              }
            ],
            attemptedActions: []
          }
        ],
        lastUserVerbatim: "A peu près 1 message sur 2",
        lastBotVerbatim: "Merci, je note ces informations."
      }),
      deliveryResult: {
        status: "partial",
        deliveredMessages: [
          { content: "Merci, je note ces informations." }
        ]
      }
    });

    const finalContext = await applyLiveMemoryUpdate({
      turnIdentity,
      liveMemoryUpdate: buildLiveMemoryUpdate({
        topics: [],
        lastUserVerbatim: "Je n’ai pas plus d’informations à fournir",
        lastBotVerbatim: "Ce message ne doit pas remplacer le bot livré."
      }),
      deliveryResult: {
        status: "failed",
        deliveredMessages: []
      }
    });

    expect(finalContext.topics).toHaveLength(2);
    expect(finalContext.topics[0]?.topicId).toBe(firstContext.topics[0]?.topicId);
    expect(finalContext.topics[0]?.caseDetails).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: "product_or_service",
        value: "twake chat"
      }),
      expect.objectContaining({
        key: "operating_system",
        value: "ubuntu"
      }),
      expect.objectContaining({
        key: "app_version",
        value: "latest"
      })
    ]));
    expect(finalContext.topics[1]?.caseDetails).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: "frequency",
        value: "about 1 in 2 messages"
      })
    ]));
    expect(finalContext.lastUserVerbatim)
      .toBe("Je n’ai pas plus d’informations à fournir");
    expect(finalContext.lastBotVerbatim)
      .toBe("Merci, je note ces informations.");
  });
});
