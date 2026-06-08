import { describe, expect, it } from "vitest";

import {
  runSearchDecision
} from "../../../src/support-processing-pipeline/search-decision/runSearchDecision";

import type {
  ConversationHistory,
  TurnAttachments,
  SearchDecisionInput
} from "../../../src/support-processing-pipeline/typesSupportProcessingPipeline.types";

const BUG_VISUAL_EVIDENCE_REQUEST = {
  types: ["screenshot", "video"],
  reason: "bug_visual_context_helpful"
};

function buildInput(
  overrides: Partial<SearchDecisionInput> = {}
): SearchDecisionInput {
  return {
    supportTopicKnowledge: {
      segments_topic: []
    },
    turnUnderstandingDelta: {
      user_language: "french",
      segments_lack_comprehension: [],
      segments_topic: [],
      segments_signal: [],
      segments_scope_boundary: [],
      segments_suspicious: []
    },
    accountInteractionTraits: {
      labels: [],
      lastUpdatedAt: "2026-06-03T08:00:00.000Z"
    },
    conversationHistory: [],
    ...overrides
  };
}

function buildBotAskFieldsHistory(params: {
  topicId: number;
  fieldsRequested: [string, ...string[]];
}): ConversationHistory {
  return [
    {
      id: "bot_event_1",
      message_id: "bot_message_1",
      created_at: "2026-06-03T08:05:00.000Z",
      role: "bot",
      responsePlan: {
        responseLanguage: "french",
        messagesPlan: {
          securityGatePlanMessage: undefined,
          suspiciousPlanMessage: undefined,
          lackComprehensionPlanMessage: undefined,
          scopeBoundaryPlanMessages: [],
          topicPlanMessages: [
            {
              politeness_opening: "salutation_and_understanding_1",
              topic_relation_acknowledgement: {
                no_matched_historical_topic_count: 1,
                matched_historical_topic_count: 0
              },
              topics_responses: [
                {
                  topic_response: {
                    title: {
                      topic_id: params.topicId,
                      topic_category: "bug",
                      tool_or_product: "Twake Drive",
                      topic_action: "create",
                      topic_object: "folder",
                      matched_historical_topic: false
                    },
                    updated_fields_acknowledgement: {},
                    main_response: {
                      type: "ask_fields",
                      details: {
                        fields_requested: params.fieldsRequested
                      }
                    },
                    next_step: "wait_more_info"
                  }
                }
              ],
              politeness_closure: "thanks_for_cooperation1"
            }
          ],
          signalPlanMessages: [],
          handoverPlanMessages: []
        }
      }
    }
  ];
}

function buildBotOptionalEvidenceHistory(topicId: number): ConversationHistory {
  return [
    {
      id: "bot_event_1",
      message_id: "bot_message_1",
      created_at: "2026-06-03T08:05:00.000Z",
      role: "bot",
      responsePlan: {
        responseLanguage: "french",
        messagesPlan: {
          securityGatePlanMessage: undefined,
          suspiciousPlanMessage: undefined,
          lackComprehensionPlanMessage: undefined,
          scopeBoundaryPlanMessages: [],
          topicPlanMessages: [
            {
              politeness_opening: "salutation_and_understanding_1",
              topic_relation_acknowledgement: {
                no_matched_historical_topic_count: 1,
                matched_historical_topic_count: 0
              },
              topics_responses: [
                {
                  topic_response: {
                    title: {
                      topic_id: topicId,
                      topic_category: "bug",
                      tool_or_product: "Twake Drive",
                      topic_action: "create",
                      topic_object: "folder",
                      matched_historical_topic: false
                    },
                    updated_fields_acknowledgement: {},
                    optional_evidence_requested: {
                      types: ["screenshot", "video"],
                      reason: "bug_visual_context_helpful"
                    },
                    main_response: {
                      type: "acknowledgement"
                    },
                    next_step: "wait_for_support"
                  }
                }
              ],
              politeness_closure: "thanks_for_cooperation1"
            }
          ],
          signalPlanMessages: [],
          handoverPlanMessages: []
        }
      }
    }
  ];
}

