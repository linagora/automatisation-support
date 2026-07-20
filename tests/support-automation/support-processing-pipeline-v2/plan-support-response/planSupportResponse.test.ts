import { describe, expect, it } from "vitest";

import {
  buildPlanSupportResponsePrompt
} from "../../../../src/support-automation/support-processing-pipeline-v2/plan-support-response/buildPlanSupportResponsePrompt";
import {
  formatPlanSupportResponseOutput
} from "../../../../src/support-automation/support-processing-pipeline-v2/plan-support-response/formatPlanSupportResponseOutput";
import {
  planSupportResponseResponseFormat
} from "../../../../src/support-automation/support-processing-pipeline-v2/plan-support-response/planSupportResponse.schema";
import {
  formatComposeSupportResponsePlanOutput
} from "../../../../src/support-automation/support-processing-pipeline-v2/compose-support-response-plan/formatComposeSupportResponsePlanOutput";

import type {
  BuildPlanSupportResponsePromptInput
} from "../../../../src/support-automation/support-processing-pipeline-v2/plan-support-response/typesPlanSupportResponse.types";
import type {
  TextUnderstanding
} from "../../../../src/support-automation/support-processing-pipeline-v2/typesSupportProcessingPipelineV2.types";

function understanding(
  overrides: Partial<TextUnderstanding> = {}
): TextUnderstanding {
  return {
    understandingId: "understanding_1",
    sourceSegmentIds: ["segment_1"],
    messageKinds: [],
    caseDetails: [],
    attemptedActions: [],
    supportMetadata: [],
    summary: "Android notifications are missing",
    ...overrides
  };
}

function input(
  overrides: Partial<BuildPlanSupportResponsePromptInput> = {}
): BuildPlanSupportResponsePromptInput {
  return {
    topicUserMessageContent:
      "I do not receive notifications on Android when I get a new email.",
    topicEvidence: {
      proposalId: "topic_update_proposal_1",
      topicId: 1,
      topicSnapshot: {
        snapshotId: "topic_patch_1",
        topicId: 1,
        temporaryTopicId: null,
        isNewTopic: false,
        title: "Android notifications",
        broadCategoryHint: "bug",
        summary: "Android notifications are missing after new email.",
        caseDetails: [
          {
            key: "platform",
            value: "Android",
            evidence: "Android"
          }
        ],
        attemptedActions: [],
        sourceUnderstandingIds: ["understanding_1"],
        sourceVerbatims: [
          "Android notifications are missing"
        ],
        sourceOpIndex: 0,
        baseTopic: null
      },
      topicSourceVerbatims: [
        "Android notifications are missing"
      ],
      relatedUnderstandingIds: ["understanding_1"],
      relatedTextUnderstandings: [understanding()],
      relatedAttachmentUnderstandings: [],
      relatedSupportResponseCues: []
    },
    targetLanguage: "English",
    selectedCatalogKnowledge: {
      selectedFields: [
        {
          fieldName: "app_version",
          description: "App version.",
          askableByUser: true
        },
        {
          fieldName: "device",
          description: "Device model.",
          askableByUser: true
        }
      ],
      selectedGenericKnowledge: [],
      rejectedFieldNames: []
    },
    topicKnowledgeEnrichmentPlan: {
      route: "rag_only",
      retrievalRequests: [
        {
          topicId: 1,
          searchPurpose: "support_answer_and_qualification",
          queryText: "Support issue: android notification.",
          desiredKnowledge: ["known_behavior"],
          context: {
            topicSummary: "Android notification issue",
            knownDetails: [],
            attemptedActions: []
          }
        }
      ],
      reason: "rag_enabled_for_bug_topics"
    },
    topicRetrievedKnowledgeSynthesis: {
      relevantFacts: [
        "Android 13+ requires runtime notification permission."
      ],
      applicableInstructions: [
        "First check Android notification settings."
      ],
      doNotClaim: [
        "Do not say that the issue is fixed."
      ],
      topics: []
    },
    ...overrides
  };
}

function completed(parsedResponse: unknown) {
  return {
    status: "completed" as const,
    parsedResponse,
    rawResponse: JSON.stringify(parsedResponse)
  };
}

function promptText(
  overrides: Partial<BuildPlanSupportResponsePromptInput> = {}
): string {
  return buildPlanSupportResponsePrompt(input(overrides)).messages
    .map((message) => message.content)
    .join("\n");
}

function format(
  parsedResponse: unknown,
  overrides: Partial<BuildPlanSupportResponsePromptInput> = {}
) {
  return formatPlanSupportResponseOutput({
    input: input(overrides),
    rawPlanSupportResponse: completed(parsedResponse)
  }).responsePlan;
}

