import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  runSupportProcessingPipelineV2
} from "../../src/support-automation/support-processing-pipeline-v2/runSupportProcessingPipelineV2";
import {
  runSupportProcessingPipelineV2Debug
} from "../../src/support-automation/support-processing-pipeline-v2/runSupportProcessingPipelineV2Debug";
import {
  buildSupportProcessingPersistenceEffectsV2
} from "../../src/support-automation/support-processing-pipeline-v2/build-persistence-effects/buildSupportProcessingPersistenceEffectsV2";
import {
  buildTopicResponsePlanDebug
} from "../../src/support-automation/support-processing-pipeline-v2/responsePlanIds";
import {
  planKnowledgeEnrichment
} from "../../src/support-automation/support-processing-pipeline-v2/plan-knowledge-enrichment/planKnowledgeEnrichment";
import {
  retrieveSupportKnowledge
} from "../../src/support-automation/support-processing-pipeline-v2/retrieve-support-knowledge/retrieveSupportKnowledge";
import {
  synthesizeRetrievedKnowledge
} from "../../src/support-automation/support-processing-pipeline-v2/synthesize-retrieved-knowledge/synthesizeRetrievedKnowledge";
import {
  applyTopicsByExactId
} from "../../src/support-automation/patch-live-memory/applyLiveMemoryUpdate";

import type {
  AttachmentSurfaceAnalysis,
  AttachmentUnderstanding,
  ComposedSupportResponsePlan,
  KnowledgeChunk,
  KnowledgeEnrichmentPlan,
  PromptSecuritySignals,
  ResponsePlanV2,
  StandardResponseFragment,
  SupportResponseCue,
  SupportProcessingPipelineV2Input,
  SupportProcessingPersistenceEffectsV2,
  SupportProcessingProgressEvent,
  SupportProcessingPipelineV2Steps,
  TextSurfaceAnalysis,
  TextUnderstanding,
  TopicPatch,
  MergedTopicSnapshot,
  TopicUpdateOp,
  TopicUpdateProposal,
  ProposeTopicUpdatesOutput,
  UserResponse
} from "../../src/support-automation/support-processing-pipeline-v2/typesSupportProcessingPipelineV2.types";
import type {
  RenderedSupportResponse
} from "../../src/support-automation/support-processing-pipeline-v2/response-renderer/typesRenderSupportResponse.types";
import type {
  LiveMemoryTopic
} from "../../src/infrastructure/live-memory/typesLiveMemoryContext.types";

function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

function buildInput(): SupportProcessingPipelineV2Input {
  return {
    latestUserMessage: {
      id: "msg_1",
      content: "Bonjour, je n'arrive pas à me connecter.",
      channel: "email",
      sentAt: "2026-06-12T08:00:00.000Z"
    },
    latestUserAttachments: [
      {
        id: "att_1",
        filename: "screen.png",
        sizeInBytes: 1024,
        mimeType: "image/png",
        channel: "email",
        sentAt: "2026-06-12T08:00:01.000Z"
      }
    ],
    accountTrustStatus: {
      status: "trusted",
      reasons: []
    },
    accountProfile: {
      accountType: "company",
      actualPlan: "paid",
      paymentStatus: "up_to_date",
      planHistory: [],
      createdAt: "2025-01-01T00:00:00.000Z",
      daysSinceCreation: 528
    },
    accountInteractionTraits: {
      labels: [],
      lastUpdatedAt: "2026-06-12T08:00:00.000Z"
    },
    supportTopicKnowledge: {
      topics: []
    },
    conversationHistory: [],
    recentInteractionContext: {
      previousBotResponseSummary: "Previous bot answer",
      previousUserMessageSummary: "Previous user message"
    }
  };
}

const promptSecuritySignals: PromptSecuritySignals = {
  matchedPatternIds: []
};

const standardFragment: StandardResponseFragment = {
  category: "standard_interaction",
  standardSubcategory: "thanks_neutral",
  content: "Merci."
};

const standardOnlyTextSurface: TextSurfaceAnalysis = {
  userLanguage: "French",
  segments: [
    {
      segmentId: "seg_standard",
      verbatim: "merci",
      category: "standard_interaction",
      standardSubcategory: "thanks_neutral"
    }
  ]
};

const supportTextSurface: TextSurfaceAnalysis = {
  userLanguage: "French",
  segments: [
    {
      segmentId: "seg_support",
      verbatim: "je n'arrive pas à me connecter",
      category: "support_relevant"
    }
  ]
};

const supportAndSmallTalkTextSurface: TextSurfaceAnalysis = {
  userLanguage: "French",
  segments: [
    {
      segmentId: "seg_standard",
      verbatim: "Bonjour,",
      category: "standard_interaction",
      standardSubcategory: "greeting"
    },
    {
      segmentId: "seg_support",
      verbatim: "mon compte est bloqué",
      category: "support_relevant"
    }
  ]
};

const noDeepAttachmentSurface: AttachmentSurfaceAnalysis = [
  {
    attachmentIndex: 1,
    category: "standard_interaction",
    shouldRunDeepAnalysis: false
  }
];

const deepAttachmentSurface: AttachmentSurfaceAnalysis = [
  {
    attachmentIndex: 1,
    category: "support_relevant",
    shouldRunDeepAnalysis: true
  }
];

const textUnderstandings: TextUnderstanding[] = [
  {
    understandingId: "text_understanding_1",
    sourceSegmentIds: ["seg_support"],
    messageKinds: [],
    caseDetails: [],
    attemptedActions: [],
    supportMetadata: [],
    sourceVerbatims: ["Login issue"],
    summary: "Login issue",
    primaryUserExpectation: "wants_solution",
    supportNeeds: ["possible_account_or_access_action"],
    broadCategoryHint: "access_security",
    contextDependency: "standalone_but_may_match_existing",
    contextualAnswer: {
      type: "none",
      value: null,
      evidence: null
    },
    facts: [],
    testedActions: [],
    uncertainties: []
  }
];

const supportResponseCues: SupportResponseCue[] = [
  {
    cueId: "support_response_cue_1",
    sourceSegmentIds: ["seg_support"],
    relatedUnderstandingIds: ["text_understanding_1"],
    verbatim: "je n'arrive pas",
    cueNote: "strong frustration"
  }
];

const attachmentUnderstandings: AttachmentUnderstanding[] = [
  {
    attachmentIndex: 1,
    status: "analyzed",
    summary: "Screenshot of login error"
  }
];

const topicUpdateProposals: TopicUpdateProposal[] = [
  {
    proposalId: "topic_update_proposal_1",
    action: "create_new_topic",
    fromUnderstandingIds: ["text_understanding_1"],
    topicId: null,
    selectedSourceVerbatims: ["Login issue"],
    updateIntent: {
      relationship: "creates_distinct_topic",
      blockingIssue: "yes",
      statusHint: "open",
      userGoal: "Resolve login issue",
      correctionNote: null
    },
    newTopic: {
      title: "Login issue",
      broadCategoryHint: "access_security",
      userGoal: "Resolve login issue",
      blockingIssue: "yes"
    },
    reason: "The login issue is not covered by an existing topic."
  }
];

const noRagPlan: KnowledgeEnrichmentPlan = {
  route: "none",
  retrievalRequests: [],
  reason: "rag_not_enabled_yet"
};

const ragPlan: KnowledgeEnrichmentPlan = {
  route: "rag_only",
  retrievalRequests: [
    {
      topicId: 1,
      searchPurpose: "support_answer_and_qualification",
      queryText: "Support issue: login password error.",
      desiredKnowledge: [
        "known_behavior",
        "troubleshooting_steps",
        "safe_response",
        "fields_to_ask",
        "do_not_claim"
      ],
      context: {
        topicSummary: "Login password error",
        knownDetails: [],
        attemptedActions: []
      }
    }
  ],
  reason: "Topic requires support knowledge."
};

const knowledgeChunks: KnowledgeChunk[] = [
  {
    topicId: 1,
    sourceId: "doc_1",
    content: "Reset password instructions",
    score: 0.9
  }
];

const retrievedKnowledgeSynthesis = {
  supportKnowledgeSummary:
    "Support knowledge lookup returned useful customer-facing knowledge for this topic.",
  relevantFacts: ["Reset password is available"],
  applicableInstructions: ["Use the reset-password flow when applicable."],
  possibleFields: ["error_message"],
  unresolvedPoints: ["Exact error message is still missing."],
  sourceReferences: ["doc_1"],
  limitations: ["Do not claim that login is restored."],
  internalNotes: ["Support can inspect account state internally."],
  retrievedChunkCount: 1,
  doNotClaim: ["Do not say that the issue is fixed."],
  topics: [
    {
      topicId: 1,
      relevantFacts: ["Reset password is available"],
      applicableInstructions: [
        "Use the reset-password flow when applicable."
      ],
      possibleFields: ["error_message"],
      unresolvedPoints: ["Exact error message is still missing."],
      sourceReferences: ["doc_1"]
    }
  ]
};

const responsePlan: ResponsePlanV2 = {
  responsePlanId: "response_plan_test",
  topicId: 1,
  acknowledge: [
    "Acknowledge the topic."
  ],
  answer: [],
  ask: [],
  say: [
    "Write a concise acknowledgement without inventing a solution. Do not ask a question or provide a solution."
  ],
  review: null
};

const expectedTopicResponsePlan: ResponsePlanV2 = {
  ...responsePlan,
  responsePlanId: "response_plan_topic_update_proposal_1"
};

const composedSupportResponsePlan: ComposedSupportResponsePlan = {
  topicId: null,
  messageIntent: "support_reply",
  acknowledge: [],
  answer: [],
  ask: [],
  say: [
    "Write a concise acknowledgement without inventing a solution. Do not ask a question or provide a solution."
  ],
  review: null
};

const renderedSupportResponse: RenderedSupportResponse = {
  finalResponseText: "Voici quoi faire."
};

const userResponse: UserResponse = {
  messages: [
    {
      type: "global_response",
      content: "Réponse finale."
    }
  ]
};

