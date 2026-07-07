import { describe, expect, it, vi } from "vitest";

import {
  synthesizeRetrievedKnowledge
} from "../../../../src/support-automation/support-processing-pipeline-v2/synthesize-retrieved-knowledge/synthesizeRetrievedKnowledge";

import type {
  KnowledgeEnrichmentPlan,
  SynthesizeRetrievedKnowledgeInput
} from "../../../../src/support-automation/support-processing-pipeline-v2/typesSupportProcessingPipelineV2.types";
import type {
  RawSynthesizeRetrievedKnowledge,
  SynthesizeRetrievedKnowledgeRequester
} from "../../../../src/support-automation/support-processing-pipeline-v2/synthesize-retrieved-knowledge/typesSynthesizeRetrievedKnowledge.types";

function knowledgePlan(topicId: number): KnowledgeEnrichmentPlan {
  return {
    route: "rag_only",
    retrievalRequests: [
      {
        topicId,
        searchPurpose: "support_answer_and_qualification",
        queryText: "Support issue: notifications.",
        desiredKnowledge: ["customer_facing_information"],
        context: {
          topicSummary: "Notification issue",
          knownDetails: [],
          attemptedActions: []
        }
      }
    ],
    reason: "rag_enabled_for_bug_topics"
  };
}

function synthesisInput(params: {
  topicId?: number;
  content: string;
  sourceId?: string;
  metadata?: Record<string, unknown>;
  knowledgeRetrievalFailureReason?: string;
}): SynthesizeRetrievedKnowledgeInput {
  const topicId = params.topicId ?? 1;
  const plan = knowledgePlan(topicId);

  return {
    knowledgeEnrichmentPlan: plan,
    topicKnowledgeEnrichmentPlan: plan,
    knowledgeChunks: [
      {
        topicId,
        sourceId: params.sourceId ?? "rag_notifications",
        content: params.content,
        score: 0.9,
        metadata: params.metadata
      }
    ],
    knowledgeRetrievalFailureReason: params.knowledgeRetrievalFailureReason,
    topicEvidence: {
      proposalId: "proposal_1",
      topicId,
      topicSourceVerbatims: ["Notifications are missing on Android."],
      relatedUnderstandingIds: [],
      relatedTextUnderstandings: [],
      relatedAttachmentUnderstandings: [],
      relatedSupportResponseCues: []
    },
    selectedCatalogKnowledge: {
      selectedFields: [],
      selectedGenericKnowledge: [],
      scopeReason: "test",
      rejectedFieldNames: []
    }
  };
}

function completed(
  parsedResponse: Record<string, unknown>
): SynthesizeRetrievedKnowledgeRequester {
  return async (): Promise<RawSynthesizeRetrievedKnowledge> => {
    return {
      status: "completed",
      parsedResponse,
      rawResponse: JSON.stringify(parsedResponse)
    };
  };
}

