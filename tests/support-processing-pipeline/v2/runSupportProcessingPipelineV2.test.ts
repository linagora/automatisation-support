import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  runSupportProcessingPipelineV2
} from "../../../src/support-processing-pipeline/v2/runSupportProcessingPipelineV2";
import {
  buildSupportPatchesV2
} from "../../../src/support-processing-pipeline/v2/build-support-patches/buildSupportPatchesV2";
import {
  buildTopicResponsePlanDebug
} from "../../../src/support-processing-pipeline/v2/responsePlanIds";
import {
  planKnowledgeEnrichment
} from "../../../src/support-processing-pipeline/v2/plan-knowledge-enrichment/planKnowledgeEnrichment";
import {
  retrieveSupportKnowledge
} from "../../../src/support-processing-pipeline/v2/retrieve-support-knowledge/retrieveSupportKnowledge";
import {
  synthesizeRetrievedKnowledge
} from "../../../src/support-processing-pipeline/v2/synthesize-retrieved-knowledge/synthesizeRetrievedKnowledge";

import type {
  AttachmentSurfaceAnalysis,
  AttachmentUnderstanding,
  KnowledgeChunk,
  KnowledgeEnrichmentPlan,
  Patches,
  PromptSecuritySignals,
  ResponsePlanV2,
  StandardResponseFragment,
  SupportResponseCue,
  SupportProcessingPipelineV2Input,
  SupportProcessingProgressEvent,
  SupportProcessingPipelineV2Steps,
  TextSurfaceAnalysis,
  TextUnderstanding,
  TopicUpdateProposal,
  UserResponse
} from "../../../src/support-processing-pipeline/v2/typesSupportProcessingPipelineV2.types";
import type {
  RenderedSupportResponse
} from "../../../src/support-processing-pipeline/v2/response-renderer/typesRenderSupportResponse.types";

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
      segments_topic: []
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
  route: "no_retrieval",
  retrievalRequests: [],
  reason: "rag_not_enabled_yet"
};

