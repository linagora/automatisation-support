import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  runSupportProcessingPipelineV2
} from "../../../src/support-processing-pipeline/v2/runSupportProcessingPipelineV2";

import type {
  AttachmentSurfaceAnalysis,
  AttachmentUnderstanding,
  KnowledgeChunk,
  KnowledgeEnrichmentPlan,
  Patches,
  PromptSecuritySignals,
  ResponsePlanV2,
  StandardResponseFragment,
  SupportProcessingPipelineV2Input,
  SupportProcessingProgressEvent,
  SupportProcessingPipelineV2Steps,
  SupportUnderstandingV2,
  TextSurfaceAnalysis,
  TextUnderstanding,
  TopicUpdateProposal,
  UserResponse
} from "../../../src/support-processing-pipeline/v2/typesSupportProcessingPipelineV2.types";

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
    sourceSegmentId: "seg_support",
    sourceVerbatims: ["Login issue"],
    summary: "Login issue",
    primaryUserExpectation: "wants_solution",
    supportNeeds: ["possible_account_or_access_action"],
    broadCategoryHint: "access_security",
    contextDependency: "standalone_but_may_match_existing",
    facts: [],
    testedActions: [],
    uncertainties: []
  }
];

const attachmentUnderstandings: AttachmentUnderstanding[] = [
  {
    attachmentIndex: 1,
    status: "analyzed",
    summary: "Screenshot of login error"
  }
];

const topicUpdateProposal: TopicUpdateProposal = {
  topicUpdates: [
    {
      action: "create",
      sourceSegmentIds: ["seg_support"],
      sourceAttachmentIndexes: []
    }
  ],
  deferredItems: []
};

const supportUnderstanding: SupportUnderstandingV2 = {
  topics: [
    {
      topicId: 1
    }
  ],
  unresolvedItems: [],
  appliedTopicUpdates: topicUpdateProposal.topicUpdates
};

const noRagPlan: KnowledgeEnrichmentPlan = {
  route: "use_generic_fields"
};

const ragPlan: KnowledgeEnrichmentPlan = {
  route: "retrieve_knowledge",
  retrievalRequests: [
    {
      topicId: 1,
      query: "login issue"
    }
  ]
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
  topicPlans: [
    {
      topicId: "topic_1"
    }
  ]
};

