import type {
  LiveMemoryContext
} from "../../infrastructure/live-memory/typesLiveMemoryContext.types";
import type {
  SupportTopicContextV2
} from "../support-processing-pipeline-v2-LEGACY/topic-context/typesSupportTopicContextV2.types";

function convertLiveMemoryContextToSupportTopicContextV2(
  liveMemoryContext: LiveMemoryContext
): SupportTopicContextV2 {
  return {
    topics: liveMemoryContext.topics.map((topic) => ({
      topicId: topic.topicId,
      title: topic.title,
      broadCategoryHint: topic.broadCategoryHint,
      summary: topic.summary,
      caseDetails: topic.caseDetails,
      attemptedActions: topic.attemptedActions,
      supportKnowledgeSummary: topic.supportKnowledgeSummary ?? null,
      ...(topic.unansweredRequestedFieldNames &&
      topic.unansweredRequestedFieldNames.length > 0
        ? {
            unansweredRequestedFieldNames:
              topic.unansweredRequestedFieldNames
          }
        : {})
    }))
  };
}

export {
  convertLiveMemoryContextToSupportTopicContextV2
};
