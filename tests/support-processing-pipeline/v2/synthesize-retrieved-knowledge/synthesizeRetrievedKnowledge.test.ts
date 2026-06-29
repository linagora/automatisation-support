import { describe, expect, it } from "vitest";

import {
  synthesizeRetrievedKnowledge
} from "../../../../src/support-processing-pipeline/v2/synthesize-retrieved-knowledge/synthesizeRetrievedKnowledge";
import {
  JsonKnowledgeRepository
} from "../../../../src/repositories/json/jsonKnowledgeRepository";
import type {
  KnowledgeEnrichmentPlan
} from "../../../../src/support-processing-pipeline/v2/typesSupportProcessingPipelineV2.types";

describe("synthesizeRetrievedKnowledge", function () {
  it("produces concise planner knowledge from retrieved Android knowledge", async function () {
    const item = await new JsonKnowledgeRepository().findById(
      "android_push_notification_not_received"
    );

    expect(item).toBeDefined();

    const plan: KnowledgeEnrichmentPlan = {
      route: "retrieve_knowledge" as const,
      retrievalRequests: [
        {
          topicId: "topic_1",
          searchPurpose: "support_answer_and_qualification" as const,
          queryText: "Support issue: android notification.",
          desiredKnowledge: ["known_behavior"],
          context: {
            topicSummary: "Android notification",
            knownDetails: [],
            attemptedActions: []
          }
        }
      ],
      reason: "rag_enabled_for_bug_topics"
    };
    const synthesis = synthesizeRetrievedKnowledge({
      knowledgeEnrichmentPlan: plan,
      topicKnowledgeEnrichmentPlan: plan,
      knowledgeChunks: [
        {
          topicId: "topic_1",
          sourceId: item!.knowledgeId,
          content: JSON.stringify(item),
          score: 10
        }
      ],
      topicEvidence: {
        proposalId: "proposal_1",
        topicId: null,
        topicSourceVerbatims: ["Notifications missing on Android."],
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
    });

    expect(synthesis.relevantFacts).toEqual(expect.arrayContaining([
      expect.stringContaining("Android 13+ requires runtime notification permission")
    ]));
    expect(synthesis.applicableInstructions).toEqual(expect.arrayContaining([
      expect.stringContaining("notification channel")
    ]));
    expect(synthesis.recommendedFirstAnswer).toContain(
      "notifications are enabled for the app"
    );
    expect(synthesis.doNotClaim).toEqual(expect.arrayContaining([
      "Do not say that the issue is fixed.",
      "Do not promise a resolution timeline."
    ]));
  });

  it("accepts generic non-json text chunks", function () {
    const plan: KnowledgeEnrichmentPlan = {
      route: "retrieve_knowledge" as const,
      retrievalRequests: [
        {
          topicId: "topic_text",
          searchPurpose: "support_answer_and_qualification" as const,
          queryText: "Support issue: sign-in error.",
          desiredKnowledge: ["known_behavior"],
          context: {
            topicSummary: "Sign-in error",
            knownDetails: [],
            attemptedActions: []
          }
        }
      ],
      reason: "rag_enabled_for_access_security_topics"
    };
    const synthesis = synthesizeRetrievedKnowledge({
      knowledgeEnrichmentPlan: plan,
      topicKnowledgeEnrichmentPlan: plan,
      knowledgeChunks: [
        {
          topicId: "topic_text",
          sourceId: "rag_chunk_1",
          content: "Known issue: some sign-in errors require password reset verification.",
          score: 0.75
        }
      ],
      topicEvidence: {
        proposalId: "proposal_1",
        topicId: "topic_text",
        topicSourceVerbatims: ["Sign-in error."],
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
    });

    expect(synthesis.relevantFacts).toEqual([
      "Known issue: some sign-in errors require password reset verification."
    ]);
    expect(synthesis.sourceReferences).toEqual(["rag_chunk_1"]);
  });

  it("keeps facts empty and records a limitation when retrieval failed", function () {
    const plan: KnowledgeEnrichmentPlan = {
      route: "retrieve_knowledge" as const,
      retrievalRequests: [
        {
          topicId: "topic_timeout",
          searchPurpose: "support_answer_and_qualification" as const,
          queryText: "Support issue: timeout.",
          desiredKnowledge: ["known_behavior"],
          context: {
            topicSummary: "Timeout",
            knownDetails: [],
            attemptedActions: []
          }
        }
      ],
      reason: "rag_enabled_for_bug_topics"
    };
    const synthesis = synthesizeRetrievedKnowledge({
      knowledgeEnrichmentPlan: plan,
      topicKnowledgeEnrichmentPlan: plan,
      knowledgeChunks: [],
      knowledgeRetrievalFailureReason: "abort_error",
      topicEvidence: {
        proposalId: "proposal_timeout",
        topicId: "topic_timeout",
        topicSourceVerbatims: ["Timeout."],
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
    });

    expect(synthesis.relevantFacts).toEqual([]);
    expect(synthesis.sourceReferences).toEqual([]);
    expect(synthesis.limitations).toEqual([
      "Knowledge retrieval failed or timed out for this topic."
    ]);
    expect(synthesis.topics[0]).toMatchObject({
      topicId: "topic_timeout",
      relevantFacts: [],
      sourceReferences: []
    });
  });
});
