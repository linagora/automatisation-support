import { describe, expect, it } from "vitest";

import {
  buildPlanSupportResponsePrompt
} from "../../../../src/support-processing-pipeline/v2/plan-support-response/buildPlanSupportResponsePrompt";
import {
  formatPlanSupportResponseOutput
} from "../../../../src/support-processing-pipeline/v2/plan-support-response/formatPlanSupportResponseOutput";

import type {
  BuildPlanSupportResponsePromptInput
} from "../../../../src/support-processing-pipeline/v2/plan-support-response/typesPlanSupportResponse.types";
import type {
  AttachmentUnderstanding,
  TextUnderstanding,
  TopicUpdateProposal
} from "../../../../src/support-processing-pipeline/v2/typesSupportProcessingPipelineV2.types";

const proposal: TopicUpdateProposal = {
  proposalId: "topic_update_proposal_1",
  action: "create_new_topic",
  fromUnderstandingIds: ["understanding_1"],
  relatedAttachmentIndexes: [],
  topicId: null,
  selectedSourceVerbatims: ["Le problème est toujours présent."],
  updateIntent: {
    relationship: "creates_distinct_topic",
    blockingIssue: "unknown",
    statusHint: "open",
    userGoal: "Résoudre le problème",
    correctionNote: null
  },
  newTopic: {
    title: "Problème applicatif",
    broadCategoryHint: "bug",
    userGoal: "Résoudre le problème",
    blockingIssue: "unknown"
  },
  reason: "Nouveau sujet."
};

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
    sourceVerbatims: ["Le problème est toujours présent."],
    summary: "Problème applicatif",
    primaryUserExpectation: "wants_solution",
    supportNeeds: ["possible_bug"],
    broadCategoryHint: "bug",
    contextDependency: "standalone_complete",
    contextualAnswer: {
      type: "none",
      value: null,
      evidence: null
    },
    facts: [],
    testedActions: [],
    uncertainties: [],
    ...overrides
  };
}

type PlannerTestOverrides = Omit<
  Partial<BuildPlanSupportResponsePromptInput>,
  "topicUserMessageContent" | "topicEvidence"
> & {
  latestUserMessageContent?: string;
  topicUpdateProposal?: TopicUpdateProposal;
  existingTopic?: unknown;
  relatedTextUnderstandings?: TextUnderstanding[];
  relatedAttachmentUnderstandings?: AttachmentUnderstanding[];
};

function input(
  overrides: PlannerTestOverrides = {}
): BuildPlanSupportResponsePromptInput {
  const {
    latestUserMessageContent = "Le problème est toujours présent.",
    topicUpdateProposal = proposal,
    existingTopic,
    relatedTextUnderstandings = [understanding()],
    relatedAttachmentUnderstandings = [],
    ...inputOverrides
  } = overrides;

  return {
    topicUserMessageContent: latestUserMessageContent,
    topicEvidence: {
      proposalId: topicUpdateProposal.proposalId,
      topicId: topicUpdateProposal.topicId,
      topicSourceVerbatims: topicUpdateProposal.selectedSourceVerbatims,
      relatedUnderstandingIds: topicUpdateProposal.fromUnderstandingIds,
      relatedTextUnderstandings,
      relatedAttachmentUnderstandings,
      relatedSupportResponseCues: [],
      ...(existingTopic ? { existingTopic } : {})
    },
    targetLanguage: "French",
    selectedCatalogKnowledge: {
      selectedFields: [
        {
          fieldName: "error_message",
          description: "Message d’erreur exact."
        }
      ],
      selectedGenericKnowledge: []
    },
    topicKnowledgeEnrichmentPlan: {
      route: "no_retrieval",
      retrievalRequests: [],
      reason: "rag_not_enabled"
    },
    topicRetrievedKnowledgeSynthesis: null,
    ...inputOverrides
  };
}

function serialize(
  overrides: PlannerTestOverrides = {}
): string {
  return buildPlanSupportResponsePrompt(input(overrides)).messages
    .map((message) => message.content)
    .join("\n");
}

