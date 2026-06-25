import { describe, expect, it } from "vitest";

import {
  synthesizeRetrievedKnowledge
} from "../../../../src/support-processing-pipeline/v2/synthesize-retrieved-knowledge/synthesizeRetrievedKnowledge";
import {
  JsonKnowledgeRepository
} from "../../../../src/repositories/json/jsonKnowledgeRepository";

describe("synthesizeRetrievedKnowledge", function () {
  it("produces concise planner knowledge from retrieved Android knowledge", async function () {
    const item = await new JsonKnowledgeRepository().findById(
      "android_push_notification_not_received"
    );

    expect(item).toBeDefined();

    const plan = {
      route: "retrieve_knowledge" as const,
      retrievalRequests: [
        {
          topicId: 0,
          query: "android notification"
        }
      ]
    };
    const synthesis = synthesizeRetrievedKnowledge({
      knowledgeEnrichmentPlan: plan,
      topicKnowledgeEnrichmentPlan: plan,
      knowledgeChunks: [
        {
          topicId: 0,
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
});