describe("planSupportResponse", function () {
  it("builds a prompt around merged topic, selector fields, and retrieved knowledge", function () {
    const prompt = promptText();

    expect(prompt).toContain("senior support response planner");
    expect(prompt).toContain('"topicSnapshot"');
    expect(prompt).toContain('"selectedCatalogKnowledge"');
    expect(prompt).toContain('"topicRetrievedKnowledgeSynthesis"');
    expect(prompt).toContain('"say"');
    expect(prompt).toContain(
      "The next stage consumes only \"say\"."
    );
    expect(prompt).toContain(
      "Do not copy retrieved wording directly into the response."
    );
    expect(prompt).toContain(
      "Treat internalNotes, sourceReferences, retrieval metadata, developer notes"
    );
    expect(prompt).toContain(
      "Do not phrase them as support-side verification."
    );
    expect(prompt).toContain(
      "Do not ask the user to perform internal support, developer, backend"
    );
  });

  it("explains enriched catalog direct question guidance", function () {
    const prompt = promptText();

    expect(prompt).toContain("selectedCatalogKnowledge.directQuestionGuidance");
    expect(prompt).toContain(
      "Use it to understand which atomic missing fields may be useful to ask and how to group them."
    );
    expect(prompt).toContain(
      "Direct field questions can be represented through ask[], but only for fields present in selectedCatalogKnowledge.selectedFields."
    );
  });

  it("explains diagnosticFlow as say guidance rather than ask items", function () {
    const prompt = promptText();

    expect(prompt).toContain("selectedCatalogKnowledge.diagnosticFlow");
    expect(prompt).toContain(
      "For now, express useful diagnostic flow requests in say, not ask[]"
    );
    expect(prompt).toContain(
      "Do not split a diagnostic flow mechanically into many ask[] items."
    );
    expect(prompt).toContain(
      "Do not use diagnosticFlow targetFieldNames to bypass ask[] validation."
    );
  });

  it("explains sufficientlyQualified and avoids redundant questions", function () {
    const prompt = promptText();

    expect(prompt).toContain("selectedCatalogKnowledge.sufficientlyQualified");
    expect(prompt).toContain(
      "If true, avoid asking more questions unless there is a decisive missing direct field."
    );
    expect(prompt).toContain(
      "prefer the human review / best-effort support fallback instead of asking redundant questions"
    );
  });

  it("explains unansweredRequestedFieldNames as planner anti-repetition memory", function () {
    const prompt = promptText({
      topicEvidence: {
        ...input().topicEvidence,
        topicSnapshot: {
          ...input().topicEvidence.topicSnapshot!,
          unansweredRequestedFieldNames: ["app_version"]
        }
      }
    });

    expect(prompt).toContain("topicSnapshot.unansweredRequestedFieldNames");
    expect(prompt).toContain(
      "previously requested or planned by the bot but are still missing"
    );
    expect(prompt).toContain(
      "Do not repeat these fields mechanically."
    );
    expect(prompt).toContain('"unansweredRequestedFieldNames":["app_version"]');
  });

  it("includes enriched catalog qualification data in the planner task JSON", function () {
    const prompt = promptText({
      selectedCatalogKnowledge: {
        selectedFieldNames: [
          "app_version"
        ],
        selectedFields: [
          {
            fieldName: "app_version",
            description: "App version.",
            askableByUser: true
          }
        ],
        selectedGenericKnowledge: [],
        directQuestionGuidance: {
          fieldNames: [
            "app_version"
          ],
          guidance: "Ask for the app version naturally.",
          reason: "Version affects troubleshooting."
        },
        diagnosticFlow: {
          name: "issue_diagnostic",
          targetFieldNames: [
            "trigger_action",
            "failure_step",
            "observed_result"
          ],
          attemptedActionsRelevant: true,
          guidance:
            "Ask the user to describe the exact steps and where the issue appears.",
          reason: "The issue needs step-by-step qualification."
        },
        sufficientlyQualified: false,
        reason: "Missing reproduction context.",
        rejectedFieldNames: [],
        scopeReason: "selected_candidate_fields"
      }
    });

    expect(prompt).toContain('"directQuestionGuidance"');
    expect(prompt).toContain('"diagnosticFlow"');
    expect(prompt).toContain('"sufficientlyQualified":false');
    expect(prompt).toContain('"Missing reproduction context."');
  });

  it("accepts answer only without decision or forbid", function () {
    const responsePlan = format({
      topicId: 1,
      acknowledge: [
        "Acknowledge missing Android notifications."
      ],
      answer: [
        {
          point: "Android 13+ requires runtime notification permission.",
          support: "retrieved_knowledge"
        }
      ],
      ask: [],
      say: [
        "Acknowledge the missing Android notifications and explain that Android 13+ requires notification permission. Do not say the issue is fixed."
      ],
      review: null
    });

    expect(responsePlan.answer).toEqual([
      {
        point: "Android 13+ requires runtime notification permission.",
        support: "retrieved_knowledge"
      }
    ]);
    expect(responsePlan.say[0]).toContain("Android 13+");
    expect(responsePlan).not.toHaveProperty("decision");
    expect(responsePlan).not.toHaveProperty("forbid");
  });

  it("accepts ask only from selected fields", function () {
    const responsePlan = format({
      topicId: 1,
      acknowledge: [
        "Acknowledge the notification issue."
      ],
      answer: [],
      ask: [
        {
          fieldName: "app_version",
          goal: "Confirm the affected app version."
        },
        {
          fieldName: "device",
          goal: "Confirm the affected device."
        }
      ],
      say: [
        "Acknowledge the notification issue and ask for the app version and device model in one concise question."
      ],
      review: null
    });

    expect(responsePlan.answer).toEqual([]);
    expect(responsePlan.ask.map((ask) => ask.fieldName)).toEqual([
      "app_version",
      "device"
    ]);
    expect(responsePlan.say[0]).toContain("app version and device model");
  });

  it("accepts answer and ask together", function () {
    const responsePlan = format({
      topicId: 1,
      acknowledge: [
        "Acknowledge missing notifications."
      ],
      answer: [
        {
          point: "Notifications depend on Android permission settings.",
          support: "retrieved_knowledge"
        }
      ],
      ask: [
        {
          fieldName: "app_version",
          goal: "Qualify whether a known app version is affected."
        }
      ],
      say: [
        "Acknowledge missing notifications, explain that notification permission settings matter, then ask for the app version."
      ],
      review: null
    });

    expect(responsePlan.answer).toHaveLength(1);
    expect(responsePlan.ask).toHaveLength(1);
    expect(responsePlan.say[0]).toContain("then ask for the app version");
  });

  it("accepts acknowledge only", function () {
    const responsePlan = format(
      {
        topicId: 1,
        acknowledge: [
          "Acknowledge that the user still has the issue."
        ],
        answer: [],
        ask: [],
        say: [
          "Acknowledge that the issue is still present without inventing a diagnosis or support action."
        ],
        review: null
      },
      {
        topicKnowledgeEnrichmentPlan: {
          route: "none",
          retrievalRequests: []
        },
        topicRetrievedKnowledgeSynthesis: null,
        selectedCatalogKnowledge: {
          selectedFields: [],
          selectedGenericKnowledge: [],
          rejectedFieldNames: []
        }
      }
    );

    expect(responsePlan.acknowledge).toHaveLength(1);
    expect(responsePlan.answer).toEqual([]);
    expect(responsePlan.ask).toEqual([]);
    expect(responsePlan.say[0]).toContain("without inventing");
  });

  it("accepts human review plan when no reliable answer or useful question remains", function () {
    const responsePlan = format(
      {
        topicId: 1,
        acknowledge: [
          "Acknowledge that the user reports missing Android notifications."
        ],
        answer: [],
        ask: [],
        say: [
          "Acknowledge that the user reports missing Android notifications. Say that no reliable automatic answer can be given at this stage and that the issue needs human support review. Do not expose backend or retrieval details."
        ],
        review: "No customer-facing answer is available and no decisive selected field remains."
      },
      {
        selectedCatalogKnowledge: {
          selectedFields: [],
          selectedGenericKnowledge: [],
          rejectedFieldNames: []
        },
        topicRetrievedKnowledgeSynthesis: {
          relevantFacts: [],
          applicableInstructions: [],
          limitations: [
            "Internal knowledge is not customer-facing."
          ],
          internalNotes: [
            "Backend debug logs may need inspection."
          ],
          retrievedChunkCount: 1,
          topics: []
        }
      }
    );

    expect(responsePlan.answer).toEqual([]);
    expect(responsePlan.ask).toEqual([]);
    expect(responsePlan.review).toContain("No customer-facing answer");
    expect(responsePlan.say[0]).toContain("human support review");
  });

  it("drops invalid ask fields", function () {
    const output = formatPlanSupportResponseOutput({
      input: input(),
      rawPlanSupportResponse: completed({
        topicId: 1,
        acknowledge: [],
        answer: [],
        ask: [
          {
            fieldName: "",
            goal: "Empty field should be dropped."
          },
          {
            fieldName: "browser",
            goal: "Browser was not selected."
          },
          {
            fieldName: "app_version",
            goal: "Selected field."
          }
        ],
        say: [
          "Ask only for the selected app version."
        ],
        review: null
      })
    });

    expect(output.responsePlan.ask).toEqual([
      {
        fieldName: "app_version",
        goal: "Selected field."
      }
    ]);
    expect(output.validation.droppedItems).toEqual([
      "ask.0",
      "ask.1:field_not_selected:browser"
    ]);
  });

  it("drops RAG-useful ask fields that are not selected by catalog", function () {
    const output = formatPlanSupportResponseOutput({
      input: input({
        topicRetrievedKnowledgeSynthesis: {
          relevantFacts: [],
          applicableInstructions: [
            "Ask for notification permission status if it is authorized."
          ],
          possibleFields: [
            "notification_permission_status",
            "app_version"
          ],
          unresolvedPoints: [
            "notification_permission_status"
          ],
          sourceReferences: [],
          limitations: [],
          doNotClaim: [],
          topics: []
        }
      }),
      rawPlanSupportResponse: completed({
        topicId: 1,
        acknowledge: [],
        answer: [],
        ask: [
          {
            fieldName: "notification_permission_status",
            goal: "RAG says this would be useful, but catalog did not authorize it."
          },
          {
            fieldName: "app_version",
            goal: "RAG says this is useful and catalog authorized it."
          }
        ],
        say: [
          "Ask only for the selected app version."
        ],
        review: null
      })
    });

    expect(output.responsePlan.ask).toEqual([
      {
        fieldName: "app_version",
        goal: "RAG says this is useful and catalog authorized it."
      }
    ]);
    expect(output.validation.droppedItems).toContain(
      "ask.0:field_not_selected:notification_permission_status"
    );
  });

  it("drops invalid answer points", function () {
    const output = formatPlanSupportResponseOutput({
      input: input(),
      rawPlanSupportResponse: completed({
        topicId: 1,
        acknowledge: [],
        answer: [
          {
            point: "",
            support: "retrieved_knowledge"
          },
          {
            point: "Supported by the topic.",
            support: "topic"
          },
          {
            point: "Unsupported enum.",
            support: "invented"
          }
        ],
        ask: [],
        say: [
          "Acknowledge the topic using supported information only."
        ],
        review: null
      })
    });

    expect(output.responsePlan.answer).toEqual([
      {
        point: "Supported by the topic.",
        support: "topic"
      }
    ]);
    expect(output.validation.droppedItems).toEqual([
      "answer.0",
      "answer.2"
    ]);
  });

  it("falls back without reconstructing decision or forbid", function () {
    const output = formatPlanSupportResponseOutput({
      input: input(),
      rawPlanSupportResponse: {
        status: "completed",
        parsedResponse: {
          topicId: 1,
          acknowledge: [],
          answer: [],
          ask: [],
          say: [],
          review: null
        }
      }
    });

    expect(output.validation.status).toBe("fallback");
    expect(output.responsePlan.say).toEqual([
      "Acknowledge the user's topic without making unsupported claims. Ask for clarification only if necessary."
    ]);
    expect(output.responsePlan.review).toBe(
      "plan_support_response_fallback:missing_say"
    );
    expect(output.responsePlan).not.toHaveProperty("decision");
    expect(output.responsePlan).not.toHaveProperty("forbid");
  });

  it("schema exposes no decision or forbid fields", function () {
    const serializedSchema = JSON.stringify(planSupportResponseResponseFormat);

    expect(serializedSchema).toContain("acknowledge");
    expect(serializedSchema).toContain("answer");
    expect(serializedSchema).toContain("ask");
    expect(serializedSchema).toContain("say");
    expect(serializedSchema).not.toContain("decision");
    expect(serializedSchema).not.toContain("forbid");
  });

  it("uses say as the operational topic output for composition", function () {
    const composed = formatComposeSupportResponsePlanOutput({
      input: {
        standardResponseFragments: [],
        topicResponsePlans: [
          {
            topicId: 1,
            acknowledge: ["Acknowledge internally."],
            answer: [
              {
                point: "Internal answer point.",
                support: "topic"
              }
            ],
            ask: [
              {
                fieldName: "app_version",
                goal: "This must remain internal planning metadata."
              }
            ],
            say: [
              "Only this instruction should reach the renderer for the topic."
            ],
            review: null,
            responsePlanId: "response_plan_topic_1"
          }
        ],
        supportResponseCues: [],
        channel: "email",
        recentInteractionContext: {}
      },
      rawComposeSupportResponsePlan: {
        status: "failed",
        error: {
          message: "force_fallback"
        }
      }
    }).composedSupportResponsePlan;

    expect(composed.say[0]).toContain(
      "Only this instruction should reach the renderer for the topic."
    );
    expect(composed.ask).toEqual([
      {
        goal: "This must remain internal planning metadata.",
        sourceTopicIds: ["response_plan_topic_1"]
      }
    ]);
    expect(composed).not.toHaveProperty("sections");
    expect(composed).not.toHaveProperty("globalQuestions");
    expect(composed).not.toHaveProperty("globalForbid");
  });
});