describe("synthesizeRetrievedKnowledge", function () {
  it("keeps sourceCount 0 chunks out of facts and does not call the LLM", async function () {
    const requester = vi.fn<SynthesizeRetrievedKnowledgeRequester>();
    const synthesis = await synthesizeRetrievedKnowledge(
      synthesisInput({
        sourceId: "openrag_0",
        content: "No relevant information was found.",
        metadata: {
          sourceCount: 0,
          sources: []
        }
      }),
      requester
    );

    expect(requester).not.toHaveBeenCalled();
    expect(synthesis.relevantFacts).toEqual([]);
    expect(synthesis.applicableInstructions).toEqual([]);
    expect(synthesis.sourceReferences).toEqual([]);
    expect(synthesis.retrievedChunkCount).toBe(0);
    expect(synthesis.supportKnowledgeSummary).toEqual({
      summary:
        "Support knowledge lookup returned no usable customer-facing knowledge for this topic.",
      customerFacing: null,
      supportFacing: null
    });
    expect(synthesis.limitations).toContain(
      "No usable customer-facing knowledge found for this topic."
    );
  });

  it("rejects off-topic chunks returned by retrieval", async function () {
    const synthesis = await synthesizeRetrievedKnowledge(
      synthesisInput({
        sourceId: "rag_wrong_product",
        content: "Desktop calendar sync steps for another product."
      }),
      completed({
        relevantFacts: [],
        applicableInstructions: [],
        possibleFields: [],
        unresolvedPoints: [],
        sourceReferences: [],
        limitations: ["Retrieved chunk is off-topic for this support topic."],
        doNotClaim: [],
        internalNotes: ["Rejected rag_wrong_product as off-topic."],
        retrievedChunkCount: 0
      })
    );

    expect(synthesis.relevantFacts).toEqual([]);
    expect(synthesis.sourceReferences).toEqual([]);
    expect(synthesis.retrievedChunkCount).toBe(0);
    expect(synthesis.internalNotes).toEqual([
      "Rejected rag_wrong_product as off-topic."
    ]);
    expect(synthesis.supportKnowledgeSummary).toEqual({
      summary:
        "Support knowledge lookup returned support-facing context but no verified customer-facing knowledge.",
      customerFacing: null,
      supportFacing:
        "Rejected rag_wrong_product as off-topic.\nRetrieved chunk is off-topic for this support topic."
    });
  });

  it("keeps internal-only technical knowledge out of relevantFacts", async function () {
    const synthesis = await synthesizeRetrievedKnowledge(
      synthesisInput({
        sourceId: "rag_internal",
        content:
          "Support/dev note: inspect backend debug logs and deployment configuration."
      }),
      completed({
        relevantFacts: [],
        applicableInstructions: [],
        possibleFields: [],
        unresolvedPoints: [],
        sourceReferences: [],
        limitations: ["Knowledge is internal-only."],
        doNotClaim: [],
        internalNotes: [
          "Support/dev note: inspect backend debug logs and deployment configuration."
        ],
        retrievedChunkCount: 0
      })
    );

    expect(synthesis.relevantFacts).toEqual([]);
    expect(synthesis.applicableInstructions).toEqual([]);
    expect(synthesis.internalNotes).toEqual([
      "Support/dev note: inspect backend debug logs and deployment configuration."
    ]);
    expect(synthesis.retrievedChunkCount).toBe(0);
    expect(synthesis.supportKnowledgeSummary).toEqual({
      summary:
        "Support knowledge lookup returned support-facing context but no verified customer-facing knowledge.",
      customerFacing: null,
      supportFacing:
        "Support/dev note: inspect backend debug logs and deployment configuration.\nKnowledge is internal-only."
    });
  });

  it("keeps only customer-facing information from mixed chunks", async function () {
    const synthesis = await synthesizeRetrievedKnowledge(
      synthesisInput({
        sourceId: "rag_mixed",
        content:
          "Users can verify that app notifications are enabled. Support should inspect backend logs."
      }),
      completed({
        relevantFacts: [
          "Users can verify that app notifications are enabled."
        ],
        applicableInstructions: [
          "Ask whether notifications are enabled for the app."
        ],
        possibleFields: ["notification_permission_status"],
        unresolvedPoints: ["Whether notifications are enabled."],
        sourceReferences: ["rag_mixed"],
        limitations: [],
        doNotClaim: ["Do not say the issue is fixed."],
        internalNotes: ["Support should inspect backend logs."],
        retrievedChunkCount: 1
      })
    );

    expect(synthesis.relevantFacts).toEqual([
      "Users can verify that app notifications are enabled."
    ]);
    expect(synthesis.applicableInstructions).toEqual([
      "Ask whether notifications are enabled for the app."
    ]);
    expect(synthesis.sourceReferences).toEqual(["rag_mixed"]);
    expect(synthesis.retrievedChunkCount).toBe(1);
    expect(synthesis.supportKnowledgeSummary).toEqual({
      summary:
        "Support knowledge lookup returned useful customer-facing knowledge for this topic.",
      customerFacing:
        "Users can verify that app notifications are enabled.\nAsk whether notifications are enabled for the app.\nCustomer-answerable field: notification_permission_status\nWhether notifications are enabled.",
      supportFacing:
        "Support should inspect backend logs.\nDo not say the issue is fixed."
    });
    expect(synthesis.internalNotes).toEqual([
      "Support should inspect backend logs."
    ]);
  });

  it("falls back safely when the LLM sanitizer fails", async function () {
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
    const requester: SynthesizeRetrievedKnowledgeRequester = async () => {
      return {
        status: "failed",
        error: {
          message: "llm_unavailable"
        }
      };
    };

    const synthesis = await synthesizeRetrievedKnowledge(
      synthesisInput({
        content: "Potentially useful notification knowledge."
      }),
      requester
    );

    expect(synthesis.relevantFacts).toEqual([]);
    expect(synthesis.sourceReferences).toEqual([]);
    expect(synthesis.retrievedChunkCount).toBe(0);
    expect(synthesis.limitations).toContain("llm_unavailable");
    expect(synthesis.supportKnowledgeSummary).toEqual({
      summary:
        "Support knowledge lookup returned no usable customer-facing knowledge for this topic.",
      customerFacing: null,
      supportFacing: null
    });
    expect(debug).toHaveBeenCalledWith(
      "support.v2.synthesize_retrieved_knowledge.failed",
      { reason: "llm_unavailable" }
    );

    debug.mockRestore();
  });

  it("guards against raw or rejected RAG becoming planner-facing facts", async function () {
    const synthesis = await synthesizeRetrievedKnowledge(
      synthesisInput({
        sourceId: "rag_raw",
        content:
          "Internal deployment runbook: change backend config."
      }),
      completed({
        relevantFacts: [
          "No relevant information found.",
          ""
        ],
        applicableInstructions: [],
        possibleFields: [],
        unresolvedPoints: [],
        sourceReferences: ["rag_raw", "unknown_source"],
        limitations: [],
        doNotClaim: [],
        internalNotes: ["Internal deployment runbook rejected."],
        retrievedChunkCount: 99
      })
    );

    expect(synthesis.relevantFacts).toEqual([]);
    expect(synthesis.sourceReferences).toEqual([]);
    expect(synthesis.retrievedChunkCount).toBe(0);
    expect(synthesis.internalNotes).toEqual([
      "Internal deployment runbook rejected."
    ]);
    expect(synthesis.supportKnowledgeSummary).toEqual({
      summary:
        "Support knowledge lookup returned support-facing context but no verified customer-facing knowledge.",
      customerFacing: null,
      supportFacing: "Internal deployment runbook rejected."
    });
  });

  it("marks retrieval failures with a stable support knowledge summary", async function () {
    const synthesis = await synthesizeRetrievedKnowledge(
      synthesisInput({
        content: "",
        knowledgeRetrievalFailureReason: "timeout"
      }),
      vi.fn<SynthesizeRetrievedKnowledgeRequester>()
    );

    expect(synthesis.supportKnowledgeSummary).toEqual({
      summary:
        "Support knowledge lookup failed or timed out. No usable customer-facing knowledge was found.",
      customerFacing: null,
      supportFacing: "Knowledge retrieval failed or timed out for this topic."
    });
  });
});