function buildAnalyzedImageAttachments(): TurnAttachments {
  return {
    images: [
      {
        id: "attachment_1",
        kind: "image",
        filename: "screenshot.png",
        mimeType: "image/png",
        sizeInBytes: 1024,
        status: "analyzed"
      }
    ],
    videos: [],
    other: []
  };
}

describe("runSearchDecision", function () {
  it("returns no_topic when the turn has no topic segment", async function () {
    const output = await runSearchDecision(buildInput());

    expect(output).toMatchObject({
      decision: {
        route: "continue",
        topics: []
      },
      detected: {
        topicsQualificationResult: "no_topic",
        solutionLikelihoodResult: "no_topic"
      }
    });
  });

  it("does not ask trigger_action for a bug with explicit topic action and observed result", async function () {
    const output = await runSearchDecision(
      buildInput({
        turnUnderstandingDelta: {
          user_language: "french",
          segments_lack_comprehension: [],
          segments_topic: [
            {
              matched_historical_topic: "no",
              id_topic: 1,
              topic_category: "bug",
              tool_or_product: "Twake Drive",
              topic_action: "create",
              topic_object: "folder",
              topic_details: {
                observed_result: "nothing happens"
              },
              user_goal: "Create a folder",
              blocking_issue: "yes"
            }
          ],
          segments_signal: [],
          segments_scope_boundary: [],
          segments_suspicious: []
        }
      })
    );

    expect(output.decision.topics).toEqual([
      {
        topic_id: 1,
        type: "ask_more_info",
        missing_fields: ["platform"],
        optional_evidence_requested: BUG_VISUAL_EVIDENCE_REQUEST
      }
    ]);
    expect(output.detected.solutionLikelihoodResult).toBe("rag_not_relevant");
  });

  it("can ask trigger_action for a vague bug without useful action context", async function () {
    const output = await runSearchDecision(
      buildInput({
        turnUnderstandingDelta: {
          user_language: "french",
          segments_lack_comprehension: [],
          segments_topic: [
            {
              matched_historical_topic: "no",
              id_topic: 1,
              topic_category: "bug",
              topic_details: {
                observed_result: "does not work"
              },
              user_goal: "Resolve vague issue",
              blocking_issue: "yes"
            }
          ],
          segments_signal: [],
          segments_scope_boundary: [],
          segments_suspicious: []
        }
      })
    );

    expect(output.decision.topics).toEqual([
      {
        topic_id: 1,
        type: "ask_more_info",
        missing_fields: ["trigger_action", "platform"],
        optional_evidence_requested: BUG_VISUAL_EVIDENCE_REQUEST
      }
    ]);
  });

  it("does not ask access_action or observed_result for an access security login issue with explicit action and error message", async function () {
    const output = await runSearchDecision(
      buildInput({
        turnUnderstandingDelta: {
          user_language: "french",
          segments_lack_comprehension: [],
          segments_topic: [
            {
              matched_historical_topic: "no",
              id_topic: 1,
              topic_category: "access_security",
              tool_or_product: "Twake",
              topic_action: "connect",
              topic_object: "account",
              topic_details: {
                observed_result: "error after entering password",
                error_message: "invalid credentials"
              },
              user_goal: "Connect to Twake account",
              blocking_issue: "yes"
            }
          ],
          segments_signal: [],
          segments_scope_boundary: [],
          segments_suspicious: []
        }
      })
    );

    expect(output.decision.topics).toEqual([
      {
        topic_id: 1,
        type: "ask_more_info",
        missing_fields: ["platform", "account_context"]
      }
    ]);
    expect(output.decision.topics[0]).not.toHaveProperty(
      "optional_evidence_requested"
    );
  });

  it("asks account context and platform for a reset password email topic", async function () {
    const output = await runSearchDecision(
      buildInput({
        turnUnderstandingDelta: {
          user_language: "french",
          segments_lack_comprehension: [],
          segments_topic: [
            {
              matched_historical_topic: "no",
              id_topic: 1,
              topic_category: "access_security",
              topic_action: "reset",
              topic_object: "password",
              topic_details: {
                observed_result: "not receiving password reset email"
              },
              user_goal: "Reset password",
              blocking_issue: "yes"
            }
          ],
          segments_signal: [],
          segments_scope_boundary: [],
          segments_suspicious: []
        }
      })
    );

    expect(output.decision.topics).toEqual([
      {
        topic_id: 1,
        type: "ask_more_info",
        missing_fields: ["account_context", "platform"]
      }
    ]);
    expect(output.decision.topics[0]).not.toHaveProperty(
      "optional_evidence_requested"
    );
  });

  it("keeps a fallback access security policy when topic action is not explicit", async function () {
    const output = await runSearchDecision(
      buildInput({
        turnUnderstandingDelta: {
          user_language: "french",
          segments_lack_comprehension: [],
          segments_topic: [
            {
              matched_historical_topic: "no",
              id_topic: 1,
              topic_category: "access_security",
              tool_or_product: "Twake",
              topic_details: {
                observed_result: "cannot access account"
              },
              user_goal: "Access Twake",
              blocking_issue: "yes"
            }
          ],
          segments_signal: [],
          segments_scope_boundary: [],
          segments_suspicious: []
        }
      })
    );

    expect(output.decision.topics).toEqual([
      {
        topic_id: 1,
        type: "ask_more_info",
        missing_fields: ["access_action", "auth_method"]
      }
    ]);
  });

  it("prioritizes permission context for permission denied access security issues", async function () {
    const output = await runSearchDecision(
      buildInput({
        turnUnderstandingDelta: {
          user_language: "french",
          segments_lack_comprehension: [],
          segments_topic: [
            {
              matched_historical_topic: "no",
              id_topic: 1,
              topic_category: "access_security",
              tool_or_product: "Twake Drive",
              topic_action: "open",
              topic_object: "shared folder",
              topic_details: {
                error_message: "Permission denied"
              },
              user_goal: "Open shared folder",
              blocking_issue: "yes"
            }
          ],
          segments_signal: [],
          segments_scope_boundary: [],
          segments_suspicious: []
        }
      })
    );

    expect(output.decision.topics).toEqual([
      {
        topic_id: 1,
        type: "ask_more_info",
        missing_fields: ["feature_or_page", "account_context"]
      }
    ]);
  });

  it("asks at most two missing fields for a bug topic", async function () {
    const output = await runSearchDecision(
      buildInput({
        turnUnderstandingDelta: {
          user_language: "french",
          segments_lack_comprehension: [],
          segments_topic: [
            {
              matched_historical_topic: "no",
              id_topic: 1,
              topic_category: "bug",
              tool_or_product: "Drive",
              topic_action: "create",
              topic_object: "folder",
              topic_details: {},
              user_goal: "Create a folder",
              blocking_issue: "yes"
            }
          ],
          segments_signal: [],
          segments_scope_boundary: [],
          segments_suspicious: []
        }
      })
    );

    expect(output.decision.topics).toEqual([
      {
        topic_id: 1,
        type: "ask_more_info",
        missing_fields: ["observed_result", "trigger_action"],
        optional_evidence_requested: BUG_VISUAL_EVIDENCE_REQUEST
      }
    ]);
  });

  it("does not request optional visual evidence when a bug already has an image attachment", async function () {
    const output = await runSearchDecision(
      buildInput({
        turnUnderstandingDelta: {
          user_language: "french",
          segments_lack_comprehension: [],
          segments_topic: [
            {
              matched_historical_topic: "no",
              id_topic: 1,
              topic_category: "bug",
              tool_or_product: "Drive",
              topic_action: "create",
              topic_object: "folder",
              topic_details: {
                observed_result: "nothing happens"
              },
              user_goal: "Create a folder",
              blocking_issue: "yes"
            }
          ],
          segments_signal: [],
          segments_scope_boundary: [],
          segments_suspicious: [],
          attachments: buildAnalyzedImageAttachments()
        }
      })
    );

    expect(output.decision.topics[0]).not.toHaveProperty(
      "optional_evidence_requested"
    );
  });

  it("acknowledges a clear bug when platform is already present and keeps visual evidence optional", async function () {
    const output = await runSearchDecision(
      buildInput({
        turnUnderstandingDelta: {
          user_language: "french",
          segments_lack_comprehension: [],
          segments_topic: [
            {
              matched_historical_topic: "no",
              id_topic: 1,
              topic_category: "bug",
              tool_or_product: "Drive",
              topic_action: "create",
              topic_object: "folder",
              segment_verbatims: [
                "Sur le web, Drive affiche une erreur quand je crée un dossier."
              ],
              topic_details: {
                observed_result: "error when creating a folder",
                platform: "web"
              },
              user_goal: "Create a folder",
              blocking_issue: "yes"
            }
          ],
          segments_signal: [],
          segments_scope_boundary: [],
          segments_suspicious: []
        }
      })
    );

    expect(output.decision.topics).toEqual([
      {
        topic_id: 1,
        type: "solution_searching",
        missing_fields: [],
        optional_evidence_requested: BUG_VISUAL_EVIDENCE_REQUEST
      }
    ]);
  });

  it("does not request optional visual evidence for a VoiceOver accessibility bug", async function () {
    const output = await runSearchDecision(
      buildInput({
        turnUnderstandingDelta: {
          user_language: "french",
          segments_lack_comprehension: [],
          segments_topic: [
            {
              matched_historical_topic: "no",
              id_topic: 1,
              topic_category: "bug",
              tool_or_product: "Twake Chat",
              topic_action: "send",
              topic_object: "message",
              segment_verbatims: [
                "Avec VoiceOver sur iPhone, je ne sais pas quel bouton envoie le message."
              ],
              topic_details: {
                observed_result: "cannot identify send button",
                platform: "iPhone"
              },
              user_goal: "Send a message with VoiceOver",
              blocking_issue: "yes"
            }
          ],
          segments_signal: [],
          segments_scope_boundary: [],
          segments_suspicious: []
        }
      })
    );

    expect(output.decision.topics[0]).not.toHaveProperty(
      "optional_evidence_requested"
    );
  });

  it("does not request optional visual evidence for unavailable connectors", async function () {
    const output = await runSearchDecision(
      buildInput({
        turnUnderstandingDelta: {
          user_language: "french",
          segments_lack_comprehension: [],
          segments_topic: [
            {
              matched_historical_topic: "no",
              id_topic: 1,
              topic_category: "bug",
              topic_action: "import",
              topic_object: "documents",
              segment_verbatims: [
                "Les connecteurs banque et ENSAP sont indisponibles."
              ],
              topic_details: {
                observed_result: "connectors unavailable",
                platform: "web"
              },
              user_goal: "Import documents from connectors",
              blocking_issue: "yes"
            }
          ],
          segments_signal: [],
          segments_scope_boundary: [],
          segments_suspicious: []
        }
      })
    );

    expect(output.decision.topics[0]).not.toHaveProperty(
      "optional_evidence_requested"
    );
  });

  it("does not request optional visual evidence again when it was already requested for the topic", async function () {
    const output = await runSearchDecision(
      buildInput({
        conversationHistory: buildBotOptionalEvidenceHistory(1),
        turnUnderstandingDelta: {
          user_language: "french",
          segments_lack_comprehension: [],
          segments_topic: [
            {
              matched_historical_topic: "no",
              id_topic: 1,
              topic_category: "bug",
              tool_or_product: "Drive",
              topic_action: "create",
              topic_object: "folder",
              topic_details: {
                observed_result: "nothing happens"
              },
              user_goal: "Create a folder",
              blocking_issue: "yes"
            }
          ],
          segments_signal: [],
          segments_scope_boundary: [],
          segments_suspicious: []
        }
      })
    );

    expect(output.decision.topics[0]).not.toHaveProperty(
      "optional_evidence_requested"
    );
  });

  it("does not ask again for a field already requested for the same topic", async function () {
    const output = await runSearchDecision(
      buildInput({
        conversationHistory: buildBotAskFieldsHistory({
          topicId: 1,
          fieldsRequested: ["platform"]
        }),
        turnUnderstandingDelta: {
          user_language: "french",
          segments_lack_comprehension: [],
          segments_topic: [
            {
              matched_historical_topic: "no",
              id_topic: 1,
              topic_category: "bug",
              tool_or_product: "Twake Drive",
              topic_action: "create",
              topic_object: "folder",
              topic_details: {
                observed_result: "nothing happens",
                expected_result: "folder should be created",
                trigger_action: "click create folder"
              },
              user_goal: "Create a folder",
              blocking_issue: "yes"
            }
          ],
          segments_signal: [],
          segments_scope_boundary: [],
          segments_suspicious: []
        }
      })
    );

    expect(output.decision.topics).toEqual([
      {
        topic_id: 1,
        type: "solution_searching",
        missing_fields: [],
        optional_evidence_requested: BUG_VISUAL_EVIDENCE_REQUEST
      }
    ]);
  });

  it("asks another missing field that was not requested before", async function () {
    const output = await runSearchDecision(
      buildInput({
        conversationHistory: buildBotAskFieldsHistory({
          topicId: 1,
          fieldsRequested: ["trigger_action"]
        }),
        turnUnderstandingDelta: {
          user_language: "french",
          segments_lack_comprehension: [],
          segments_topic: [
            {
              matched_historical_topic: "no",
              id_topic: 1,
              topic_category: "bug",
              tool_or_product: "Twake Drive",
              topic_action: "create",
              topic_object: "folder",
              topic_details: {
                observed_result: "nothing happens",
                expected_result: "folder should be created"
              },
              user_goal: "Create a folder",
              blocking_issue: "yes"
            }
          ],
          segments_signal: [],
          segments_scope_boundary: [],
          segments_suspicious: []
        }
      })
    );

    expect(output.decision.topics).toEqual([
      {
        topic_id: 1,
        type: "ask_more_info",
        missing_fields: ["platform"],
        optional_evidence_requested: BUG_VISUAL_EVIDENCE_REQUEST
      }
    ]);
  });

  it("allows a previously requested field to be filled later", async function () {
    const output = await runSearchDecision(
      buildInput({
        conversationHistory: buildBotAskFieldsHistory({
          topicId: 1,
          fieldsRequested: ["platform"]
        }),
        turnUnderstandingDelta: {
          user_language: "french",
          segments_lack_comprehension: [],
          segments_topic: [
            {
              matched_historical_topic: "no",
              id_topic: 1,
              topic_category: "bug",
              tool_or_product: "Twake Drive",
              topic_action: "create",
              topic_object: "folder",
              topic_details: {
                observed_result: "nothing happens",
                expected_result: "folder should be created",
                trigger_action: "click create folder",
                platform: "Windows 11"
              },
              user_goal: "Create a folder",
              blocking_issue: "yes"
            }
          ],
          segments_signal: [],
          segments_scope_boundary: [],
          segments_suspicious: []
        }
      })
    );

    expect(output.decision.topics).toEqual([
      {
        topic_id: 1,
        type: "solution_searching",
        missing_fields: [],
        optional_evidence_requested: BUG_VISUAL_EVIDENCE_REQUEST
      }
    ]);
  });

  it("searches solutions for a qualified RAG eligible topic", async function () {
    const output = await runSearchDecision(
      buildInput({
        turnUnderstandingDelta: {
          user_language: "french",
          segments_lack_comprehension: [],
          segments_topic: [
            {
              matched_historical_topic: "no",
              id_topic: 1,
              topic_category: "bug",
              tool_or_product: "Twake Drive",
              topic_action: "create",
              topic_object: "folder",
              topic_details: {
                observed_result: "nothing happens",
                expected_result: "folder should be created",
                trigger_action: "click create folder",
                platform: "web"
              },
              user_goal: "Create a folder",
              blocking_issue: "yes"
            }
          ],
          segments_signal: [],
          segments_scope_boundary: [],
          segments_suspicious: []
        }
      })
    );

    expect(output.decision.topics).toEqual([
      {
        topic_id: 1,
        type: "solution_searching",
        missing_fields: [],
        optional_evidence_requested: BUG_VISUAL_EVIDENCE_REQUEST
      }
    ]);
    expect(output.detected.solutionLikelihoodResult).toBe("rag_relevant");
  });

  it("searches solutions for a clear how-to question FAQ without asking feature_or_page", async function () {
    const output = await runSearchDecision(
      buildInput({
        turnUnderstandingDelta: {
          user_language: "french",
          segments_lack_comprehension: [],
          segments_topic: [
            {
              matched_historical_topic: "no",
              id_topic: 1,
              topic_category: "question_faq",
              tool_or_product: "Drive",
              topic_action: "share",
              topic_object: "folder",
              topic_details: {
                question_intent: "how_to"
              },
              user_goal: "Share a folder with a colleague in Drive",
              blocking_issue: "no"
            }
          ],
          segments_signal: [],
          segments_scope_boundary: [],
          segments_suspicious: []
        }
      })
    );

    expect(output.decision.topics).toEqual([
      {
        topic_id: 1,
        type: "solution_searching",
        missing_fields: []
      }
    ]);
    expect(output.detected.solutionLikelihoodResult).toBe("rag_relevant");
  });

  it("can ask for more context on a vague question FAQ", async function () {
    const output = await runSearchDecision(
      buildInput({
        turnUnderstandingDelta: {
          user_language: "french",
          segments_lack_comprehension: [],
          segments_topic: [
            {
              matched_historical_topic: "no",
              id_topic: 1,
              topic_category: "question_faq",
              tool_or_product: "Drive",
              topic_details: {
                question_intent: "how_to"
              },
              user_goal: "Ask how to do something in Drive",
              blocking_issue: "no"
            }
          ],
          segments_signal: [],
          segments_scope_boundary: [],
          segments_suspicious: []
        }
      })
    );

    expect(output.decision.topics).toEqual([
      {
        topic_id: 1,
        type: "ask_more_info",
        missing_fields: ["feature_or_page"]
      }
    ]);
  });

  it("acknowledges a clear request instead of asking feature_or_page or additional_context", async function () {
    const output = await runSearchDecision(
      buildInput({
        turnUnderstandingDelta: {
          user_language: "french",
          segments_lack_comprehension: [],
          segments_topic: [
            {
              matched_historical_topic: "no",
              id_topic: 1,
              topic_category: "request",
              topic_action: "organize",
              topic_object: "passwords",
              segment_verbatims: [
                "Est-ce que vous pouvez ajouter des dossiers pour organiser les mots de passe ?"
              ],
              topic_details: {
                gap_observed: "ability to organize passwords into folders"
              },
              user_goal: "Add folders to organize passwords",
              blocking_issue: "no"
            }
          ],
          segments_signal: [],
          segments_scope_boundary: [],
          segments_suspicious: []
        }
      })
    );

    expect(output.decision.topics).toEqual([
      {
        topic_id: 1,
        type: "acknowledgement",
        missing_fields: []
      }
    ]);
  });

  it("can ask for more context on a vague request", async function () {
    const output = await runSearchDecision(
      buildInput({
        turnUnderstandingDelta: {
          user_language: "french",
          segments_lack_comprehension: [],
          segments_topic: [
            {
              matched_historical_topic: "no",
              id_topic: 1,
              topic_category: "request",
              segment_verbatims: [
                "Il faudrait améliorer ça."
              ],
              topic_details: {},
              user_goal: "Improve something",
              blocking_issue: "no"
            }
          ],
          segments_signal: [],
          segments_scope_boundary: [],
          segments_suspicious: []
        }
      })
    );

    expect(output.decision.topics).toEqual([
      {
        topic_id: 1,
        type: "ask_more_info",
        missing_fields: ["gap_observed", "feature_or_page"]
      }
    ]);
  });

  it("uses historical topic details only for missing fields decisions", async function () {
    const output = await runSearchDecision(
      buildInput({
        supportTopicKnowledge: {
          segments_topic: [
            {
              id_topic: 1,
              topic_category: "bug",
              tool_or_product: "Twake Drive",
              topic_action: "create",
              topic_object: "folder",
              topic_details: {
                platform: "mobile app",
                trigger_action: "click on create folder",
                expected_result: "folder should be created",
                observed_result: "nothing happens"
              },
              user_goal: "Create a folder",
              blocking_issue: "no"
            }
          ]
        },
        turnUnderstandingDelta: {
          user_language: "french",
          segments_lack_comprehension: [],
          segments_topic: [
            {
              matched_historical_topic: "yes",
              id_topic: 1,
              topic_details: {
                observed_result: "validation button remains grayed out"
              }
            }
          ],
          segments_signal: [],
          segments_scope_boundary: [],
          segments_suspicious: []
        }
      })
    );

    expect(output.decision.topics).toEqual([
      {
        topic_id: 1,
        type: "solution_searching",
        missing_fields: [],
        optional_evidence_requested: BUG_VISUAL_EVIDENCE_REQUEST
      }
    ]);
    expect(output.detected.solutionLikelihoodResult).toBe("rag_relevant");
  });

  it("does not request optional visual evidence for a resolved matched bug topic", async function () {
    const output = await runSearchDecision(
      buildInput({
        supportTopicKnowledge: {
          segments_topic: [
            {
              id_topic: 1,
              topic_category: "bug",
              tool_or_product: "Twake Drive",
              topic_action: "create",
              topic_object: "folder",
              topic_details: {
                platform: "mobile app",
                trigger_action: "click on create folder",
                expected_result: "folder should be created",
                observed_result: "nothing happens"
              },
              user_goal: "Create a folder",
              blocking_issue: "yes"
            }
          ]
        },
        turnUnderstandingDelta: {
          user_language: "french",
          segments_lack_comprehension: [],
          segments_topic: [
            {
              matched_historical_topic: "yes",
              id_topic: 1,
              segment_verbatims: [
                "Ça marche maintenant pour le dossier."
              ],
              topic_details: {
                observed_result: "folder is now created"
              },
              blocking_issue: "no"
            }
          ],
          segments_signal: [],
          segments_scope_boundary: [],
          segments_suspicious: []
        }
      })
    );

    expect(output.decision.topics).toEqual([
      {
        topic_id: 1,
        type: "acknowledgement",
        missing_fields: []
      }
    ]);
  });

  it("acknowledges instead of searching when handover is explicitly requested", async function () {
    const output = await runSearchDecision(
      buildInput({
        turnUnderstandingDelta: {
          user_language: "french",
          segments_lack_comprehension: [],
          segments_topic: [
            {
              matched_historical_topic: "no",
              id_topic: 1,
              topic_category: "bug",
              tool_or_product: "Twake Drive",
              topic_action: "create",
              topic_object: "folder",
              topic_details: {
                observed_result: "nothing happens",
                expected_result: "folder should be created",
                trigger_action: "click create folder",
                platform: "web"
              },
              user_goal: "Create a folder",
              blocking_issue: "yes"
            }
          ],
          segments_signal: [
            {
              signal_verbatim: "Je veux parler à un humain",
              signal_types: ["handover_request"]
            }
          ],
          segments_scope_boundary: [],
          segments_suspicious: []
        }
      })
    );

    expect(output.decision.topics).toEqual([
      {
        topic_id: 1,
        type: "acknowledgement",
        missing_fields: [],
        optional_evidence_requested: BUG_VISUAL_EVIDENCE_REQUEST
      }
    ]);
    expect(output.detected.solutionLikelihoodResult).toBe("rag_not_relevant");
  });
});