const ragPlan: KnowledgeEnrichmentPlan = {
  route: "retrieve_knowledge",
  retrievalRequests: [
    {
      topicId: 1,
      query: "login password error"
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
  topics: [
    {
      topicId: 1,
      relevantFacts: ["Reset password is available"],
      sourceReferences: ["doc_1"]
    }
  ]
};

const responsePlan: ResponsePlanV2 = {
  responsePlanId: "response_plan_test",
  knowledgeGate: {
    knowledgeMode: "rag_not_enabled",
    solutionAllowed: false,
    allowedMoves: [
      "acknowledge"
    ],
    reason: "RAG is not enabled in this test fixture."
  },
  questionDecision: {
    shouldAskQuestion: false,
    plannedQuestionCount: 0,
    fieldNames: [],
    questionInstruction: null,
    reason: "No clarification question is needed in this fixture.",
  },
  rendererTask: {
    targetLanguage: "French",
    prompt: "Write a concise acknowledgement without inventing a solution.",
    questionFieldNames: [],
    forbiddenClaims: [
      "No question.",
      "No solution."
    ]
  },
  internalRationale: "Test fixture."
};

const expectedTopicResponsePlan: ResponsePlanV2 = {
  ...responsePlan,
  responsePlanId: "response_plan_topic_update_proposal_1"
};

const renderedSupportResponse: RenderedSupportResponse = {
  renderedMessages: [
    {
      messageId: "rendered_message_test",
      messageOrder: 1,
      purpose: "support_response",
      relatedPlannedMessageOrders: [],
      content: "Voici quoi faire."
    }
  ],
  finalResponseText: "Voici quoi faire.",
  internalRenderingNotes: "Test fixture."
};

const userResponse: UserResponse = {
  messages: [
    {
      type: "global_response",
      content: "Réponse finale."
    }
  ]
};

const patches: Patches = {
  analysisPatch: {
    turnUnderstandingDelta: {
      user_language: "French",
      segments_lack_comprehension: [],
      segments_topic: [],
      segments_signal: [],
      segments_scope_boundary: [],
      segments_suspicious: []
    }
  },
  securityPatch: {
    securityGateSummary: {
      gateChecked: {},
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
    generatedAt: "2026-06-12T08:00:00.000Z",
    source: "support-processing-pipeline"
  }
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
    renderSupportResponse: vi.fn(async () => renderedSupportResponse),
    buildUserResponse: vi.fn(async () => userResponse),
    buildSupportPatches: vi.fn(async () => patches),
    ...overrides
  };
}

describe("runSupportProcessingPipelineV2", function () {
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
    expect(steps.renderSupportResponse).toHaveBeenCalledWith(expect.objectContaining({
      standardResponseFragments: [standardFragment],
      topicResponsePlans: [],
      channel: input.latestUserMessage.channel
    }));
    expect(steps.buildUserResponse).toHaveBeenCalledWith({
      renderedSupportResponse
    });
    expect(steps.renderSupportResponse).toHaveBeenCalledTimes(1);
    expect(output).toEqual({
      userResponse,
      patches
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
    expect(steps.renderSupportResponse).toHaveBeenCalledWith(expect.objectContaining({
      standardResponseFragments: [],
      topicResponsePlans: [],
      channel: input.latestUserMessage.channel
    }));
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
    expect(steps.renderSupportResponse).toHaveBeenCalledWith(expect.objectContaining({
      topicResponsePlans: [expectedTopicResponsePlan],
      standardResponseFragments: [],
      channel: buildInput().latestUserMessage.channel
    }));
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
    expect(output.responsePlan).toEqual(expectedTopicResponsePlan);
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
      targetLanguage: "French",
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
        targetLanguage: "French",
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
    expect(steps.renderSupportResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        topicResponsePlans
      })
    );
    expect(buildTopicResponsePlanDebug(firstTopicResponsePlan)).toEqual({
      responsePlanId: firstTopicResponsePlan.responsePlanId
    });
    expect(buildTopicResponsePlanDebug(secondTopicResponsePlan)).toEqual({
      responsePlanId: secondTopicResponsePlan.responsePlanId
    });
    expect(output.responsePlan).toEqual(firstTopicResponsePlan);
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
        topicRetrievedKnowledgeSynthesis: retrievedKnowledgeSynthesis
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
          notificationUnderstanding.sourceVerbatims
      },
      {
        ...topicUpdateProposals[0],
        proposalId: "topic_update_proposal_2",
        fromUnderstandingIds: ["text_understanding_2"],
        selectedSourceVerbatims: billingUnderstanding.sourceVerbatims,
        newTopic: {
          title: "Duplicate invoice",
          broadCategoryHint: "billing",
          userGoal: "Clarify duplicate invoice",
          blockingIssue: "unknown"
        }
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
      proposeTopicUpdates: vi.fn(async () => proposals),
      planKnowledgeEnrichment: vi.fn(planKnowledgeEnrichment),
      retrieveSupportKnowledge: vi.fn(retrieveSupportKnowledge),
      synthesizeRetrievedKnowledge: vi.fn(synthesizeRetrievedKnowledge),
      buildSupportPatches: vi.fn(buildSupportPatchesV2)
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
          route: "retrieve_knowledge"
        })
      }),
      expect.objectContaining({
        proposalId: proposals[1].proposalId,
        plan: expect.objectContaining({
          route: "no_retrieval"
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
      output.patches.analysisPatch.turnUnderstandingDelta.segments_topic
    ).toEqual(expect.arrayContaining([
      expect.objectContaining({
        matched_historical_topic: "no",
        linkedKnowledgeIds: [
          "android_push_notification_not_received"
        ]
      }),
      expect.objectContaining({
        matched_historical_topic: "no",
        topic_category: "billing"
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
        relevantFacts: expect.arrayContaining([
          expect.stringContaining(
            "Android 13+ requires runtime notification permission"
          )
        ]),
        doNotClaim: expect.arrayContaining([
          "Do not say that the issue is fixed."
        ])
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
      topics: [
        {
          topicId: 1,
          relevantFacts: ["Access fact"],
          sourceReferences: ["access_doc"]
        }
      ]
    };
    const secondSynthesis = {
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
      route: "retrieve_knowledge",
      retrievalRequests: [
        {
          topicId: 1,
          query: "access error"
        },
        {
          topicId: 1,
          query: "password reset"
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
    expect(steps.renderSupportResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        topicResponsePlans: []
      })
    );
    expect(output.topicResponsePlans).toEqual([]);
    expect(output).not.toHaveProperty("responsePlan");
  });

  it("passes support response plans and empty standard fragments to the renderer on support-only turns", async function () {
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

    expect(steps.renderSupportResponse).toHaveBeenCalledWith(expect.objectContaining({
      topicResponsePlans: [expectedTopicResponsePlan],
      standardResponseFragments: [],
      channel: input.latestUserMessage.channel
    }));
  });

  it("passes support response plans and standard fragments together to the renderer", async function () {
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
    expect(steps.renderSupportResponse).toHaveBeenCalledWith(expect.objectContaining({
      topicResponsePlans: [expectedTopicResponsePlan],
      standardResponseFragments: [standardFragment],
      channel: input.latestUserMessage.channel
    }));
  });

  it("renders multiple standard fragments with one renderer call", async function () {
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

    expect(steps.renderSupportResponse).toHaveBeenCalledTimes(1);
    expect(steps.renderSupportResponse).toHaveBeenCalledWith(expect.objectContaining({
      standardResponseFragments: fragments,
      topicResponsePlans: [],
      channel: input.latestUserMessage.channel
    }));
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
      "src/support-processing-pipeline/v2/runSupportProcessingPipelineV2.ts",
      "src/support-processing-pipeline/v2/typesSupportProcessingPipelineV2.types.ts",
      "tests/support-processing-pipeline/v2/runSupportProcessingPipelineV2.test.ts",
      "docs/support-processing-pipeline/supportProcessingPipelineV2.md"
    ];

    for (const relativePath of filesToCheck) {
      const content = readFileSync(join(root, relativePath), "utf8");

      expect(content).not.toContain(removedAccumulatorName);
      expect(content).not.toContain(removedAccumulatorType);
    }
  });

  it("includes a multi-topic dataset case and exposes per-topic debug plan ids", function () {
    const root = process.cwd();
    const datasetSource = readFileSync(
      join(
        root,
        "scripts/support-processing-pipeline/v2/textAnalysisDataset.ts"
      ),
      "utf8"
    );
    const runnerSource = readFileSync(
      join(
        root,
        "scripts/support-processing-pipeline/v2/runTextAnalysisDataset.ts"
      ),
      "utf8"
    );

    expect(datasetSource).toContain('id: "multi-topic-access-billing"');
    expect(datasetSource).toContain(
      "Mon compte est toujours bloqué. Et j’ai aussi reçu ma facture deux fois."
    );
    expect(runnerSource).toContain("topicCatalogSelections");
    expect(runnerSource).toContain("topicResponsePlan?:");
    expect(runnerSource).toContain("buildTopicResponsePlanDebug");
    expect(runnerSource).toContain("retrievedChunkCount");
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
      { step: "planKnowledgeEnrichment", status: "skipped" },
      { step: "selectCatalogKnowledgeForTopic", status: "skipped" },
      { step: "retrieveSupportKnowledge", status: "skipped" },
      { step: "synthesizeRetrievedKnowledge", status: "skipped" },
      { step: "planSupportResponse", status: "skipped" },
      { step: "renderSupportResponse", status: "started" },
      { step: "renderSupportResponse", status: "completed" },
      { step: "buildUserResponse", status: "started" },
      { step: "buildUserResponse", status: "completed" },
      { step: "buildSupportPatches", status: "started" },
      { step: "buildSupportPatches", status: "completed" }
    ]);
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
      step: "renderSupportResponse",
      status: "completed"
    });
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
      patches
    });
  });
});