const persistenceEffects: SupportProcessingPersistenceEffectsV2 = {
  liveMemoryUpdate: {
    mode: "merge",
    topics: [],
    lastUserVerbatim: "Bonjour",
    lastBotVerbatim: "Réponse finale.",
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

function buildSteps(
  overrides: SupportProcessingPipelineV2Steps = {}
): Required<SupportProcessingPipelineV2Steps> {
  return {
    detectSuspiciousPromptPatterns: vi.fn(async () => promptSecuritySignals),
    planTurnAnalysis: vi.fn(async () => ({
      analyzeText: false,
      analyzeAttachments: false,
      matchedPatternIds: []
    })),
    analyzeTextSurface: vi.fn(async () => standardOnlyTextSurface),
    analyzeAttachmentSurface: vi.fn(async () => noDeepAttachmentSurface),
    buildStandardResponseFragments: vi.fn(async () => []),
    analyzeSupportText: vi.fn(async () => ({
      textUnderstandings,
      supportResponseCues
    })),
    analyzeSupportAttachments: vi.fn(async () => attachmentUnderstandings),
    proposeTopicUpdates: vi.fn(async () => topicUpdateProposals),
    applyTopicUpdates: vi.fn(async () => {
      throw new Error("applyTopicUpdates should not run in the temporary V2 flow");
    }),
    planKnowledgeEnrichment: vi.fn(async () => noRagPlan),
    selectCatalogKnowledgeForTopic: vi.fn(async () => ({
      selectedFields: [
        {
          fieldName: "access_action",
          description: "Access action.",
          askableByUser: true
        },
        {
          fieldName: "auth_method",
          description: "Authentication method.",
          askableByUser: true
        },
        {
          fieldName: "account_status",
          description: "Internal account status.",
          askableByUser: false
        },
        {
          fieldName: "error_message",
          description: "Exact error.",
          askableByUser: true
        }
      ],
      selectedGenericKnowledge: [],
      scopeReason: "test_catalog_selection",
      rejectedFieldNames: []
    })),
    retrieveSupportKnowledge: vi.fn(async () => knowledgeChunks),
    synthesizeRetrievedKnowledge: vi.fn(
      async () => retrievedKnowledgeSynthesis
    ),
    planSupportResponse: vi.fn(async () => responsePlan),
    composeSupportResponsePlan: vi.fn(async () => composedSupportResponsePlan),
    renderSupportResponse: vi.fn(async () => renderedSupportResponse),
    buildUserResponse: vi.fn(async () => userResponse),
    buildSupportProcessingPersistenceEffects: vi.fn(
      async () => persistenceEffects
    ),
    ...overrides
  };
}

describe("runSupportProcessingPipelineV2", function () {
  it("replays the billing and notification follow-up with two updates through compose, render and persistence", async function () {
    const input = buildInput();
    input.latestUserMessage.content = [
      "Concernant : Est-ce que ce doublon concerne uniquement le document ou aussi le paiement ?",
      "oui ça concerne le paiement aussi j'ai été prélevé par cozy et par twake, sans doute un problème de migration",
      "",
      "Concernant : j'ai bien mis toutes les autorisations nécessaires de notifications. évidemment l'appli est bien installée. Plateforme android sur mon tel 9.0"
    ].join("\n");
    input.latestUserMessage.channel = "email";
    const existingBillingCaseDetails = [
      {
        key: "billing_issue_type",
        value: "duplicate_billing",
        evidence: "J'ai reçu 2 factures au lieu d'1 seul"
      }
    ];
    const existingNotificationCaseDetails = [
      {
        key: "notification_permission_status",
        value: "not_receiving",
        evidence: "J'ai pas de notificaitios"
      }
    ];
    input.supportTopicKnowledge = {
      topics: [
        {
          topicId: 1,
          title: "Duplicate billing for Twake subscription",
          broadCategoryHint: "billing",
          summary:
            "User received two invoices instead of one for their Twake subscription.",
          caseDetails: existingBillingCaseDetails,
          attemptedActions: [],
          supportKnowledgeSummary: null
        },
        {
          topicId: 2,
          title: "Missing notifications on device",
          broadCategoryHint: "bug",
          summary:
            "User is not receiving notifications on their mobile device.",
          caseDetails: existingNotificationCaseDetails,
          attemptedActions: [],
          supportKnowledgeSummary: null
        }
      ]
    };
    const billingSourceVerbatims = [
      "oui ça concerne le paiement aussi j'ai été prélevé par cozy et par twake, sans doute un problème de migration"
    ];
    const notificationSourceVerbatims = [
      "j'ai bien mis toutes les autorisations nécessaires de notifications. évidemment l'appli est bien installée. Plateforme android sur mon tel 9.0"
    ];
    const billingUnderstanding: TextUnderstanding = {
      ...textUnderstandings[0],
      understandingId: "text_understanding_billing",
      sourceSegmentIds: ["seg_billing"],
      sourceVerbatims: billingSourceVerbatims,
      summary: "The duplicate invoice also concerns duplicate payment by Cozy and Twake during migration.",
      broadCategoryHint: "billing",
      caseDetails: [
        {
          key: "billing_issue_type",
          value: "duplicate_payment",
          evidence: "ça concerne le paiement aussi"
        },
        {
          key: "billing_provider",
          value: "cozy and twake",
          evidence: "prélevé par cozy et par twake"
        },
        {
          key: "possible_cause",
          value: "migration",
          evidence: "problème de migration"
        }
      ]
    };
    const notificationUnderstanding: TextUnderstanding = {
      ...textUnderstandings[0],
      understandingId: "text_understanding_notifications",
      sourceSegmentIds: ["seg_notifications"],
      sourceVerbatims: notificationSourceVerbatims,
      summary:
        "Notification permissions are enabled, the app is installed, and the platform is Android 9.0.",
      broadCategoryHint: "configuration",
      caseDetails: [
        {
          key: "notification_permission_status",
          value: "enabled",
          evidence: "autorisations nécessaires de notifications"
        },
        {
          key: "installation_status",
          value: "installed",
          evidence: "l'appli est bien installée"
        },
        {
          key: "platform",
          value: "android",
          evidence: "Plateforme android"
        },
        {
          key: "operating_system",
          value: "Android 9.0",
          evidence: "android sur mon tel 9.0"
        }
      ]
    };
    const billingSnapshot: MergedTopicSnapshot = {
      snapshotId: "topic_1",
      topicId: 1,
      temporaryTopicId: null,
      isNewTopic: false,
      title: "Duplicate billing for Twake subscription",
      broadCategoryHint: "billing",
      summary:
        "User received two invoices and says the duplicate also concerns payment by Cozy and Twake, possibly during migration.",
      caseDetails: [
        ...existingBillingCaseDetails,
        ...billingUnderstanding.caseDetails
      ],
      attemptedActions: [],
      sourceUnderstandingIds: ["text_understanding_billing"],
      sourceVerbatims: billingSourceVerbatims,
      sourceOpIndex: 0,
      baseTopic: input.supportTopicKnowledge.topics[0]
    };
    const notificationSnapshot: MergedTopicSnapshot = {
      snapshotId: "topic_2",
      topicId: 2,
      temporaryTopicId: null,
      isNewTopic: false,
      title: "Missing notifications on device",
      broadCategoryHint: "bug",
      summary: "User is not receiving notifications on their mobile device.",
      caseDetails: [
        ...existingNotificationCaseDetails,
        ...notificationUnderstanding.caseDetails
      ],
      attemptedActions: [],
      sourceUnderstandingIds: ["text_understanding_notifications"],
      sourceVerbatims: notificationSourceVerbatims,
      sourceOpIndex: 1,
      baseTopic: input.supportTopicKnowledge.topics[1]
    };
    const topicUpdateOps: TopicUpdateOp[] = [
      {
        op: "update",
        items: [0],
        topicId: 1,
        topic: null,
        merge: {
          caseDetails: [[0, 0], [0, 1], [0, 2]],
          attemptedActions: []
        },
        replace: null,
        review: null
      },
      {
        op: "update",
        items: [1],
        topicId: 2,
        topic: null,
        merge: {
          caseDetails: [[1, 0], [1, 1], [1, 2], [1, 3]],
          attemptedActions: []
        },
        replace: null,
        review: null
      }
    ];
    const topicPatches: TopicPatch[] = [
      {
        patchId: "topic_patch_1",
        op: "update",
        items: [0],
        topicId: 1,
        temporaryTopicId: null,
        topic: null,
        merge: {
          caseDetails: billingUnderstanding.caseDetails,
          attemptedActions: []
        },
        replace: {
          caseDetails: [],
          attemptedActions: []
        },
        review: null,
        sourceUnderstandingIds: ["text_understanding_billing"],
        selectedSourceVerbatims: billingSourceVerbatims
      },
      {
        patchId: "topic_patch_2",
        op: "update",
        items: [1],
        topicId: 2,
        temporaryTopicId: null,
        topic: null,
        merge: {
          caseDetails: notificationUnderstanding.caseDetails,
          attemptedActions: []
        },
        replace: {
          caseDetails: [],
          attemptedActions: []
        },
        review: null,
        sourceUnderstandingIds: ["text_understanding_notifications"],
        selectedSourceVerbatims: notificationSourceVerbatims
      }
    ];
    const twoTopicPlans: ResponsePlanV2[] = [
      {
        ...responsePlan,
        topicId: 1,
        say: ["Acknowledge the duplicate payment by Cozy and Twake."]
      },
      {
        ...responsePlan,
        topicId: 2,
        say: ["Acknowledge Android 9.0 and enabled notifications."]
      }
    ];
    const composed: ComposedSupportResponsePlan = {
      ...composedSupportResponsePlan,
      say: [
        "Answer both the billing follow-up and the notification follow-up."
      ]
    };
    const steps = buildSteps({
      planTurnAnalysis: vi.fn(async () => ({
        analyzeText: true,
        analyzeAttachments: false,
        matchedPatternIds: []
      })),
      analyzeTextSurface: vi.fn(async () => ({
        userLanguage: "fr",
        segments: [
          {
            segmentId: "seg_billing",
            verbatim: billingSourceVerbatims[0],
            category: "support_relevant" as const
          },
          {
            segmentId: "seg_notifications",
            verbatim: notificationSourceVerbatims[0],
            category: "support_relevant" as const
          }
        ]
      })),
      analyzeSupportText: vi.fn(async () => ({
        textUnderstandings: [
          billingUnderstanding,
          notificationUnderstanding
        ],
        supportResponseCues: []
      })),
      proposeTopicUpdates: vi.fn(async (): Promise<ProposeTopicUpdatesOutput> => ({
        topicUpdateOps,
        topicUpdateProposals: [
          {
            ...topicUpdateProposals[0],
            proposalId: "topic_patch_1",
            action: "update_existing_topic",
            fromUnderstandingIds: ["text_understanding_billing"],
            topicId: 1,
            selectedSourceVerbatims: billingSourceVerbatims,
            newTopic: null
          },
          {
            ...topicUpdateProposals[0],
            proposalId: "topic_patch_2",
            action: "update_existing_topic",
            fromUnderstandingIds: ["text_understanding_notifications"],
            topicId: 2,
            selectedSourceVerbatims: notificationSourceVerbatims,
            newTopic: null
          }
        ],
        topicPatches,
        mergedTopicSnapshots: [
          billingSnapshot,
          notificationSnapshot
        ]
      })),
      planSupportResponse: vi.fn(async (plannerInput) => {
        return plannerInput.topicEvidence.topicId === 1
          ? twoTopicPlans[0]
          : twoTopicPlans[1];
      }),
      composeSupportResponsePlan: vi.fn(async () => composed),
      renderSupportResponse: vi.fn(async () => ({
        finalResponseText:
          "Je prends en compte le double prélèvement et les informations Android 9.0."
      })),
      buildSupportProcessingPersistenceEffects: vi.fn(
        buildSupportProcessingPersistenceEffectsV2
      )
    });

    const output = await runSupportProcessingPipelineV2(input, steps);

    expect(output.textUnderstandings?.map((item) => item.understandingId))
      .toEqual([
        "text_understanding_billing",
        "text_understanding_notifications"
      ]);
    expect(output.topicUpdateOps).toEqual(topicUpdateOps);
    expect(output.topicPatches?.map((patch) => patch.topicId)).toEqual([1, 2]);
    expect(output.mergedTopicSnapshots?.map((snapshot) => snapshot.topicId))
      .toEqual([1, 2]);
    expect(output.mergedTopicSnapshots?.[1]).toEqual(expect.objectContaining({
      topicId: 2,
      title: "Missing notifications on device",
      summary: "User is not receiving notifications on their mobile device."
    }));
    expect(output.persistenceEffects.liveMemoryUpdate.topics.map((topic) => {
      return topic.topicId;
    })).toEqual([1, 2]);
    expect(output.persistenceEffects.liveMemoryUpdate.topics[1])
      .toEqual(expect.objectContaining({
        topicId: 2,
        title: "Missing notifications on device",
        summary: "User is not receiving notifications on their mobile device."
      }));
    expect(output.persistenceEffects.liveMemoryUpdate.topics[0]?.caseDetails)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          key: "billing_provider",
          value: "cozy and twake"
        }),
        expect.objectContaining({
          key: "possible_cause",
          value: "migration"
        })
      ]));
    expect(output.persistenceEffects.liveMemoryUpdate.topics[1]?.caseDetails)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          key: "notification_permission_status",
          value: "enabled"
        }),
        expect.objectContaining({
          key: "operating_system",
          value: "Android 9.0"
        })
      ]));
    const previousLiveMemoryTopics: LiveMemoryTopic[] =
      input.supportTopicKnowledge.topics.map((topic) => ({
        topicId: topic.topicId,
        title: topic.title,
        broadCategoryHint: topic.broadCategoryHint,
        summary: topic.summary,
        caseDetails: topic.caseDetails,
        attemptedActions: topic.attemptedActions,
        ...(topic.supportKnowledgeSummary
          ? { supportKnowledgeSummary: topic.supportKnowledgeSummary }
          : {})
      }));
    const incomingLiveMemoryTopics: LiveMemoryTopic[] =
      output.persistenceEffects.liveMemoryUpdate.topics.map((topic) => ({
        topicId: topic.topicId,
        title: topic.title,
        broadCategoryHint: topic.broadCategoryHint,
        summary: topic.summary,
        caseDetails: topic.caseDetails.map((detail) => ({
          key: detail.key,
          value: detail.value,
          evidence: detail.evidence ?? ""
        })),
        attemptedActions: topic.attemptedActions.map((action) => ({
          action: action.action,
          outcome: action.outcome ?? "unknown",
          evidence: action.evidence ?? ""
        })),
        ...(topic.supportKnowledgeSummary
          ? { supportKnowledgeSummary: topic.supportKnowledgeSummary }
          : {})
      }));
    const liveMemoryFinale = {
      topics: applyTopicsByExactId({
        previousTopics: previousLiveMemoryTopics,
        incomingTopics: incomingLiveMemoryTopics
      }),
      lastUserVerbatim: output.persistenceEffects.liveMemoryUpdate.lastUserVerbatim,
      lastBotVerbatim: output.persistenceEffects.liveMemoryUpdate.lastBotVerbatim,
      userState: output.persistenceEffects.liveMemoryUpdate.userState
    };
    expect(liveMemoryFinale.topics[1]).toEqual(expect.objectContaining({
      topicId: 2,
      title: "Missing notifications on device",
      summary: "User is not receiving notifications on their mobile device."
    }));
    const serializedReplayOutput = JSON.stringify({
      supportTopicKnowledge: input.supportTopicKnowledge,
      topicUpdateOps: output.topicUpdateOps,
      topicPatches: output.topicPatches,
      mergedTopicSnapshots: output.mergedTopicSnapshots,
      liveMemoryUpdate: output.persistenceEffects.liveMemoryUpdate,
      liveMemoryFinale
    });
    for (const legacyField of [
      ["id", "topic"].join("_"),
      ["topic", "label"].join("_"),
      ["topic", "category"].join("_"),
      ["user", "goal"].join("_"),
      ["blocking", "issue"].join("_"),
      ["topic", "details"].join("_")
    ]) {
      expect(serializedReplayOutput).not.toContain(`"${legacyField}"`);
    }
    expect(steps.composeSupportResponsePlan).toHaveBeenCalledWith(
      expect.objectContaining({
        targetLanguage: "fr",
        topicResponsePlans: expect.arrayContaining([
          expect.objectContaining({ topicId: 1 }),
          expect.objectContaining({ topicId: 2 })
        ])
      })
    );
    expect(steps.renderSupportResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        composedSupportResponsePlan: composed,
        targetLanguage: "fr",
        channel: "email"
      })
    );
  });

  it("renders standard-only output without a response plan when no analysis is enabled", async function () {
    const input = buildInput();
    const steps = buildSteps({
      buildStandardResponseFragments: vi.fn(async () => [standardFragment])
    });

    const output = await runSupportProcessingPipelineV2(input, steps);

    expect(steps.analyzeTextSurface).not.toHaveBeenCalled();
    expect(steps.analyzeAttachmentSurface).not.toHaveBeenCalled();
    expect(steps.analyzeSupportText).not.toHaveBeenCalled();
    expect(steps.planSupportResponse).not.toHaveBeenCalled();
    expect(steps.composeSupportResponsePlan).toHaveBeenCalledWith(expect.objectContaining({
      standardResponseFragments: [standardFragment],
      topicResponsePlans: [],
      channel: input.latestUserMessage.channel
    }));
    expect(steps.renderSupportResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        composedSupportResponsePlan,
        targetLanguage: "en",
        channel: input.latestUserMessage.channel
      })
    );
    expect(steps.buildUserResponse).toHaveBeenCalledWith({
      renderedSupportResponse
    });
    expect(steps.renderSupportResponse).toHaveBeenCalledTimes(1);
    expect(output).toEqual({
      userResponse,
      persistenceEffects,
      composedSupportResponsePlan
    });
  });

  it("runs text surface only and stops when it is standard only", async function () {
    const input = buildInput();
    const steps = buildSteps({
      planTurnAnalysis: vi.fn(async () => ({
        analyzeText: true,
        analyzeAttachments: false,
        matchedPatternIds: []
      }))
    });

    await runSupportProcessingPipelineV2(input, steps);

    expect(steps.analyzeTextSurface).toHaveBeenCalledWith({
      latestUserMessage: input.latestUserMessage,
      turnAnalysisPlan: {
        analyzeText: true,
        analyzeAttachments: false,
        matchedPatternIds: []
      },
      recentInteractionContext: input.recentInteractionContext
    });
    expect(steps.analyzeSupportText).not.toHaveBeenCalled();
    expect(steps.composeSupportResponsePlan).toHaveBeenCalledWith(expect.objectContaining({
      standardResponseFragments: [],
      topicResponsePlans: [],
      channel: input.latestUserMessage.channel
    }));
    expect(steps.renderSupportResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        composedSupportResponsePlan,
        targetLanguage: "fr",
        channel: input.latestUserMessage.channel
      })
    );
  });

  it("runs text deep analysis when text surface has support content", async function () {
    const steps = buildSteps({
      planTurnAnalysis: vi.fn(async () => ({
        analyzeText: true,
        analyzeAttachments: false,
        matchedPatternIds: []
      })),
      analyzeTextSurface: vi.fn(async () => supportTextSurface)
    });

    const output = await runSupportProcessingPipelineV2(buildInput(), steps);

    expect(steps.analyzeSupportText).toHaveBeenCalled();
    expect(steps.analyzeSupportAttachments).not.toHaveBeenCalled();
    expect(steps.composeSupportResponsePlan).toHaveBeenCalledWith(expect.objectContaining({
      topicResponsePlans: [expectedTopicResponsePlan],
      standardResponseFragments: [],
      channel: buildInput().latestUserMessage.channel
    }));
    expect(steps.renderSupportResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        composedSupportResponsePlan,
        targetLanguage: "fr",
        channel: buildInput().latestUserMessage.channel
      })
    );
    expect(steps.proposeTopicUpdates).toHaveBeenCalledWith({
      textUnderstandings,
      supportTopicKnowledge: buildInput().supportTopicKnowledge,
      recentInteractionContext: buildInput().recentInteractionContext,
      latestUserMessageContent: buildInput().latestUserMessage.content
    });
    expect(steps.proposeTopicUpdates).toHaveBeenCalledWith(
      expect.not.objectContaining({
        supportResponseCues: expect.anything()
      })
    );
    expect(output.supportResponseCues).toEqual(supportResponseCues);
    expect(output.topicUpdateProposals).toEqual(topicUpdateProposals);
    expect(output.topicUpdateProposals?.[0]?.topicId).toBeNull();
  });

  it("runs attachment deep analysis when attachment surface selects it", async function () {
    const steps = buildSteps({
      planTurnAnalysis: vi.fn(async () => ({
        analyzeText: false,
        analyzeAttachments: true,
        matchedPatternIds: []
      })),
      analyzeAttachmentSurface: vi.fn(async () => deepAttachmentSurface)
    });

    await runSupportProcessingPipelineV2(buildInput(), steps);

    expect(steps.analyzeSupportText).not.toHaveBeenCalled();
    expect(steps.analyzeSupportAttachments).toHaveBeenCalled();
    expect(steps.proposeTopicUpdates).toHaveBeenCalledWith({
      textUnderstandings: [],
      supportTopicKnowledge: buildInput().supportTopicKnowledge,
      recentInteractionContext: buildInput().recentInteractionContext,
      latestUserMessageContent: buildInput().latestUserMessage.content
    });
  });

  it("starts text and attachment surface paths in parallel", async function () {
    const textDeferred = createDeferred<TextSurfaceAnalysis>();
    const attachmentDeferred = createDeferred<AttachmentSurfaceAnalysis>();
    const steps = buildSteps({
      planTurnAnalysis: vi.fn(async () => ({
        analyzeText: true,
        analyzeAttachments: true,
        matchedPatternIds: []
      })),
      analyzeTextSurface: vi.fn(() => textDeferred.promise),
      analyzeAttachmentSurface: vi.fn(() => attachmentDeferred.promise)
    });

    const runPromise = runSupportProcessingPipelineV2(buildInput(), steps);

    await vi.waitFor(() => {
      expect(steps.analyzeTextSurface).toHaveBeenCalled();
      expect(steps.analyzeAttachmentSurface).toHaveBeenCalled();
    });

    textDeferred.resolve(supportTextSurface);
    attachmentDeferred.resolve(deepAttachmentSurface);

    await runPromise;

    expect(steps.analyzeSupportText).toHaveBeenCalled();
    expect(steps.analyzeSupportAttachments).toHaveBeenCalled();
  });

  it("moves from topic proposals to mocked knowledge without applying topic updates", async function () {
    const steps = buildSteps({
      planTurnAnalysis: vi.fn(async () => ({
        analyzeText: true,
        analyzeAttachments: false,
        matchedPatternIds: []
      })),
      analyzeTextSurface: vi.fn(async () => supportTextSurface)
    });

    const output = await runSupportProcessingPipelineV2(buildInput(), steps);

    expect(steps.applyTopicUpdates).not.toHaveBeenCalled();
    expect(output.topicUpdateProposals).toEqual(topicUpdateProposals);
    expect(output.knowledgeEnrichmentPlan).toEqual(noRagPlan);
    expect(output.retrievedSupportKnowledge).toEqual([]);
    expect(output.synthesizedRetrievedKnowledge).toBeNull();
    expect(output.topicResponsePlans).toEqual([expectedTopicResponsePlan]);
    expect(output).not.toHaveProperty("responsePlan");
    expect(steps.retrieveSupportKnowledge).not.toHaveBeenCalled();
    expect(steps.synthesizeRetrievedKnowledge).not.toHaveBeenCalled();
    expect(steps.planKnowledgeEnrichment).toHaveBeenCalledWith({
      topicEvidence: expect.objectContaining({
        proposalId: topicUpdateProposals[0].proposalId,
        topicSourceVerbatims: ["Login issue"],
        relatedUnderstandingIds: ["text_understanding_1"],
        relatedTextUnderstandings: textUnderstandings,
        relatedAttachmentUnderstandings: [],
        relatedSupportResponseCues: supportResponseCues
      }),
      recentInteractionContext: buildInput().recentInteractionContext,
      targetLanguage: "fr",
      extractableFieldCatalog: expect.arrayContaining([
        expect.objectContaining({
          fieldName: "account_status",
          askableByUser: false
        }),
        expect.objectContaining({
          fieldName: "visual_evidence"
        })
      ])
    });
    expect(steps.planSupportResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        topicUserMessageContent: "Login issue",
        targetLanguage: "fr",
        topicEvidence: expect.objectContaining({
          proposalId: topicUpdateProposals[0].proposalId,
          topicSourceVerbatims: ["Login issue"],
          relatedTextUnderstandings: textUnderstandings,
          relatedAttachmentUnderstandings: []
        }),
        topicKnowledgeEnrichmentPlan: noRagPlan,
        topicRetrievedKnowledgeSynthesis: null,
        selectedCatalogKnowledge: expect.objectContaining({
          selectedFields: expect.arrayContaining([
            expect.objectContaining({ fieldName: "access_action" }),
            expect.objectContaining({ fieldName: "auth_method" }),
            expect.objectContaining({ fieldName: "account_status" }),
            expect.objectContaining({ fieldName: "error_message" })
          ]),
          selectedGenericKnowledge: []
        })
      })
    );
  });

  it("routes catalog_only without launching RAG", async function () {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const steps = buildSteps({
      planTurnAnalysis: vi.fn(async () => ({
        analyzeText: true,
        analyzeAttachments: false,
        matchedPatternIds: []
      })),
      analyzeTextSurface: vi.fn(async () => supportTextSurface)
    });

    const output = await runSupportProcessingPipelineV2(buildInput(), steps);

    expect(steps.selectCatalogKnowledgeForTopic).toHaveBeenCalledTimes(1);
    expect(steps.planKnowledgeEnrichment).not.toHaveBeenCalled();
    expect(steps.retrieveSupportKnowledge).not.toHaveBeenCalled();
    expect(steps.synthesizeRetrievedKnowledge).not.toHaveBeenCalled();
    expect(output.ragUsage).toEqual([
      expect.objectContaining({ status: "skipped_by_router" })
    ]);
    expect(info).toHaveBeenCalledWith(expect.stringContaining(
      "[Knowledge routing] topicId="
    ));
    expect(info).toHaveBeenCalledWith(expect.stringContaining(
      "status=skipped_by_router"
    ));
    info.mockRestore();
  });

  it("routes none without launching catalog or RAG", async function () {
    const steps = buildSteps({
      planTurnAnalysis: vi.fn(async () => ({
        analyzeText: true,
        analyzeAttachments: false,
        matchedPatternIds: []
      })),
      analyzeTextSurface: vi.fn(async () => supportTextSurface)
    });

    await runSupportProcessingPipelineV2(buildInput(), steps);

    expect(steps.selectCatalogKnowledgeForTopic).not.toHaveBeenCalled();
    expect(steps.planKnowledgeEnrichment).not.toHaveBeenCalled();
    expect(steps.retrieveSupportKnowledge).not.toHaveBeenCalled();
    expect(steps.synthesizeRetrievedKnowledge).not.toHaveBeenCalled();
  });

  it("routes rag_only without launching catalog", async function () {
    const steps = buildSteps({
      planTurnAnalysis: vi.fn(async () => ({
        analyzeText: true,
        analyzeAttachments: false,
        matchedPatternIds: []
      })),
      analyzeTextSurface: vi.fn(async () => supportTextSurface),
      planKnowledgeEnrichment: vi.fn(async () => ragPlan)
    });

    await runSupportProcessingPipelineV2(buildInput(), steps);

    expect(steps.selectCatalogKnowledgeForTopic).not.toHaveBeenCalled();
    expect(steps.planKnowledgeEnrichment).toHaveBeenCalledTimes(1);
    expect(steps.retrieveSupportKnowledge).toHaveBeenCalledTimes(1);
    expect(steps.synthesizeRetrievedKnowledge).toHaveBeenCalledTimes(1);
    expect(steps.planSupportResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedCatalogKnowledge: expect.objectContaining({
          selectedFields: []
        })
      })
    );
  });

  it("routes catalog_and_rag through both catalog and RAG", async function () {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const steps = buildSteps({
      planTurnAnalysis: vi.fn(async () => ({
        analyzeText: true,
        analyzeAttachments: false,
        matchedPatternIds: []
      })),
      analyzeTextSurface: vi.fn(async () => supportTextSurface),
      planKnowledgeEnrichment: vi.fn(async () => ragPlan)
    });

    const output = await runSupportProcessingPipelineV2(buildInput(), steps);

    expect(steps.selectCatalogKnowledgeForTopic).toHaveBeenCalledTimes(1);
    expect(steps.retrieveSupportKnowledge).toHaveBeenCalledTimes(1);
    expect(output.ragUsage).toEqual([
      expect.objectContaining({
        status: "success",
        requestChars: ragPlan.retrievalRequests[0].queryText.length,
        estimatedRequestTokens: Math.ceil(
          ragPlan.retrievalRequests[0].queryText.length / 4
        ),
        chunkCount: knowledgeChunks.length,
        responseChars: knowledgeChunks[0].content.length,
        estimatedResponseTokens: Math.ceil(
          knowledgeChunks[0].content.length / 4
        )
      })
    ]);
    expect(info).toHaveBeenCalledWith(expect.stringContaining("[RAG usage]"));
    info.mockRestore();
  });

  it("falls back to catalog_only when knowledge routing fails", async function () {
    const steps = buildSteps({
      planTurnAnalysis: vi.fn(async () => ({
        analyzeText: true,
        analyzeAttachments: false,
        matchedPatternIds: []
      })),
      analyzeTextSurface: vi.fn(async () => supportTextSurface)
    });

    await runSupportProcessingPipelineV2(buildInput(), steps);

    expect(steps.selectCatalogKnowledgeForTopic).toHaveBeenCalledTimes(1);
    expect(steps.planKnowledgeEnrichment).not.toHaveBeenCalled();
    expect(steps.retrieveSupportKnowledge).not.toHaveBeenCalled();
  });

  it("persists supportKnowledgeSummary from RAG synthesis on the topic snapshot", async function () {
    const snapshot: MergedTopicSnapshot = {
      snapshotId: "snapshot_1",
      topicId: 1,
      temporaryTopicId: null,
      isNewTopic: false,
      title: "Twake Chat reload",
      broadCategoryHint: "bug",
      summary: "Twake Chat desktop reloads the conversation.",
      caseDetails: [
        {
          key: "product_or_service",
          value: "Twake Chat",
          evidence: "Twake Chat"
        }
      ],
      attemptedActions: [],
      sourceUnderstandingIds: ["text_understanding_1"],
      sourceVerbatims: ["Twake Chat desktop reload"],
      sourceOpIndex: 0,
      baseTopic: null
    };
    const steps = buildSteps({
      planTurnAnalysis: vi.fn(async () => ({
        analyzeText: true,
        analyzeAttachments: false,
        matchedPatternIds: []
      })),
      analyzeTextSurface: vi.fn(async () => supportTextSurface),
      proposeTopicUpdates: vi.fn(async () => ({
        topicUpdateOps: [],
        topicUpdateProposals: [],
        topicPatches: [],
        mergedTopicSnapshots: [snapshot]
      })),
      planKnowledgeEnrichment: vi.fn(async () => ragPlan),
      buildSupportProcessingPersistenceEffects: vi.fn(
        buildSupportProcessingPersistenceEffectsV2
      )
    });

    const output = await runSupportProcessingPipelineV2(buildInput(), steps);

    expect(output.mergedTopicSnapshots?.[0]).toMatchObject({
      topicId: 1,
      supportKnowledgeSummary:
        "Support knowledge lookup returned useful customer-facing knowledge for this topic."
    });
    expect(
      output.persistenceEffects.liveMemoryUpdate.topics[0]
        .supportKnowledgeSummary
    ).toBe(
      "Support knowledge lookup returned useful customer-facing knowledge for this topic."
    );
  });

  it("falls back before composition when a topic response plan is unusable", async function () {
    const steps = buildSteps({
      planTurnAnalysis: vi.fn(async () => ({
        analyzeText: true,
        analyzeAttachments: false,
        matchedPatternIds: []
      })),
      analyzeTextSurface: vi.fn(async () => supportTextSurface),
      planSupportResponse: vi.fn(async () => {
        return undefined as unknown as ResponsePlanV2;
      })
    });

    const output = await runSupportProcessingPipelineV2(buildInput(), steps);

    expect(output.topicResponsePlans).toHaveLength(1);
    expect(output.topicResponsePlans?.[0]).toMatchObject({
      topicId: topicUpdateProposals[0].proposalId,
      acknowledge: [],
      answer: [],
      ask: [],
      say: [
        "Acknowledge the user's topic without making unsupported claims. Ask for clarification only if necessary."
      ],
      review:
        `topic_response_plan_fallback:${topicUpdateProposals[0].proposalId}`
    });
    expect(output.topicResponsePlans?.[0]?.responsePlanId).toBe(
      `response_plan_${topicUpdateProposals[0].proposalId}`
    );
    expect(steps.composeSupportResponsePlan).toHaveBeenCalledWith(
      expect.objectContaining({
        topicResponsePlans: output.topicResponsePlans
      })
    );
  });

  it("passes the current turn language to the renderer despite French previous bot context", async function () {
    const input = buildInput();
    input.latestUserMessage.content =
      "yes for sure, i juste ask for reinitialisation and it is said that a mail is supposed to be sent but in my personal mailbox i dont get the mail";
    input.recentInteractionContext = {
      previousUserMessageSummary: "I asked for password reset.",
      previousBotResponseSummary:
        "Je comprends que vous attendez un email de réinitialisation."
    };
    const steps = buildSteps({
      planTurnAnalysis: vi.fn(async () => ({
        analyzeText: true,
        analyzeAttachments: false,
        matchedPatternIds: []
      })),
      analyzeTextSurface: vi.fn(async () => ({
        ...supportTextSurface,
        userLanguage: "English"
      }))
    });

    await runSupportProcessingPipelineV2(input, steps);

    expect(steps.composeSupportResponsePlan).toHaveBeenCalledWith(
      expect.objectContaining({
        targetLanguage: "en"
      })
    );
    expect(steps.renderSupportResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        composedSupportResponsePlan,
        targetLanguage: "en",
        channel: input.latestUserMessage.channel
      })
    );
  });

  it("normalizes legacy Other surface languages before planner and renderer inputs", async function () {
    const input = buildInput();
    input.latestUserMessage.content = "Guten mein freunde";
    const steps = buildSteps({
      planTurnAnalysis: vi.fn(async () => ({
        analyzeText: true,
        analyzeAttachments: false,
        matchedPatternIds: []
      })),
      analyzeTextSurface: vi.fn(async () => ({
        ...supportTextSurface,
        userLanguage: "Other"
      }))
    });

    await runSupportProcessingPipelineV2(input, steps);

    expect(steps.planSupportResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        targetLanguage: "en"
      })
    );
    expect(steps.composeSupportResponsePlan).toHaveBeenCalledWith(
      expect.objectContaining({
        targetLanguage: "en"
      })
    );
    expect(steps.renderSupportResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        composedSupportResponsePlan,
        targetLanguage: "en",
        channel: input.latestUserMessage.channel
      })
    );
  });

  it("passes a German surface language through planner and renderer despite French previous context", async function () {
    const input = buildInput();
    input.latestUserMessage.content =
      "Ich habe ein Problem mit den Benachrichtigungen auf Android.";
    input.recentInteractionContext = {
      previousUserMessageSummary: "Bonjour",
      previousBotResponseSummary: "Je vous réponds en français."
    };
    const steps = buildSteps({
      planTurnAnalysis: vi.fn(async () => ({
        analyzeText: true,
        analyzeAttachments: false,
        matchedPatternIds: []
      })),
      analyzeTextSurface: vi.fn(async () => ({
        ...supportTextSurface,
        userLanguage: "de"
      }))
    });

    await runSupportProcessingPipelineV2(input, steps);

    expect(steps.planSupportResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        targetLanguage: "de"
      })
    );
    expect(steps.composeSupportResponsePlan).toHaveBeenCalledWith(
      expect.objectContaining({
        targetLanguage: "de"
      })
    );
    expect(steps.renderSupportResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        composedSupportResponsePlan,
        targetLanguage: "de",
        channel: input.latestUserMessage.channel
      })
    );
  });

  it("plans every actionable topic with its related evidence", async function () {
    const unrelatedUnderstanding: TextUnderstanding = {
      ...textUnderstandings[0],
      understandingId: "text_understanding_2",
      sourceSegmentIds: ["seg_support_2"],
      sourceVerbatims: ["Un autre problème"],
      summary: "Un autre problème"
    };
    const proposals: TopicUpdateProposal[] = [
      {
        ...topicUpdateProposals[0],
        relatedAttachmentIndexes: [1]
      },
      {
        ...topicUpdateProposals[0],
        proposalId: "topic_update_proposal_2",
        fromUnderstandingIds: ["text_understanding_2"],
        selectedSourceVerbatims: ["Un autre problème"]
      }
    ];
    const steps = buildSteps({
      planTurnAnalysis: vi.fn(async () => ({
        analyzeText: true,
        analyzeAttachments: true,
        matchedPatternIds: []
      })),
      analyzeTextSurface: vi.fn(async () => supportTextSurface),
      analyzeAttachmentSurface: vi.fn(async () => deepAttachmentSurface),
      analyzeSupportText: vi.fn(async () => ({
        textUnderstandings: [
          ...textUnderstandings,
          unrelatedUnderstanding
        ],
        supportResponseCues
      })),
      proposeTopicUpdates: vi.fn(async () => proposals),
      selectCatalogKnowledgeForTopic: vi.fn(async (selectionInput) => {
        if (
          selectionInput.topicEvidence.proposalId ===
          proposals[0].proposalId
        ) {
          return {
            selectedFields: [
              {
                fieldName: "visual_evidence",
                description: "Related screenshot.",
                askableByUser: true
              }
            ],
            selectedGenericKnowledge: [],
            scopeReason: "Attachment linked to first topic.",
            rejectedFieldNames: []
          };
        }

        return {
          selectedFields: [
            {
              fieldName: "error_message",
              description: "Exact error.",
              askableByUser: true
            }
          ],
          selectedGenericKnowledge: [],
          scopeReason: "Second topic needs its error.",
          rejectedFieldNames: []
        };
      })
    });

    const output = await runSupportProcessingPipelineV2(buildInput(), steps);

    expect(steps.planKnowledgeEnrichment).toHaveBeenCalledTimes(2);
    expect(steps.selectCatalogKnowledgeForTopic).toHaveBeenCalledTimes(2);
    expect(steps.planKnowledgeEnrichment).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        topicEvidence: expect.objectContaining({
          proposalId: proposals[0].proposalId,
          relatedTextUnderstandings: [textUnderstandings[0]]
        })
      })
    );
    expect(steps.planKnowledgeEnrichment).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        topicEvidence: expect.objectContaining({
          proposalId: proposals[1].proposalId,
          relatedTextUnderstandings: [unrelatedUnderstanding]
        })
      })
    );
    expect(steps.planSupportResponse).toHaveBeenCalledTimes(2);
    expect(steps.planSupportResponse).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        topicUserMessageContent: "Login issue",
        topicEvidence: expect.objectContaining({
          proposalId: proposals[0].proposalId,
          relatedTextUnderstandings: [textUnderstandings[0]],
          relatedAttachmentUnderstandings: attachmentUnderstandings
        }),
        selectedCatalogKnowledge: expect.objectContaining({
          selectedFields: expect.arrayContaining([
            expect.objectContaining({ fieldName: "visual_evidence" })
          ])
        })
      })
    );
    expect(steps.planSupportResponse).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        topicUserMessageContent: "Un autre problème",
        topicEvidence: expect.objectContaining({
          proposalId: proposals[1].proposalId,
          relatedTextUnderstandings: [unrelatedUnderstanding],
          relatedAttachmentUnderstandings: []
        }),
        selectedCatalogKnowledge: expect.objectContaining({
          selectedFields: [
            expect.objectContaining({ fieldName: "error_message" })
          ]
        })
      })
    );
    const topicResponsePlans = output.topicResponsePlans ?? [];

    expect(topicResponsePlans).toHaveLength(2);
    const [firstTopicResponsePlan, secondTopicResponsePlan] =
      topicResponsePlans;

    expect(firstTopicResponsePlan.responsePlanId).toBe(
      "response_plan_topic_update_proposal_1"
    );
    expect(secondTopicResponsePlan.responsePlanId).toBe(
      "response_plan_topic_update_proposal_2"
    );
    expect(firstTopicResponsePlan.responsePlanId).not.toBe(
      secondTopicResponsePlan.responsePlanId
    );
    expect(firstTopicResponsePlan.responsePlanId).not.toBe("");
    expect(secondTopicResponsePlan.responsePlanId).not.toBe("");
    expect(steps.composeSupportResponsePlan).toHaveBeenCalledWith(
      expect.objectContaining({
        topicResponsePlans
      })
    );
    expect(steps.renderSupportResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        composedSupportResponsePlan
      })
    );
    expect(buildTopicResponsePlanDebug(firstTopicResponsePlan)).toMatchObject({
      responsePlanId: firstTopicResponsePlan.responsePlanId,
      say: firstTopicResponsePlan.say,
      ask: firstTopicResponsePlan.ask,
      review: firstTopicResponsePlan.review
    });
    expect(buildTopicResponsePlanDebug(secondTopicResponsePlan)).toMatchObject({
      responsePlanId: secondTopicResponsePlan.responsePlanId,
      say: secondTopicResponsePlan.say,
      ask: secondTopicResponsePlan.ask,
      review: secondTopicResponsePlan.review
    });
    expect(output).not.toHaveProperty("responsePlan");
  });

  it("isolates access and billing evidence across topic-only branches", async function () {
    const accessUnderstanding: TextUnderstanding = {
      ...textUnderstandings[0],
      sourceVerbatims: ["Mon compte est toujours bloqué."],
      summary: "Blocked account"
    };
    const billingUnderstanding: TextUnderstanding = {
      ...textUnderstandings[0],
      understandingId: "text_understanding_2",
      sourceSegmentIds: ["seg_support_2"],
      sourceVerbatims: ["J’ai aussi reçu ma facture deux fois."],
      summary: "Duplicate invoice",
      supportNeeds: ["possible_billing_or_payment_action"],
      broadCategoryHint: "billing"
    };
    const accessProposal: TopicUpdateProposal = {
      ...topicUpdateProposals[0],
      selectedSourceVerbatims: ["Mon compte est toujours bloqué."]
    };
    const billingProposal: TopicUpdateProposal = {
      ...topicUpdateProposals[0],
      proposalId: "topic_update_proposal_2",
      fromUnderstandingIds: ["text_understanding_2"],
      selectedSourceVerbatims: ["J’ai aussi reçu ma facture deux fois."],
      newTopic: {
        ...topicUpdateProposals[0].newTopic!,
        title: "Facture reçue deux fois",
        broadCategoryHint: "billing",
        userGoal: "Clarifier la double facturation"
      }
    };
    const mixedInput = buildInput();
    mixedInput.latestUserMessage.content =
      "Mon compte est toujours bloqué. Et j’ai aussi reçu ma facture deux fois.";
    const steps = buildSteps({
      planTurnAnalysis: vi.fn(async () => ({
        analyzeText: true,
        analyzeAttachments: false,
        matchedPatternIds: []
      })),
      analyzeTextSurface: vi.fn(async (): Promise<TextSurfaceAnalysis> => ({
        userLanguage: "French",
        segments: [
          {
            segmentId: "seg_support",
            verbatim: "Mon compte est toujours bloqué.",
            category: "support_relevant"
          },
          {
            segmentId: "seg_support_2",
            verbatim: "J’ai aussi reçu ma facture deux fois.",
            category: "support_relevant"
          }
        ]
      })),
      analyzeSupportText: vi.fn(async () => ({
        textUnderstandings: [accessUnderstanding, billingUnderstanding],
        supportResponseCues: []
      })),
      proposeTopicUpdates: vi.fn(async () => [
        accessProposal,
        billingProposal
      ]),
      selectCatalogKnowledgeForTopic: vi.fn(async (selectionInput) => ({
        selectedFields:
          selectionInput.topicEvidence.proposalId ===
            accessProposal.proposalId
            ? [{
                fieldName: "account_status",
                description: "Internal account status.",
                askableByUser: false
              }]
            : [{
                fieldName: "duplicate_billing_impact",
                description: "Duplicate document versus duplicate charge.",
                askableByUser: true
              }],
        selectedGenericKnowledge: [],
        scopeReason: "Topic-only test selection.",
        rejectedFieldNames: []
      }))
    });

    await runSupportProcessingPipelineV2(mixedInput, steps);

    const selectorInputs = vi.mocked(
      steps.selectCatalogKnowledgeForTopic
    ).mock.calls.map(([selectionInput]) => selectionInput);
    const plannerInputs = vi.mocked(
      steps.planSupportResponse
    ).mock.calls.map(([plannerInput]) => plannerInput);
    const accessSelectorInput = selectorInputs.find((selectionInput) => {
      return selectionInput.topicEvidence.proposalId ===
        accessProposal.proposalId;
    });
    const billingSelectorInput = selectorInputs.find((selectionInput) => {
      return selectionInput.topicEvidence.proposalId ===
        billingProposal.proposalId;
    });
    const accessPlannerInput = plannerInputs.find((plannerInput) => {
      return plannerInput.topicEvidence.proposalId ===
        accessProposal.proposalId;
    });
    const billingPlannerInput = plannerInputs.find((plannerInput) => {
      return plannerInput.topicEvidence.proposalId ===
        billingProposal.proposalId;
    });

    expect(accessSelectorInput).toEqual(expect.objectContaining({
      topicUserMessageContent: "Mon compte est toujours bloqué.",
      topicEvidence: expect.objectContaining({
        topicSourceVerbatims: ["Mon compte est toujours bloqué."],
        relatedUnderstandingIds: ["text_understanding_1"],
        relatedTextUnderstandings: [accessUnderstanding]
      })
    }));
    expect(JSON.stringify(accessSelectorInput)).not.toContain("facture");
    expect(billingSelectorInput).toEqual(expect.objectContaining({
      topicUserMessageContent: "J’ai aussi reçu ma facture deux fois.",
      topicEvidence: expect.objectContaining({
        topicSourceVerbatims: ["J’ai aussi reçu ma facture deux fois."],
        relatedUnderstandingIds: ["text_understanding_2"],
        relatedTextUnderstandings: [billingUnderstanding]
      })
    }));
    expect(JSON.stringify(billingSelectorInput)).not.toContain("compte");
    expect(accessPlannerInput?.selectedCatalogKnowledge).toEqual(
      expect.objectContaining({
        selectedFields: [
          expect.objectContaining({ fieldName: "account_status" })
        ]
      })
    );
    expect(JSON.stringify(accessPlannerInput)).not.toContain("facture");
    expect(billingPlannerInput?.selectedCatalogKnowledge).toEqual(
      expect.objectContaining({
        selectedFields: [
          expect.objectContaining({ fieldName: "duplicate_billing_impact" })
        ]
      })
    );
    expect(JSON.stringify(billingPlannerInput)).not.toContain("compte");
  });

  it("updates existing access and billing topics in the multi-topic access billing flow", async function () {
    const mixedInput = buildInput();
    mixedInput.latestUserMessage.content =
      "Mon compte est toujours bloqué. Et j’ai aussi reçu ma facture deux fois.";
    mixedInput.supportTopicKnowledge = {
      topics: [
        {
          topicId: 1,
          title: "Compte bloqué",
          broadCategoryHint: "access_security",
          summary: "Le compte de l'utilisateur est bloqué.",
          caseDetails: [],
          attemptedActions: [],
          supportKnowledgeSummary: null
        },
        {
          topicId: 2,
          title: "Problème de facturation",
          broadCategoryHint: "billing",
          summary: "L'utilisateur a un problème de facturation.",
          caseDetails: [],
          attemptedActions: [],
          supportKnowledgeSummary: null
        }
      ]
    };

    const accessUnderstanding: TextUnderstanding = {
      ...textUnderstandings[0],
      sourceVerbatims: ["Mon compte est toujours bloqué."],
      summary: "Compte toujours bloqué",
      broadCategoryHint: "access_security",
      caseDetails: [
        {
          key: "observed_result",
          value: "account_still_blocked",
          evidence: "Mon compte est toujours bloqué."
        }
      ]
    };
    const billingUnderstanding: TextUnderstanding = {
      ...textUnderstandings[0],
      understandingId: "text_understanding_2",
      sourceSegmentIds: ["seg_support_2"],
      sourceVerbatims: ["J’ai aussi reçu ma facture deux fois."],
      summary: "Facture reçue deux fois",
      broadCategoryHint: "billing",
      supportNeeds: ["possible_billing_or_payment_action"],
      caseDetails: [
        {
          key: "billing_issue_type",
          value: "duplicate_billing",
          evidence: "J’ai aussi reçu ma facture deux fois."
        }
      ]
    };
    const topicUpdateOps: TopicUpdateOp[] = [
      {
        op: "update",
        items: [0],
        topicId: 1,
        topic: null,
        merge: {
          caseDetails: [[0, 0]],
          attemptedActions: []
        },
        replace: null,
        review: null
      },
      {
        op: "update",
        items: [1],
        topicId: 2,
        topic: null,
        merge: {
          caseDetails: [[1, 0]],
          attemptedActions: []
        },
        replace: null,
        review: null
      }
    ];
    const topicPatches: TopicPatch[] = [
      {
        patchId: "topic_patch_1",
        op: "update",
        items: [0],
        topicId: 1,
        temporaryTopicId: null,
        topic: null,
        merge: {
          caseDetails: accessUnderstanding.caseDetails,
          attemptedActions: []
        },
        replace: {
          caseDetails: [],
          attemptedActions: []
        },
        review: null,
        sourceUnderstandingIds: ["text_understanding_1"],
        selectedSourceVerbatims: ["Mon compte est toujours bloqué."]
      },
      {
        patchId: "topic_patch_2",
        op: "update",
        items: [1],
        topicId: 2,
        temporaryTopicId: null,
        topic: null,
        merge: {
          caseDetails: billingUnderstanding.caseDetails,
          attemptedActions: []
        },
        replace: {
          caseDetails: [],
          attemptedActions: []
        },
        review: null,
        sourceUnderstandingIds: ["text_understanding_2"],
        selectedSourceVerbatims: ["J’ai aussi reçu ma facture deux fois."]
      }
    ];
    const mergedTopicSnapshots: MergedTopicSnapshot[] = [
      {
        snapshotId: "topic_patch_1",
        topicId: 1,
        temporaryTopicId: null,
        isNewTopic: false,
        title: "Compte bloqué",
        broadCategoryHint: "access_security",
        summary: "Le compte de l'utilisateur est toujours bloqué.",
        caseDetails: accessUnderstanding.caseDetails,
        attemptedActions: [],
        sourceUnderstandingIds: ["text_understanding_1"],
        sourceVerbatims: ["Mon compte est toujours bloqué."],
        sourceOpIndex: 0,
        baseTopic: mixedInput.supportTopicKnowledge.topics[0]
      },
      {
        snapshotId: "topic_patch_2",
        topicId: 2,
        temporaryTopicId: null,
        isNewTopic: false,
        title: "Problème de facturation",
        broadCategoryHint: "billing",
        summary: "L'utilisateur indique avoir reçu sa facture deux fois.",
        caseDetails: billingUnderstanding.caseDetails,
        attemptedActions: [],
        sourceUnderstandingIds: ["text_understanding_2"],
        sourceVerbatims: ["J’ai aussi reçu ma facture deux fois."],
        sourceOpIndex: 1,
        baseTopic: mixedInput.supportTopicKnowledge.topics[1]
      }
    ];
    const proposedTopicUpdates: ProposeTopicUpdatesOutput = {
      topicUpdateOps,
      topicPatches,
      mergedTopicSnapshots,
      topicUpdateProposals: []
    };
    const composedPlanForBothTopics: ComposedSupportResponsePlan = {
      topicId: null,
      messageIntent: "support_reply",
      acknowledge: [],
      answer: [],
      ask: [],
      say: [
        "Acknowledge that the user reports the account is still blocked.",
        "Acknowledge that the user reports receiving the invoice twice."
      ],
      review: null
    };
    const renderedBothTopics: RenderedSupportResponse = {
      finalResponseText:
        "Je comprends que votre compte est toujours bloqué et que vous indiquez avoir reçu votre facture deux fois."
    };
    const steps = buildSteps({
      planTurnAnalysis: vi.fn(async () => ({
        analyzeText: true,
        analyzeAttachments: false,
        matchedPatternIds: []
      })),
      analyzeTextSurface: vi.fn(async (): Promise<TextSurfaceAnalysis> => ({
        userLanguage: "French",
        segments: [
          {
            segmentId: "seg_support",
            verbatim: "Mon compte est toujours bloqué.",
            category: "support_relevant"
          },
          {
            segmentId: "seg_support_2",
            verbatim: "J’ai aussi reçu ma facture deux fois.",
            category: "support_relevant"
          }
        ]
      })),
      analyzeSupportText: vi.fn(async () => ({
        textUnderstandings: [accessUnderstanding, billingUnderstanding],
        supportResponseCues: []
      })),
      proposeTopicUpdates: vi.fn(async () => proposedTopicUpdates),
      planSupportResponse: vi.fn(async (plannerInput) => ({
        responsePlanId: "response_plan_test",
        topicId: plannerInput.topicEvidence.topicId,
        acknowledge: [],
        answer: [],
        ask: [],
        say: [
          `Acknowledge ${plannerInput.topicEvidence.topicId}.`
        ],
        review: null
      })),
      composeSupportResponsePlan: vi.fn(async () => composedPlanForBothTopics),
      renderSupportResponse: vi.fn(async () => renderedBothTopics),
      buildUserResponse: vi.fn(async ({ renderedSupportResponse }) => ({
        messages: [
          {
            type: "topic_response",
            content: renderedSupportResponse.finalResponseText
          }
        ]
      } satisfies UserResponse))
    });

    const output = await runSupportProcessingPipelineV2(mixedInput, steps);

    expect(output.topicUpdateOps).toEqual(topicUpdateOps);
    expect(output.topicUpdateOps?.map((op) => [op.op, op.topicId])).toEqual([
      ["update", "topic_1"],
      ["update", "topic_2"]
    ]);
    expect(output.mergedTopicSnapshots?.map((snapshot) => {
      return snapshot.topicId;
    })).toEqual(["topic_1", "topic_2"]);
    expect(output.topicResponsePlans).toHaveLength(2);
    expect(steps.composeSupportResponsePlan).toHaveBeenCalledWith(
      expect.objectContaining({
        topicResponsePlans: output.topicResponsePlans
      })
    );
    expect(composedPlanForBothTopics.say.join(" ")).toContain(
      "account is still blocked"
    );
    expect(composedPlanForBothTopics.say.join(" ")).toContain(
      "receiving the invoice twice"
    );
    expect(output.userResponse.messages[0]?.content).toContain(
      "compte est toujours bloqué"
    );
    expect(output.userResponse.messages[0]?.content).toContain(
      "facture deux fois"
    );
  });

  it("keeps the existing live-memory topicId through snapshots and persistence effects", async function () {
    const input = buildInput();
    input.latestUserMessage.content = "ubuntu et j’utilise la dernière version";
    input.supportTopicKnowledge = {
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
              evidence: "desktop app"
            },
            {
              key: "observed_result",
              value:
                "must reload/reclick conversation to see incoming messages",
              evidence: ""
            }
          ],
          attemptedActions: [],
          supportKnowledgeSummary: null
        }
      ]
    };
    const followUpUnderstanding: TextUnderstanding = {
      ...textUnderstandings[0],
      sourceVerbatims: ["ubuntu et j’utilise la dernière version"],
      summary: "Ubuntu and latest app version.",
      broadCategoryHint: "bug",
      messageKinds: [
        {
          kind: "info_update",
          evidence: "ubuntu et j’utilise la dernière version"
        }
      ],
      caseDetails: [
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
      ]
    };
    const proposedTopicUpdates: ProposeTopicUpdatesOutput = {
      topicUpdateOps: [
        {
          op: "update",
          items: [0],
          topicId: 1,
          topic: null,
          merge: {
            caseDetails: [[0, 0], [0, 1]],
            attemptedActions: []
          },
          replace: null,
          review: null
        }
      ],
      topicPatches: [
        {
          patchId: "topic_patch_1",
          op: "update",
          items: [0],
          topicId: 1,
          temporaryTopicId: null,
          topic: null,
          merge: {
            caseDetails: followUpUnderstanding.caseDetails,
            attemptedActions: []
          },
          replace: {
            caseDetails: [],
            attemptedActions: []
          },
          review: null,
          sourceUnderstandingIds: ["text_understanding_1"],
          selectedSourceVerbatims: [
            "ubuntu et j’utilise la dernière version"
          ]
        }
      ],
      mergedTopicSnapshots: [
        {
          snapshotId: "topic_patch_1",
          topicId: 1,
          temporaryTopicId: null,
          isNewTopic: false,
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
              evidence: "desktop app"
            },
            ...followUpUnderstanding.caseDetails
          ],
          attemptedActions: [],
          sourceUnderstandingIds: ["text_understanding_1"],
          sourceVerbatims: [
            "ubuntu et j’utilise la dernière version"
          ],
          sourceOpIndex: 0,
          baseTopic: input.supportTopicKnowledge.topics[0]
        }
      ],
      topicUpdateProposals: []
    };
    const steps = buildSteps({
      planTurnAnalysis: vi.fn(async () => ({
        analyzeText: true,
        analyzeAttachments: false,
        matchedPatternIds: []
      })),
      analyzeTextSurface: vi.fn(async () => supportTextSurface),
      analyzeSupportText: vi.fn(async () => ({
        textUnderstandings: [followUpUnderstanding],
        supportResponseCues: []
      })),
      proposeTopicUpdates: vi.fn(async () => proposedTopicUpdates),
      buildSupportProcessingPersistenceEffects: vi.fn(
        buildSupportProcessingPersistenceEffectsV2
      )
    });

    const output = await runSupportProcessingPipelineV2(input, steps);

    expect(output.topicUpdateOps?.[0]?.topicId).toBe("topic_1");
    expect(output.mergedTopicSnapshots?.[0]?.topicId).toBe("topic_1");
    expect(output.persistenceEffects.liveMemoryUpdate.topics).toEqual([
      expect.objectContaining({
        topicId: 1,
        title: "Twake Chat desktop messages",
        caseDetails: expect.arrayContaining([
          expect.objectContaining({
            key: "operating_system",
            value: "ubuntu"
          }),
          expect.objectContaining({
            key: "app_version",
            value: "latest"
          })
        ])
      })
    ]);
  });

  it("does not silently rebuild topic verbatims when the proposal has none", async function () {
    const proposalWithoutVerbatims: TopicUpdateProposal = {
      ...topicUpdateProposals[0],
      selectedSourceVerbatims: []
    };
    const steps = buildSteps({
      planTurnAnalysis: vi.fn(async () => ({
        analyzeText: true,
        analyzeAttachments: false,
        matchedPatternIds: []
      })),
      analyzeTextSurface: vi.fn(async () => supportTextSurface),
      proposeTopicUpdates: vi.fn(async () => [proposalWithoutVerbatims])
    });

    await runSupportProcessingPipelineV2(buildInput(), steps);

    expect(steps.selectCatalogKnowledgeForTopic).toHaveBeenCalledWith(
      expect.objectContaining({
        topicUserMessageContent: "",
        topicEvidence: expect.objectContaining({
          topicSourceVerbatims: [],
          relatedTextUnderstandings: textUnderstandings
        })
      })
    );
    expect(steps.planSupportResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        topicUserMessageContent: "",
        topicEvidence: expect.objectContaining({
          topicSourceVerbatims: []
        })
      })
    );
  });

  it("starts actionable topic branches in parallel", async function () {
    const firstPlan = createDeferred<KnowledgeEnrichmentPlan>();
    const secondPlan = createDeferred<KnowledgeEnrichmentPlan>();
    const proposals: TopicUpdateProposal[] = [
      topicUpdateProposals[0],
      {
        ...topicUpdateProposals[0],
        proposalId: "topic_update_proposal_2"
      }
    ];
    let planCallCount = 0;
    const steps = buildSteps({
      planTurnAnalysis: vi.fn(async () => ({
        analyzeText: true,
        analyzeAttachments: false,
        matchedPatternIds: []
      })),
      analyzeTextSurface: vi.fn(async () => supportTextSurface),
      proposeTopicUpdates: vi.fn(async () => proposals),
      planKnowledgeEnrichment: vi.fn(() => {
        planCallCount += 1;

        return planCallCount === 1
          ? firstPlan.promise
          : secondPlan.promise;
      })
    });

    const runPromise = runSupportProcessingPipelineV2(buildInput(), steps);

    await vi.waitFor(() => {
      expect(steps.planKnowledgeEnrichment).toHaveBeenCalledTimes(2);
    });
    expect(steps.planSupportResponse).not.toHaveBeenCalled();

    firstPlan.resolve(noRagPlan);
    secondPlan.resolve(noRagPlan);
    await runPromise;

    expect(steps.planSupportResponse).toHaveBeenCalledTimes(2);
  });

  it("uses the temporary catalog fallback when topic selection fails", async function () {
    const steps = buildSteps({
      planTurnAnalysis: vi.fn(async () => ({
        analyzeText: true,
        analyzeAttachments: false,
        matchedPatternIds: []
      })),
      analyzeTextSurface: vi.fn(async () => supportTextSurface),
      selectCatalogKnowledgeForTopic: vi.fn(async () => {
        throw new Error("selector unavailable");
      })
    });

    await runSupportProcessingPipelineV2(buildInput(), steps);

    expect(steps.planSupportResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedCatalogKnowledge: expect.objectContaining({
          scopeReason: "temporary_topic_catalog_selection",
          selectedFields: expect.arrayContaining([
            expect.objectContaining({ fieldName: "access_action" }),
            expect.objectContaining({
              fieldName: "account_status",
              askableByUser: false
            })
          ])
        })
      })
    );
  });

  it("runs retrieval and synthesis for one topic that requests RAG", async function () {
    const steps = buildSteps({
      planTurnAnalysis: vi.fn(async () => ({
        analyzeText: true,
        analyzeAttachments: false,
        matchedPatternIds: []
      })),
      analyzeTextSurface: vi.fn(async () => supportTextSurface),
      planKnowledgeEnrichment: vi.fn(async () => ragPlan)
    });

    const output = await runSupportProcessingPipelineV2(buildInput(), steps);

    expect(steps.retrieveSupportKnowledge).toHaveBeenCalledTimes(1);
    expect(steps.retrieveSupportKnowledge).toHaveBeenCalledWith(
      expect.objectContaining({
        knowledgeEnrichmentPlan: ragPlan,
        topicKnowledgeEnrichmentPlan: ragPlan,
        topicEvidence: expect.objectContaining({
          proposalId: topicUpdateProposals[0].proposalId,
          relatedTextUnderstandings: textUnderstandings
        }),
        selectedCatalogKnowledge: expect.objectContaining({
          scopeReason: "test_catalog_selection"
        })
      })
    );
    expect(steps.synthesizeRetrievedKnowledge).toHaveBeenCalledTimes(1);
    expect(steps.synthesizeRetrievedKnowledge).toHaveBeenCalledWith(
      expect.objectContaining({
        knowledgeEnrichmentPlan: ragPlan,
        knowledgeChunks,
        topicEvidence: expect.objectContaining({
          proposalId: topicUpdateProposals[0].proposalId
        })
      })
    );
    expect(steps.planSupportResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        topicRetrievedKnowledgeSynthesis: expect.objectContaining({
          relevantFacts: ["Reset password is available"],
          internalNotes: ["Support can inspect account state internally."],
          retrievedChunkCount: 1,
          topics: retrievedKnowledgeSynthesis.topics
        })
      })
    );
    expect(output.topicRetrievedSupportKnowledge).toEqual([
      {
        proposalId: topicUpdateProposals[0].proposalId,
        topicId: null,
        knowledgeChunks
      }
    ]);
    expect(output.topicRetrievedKnowledgeSyntheses).toEqual([
      {
        proposalId: topicUpdateProposals[0].proposalId,
        topicId: null,
        synthesis: retrievedKnowledgeSynthesis
      }
    ]);
  });

  it("waits for retrieved knowledge synthesis before planning the response", async function () {
    const synthesis = createDeferred<typeof retrievedKnowledgeSynthesis>();
    const stageEvents: string[] = [];
    const steps = buildSteps({
      planTurnAnalysis: vi.fn(async () => ({
        analyzeText: true,
        analyzeAttachments: false,
        matchedPatternIds: []
      })),
      analyzeTextSurface: vi.fn(async () => supportTextSurface),
      planKnowledgeEnrichment: vi.fn(async () => ragPlan),
      synthesizeRetrievedKnowledge: vi.fn(async () => {
        stageEvents.push("synthesize:start");
        const result = await synthesis.promise;

        stageEvents.push("synthesize:done");
        return result;
      }),
      planSupportResponse: vi.fn(async (plannerInput) => {
        stageEvents.push("response_plan:start");

        expect(plannerInput.topicRetrievedKnowledgeSynthesis).toEqual(
          retrievedKnowledgeSynthesis
        );

        return responsePlan;
      })
    });

    const runPromise = runSupportProcessingPipelineV2(buildInput(), steps);

    await vi.waitFor(() => {
      expect(steps.synthesizeRetrievedKnowledge).toHaveBeenCalledTimes(1);
    });

    expect(steps.planSupportResponse).not.toHaveBeenCalled();
    expect(stageEvents).toEqual(["synthesize:start"]);

    synthesis.resolve(retrievedKnowledgeSynthesis);

    await runPromise;

    expect(stageEvents).toEqual([
      "synthesize:start",
      "synthesize:done",
      "response_plan:start"
    ]);
    expect(steps.planSupportResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        topicRetrievedKnowledgeSynthesis: expect.objectContaining({
          relevantFacts: ["Reset password is available"],
          internalNotes: ["Support can inspect account state internally."],
          retrievedChunkCount: 1
        })
      })
    );
  });

  it("continues to render when RAG retrieval aborts", async function () {
    const abortError = new Error("The operation was aborted.");
    abortError.name = "AbortError";
    const steps = buildSteps({
      planTurnAnalysis: vi.fn(async () => ({
        analyzeText: true,
        analyzeAttachments: false,
        matchedPatternIds: []
      })),
      analyzeTextSurface: vi.fn(async () => supportTextSurface),
      planKnowledgeEnrichment: vi.fn(async () => ragPlan),
      retrieveSupportKnowledge: vi.fn(async () => {
        throw abortError;
      }),
      synthesizeRetrievedKnowledge: vi.fn(synthesizeRetrievedKnowledge)
    });

    const output = await runSupportProcessingPipelineV2(buildInput(), steps);
    const plannerInput = vi.mocked(steps.planSupportResponse).mock.calls[0][0];

    expect(steps.retrieveSupportKnowledge).toHaveBeenCalledTimes(1);
    expect(steps.synthesizeRetrievedKnowledge).toHaveBeenCalledWith(
      expect.objectContaining({
        knowledgeChunks: [],
        knowledgeRetrievalFailureReason: "abort_error"
      })
    );
    expect(output.topicRetrievedSupportKnowledge).toEqual([
      {
        proposalId: topicUpdateProposals[0].proposalId,
        topicId: null,
        knowledgeChunks: []
      }
    ]);
    expect(plannerInput.topicRetrievedKnowledgeSynthesis).toEqual(
      expect.objectContaining({
        relevantFacts: [],
        limitations: expect.arrayContaining([
          "Knowledge retrieval failed or timed out for this topic."
        ])
      })
    );
    expect(steps.planSupportResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedCatalogKnowledge: expect.objectContaining({
          scopeReason: "test_catalog_selection"
        })
      })
    );
    expect(steps.renderSupportResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        composedSupportResponsePlan
      })
    );
    expect(output.userResponse).toBe(userResponse);
  });

  it("runs RAG only for the topic whose enrichment plan requests it", async function () {
    const secondUnderstanding: TextUnderstanding = {
      ...textUnderstandings[0],
      understandingId: "text_understanding_2",
      summary: "Second issue"
    };
    const proposals: TopicUpdateProposal[] = [
      topicUpdateProposals[0],
      {
        ...topicUpdateProposals[0],
        proposalId: "topic_update_proposal_2",
        fromUnderstandingIds: ["text_understanding_2"]
      }
    ];
    const steps = buildSteps({
      planTurnAnalysis: vi.fn(async () => ({
        analyzeText: true,
        analyzeAttachments: false,
        matchedPatternIds: []
      })),
      analyzeTextSurface: vi.fn(async () => supportTextSurface),
      analyzeSupportText: vi.fn(async () => ({
        textUnderstandings: [
          ...textUnderstandings,
          secondUnderstanding
        ],
        supportResponseCues
      })),
      proposeTopicUpdates: vi.fn(async () => proposals),
      planKnowledgeEnrichment: vi.fn(async (planInput) => {
        return planInput.topicEvidence.proposalId ===
          proposals[1].proposalId
          ? ragPlan
          : noRagPlan;
      })
    });

    const output = await runSupportProcessingPipelineV2(buildInput(), steps);

    expect(steps.retrieveSupportKnowledge).toHaveBeenCalledTimes(1);
    expect(steps.retrieveSupportKnowledge).toHaveBeenCalledWith(
      expect.objectContaining({
        topicEvidence: expect.objectContaining({
          proposalId: proposals[1].proposalId,
          relatedTextUnderstandings: [secondUnderstanding]
        })
      })
    );
    expect(steps.synthesizeRetrievedKnowledge).toHaveBeenCalledTimes(1);
    expect(output.topicRetrievedKnowledgeSyntheses).toEqual([
      {
        proposalId: proposals[0].proposalId,
        topicId: null,
        synthesis: null
      },
      {
        proposalId: proposals[1].proposalId,
        topicId: null,
        synthesis: retrievedKnowledgeSynthesis
      }
    ]);

    const plannerCalls = vi.mocked(steps.planSupportResponse).mock.calls;
    const firstTopicPlannerInput = plannerCalls.find(([plannerInput]) => {
      return plannerInput.topicEvidence.proposalId ===
        proposals[0].proposalId;
    })?.[0];
    const secondTopicPlannerInput = plannerCalls.find(([plannerInput]) => {
      return plannerInput.topicEvidence.proposalId ===
        proposals[1].proposalId;
    })?.[0];

    expect(firstTopicPlannerInput?.topicRetrievedKnowledgeSynthesis).toBeNull();
    expect(secondTopicPlannerInput?.topicRetrievedKnowledgeSynthesis).toEqual(
      retrievedKnowledgeSynthesis
    );
  });

  it("keeps catalog selection independent from RAG synthesis before planning", async function () {
    const ragSynthesisWithPossibleFields = {
      supportKnowledgeSummary:
        "Support knowledge lookup returned useful customer-facing knowledge for this topic.",
      relevantFacts: ["Notification permission status can affect diagnosis."],
      applicableInstructions: [
        "Ask for notification_permission_status only if the catalog selected it."
      ],
      possibleFields: ["notification_permission_status"],
      unresolvedPoints: ["notification_permission_status"],
      sourceReferences: ["doc_1"],
      limitations: [],
      doNotClaim: [],
      topics: []
    };
    const selectedCatalogKnowledge = {
      selectedFields: [
        {
          fieldName: "app_version",
          description: "App version.",
          askableByUser: true
        }
      ],
      selectedGenericKnowledge: [],
      scopeReason: "catalog_did_not_select_notification_permission_status",
      rejectedFieldNames: ["notification_permission_status"]
    };
    const steps = buildSteps({
      planTurnAnalysis: vi.fn(async () => ({
        analyzeText: true,
        analyzeAttachments: false,
        matchedPatternIds: []
      })),
      analyzeTextSurface: vi.fn(async () => supportTextSurface),
      planKnowledgeEnrichment: vi.fn(async () => ragPlan),
      selectCatalogKnowledgeForTopic: vi.fn(async () => selectedCatalogKnowledge),
      synthesizeRetrievedKnowledge: vi.fn(
        async () => ragSynthesisWithPossibleFields
      )
    });

    await runSupportProcessingPipelineV2(buildInput(), steps);

    expect(steps.planSupportResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedCatalogKnowledge,
        topicRetrievedKnowledgeSynthesis: ragSynthesisWithPossibleFields
      })
    );

    const plannerInput = vi.mocked(steps.planSupportResponse).mock.calls[0][0] as {
      selectedCatalogKnowledge: typeof selectedCatalogKnowledge;
    };

    expect(plannerInput.selectedCatalogKnowledge.selectedFields.map((field) => {
      return field.fieldName;
    })).toEqual(["app_version"]);
    expect(plannerInput.selectedCatalogKnowledge.rejectedFieldNames)
      .toContain("notification_permission_status");
  });

  it("retrieves mock knowledge only for the matching topic in a multi-topic turn", async function () {
    const notificationUnderstanding: TextUnderstanding = {
      ...textUnderstandings[0],
      sourceVerbatims: [
        "I do not receive notifications on Android when I get a new email."
      ],
      summary: "Android push notification missing after new email.",
      broadCategoryHint: "bug",
      supportNeeds: ["possible_bug"]
    };
    const billingUnderstanding: TextUnderstanding = {
      ...textUnderstandings[0],
      understandingId: "text_understanding_2",
      sourceSegmentIds: ["seg_support_2"],
      sourceVerbatims: ["I received my invoice twice."],
      summary: "Duplicate invoice.",
      broadCategoryHint: "billing",
      supportNeeds: ["possible_billing_or_payment_action"]
    };
    const proposals: TopicUpdateProposal[] = [
      {
        ...topicUpdateProposals[0],
        selectedSourceVerbatims:
          notificationUnderstanding.sourceVerbatims as string[]
      },
      {
        ...topicUpdateProposals[0],
        proposalId: "topic_update_proposal_2",
        fromUnderstandingIds: ["text_understanding_2"],
        selectedSourceVerbatims: billingUnderstanding.sourceVerbatims as string[],
        newTopic: {
          title: "Duplicate invoice",
          broadCategoryHint: "billing",
          userGoal: "Clarify duplicate invoice",
          blockingIssue: "unknown"
        }
      }
    ];
    const mergedTopicSnapshots = [
      {
        snapshotId: proposals[0].proposalId,
        topicId: null,
        temporaryTopicId: null,
        isNewTopic: true,
        title: "Android notification problem",
        broadCategoryHint: "bug",
        summary: notificationUnderstanding.summary,
        caseDetails: [],
        attemptedActions: [],
        sourceUnderstandingIds: ["text_understanding_1"],
        sourceVerbatims:
          notificationUnderstanding.sourceVerbatims as string[],
        sourceOpIndex: 0,
        baseTopic: null
      },
      {
        snapshotId: proposals[1].proposalId,
        topicId: null,
        temporaryTopicId: null,
        isNewTopic: true,
        title: "Duplicate invoice",
        broadCategoryHint: "billing",
        summary: billingUnderstanding.summary,
        caseDetails: [],
        attemptedActions: [],
        sourceUnderstandingIds: ["text_understanding_2"],
        sourceVerbatims: billingUnderstanding.sourceVerbatims as string[],
        sourceOpIndex: 1,
        baseTopic: null
      }
    ];
    const steps = buildSteps({
      planTurnAnalysis: vi.fn(async () => ({
        analyzeText: true,
        analyzeAttachments: false,
        matchedPatternIds: []
      })),
      analyzeTextSurface: vi.fn(async () => supportTextSurface),
      analyzeSupportText: vi.fn(async () => ({
        textUnderstandings: [
          notificationUnderstanding,
          billingUnderstanding
        ],
        supportResponseCues: []
      })),
      proposeTopicUpdates: vi.fn(async () => ({
        topicUpdateOps: [],
        topicUpdateProposals: proposals,
        topicPatches: [],
        mergedTopicSnapshots
      })),
      planKnowledgeEnrichment: vi.fn(planKnowledgeEnrichment),
      retrieveSupportKnowledge: vi.fn(async () => [
        {
          topicId: 1,
          sourceId: "android_push_notification_not_received",
          content: "Android notification customer-safe knowledge.",
          score: 0.95
        }
      ]),
      synthesizeRetrievedKnowledge: vi.fn(async () => ({
        supportKnowledgeSummary:
          "Support knowledge lookup returned useful customer-facing knowledge for this topic.",
        relevantFacts: [
          "Android notification customer-safe knowledge."
        ],
        applicableInstructions: [],
        possibleFields: [],
        unresolvedPoints: [],
        sourceReferences: ["android_push_notification_not_received"],
        limitations: [],
        internalNotes: [],
        retrievedChunkCount: 1,
        doNotClaim: [],
        topics: [
          {
            topicId: 1,
            relevantFacts: [
              "Android notification customer-safe knowledge."
            ],
            applicableInstructions: [],
            possibleFields: [],
            unresolvedPoints: [],
            sourceReferences: ["android_push_notification_not_received"]
          }
        ]
      })),
      buildSupportProcessingPersistenceEffects: vi.fn(
        buildSupportProcessingPersistenceEffectsV2
      )
    });

    const output = await runSupportProcessingPipelineV2(buildInput(), steps);

    expect(steps.retrieveSupportKnowledge).toHaveBeenCalledTimes(1);
    expect(steps.retrieveSupportKnowledge).toHaveBeenCalledWith(
      expect.objectContaining({
        topicEvidence: expect.objectContaining({
          proposalId: proposals[0].proposalId,
          relatedTextUnderstandings: [notificationUnderstanding]
        })
      })
    );
    expect(output.topicKnowledgeEnrichmentPlans).toEqual([
      expect.objectContaining({
        proposalId: proposals[0].proposalId,
        plan: expect.objectContaining({
          route: "rag_only"
        })
      }),
      expect.objectContaining({
        proposalId: proposals[1].proposalId,
        plan: expect.objectContaining({
          route: "none"
        })
      })
    ]);
    expect(output.topicRetrievedSupportKnowledge?.[0].knowledgeChunks[0])
      .toMatchObject({
        sourceId: "android_push_notification_not_received"
      });
    expect(output.topicRetrievedSupportKnowledge?.[1].knowledgeChunks)
      .toEqual([]);
    expect(
      output.persistenceEffects.liveMemoryUpdate.topics
    ).toEqual(expect.arrayContaining([
      expect.objectContaining({
        broadCategoryHint: "bug",
        title: "Android notification problem"
      }),
      expect.objectContaining({
        broadCategoryHint: "billing"
      })
    ]));

    const plannerCalls = vi.mocked(steps.planSupportResponse).mock.calls;
    const notificationPlannerInput = plannerCalls.find(([plannerInput]) => {
      return plannerInput.topicEvidence.proposalId ===
        proposals[0].proposalId;
    })?.[0];
    const billingPlannerInput = plannerCalls.find(([plannerInput]) => {
      return plannerInput.topicEvidence.proposalId ===
        proposals[1].proposalId;
    })?.[0];

    expect(notificationPlannerInput?.topicRetrievedKnowledgeSynthesis)
      .toEqual(expect.objectContaining({
        relevantFacts: [
          "Android notification customer-safe knowledge."
        ],
        internalNotes: [],
        retrievedChunkCount: 1
      }));
    expect(billingPlannerInput?.topicRetrievedKnowledgeSynthesis).toBeNull();
  });

  it("supports multiple retrieve_knowledge topics in parallel without mixing syntheses", async function () {
    const secondUnderstanding: TextUnderstanding = {
      ...textUnderstandings[0],
      understandingId: "text_understanding_2",
      summary: "Billing issue",
      broadCategoryHint: "billing"
    };
    const proposals: TopicUpdateProposal[] = [
      topicUpdateProposals[0],
      {
        ...topicUpdateProposals[0],
        proposalId: "topic_update_proposal_2",
        fromUnderstandingIds: ["text_understanding_2"]
      }
    ];
    const firstRetrieval = createDeferred<KnowledgeChunk[]>();
    const secondRetrieval = createDeferred<KnowledgeChunk[]>();
    const firstChunks: KnowledgeChunk[] = [
      {
        topicId: 1,
        sourceId: "access_doc",
        content: "Access knowledge",
        score: 0.9
      }
    ];
    const secondChunks: KnowledgeChunk[] = [
      {
        topicId: 2,
        sourceId: "billing_doc",
        content: "Billing knowledge",
        score: 0.8
      }
    ];
    const firstSynthesis = {
      supportKnowledgeSummary:
        "Support knowledge lookup returned useful customer-facing knowledge for this topic.",
      topics: [
        {
          topicId: 1,
          relevantFacts: ["Access fact"],
          sourceReferences: ["access_doc"]
        }
      ]
    };
    const secondSynthesis = {
      supportKnowledgeSummary:
        "Support knowledge lookup returned useful customer-facing knowledge for this topic.",
      topics: [
        {
          topicId: 2,
          relevantFacts: ["Billing fact"],
          sourceReferences: ["billing_doc"]
        }
      ]
    };
    const steps = buildSteps({
      planTurnAnalysis: vi.fn(async () => ({
        analyzeText: true,
        analyzeAttachments: false,
        matchedPatternIds: []
      })),
      analyzeTextSurface: vi.fn(async () => supportTextSurface),
      analyzeSupportText: vi.fn(async () => ({
        textUnderstandings: [
          ...textUnderstandings,
          secondUnderstanding
        ],
        supportResponseCues
      })),
      proposeTopicUpdates: vi.fn(async () => proposals),
      planKnowledgeEnrichment: vi.fn(async () => ragPlan),
      retrieveSupportKnowledge: vi.fn((retrievalInput) => {
        return retrievalInput.topicEvidence.proposalId ===
          proposals[0].proposalId
          ? firstRetrieval.promise
          : secondRetrieval.promise;
      }),
      synthesizeRetrievedKnowledge: vi.fn(async (synthesisInput) => {
        return synthesisInput.topicEvidence.proposalId ===
          proposals[0].proposalId
          ? firstSynthesis
          : secondSynthesis;
      })
    });

    const runPromise = runSupportProcessingPipelineV2(buildInput(), steps);

    await vi.waitFor(() => {
      expect(steps.retrieveSupportKnowledge).toHaveBeenCalledTimes(2);
    });
    expect(steps.synthesizeRetrievedKnowledge).not.toHaveBeenCalled();

    firstRetrieval.resolve(firstChunks);
    secondRetrieval.resolve(secondChunks);
    const output = await runPromise;

    expect(steps.synthesizeRetrievedKnowledge).toHaveBeenCalledTimes(2);
    expect(output.topicRetrievedKnowledgeSyntheses).toEqual([
      {
        proposalId: proposals[0].proposalId,
        topicId: null,
        synthesis: firstSynthesis
      },
      {
        proposalId: proposals[1].proposalId,
        topicId: null,
        synthesis: secondSynthesis
      }
    ]);

    const plannerCalls = vi.mocked(steps.planSupportResponse).mock.calls;

    expect(plannerCalls).toEqual(expect.arrayContaining([
      [
        expect.objectContaining({
          topicEvidence: expect.objectContaining({
            proposalId: proposals[0].proposalId
          }),
          topicRetrievedKnowledgeSynthesis: firstSynthesis
        })
      ],
      [
        expect.objectContaining({
          topicEvidence: expect.objectContaining({
            proposalId: proposals[1].proposalId
          }),
          topicRetrievedKnowledgeSynthesis: secondSynthesis
        })
      ]
    ]));
  });

  it("forwards multiple retrieval requests for one topic and synthesizes merged chunks", async function () {
    const multiRequestPlan: KnowledgeEnrichmentPlan = {
      route: "rag_only",
      retrievalRequests: [
        {
          topicId: 1,
          searchPurpose: "support_answer_and_qualification",
          queryText: "Support issue: access error.",
          desiredKnowledge: ["known_behavior"],
          context: {
            topicSummary: "Access error",
            knownDetails: [],
            attemptedActions: []
          }
        },
        {
          topicId: 1,
          searchPurpose: "support_answer_and_qualification",
          queryText: "Support issue: password reset.",
          desiredKnowledge: ["troubleshooting_steps"],
          context: {
            topicSummary: "Password reset",
            knownDetails: [],
            attemptedActions: []
          }
        }
      ],
      reason: "Two knowledge queries are useful."
    };
    const mergedChunks: KnowledgeChunk[] = [
      ...knowledgeChunks,
      {
        topicId: 1,
        sourceId: "doc_2",
        content: "Password reset knowledge",
        score: 0.8
      }
    ];
    const steps = buildSteps({
      planTurnAnalysis: vi.fn(async () => ({
        analyzeText: true,
        analyzeAttachments: false,
        matchedPatternIds: []
      })),
      analyzeTextSurface: vi.fn(async () => supportTextSurface),
      planKnowledgeEnrichment: vi.fn(async () => multiRequestPlan),
      retrieveSupportKnowledge: vi.fn(async () => mergedChunks)
    });

    await runSupportProcessingPipelineV2(buildInput(), steps);

    expect(steps.retrieveSupportKnowledge).toHaveBeenCalledWith(
      expect.objectContaining({
        knowledgeEnrichmentPlan: multiRequestPlan,
        topicKnowledgeEnrichmentPlan: multiRequestPlan
      })
    );
    expect(steps.synthesizeRetrievedKnowledge).toHaveBeenCalledWith(
      expect.objectContaining({
        knowledgeChunks: mergedChunks
      })
    );
  });

  it("renders no topic plans when no proposal is actionable", async function () {
    const steps = buildSteps({
      planTurnAnalysis: vi.fn(async () => ({
        analyzeText: true,
        analyzeAttachments: false,
        matchedPatternIds: []
      })),
      analyzeTextSurface: vi.fn(async () => supportTextSurface),
      proposeTopicUpdates: vi.fn(async () => {
        return [
          {
          ...topicUpdateProposals[0],
          action: "needs_review"
          }
        ] satisfies TopicUpdateProposal[];
      })
    });

    const output = await runSupportProcessingPipelineV2(buildInput(), steps);

    expect(steps.planKnowledgeEnrichment).not.toHaveBeenCalled();
    expect(steps.selectCatalogKnowledgeForTopic).not.toHaveBeenCalled();
    expect(steps.planSupportResponse).not.toHaveBeenCalled();
    expect(steps.composeSupportResponsePlan).toHaveBeenCalledWith(
      expect.objectContaining({
        topicResponsePlans: []
      })
    );
    expect(steps.renderSupportResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        composedSupportResponsePlan
      })
    );
    expect(output.topicResponsePlans).toEqual([]);
    expect(output).not.toHaveProperty("responsePlan");
  });

  it("passes support response plans and empty standard fragments to the composer on support-only turns", async function () {
    const input = buildInput();
    const steps = buildSteps({
      planTurnAnalysis: vi.fn(async () => ({
        analyzeText: true,
        analyzeAttachments: false,
        matchedPatternIds: []
      })),
      analyzeTextSurface: vi.fn(async () => supportTextSurface),
      buildStandardResponseFragments: vi.fn(async () => [])
    });

    await runSupportProcessingPipelineV2(input, steps);

    expect(steps.composeSupportResponsePlan).toHaveBeenCalledWith(expect.objectContaining({
      topicResponsePlans: [expectedTopicResponsePlan],
      standardResponseFragments: [],
      channel: input.latestUserMessage.channel
    }));
    expect(steps.renderSupportResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        composedSupportResponsePlan
      })
    );
  });

  it("passes support response plans and standard fragments together to the composer", async function () {
    const input = buildInput();
    const steps = buildSteps({
      planTurnAnalysis: vi.fn(async () => ({
        analyzeText: true,
        analyzeAttachments: false,
        matchedPatternIds: []
      })),
      analyzeTextSurface: vi.fn(async () => supportAndSmallTalkTextSurface),
      buildStandardResponseFragments: vi.fn(async () => [standardFragment])
    });

    await runSupportProcessingPipelineV2(input, steps);

    expect(steps.analyzeSupportText).toHaveBeenCalled();
    expect(steps.composeSupportResponsePlan).toHaveBeenCalledWith(expect.objectContaining({
      topicResponsePlans: [expectedTopicResponsePlan],
      standardResponseFragments: [standardFragment],
      channel: input.latestUserMessage.channel
    }));
    expect(steps.renderSupportResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        composedSupportResponsePlan
      })
    );
  });

  it("composes multiple standard fragments before one renderer call", async function () {
    const input = buildInput();
    const fragments: StandardResponseFragment[] = [
      standardFragment,
      {
        category: "standard_interaction",
        standardSubcategory: "greeting",
        content: "Bonjour."
      }
    ];
    const steps = buildSteps({
      buildStandardResponseFragments: vi.fn(async () => fragments)
    });

    await runSupportProcessingPipelineV2(input, steps);

    expect(steps.composeSupportResponsePlan).toHaveBeenCalledWith(expect.objectContaining({
      standardResponseFragments: fragments,
      topicResponsePlans: [],
      channel: input.latestUserMessage.channel
    }));
    expect(steps.renderSupportResponse).toHaveBeenCalledTimes(1);
    expect(steps.renderSupportResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        composedSupportResponsePlan
      })
    );
  });

  it("does not send standard fragments directly to buildUserResponse", async function () {
    const steps = buildSteps({
      buildStandardResponseFragments: vi.fn(async () => [standardFragment])
    });

    await runSupportProcessingPipelineV2(buildInput(), steps);

    expect(steps.buildUserResponse).toHaveBeenCalledWith({
      renderedSupportResponse
    });
  });

  it("calls the renderer exactly once on the deep route before buildUserResponse", async function () {
    const steps = buildSteps({
      planTurnAnalysis: vi.fn(async () => ({
        analyzeText: true,
        analyzeAttachments: false,
        matchedPatternIds: []
      })),
      analyzeTextSurface: vi.fn(async () => supportTextSurface)
    });

    await runSupportProcessingPipelineV2(buildInput(), steps);

    expect(steps.renderSupportResponse).toHaveBeenCalledTimes(1);
    expect(steps.buildUserResponse).toHaveBeenCalledWith({
      renderedSupportResponse
    });
  });

  it("does not leave removed accumulator references in V2 source, tests, or Mermaid documentation", function () {
    const root = process.cwd();
    const removedAccumulatorName = ["response", "Accumulator"].join("");
    const removedAccumulatorType = ["Response", "Accumulator", "V2"].join("");
    const filesToCheck = [
      "src/support-automation/support-processing-pipeline-v2/runSupportProcessingPipelineV2.ts",
      "src/support-automation/support-processing-pipeline-v2/typesSupportProcessingPipelineV2.types.ts",
      "tests/support-processing-pipeline-v2/runSupportProcessingPipelineV2.test.ts",
      "docs/support-processing-pipeline/structure.md"
    ];

    for (const relativePath of filesToCheck) {
      const content = readFileSync(join(root, relativePath), "utf8");

      expect(content).not.toContain(removedAccumulatorName);
      expect(content).not.toContain(removedAccumulatorType);
    }
  });

  it("includes a multi-topic dataset case and uses the official debug pipeline runner", function () {
    const root = process.cwd();
    const datasetSource = readFileSync(
      join(
        root,
        "scripts/support-processing-pipeline-v2/textAnalysisDataset.ts"
      ),
      "utf8"
    );
    const runnerSource = readFileSync(
      join(
        root,
        "scripts/support-processing-pipeline-v2/runTextAnalysisDataset.ts"
      ),
      "utf8"
    );

    expect(datasetSource).toContain('id: "multi-topic-access-billing"');
    expect(datasetSource).toContain(
      "Mon compte est toujours bloqué. Et j’ai aussi reçu ma facture deux fois."
    );
    expect(datasetSource).toContain('channel: "matrix"');
    expect(datasetSource).toContain("liveMemoryContext");
    expect(datasetSource).toContain("lastBotVerbatim");
    expect(runnerSource).toContain("runSupportProcessingPipelineV2Debug");
    expect(runnerSource).toContain("UNTIL_TO_STOP_AFTER_STEP");
    expect(runnerSource).not.toContain(
      "from \"../../src/support-automation/support-processing-pipeline-v2/analyze-support-text/analyzeSupportText\""
    );
    expect(runnerSource).not.toContain(
      "from \"../../src/support-automation/support-processing-pipeline-v2/propose-topic-updates/proposeTopicUpdates\""
    );
    expect(runnerSource).not.toContain(
      "from \"../../src/support-automation/support-processing-pipeline-v2/synthesize-retrieved-knowledge/synthesizeRetrievedKnowledge\""
    );
  });

  it("reports progress for the no-analysis route", async function () {
    const progressEvents: SupportProcessingProgressEvent[] = [];
    const steps = buildSteps();

    await runSupportProcessingPipelineV2(buildInput(), steps, {
      reportProgress: (event) => {
        progressEvents.push(event);
      }
    });

    expect(progressEvents).toEqual([
      { step: "detectSuspiciousPromptPatterns", status: "started" },
      { step: "detectSuspiciousPromptPatterns", status: "completed" },
      { step: "planTurnAnalysis", status: "started" },
      { step: "planTurnAnalysis", status: "completed" },
      { step: "analyzeTextSurface", status: "skipped" },
      { step: "analyzeAttachmentSurface", status: "skipped" },
      { step: "buildStandardResponseFragments", status: "started" },
      { step: "buildStandardResponseFragments", status: "completed" },
      { step: "analyzeSupportText", status: "skipped" },
      { step: "analyzeSupportAttachments", status: "skipped" },
      { step: "proposeTopicUpdates", status: "skipped" },
      { step: "applyTopicUpdates", status: "skipped" },
      { step: "planKnowledgeRouting", status: "skipped" },
      { step: "planKnowledgeEnrichment", status: "skipped" },
      { step: "selectCatalogKnowledgeForTopic", status: "skipped" },
      { step: "retrieveSupportKnowledge", status: "skipped" },
      { step: "synthesizeRetrievedKnowledge", status: "skipped" },
      { step: "planSupportResponse", status: "skipped" },
      { step: "composeSupportResponsePlan", status: "started" },
      { step: "composeSupportResponsePlan", status: "completed" },
      { step: "renderSupportResponse", status: "started" },
      { step: "renderSupportResponse", status: "completed" },
      { step: "buildUserResponse", status: "started" },
      { step: "buildUserResponse", status: "completed" },
      { step: "buildSupportProcessingPersistenceEffects", status: "started" },
      { step: "buildSupportProcessingPersistenceEffects", status: "completed" }
    ]);
  });

  it("debug mode stops after a requested official step and exposes partial output", async function () {
    const steps = buildSteps({
      planTurnAnalysis: vi.fn(async () => ({
        analyzeText: true,
        analyzeAttachments: false,
        matchedPatternIds: []
      })),
      analyzeTextSurface: vi.fn(async () => supportTextSurface)
    });
    const result = await runSupportProcessingPipelineV2Debug(
      buildInput(),
      steps,
      {
        stopAfterStep: "analyzeTextSurface"
      }
    );

    expect(result.status).toBe("stopped");
    expect(result.stoppedAfterStep).toBe("analyzeTextSurface");
    expect(result.output).toBeUndefined();
    expect(result.partial.analyzeTextSurface).toEqual(supportTextSurface);
    expect(result.progressEvents).toContainEqual({
      step: "analyzeTextSurface",
      status: "completed",
      userLanguage: supportTextSurface.userLanguage,
      rawUserLanguage: supportTextSurface.userLanguage,
      normalizedResponseLanguage: "fr"
    });
    expect(steps.renderSupportResponse).not.toHaveBeenCalled();
  });

  it("reports progress for deep analysis without RAG", async function () {
    const progressEvents: SupportProcessingProgressEvent[] = [];
    const steps = buildSteps({
      planTurnAnalysis: vi.fn(async () => ({
        analyzeText: true,
        analyzeAttachments: false,
        matchedPatternIds: []
      })),
      analyzeTextSurface: vi.fn(async () => supportTextSurface),
      planKnowledgeEnrichment: vi.fn(async () => noRagPlan)
    });

    await runSupportProcessingPipelineV2(buildInput(), steps, {
      reportProgress: (event) => {
        progressEvents.push(event);
      }
    });

    expect(progressEvents).toContainEqual({
      step: "analyzeSupportText",
      status: "completed"
    });
    expect(progressEvents).toContainEqual({
      step: "analyzeSupportAttachments",
      status: "skipped"
    });
    expect(progressEvents).toContainEqual({
      step: "applyTopicUpdates",
      status: "skipped"
    });
    expect(progressEvents).toContainEqual({
      step: "planKnowledgeEnrichment",
      status: "completed"
    });
    expect(progressEvents).toContainEqual({
      step: "retrieveSupportKnowledge",
      status: "skipped"
    });
    expect(progressEvents).toContainEqual({
      step: "synthesizeRetrievedKnowledge",
      status: "skipped"
    });
    expect(progressEvents).toContainEqual({
      step: "planSupportResponse",
      status: "completed"
    });
    expect(progressEvents).toContainEqual({
      step: "composeSupportResponsePlan",
      status: "completed"
    });
    expect(progressEvents).toContainEqual({
      step: "renderSupportResponse",
      status: "completed"
    });
  });

  it("reports the detected user language only after text surface analysis completes", async function () {
    const progressEvents: SupportProcessingProgressEvent[] = [];
    const steps = buildSteps({
      planTurnAnalysis: vi.fn(async () => ({
        analyzeText: true,
        analyzeAttachments: false,
        matchedPatternIds: []
      })),
      analyzeTextSurface: vi.fn(async () => ({
        ...supportTextSurface,
        userLanguage: "English"
      })),
      planKnowledgeEnrichment: vi.fn(async () => noRagPlan)
    });

    await runSupportProcessingPipelineV2(buildInput(), steps, {
      reportProgress: (event) => {
        progressEvents.push(event);
      }
    });

    const textSurfaceEvents = progressEvents.filter((event) => {
      return event.step === "analyzeTextSurface";
    });

    expect(textSurfaceEvents).toEqual([
      {
        step: "analyzeTextSurface",
        status: "started"
      },
      {
        step: "analyzeTextSurface",
        status: "completed",
        userLanguage: "English",
        rawUserLanguage: "English",
        normalizedResponseLanguage: "en"
      }
    ]);
  });

  it("ignores reportProgress failures", async function () {
    const steps = buildSteps({
      buildStandardResponseFragments: vi.fn(async () => [standardFragment])
    });

    const output = await runSupportProcessingPipelineV2(buildInput(), steps, {
      reportProgress: () => {
        throw new Error("progress sink failed");
      }
    });

    expect(output).toEqual({
      userResponse,
      persistenceEffects,
      composedSupportResponsePlan
    });
  });
});
