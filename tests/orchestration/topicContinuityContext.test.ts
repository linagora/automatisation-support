import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildSupportProcessingInput
} from "../../src/orchestration/buildSupportProcessingInput";
import {
  buildSupportProcessingInputV2
} from "../../src/orchestration/buildSupportProcessingInputV2";
import { applySupportPatches } from "../../src/persistence/applySupportPatches";
import { JsonMessageRepository } from "../../src/repositories/json/jsonMessageRepository";
import { JsonTicketRepository } from "../../src/repositories/json/jsonTicketRepository";
import { JsonUserRepository } from "../../src/repositories/json/jsonUserRepository";

import type {
  MatchingResult
} from "../../src/matching/typesMatching.types";
import type {
  DeliveryMessage
} from "../../src/orchestration/typesOrchestration.types";
import type {
  SupportProcessingPipelineOutput
} from "../../src/support-processing-pipeline/typesSupportProcessingPipeline.types";

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "topic-continuity-context-test-"));
}

function buildTurnOneMatchingResult(): MatchingResult {
  return {
    channel: "matrix",
    roomId: "!room:example.org",
    userId: "@user:example.org",
    messages: [
      {
        channel: "matrix",
        roomId: "!room:example.org",
        userId: "@user:example.org",
        messageId: "$turn_1",
        content: "Je crois que j'ai trouvé un bug sur Twake Chat",
        createdAt: "2026-06-05T10:00:00.000Z"
      }
    ]
  };
}

function buildTurnOneOutput(): SupportProcessingPipelineOutput {
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
        topic_category: "bug" as const,
        tool_or_product: "Twake",
        topic_action: "create",
        topic_object: "room",
        topic_label: "Bug - Twake : create : room",
        segment_verbatims: [
          "Je crois que j'ai trouvé un bug sur Twake Chat"
        ],
        topic_details: {
          observed_result: "bug on Twake Chat"
        },
        user_goal: "Report a Twake Chat bug",
        blocking_issue: "yes" as const
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
      topicPlanMessages: [
        {
          politeness_opening: "understanding_1" as const,
          topic_relation_acknowledgement: {
            no_matched_historical_topic_count: 1,
            matched_historical_topic_count: 0
          },
          topics_responses: [
            {
              topic_response: {
                title: {
                  topic_id: 1,
                  topic_category: "bug" as const,
                  tool_or_product: "Twake",
                  topic_action: "create",
                  topic_object: "room",
                  matched_historical_topic: false
                },
                updated_fields_acknowledgement: {},
                main_response: {
                  type: "ask_fields" as const,
                  details: {
                    fields_requested: ["platform"] as [string, ...string[]]
                  }
                },
                next_step: "wait_more_info" as const
              }
            }
          ],
          politeness_closure: "thanks_for_cooperation1" as const
        }
      ],
      signalPlanMessages: [],
      handoverPlanMessages: []
    }
  };

  return {
    userResponse: {
      messages: [
        {
          type: "topic_response",
          content: "Sur quelle plateforme rencontrez-vous le bug ?"
        }
      ]
    },
    patches: {
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
        source: "support-processing-pipeline"
      }
    }
  };
}

function buildTurnOneDeliveryMessages(): DeliveryMessage[] {
  return [
    {
      localId: "delivery_1",
      channel: "matrix",
      roomId: "!room:example.org",
      userId: "@user:example.org",
      content: "Sur quelle plateforme rencontrez-vous le bug ?",
      metadata: {
        userResponseMessageType: "topic_response"
      }
    }
  ];
}

describe("topic continuity context", function () {
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

  it("passes the existing ticket context to the engine on a follow-up message", async function () {
    await applySupportPatches({
      matchingResult: buildTurnOneMatchingResult(),
      supportProcessingOutput: buildTurnOneOutput(),
      deliveryMessages: buildTurnOneDeliveryMessages(),
      ticketRepository,
      userRepository,
      messageRepository
    });

    const ticket = await ticketRepository.findActiveByRoomAndUser(
      "!room:example.org",
      "@user:example.org"
    );
    const turnTwoMatchingResult: MatchingResult = {
      channel: "matrix",
      roomId: "!room:example.org",
      userId: "@user:example.org",
      messages: [
        {
          channel: "matrix",
          roomId: "!room:example.org",
          userId: "@user:example.org",
          messageId: "$turn_2",
          content: "Oui, la plateforme est sur mon application web",
          createdAt: "2026-06-05T10:01:00.000Z"
        }
      ],
      ...(ticket ? { ticket } : {})
    };

    const input = buildSupportProcessingInput(turnTwoMatchingResult);
    const inputV2 = buildSupportProcessingInputV2(turnTwoMatchingResult);

    expect(ticket).toBeDefined();
    expect(ticket?.ticketId).toBeTruthy();
    expect(input.supportTopicKnowledge.segments_topic).toHaveLength(1);
    expect(input.supportTopicKnowledge.segments_topic[0]).toMatchObject({
      id_topic: 1,
      topic_category: "bug",
      tool_or_product: "Twake",
      topic_action: "create",
      topic_object: "room",
      topic_label: "Bug - Twake : create : room"
    });
    expect(input.conversationHistory.length).toBeGreaterThan(0);
    expect(input.latestUserMessage).toMatchObject({
      id: "$turn_2",
      content: "Oui, la plateforme est sur mon application web",
      channel: "twake_chat"
    });
    expect(inputV2.recentInteractionContext).toEqual({
      previousUserMessageSummary:
        "Je crois que j'ai trouvé un bug sur Twake Chat",
      previousBotResponseSummary:
        "Sur quelle plateforme rencontrez-vous le bug ?"
    });
  });
});