const supportResponse: UserResponse["messages"] = [
  {
    type: "topic_response",
    content: "Voici quoi faire."
  }
];

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
    analyzeSupportText: vi.fn(async () => textUnderstandings),
    analyzeSupportAttachments: vi.fn(async () => attachmentUnderstandings),
    proposeTopicUpdates: vi.fn(async () => topicUpdateProposal),
    applyTopicUpdates: vi.fn(async () => supportUnderstanding),
    planKnowledgeEnrichment: vi.fn(async () => noRagPlan),
    retrieveSupportKnowledge: vi.fn(async () => knowledgeChunks),
    synthesizeRetrievedKnowledge: vi.fn(
      async () => retrievedKnowledgeSynthesis
    ),
    planSupportResponse: vi.fn(async () => responsePlan),
    renderSupportResponse: vi.fn(async () => supportResponse),
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
    expect(steps.renderSupportResponse).toHaveBeenCalledWith({
      standardResponseFragments: [standardFragment],
      accountProfile: input.accountProfile,
      channel: input.latestUserMessage.channel
    });
    expect(steps.buildUserResponse).toHaveBeenCalledWith({
      supportResponse
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
    expect(steps.renderSupportResponse).toHaveBeenCalledWith({
      standardResponseFragments: [],
      textSurfaceAnalysis: standardOnlyTextSurface,
      accountProfile: input.accountProfile,
      channel: input.latestUserMessage.channel
    });
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

    await runSupportProcessingPipelineV2(buildInput(), steps);

    expect(steps.analyzeSupportText).toHaveBeenCalled();
    expect(steps.analyzeSupportAttachments).not.toHaveBeenCalled();
    expect(steps.renderSupportResponse).toHaveBeenCalledWith({
      responsePlan,
      standardResponseFragments: [],
      textSurfaceAnalysis: supportTextSurface,
      accountProfile: buildInput().accountProfile,
      channel: buildInput().latestUserMessage.channel
    });
    expect(steps.proposeTopicUpdates).toHaveBeenCalledWith({
      textUnderstandings,
      attachmentUnderstandings: [],
      supportTopicKnowledge: buildInput().supportTopicKnowledge,
      conversationHistory: buildInput().conversationHistory
    });
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
      attachmentUnderstandings,
      supportTopicKnowledge: buildInput().supportTopicKnowledge,
      conversationHistory: buildInput().conversationHistory
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

  it("retrieves and synthesizes knowledge on the RAG branch", async function () {
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

    expect(steps.retrieveSupportKnowledge).toHaveBeenCalledWith({
      knowledgeEnrichmentPlan: ragPlan
    });
    expect(steps.synthesizeRetrievedKnowledge).toHaveBeenCalledWith({
      supportUnderstanding,
      knowledgeEnrichmentPlan: ragPlan,
      knowledgeChunks
    });
    expect(steps.planSupportResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        retrievedKnowledgeSynthesis
      })
    );
    expect(steps.planSupportResponse).toHaveBeenCalledWith(
      expect.not.objectContaining({
        standardResponseFragments: expect.anything()
      })
    );
  });

  it("uses generic field knowledge without RAG on the non-RAG branch", async function () {
    const steps = buildSteps({
      planTurnAnalysis: vi.fn(async () => ({
        analyzeText: true,
        analyzeAttachments: false,
        matchedPatternIds: []
      })),
      analyzeTextSurface: vi.fn(async () => supportTextSurface),
      planKnowledgeEnrichment: vi.fn(async () => noRagPlan)
    });

    await runSupportProcessingPipelineV2(buildInput(), steps);

    expect(steps.retrieveSupportKnowledge).not.toHaveBeenCalled();
    expect(steps.synthesizeRetrievedKnowledge).not.toHaveBeenCalled();
    expect(steps.planSupportResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        genericFieldKnowledge: {}
      })
    );
    expect(steps.planSupportResponse).toHaveBeenCalledWith(
      expect.not.objectContaining({
        standardResponseFragments: expect.anything()
      })
    );
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

    expect(steps.renderSupportResponse).toHaveBeenCalledWith({
      responsePlan,
      standardResponseFragments: [],
      textSurfaceAnalysis: supportTextSurface,
      accountProfile: input.accountProfile,
      channel: input.latestUserMessage.channel
    });
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
    expect(steps.renderSupportResponse).toHaveBeenCalledWith({
      responsePlan,
      standardResponseFragments: [standardFragment],
      textSurfaceAnalysis: supportAndSmallTalkTextSurface,
      accountProfile: input.accountProfile,
      channel: input.latestUserMessage.channel
    });
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
    expect(steps.renderSupportResponse).toHaveBeenCalledWith({
      standardResponseFragments: fragments,
      accountProfile: input.accountProfile,
      channel: input.latestUserMessage.channel
    });
  });

  it("does not send standard fragments directly to buildUserResponse", async function () {
    const steps = buildSteps({
      buildStandardResponseFragments: vi.fn(async () => [standardFragment])
    });

    await runSupportProcessingPipelineV2(buildInput(), steps);

    expect(steps.buildUserResponse).toHaveBeenCalledWith({
      supportResponse
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
      supportResponse
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

  it("reports progress for deep analysis with RAG", async function () {
    const progressEvents: SupportProcessingProgressEvent[] = [];
    const steps = buildSteps({
      planTurnAnalysis: vi.fn(async () => ({
        analyzeText: true,
        analyzeAttachments: false,
        matchedPatternIds: []
      })),
      analyzeTextSurface: vi.fn(async () => supportTextSurface),
      planKnowledgeEnrichment: vi.fn(async () => ragPlan)
    });

    await runSupportProcessingPipelineV2(buildInput(), steps, {
      reportProgress: (event) => {
        progressEvents.push(event);
      }
    });

    expect(progressEvents).toContainEqual({
      step: "retrieveSupportKnowledge",
      status: "started"
    });
    expect(progressEvents).toContainEqual({
      step: "retrieveSupportKnowledge",
      status: "completed"
    });
    expect(progressEvents).toContainEqual({
      step: "synthesizeRetrievedKnowledge",
      status: "started"
    });
    expect(progressEvents).toContainEqual({
      step: "synthesizeRetrievedKnowledge",
      status: "completed"
    });
    expect(progressEvents).not.toContainEqual({
      step: "retrieveSupportKnowledge",
      status: "skipped"
    });
    expect(progressEvents).not.toContainEqual({
      step: "synthesizeRetrievedKnowledge",
      status: "skipped"
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