describe("planSupportResponse topic-only prompt", function () {
  it("does not ask for information already present", function () {
    const prompt = serialize({
      relatedTextUnderstandings: [
        understanding({
          caseDetails: [
            {
              key: "browser",
              value: "Firefox",
              evidence: "sur Firefox"
            }
          ]
        })
      ],
      selectedCatalogKnowledge: {
        selectedFields: [{ fieldName: "browser" }]
      }
    });

    expect(prompt).toContain('"fieldName": "browser"');
    expect(prompt).toContain('"value": "Firefox"');
    expect(prompt).toContain("Do not ask fields already known from text");
  });

  it("asks a decisive question when no supported answer is possible", function () {
    const prompt = serialize();

    expect(prompt).toContain('"knowledgeMode": "rag_not_enabled"');
    expect(prompt).toContain(
      "Before choosing acknowledgement only, verify that no selected field is both missing and decisive."
    );
    expect(prompt).toContain('"fieldName": "error_message"');
  });

  it("does not choose acknowledgement only while a decisive field is missing", function () {
    const prompt = serialize({
      selectedCatalogKnowledge: {
        selectedFields: [{ fieldName: "trigger_action" }]
      }
    });

    expect(prompt).toContain(
      "Before choosing acknowledgement only, actively check whether one selected catalog field is both missing and decisive."
    );
    expect(prompt).toContain('"fieldName": "trigger_action"');
  });

  it("prioritizes duplicate_billing_impact before amount or currency", function () {
    const prompt = serialize({
      latestUserMessageContent: "J’ai reçu ma facture deux fois.",
      relatedTextUnderstandings: [
        understanding({
          summary: "Facture reçue deux fois",
          broadCategoryHint: "billing",
          supportNeeds: ["possible_billing_or_payment_action"]
        })
      ],
      selectedCatalogKnowledge: {
        selectedFields: [
          { fieldName: "duplicate_billing_impact" },
          { fieldName: "amount" },
          { fieldName: "currency" }
        ]
      }
    });

    expect(prompt).toContain(
      "do not ask amount or currency first"
    );
    expect(prompt).toContain('"fieldName": "duplicate_billing_impact"');
  });

  it("forbids invented diagnosis or solution without knowledge", function () {
    const prompt = serialize();

    expect(prompt).toContain("solutionAllowed must be false");
    expect(prompt).toContain(
      "must not provide a solution, diagnosis, procedure"
    );
  });

  it("exposes mock knowledge guidance and restrictions to the planner", function () {
    const prompt = serialize({
      topicKnowledgeEnrichmentPlan: {
        route: "retrieve_knowledge",
        retrievalRequests: [
          {
            topicId: 0,
            query: "android notification"
          }
        ]
      },
      topicRetrievedKnowledgeSynthesis: {
        relevantFacts: [
          "Android 13+ requires runtime notification permission."
        ],
        applicableInstructions: [
          "First check whether notifications are enabled in Android settings."
        ],
        possibleFields: [
          "notification_permission_status",
          "notification_channel_status"
        ],
        unresolvedPoints: [
          "Has the notification permission been granted?"
        ],
        sourceReferences: [
          "https://github.com/linagora/tmail-flutter/issues/4322"
        ],
        recommendedFirstAnswer:
          "Explain the expected notification behavior and check permissions first.",
        doNotClaim: [
          "Do not say that the issue is fixed.",
          "Do not promise a resolution timeline."
        ]
      }
    });

    expect(prompt).toContain('"knowledgeMode": "knowledge_available"');
    expect(prompt).toContain(
      "Android 13+ requires runtime notification permission."
    );
    expect(prompt).toContain(
      "Explain the expected notification behavior and check permissions first."
    );
    expect(prompt).toContain("Do not say that the issue is fixed.");
    expect(prompt).toContain(
      "Carry every doNotClaim and limitation into rendererTask.forbiddenClaims"
    );
  });

  it("moves an Android notification follow-up past the confirmed permission question", function () {
    const prompt = serialize({
      latestUserMessageContent:
        "The permission is granted. I still do not receive notifications.",
      existingTopic: {
        id_topic: 4,
        topic_category: "bug",
        topic_details: {
          operating_system: "Android",
          notification_permission_status: "granted",
          observed_result: "still not receiving notifications"
        },
        user_goal: "Restore Android notifications",
        blocking_issue: "no"
      },
      selectedCatalogKnowledge: {
        selectedFields: [
          { fieldName: "notification_permission_status" },
          { fieldName: "operating_system" },
          { fieldName: "device" },
          { fieldName: "app_version" },
          { fieldName: "frequency" }
        ]
      },
      topicRetrievedKnowledgeSynthesis: {
        relevantFacts: [],
        sourceReferences: [
          "android_push_notification_not_received"
        ],
        ifUserConfirmsNotificationsEnabled:
          "Ask for Android version, device model, app version, and frequency.",
        topics: []
      }
    });

    expect(prompt).toContain(
      "do not ask again whether notifications are enabled or permission is granted"
    );
    expect(prompt).toContain("operating_system");
    expect(prompt).toContain("version, device, app_version, and frequency");
    expect(prompt).toContain(
      "Ask for Android version, device model, app version, and frequency."
    );
    expect(prompt).toContain('"notification_permission_status": "granted"');
  });

  it("requests a clearer attachment when visual evidence is useful but unusable", function () {
    const attachment: AttachmentUnderstanding = {
      attachmentIndex: 0,
      status: "analyzed",
      summary: "Capture illisible de l’erreur",
      limitations: ["Texte trop flou pour lire le message d’erreur"]
    };
    const prompt = serialize({
      topicUpdateProposal: {
        ...proposal,
        relatedAttachmentIndexes: [0]
      },
      relatedAttachmentUnderstandings: [attachment],
      selectedCatalogKnowledge: {
        selectedFields: [{ fieldName: "visual_evidence" }]
      }
    });

    expect(prompt).toContain("Capture illisible de l’erreur");
    expect(prompt).toContain(
      "ask for a clearer or more complete screenshot/photo/video"
    );
  });

  it("does not request another attachment when current visual evidence is sufficient", function () {
    const prompt = serialize({
      topicUpdateProposal: {
        ...proposal,
        relatedAttachmentIndexes: [0]
      },
      relatedAttachmentUnderstandings: [
        {
          attachmentIndex: 0,
          status: "analyzed",
          summary: "Capture lisible montrant le message d’erreur complet"
        }
      ],
      selectedCatalogKnowledge: {
        selectedFields: [{ fieldName: "visual_evidence" }]
      }
    });

    expect(prompt).toContain(
      "Do not request another screenshot, photo, or video if existing evidence is already sufficient."
    );
    expect(prompt).toContain("Capture lisible montrant le message d’erreur complet");
  });

  it("asks for textual browser information instead of visual evidence", function () {
    const prompt = serialize({
      selectedCatalogKnowledge: {
        selectedFields: [{ fieldName: "browser" }]
      }
    });

    expect(prompt).toContain('"fieldName": "browser"');
    expect(prompt).toContain(
      "Do not request visual evidence for facts that are better provided as text, such as browser name"
    );
    expect(prompt).not.toContain('"fieldName": "visual_evidence"');
  });

  it("contains only topic-scoped planner inputs", function () {
    const prompt = serialize();

    expect(prompt).toContain('"proposalId"');
    expect(prompt).toContain('"topicSourceVerbatims"');
    expect(prompt).toContain('"relatedTextUnderstandings"');
    expect(prompt).toContain('"selectedCatalogKnowledge"');
    expect(prompt).not.toContain('"standardResponseFragments"');
    expect(prompt).not.toContain('"topicUpdateProposals"');
    expect(prompt).not.toContain('"existingTopics"');
    expect(prompt).not.toContain('"retrievedSupportKnowledge"');
    expect(prompt).not.toContain('"latestUserMessageContent"');
  });

  it("keeps French for a short negative reply when the topic language is known", function () {
    const prompt = serialize({
      latestUserMessageContent: "non",
      targetLanguage: undefined,
      existingTopic: {
        topicId: "topic_1",
        userLanguage: "French"
      }
    });

    expect(prompt).toContain('"targetLanguage": "fr"');
  });

  it("normalizes legacy Other explicit target languages to en", function () {
    const prompt = serialize({
      latestUserMessageContent: "Guten mein freunde",
      targetLanguage: "Other"
    });

    expect(prompt).toContain('"targetLanguage": "en"');
    expect(prompt).not.toContain('"targetLanguage": "Other"');
  });

  it("keeps known non-French non-English explicit target language codes", function () {
    const prompt = serialize({
      latestUserMessageContent:
        "Mein Konto ist gesperrt.",
      targetLanguage: "de"
    });

    expect(prompt).toContain('"targetLanguage": "de"');
    expect(prompt).not.toContain('"targetLanguage": "French"');
    expect(prompt).not.toContain('"targetLanguage": "English"');
  });

  it("does not ask again for already qualified login information", function () {
    const prompt = serialize({
      latestUserMessageContent:
        "J’ai une erreur de login, mon mot de passe n’est pas bon.",
      relatedTextUnderstandings: [
        understanding({
          broadCategoryHint: "access_security",
          caseDetails: [
            {
              key: "access_action",
              value: "login",
              evidence: "erreur de login"
            },
            {
              key: "auth_method",
              value: "password",
              evidence: "mot de passe"
            },
            {
              key: "observed_result",
              value: "password rejected",
              evidence: "mon mot de passe n’est pas bon"
            }
          ]
        })
      ],
      selectedCatalogKnowledge: {
        selectedFields: [
          { fieldName: "access_action", askableByUser: true },
          { fieldName: "auth_method", askableByUser: true },
          { fieldName: "observed_result", askableByUser: true }
        ]
      }
    });

    expect(prompt).toContain('"value": "password rejected"');
    expect(prompt).toContain(
      "Do not ask fields already known from text, attachments, or existing topic context."
    );
  });

  it("allows two decisive askable fields in the same turn", function () {
    const prompt = serialize({
      responsePlanningPolicy: {
        maxQuestionsPerTopic: 2
      },
      selectedCatalogKnowledge: {
        selectedFields: [
          { fieldName: "browser", askableByUser: true },
          { fieldName: "error_message", askableByUser: true }
        ]
      }
    });

    expect(prompt).toContain(
      "Ask in one response all fields that are clearly decisive now"
    );
    expect(prompt).toContain('"maxQuestionsPerTopic": 2');
  });

  it("removes a non-askable field from the formatted plan", function () {
    const plannerInput = input({
      selectedCatalogKnowledge: {
        selectedFields: [
          {
            fieldName: "account_status",
            askableByUser: false
          }
        ]
      }
    });
    const output = formatPlanSupportResponseOutput({
      input: plannerInput,
      rawPlanSupportResponse: {
        status: "completed",
        parsedResponse: {
          responsePlanId: "response_plan_1",
          knowledgeGate: {
            knowledgeMode: "rag_not_enabled",
            solutionAllowed: false,
            allowedMoves: ["ask_missing_fields"],
            reason: "No knowledge."
          },
          questionDecision: {
            shouldAskQuestion: true,
            plannedQuestionCount: 1,
            fieldNames: ["account_status"],
            questionInstruction: "Demandez si le compte est actif.",
            reason: "Missing field."
          },
          rendererTask: {
            targetLanguage: "French",
            prompt: "Demandez si le compte est actif.",
            questionFieldNames: ["account_status"],
            forbiddenClaims: []
          },
          internalRationale: "Test."
        }
      }
    });

    expect(output.responsePlan.questionDecision).toMatchObject({
      shouldAskQuestion: false,
      plannedQuestionCount: 0,
      fieldNames: [],
      questionInstruction: null
    });
    expect(output.responsePlan.rendererTask.questionFieldNames).toEqual([]);
  });

  it("normalizes unsupported formatted renderer task languages to English", function () {
    const output = formatPlanSupportResponseOutput({
      input: input({
        targetLanguage: "Other"
      }),
      rawPlanSupportResponse: {
        status: "completed",
        parsedResponse: {
          responsePlanId: "response_plan_1",
          knowledgeGate: {
            knowledgeMode: "rag_not_enabled",
            solutionAllowed: false,
            allowedMoves: ["acknowledge"],
            reason: "No knowledge."
          },
          questionDecision: {
            shouldAskQuestion: false,
            plannedQuestionCount: 0,
            fieldNames: [],
            questionInstruction: null,
            reason: "No question needed."
          },
          rendererTask: {
            targetLanguage: "Other",
            prompt: "Write a short acknowledgement.",
            questionFieldNames: [],
            forbiddenClaims: []
          },
          internalRationale: "Test."
        }
      }
    });

    expect(output.responsePlan.rendererTask.targetLanguage).toBe("en");
  });

  it("removes a question for login information already provided", function () {
    const plannerInput = input({
      relatedTextUnderstandings: [
        understanding({
          facts: [
            {
              type: "catalogued_field",
              fieldName: "observed_result",
              value: "mot de passe refusé",
              evidence: "mon mot de passe n’est pas bon"
            }
          ]
        })
      ],
      selectedCatalogKnowledge: {
        selectedFields: [
          {
            fieldName: "observed_result",
            askableByUser: true
          }
        ]
      }
    });
    const output = formatPlanSupportResponseOutput({
      input: plannerInput,
      rawPlanSupportResponse: {
        status: "completed",
        parsedResponse: {
          responsePlanId: "response_plan_1",
          knowledgeGate: {
            knowledgeMode: "rag_not_enabled",
            solutionAllowed: false,
            allowedMoves: ["ask_missing_fields"],
            reason: "No knowledge."
          },
          questionDecision: {
            shouldAskQuestion: true,
            plannedQuestionCount: 1,
            fieldNames: ["observed_result"],
            questionInstruction: "Demandez ce qui ne fonctionne pas.",
            reason: "Missing field."
          },
          rendererTask: {
            targetLanguage: "French",
            prompt: "Demandez ce qui ne fonctionne pas.",
            questionFieldNames: ["observed_result"],
            forbiddenClaims: []
          },
          internalRationale: "Test."
        }
      }
    });

    expect(output.responsePlan.questionDecision.shouldAskQuestion).toBe(false);
    expect(output.responsePlan.rendererTask.prompt).toContain(
      "Do not ask again for information already provided"
    );
  });

  it("does not re-ask a field already persisted in topic_details", function () {
    const plannerInput = input({
      existingTopic: {
        id_topic: 4,
        topic_category: "bug",
        topic_details: {
          notification_permission_status: "granted"
        },
        user_goal: "Restore Android notifications",
        blocking_issue: "no"
      },
      selectedCatalogKnowledge: {
        selectedFields: [
          {
            fieldName: "notification_permission_status",
            askableByUser: true
          }
        ]
      }
    });
    const output = formatPlanSupportResponseOutput({
      input: plannerInput,
      rawPlanSupportResponse: {
        status: "completed",
        parsedResponse: {
          responsePlanId: "response_plan_1",
          knowledgeGate: {
            knowledgeMode: "knowledge_available",
            solutionAllowed: true,
            allowedMoves: ["answer_with_knowledge", "ask_missing_fields"],
            reason: "Knowledge is available."
          },
          questionDecision: {
            shouldAskQuestion: true,
            plannedQuestionCount: 1,
            fieldNames: ["notification_permission_status"],
            questionInstruction: "Ask whether permission is granted.",
            reason: "Permission is needed."
          },
          rendererTask: {
            targetLanguage: "English",
            prompt: "Ask whether notification permission is granted.",
            questionFieldNames: ["notification_permission_status"],
            forbiddenClaims: []
          },
          internalRationale: "Test."
        }
      }
    });

    expect(output.responsePlan.questionDecision.shouldAskQuestion).toBe(false);
    expect(output.responsePlan.rendererTask.prompt).toContain(
      "Do not ask again for information already provided"
    );
  });

  it("does not re-ask a field refused in existing topic context", function () {
    const prompt = serialize({
      latestUserMessageContent: "non",
      existingTopic: {
        topicId: "topic_1",
        userLanguage: "French",
        refusedFields: ["visual_evidence"]
      },
      selectedCatalogKnowledge: {
        selectedFields: [
          {
            fieldName: "visual_evidence",
            askableByUser: true
          }
        ]
      }
    });

    expect(prompt).toContain('"refusedFields": [');
    expect(prompt).toContain(
      "Treat a contextual negative answer such as \"no\" or \"non\" as an answer"
    );
  });
});
