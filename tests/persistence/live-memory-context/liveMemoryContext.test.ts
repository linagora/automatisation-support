import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildLiveMemoryConversationKey
} from "../../../src/persistence/live-memory-context/buildLiveMemoryConversationKey";
import {
  buildLiveMemoryContextFromTurn
} from "../../../src/persistence/live-memory-context/buildLiveMemoryContextFromTurn";
import {
  readLiveMemoryContext
} from "../../../src/persistence/live-memory-context/liveMemoryContextStore";
import {
  upsertLiveMemoryContext
} from "../../../src/persistence/live-memory-context/upsertLiveMemoryContext";

import type {
  SupportAutomationTurnV2Result
} from "../../../src/orchestration/runSupportAutomationTurnV2";
import type {
  MatrixDeliveryResult
} from "../../../src/channels/matrix/typesMatrixChannel.types";
import type {
  SupportProcessingPersistenceEffectsV2
} from "../../../src/support-processing-pipeline-v2/typesSupportProcessingPipelineV2.types";
import type {
  LiveMemoryContext
} from "../../../src/persistence/live-memory-context/typesLiveMemoryContext.types";
import type {
  MergedTopicSnapshot
} from "../../../src/support-processing-pipeline-v2/typesSupportProcessingPipelineV2.types";

function buildSnapshot(
  overrides: Partial<MergedTopicSnapshot> = {}
): MergedTopicSnapshot {
  return {
    snapshotId: "snapshot_1",
    topicId: "topic_1",
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
    topic_details: {
      error_message: "Token expired"
    },
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
      patches: persistenceEffects,
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
    })).toBe("matrix_room_example_org_no_thread_user_example_org");

    expect(buildLiveMemoryConversationKey({
      channel: "twake_chat",
      roomId: " room//with:::chars ",
      threadId: "$thread-1",
      userId: "@user"
    })).toBe("twake_chat_room_with_chars_thread_1_user");
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
          topicId: "topic_1",
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
          topicId: "topic_1",
          title: "Ancien titre",
          broadCategoryHint: "access_security",
          summary: "Ancien resume.",
          caseDetails: [],
          attemptedActions: []
        },
        {
          topicId: "topic_2",
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
            topicId: "new_topic_1",
            temporaryTopicId: "new_topic_1",
            isNewTopic: true,
            title: "Nouveau sujet",
            broadCategoryHint: "bug",
            summary: "Nouveau sujet cree.",
            caseDetails: [],
            attemptedActions: [],
            topic_details: {},
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
        topicId: "topic_1",
        title: "Nouveau sujet",
        summary: "Nouveau sujet cree."
      }),
      expect.objectContaining({
        topicId: "topic_2",
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
});
