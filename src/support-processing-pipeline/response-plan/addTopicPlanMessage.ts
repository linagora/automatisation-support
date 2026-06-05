import { addTopicMainResponse } from "./addTopicMainResponse";
import type {
  TopicMainResponse,
  TopicNextStep,
  TopicPlanInput,
  TopicPlanMessage
} from "./typesResponsePlan.types";

function resolveNextStep(mainResponse: TopicMainResponse): TopicNextStep {
  if (mainResponse.type === "ask_fields") {
    return "wait_more_info";
  }

  if (mainResponse.type === "propose_solution") {
    return "wait_apply_solution";
  }

  return "wait_for_support";
}

function findHistoricalTopic(
  topicPlanInput: TopicPlanInput,
  idTopic: number
): TopicPlanInput["supportTopicKnowledge"]["segments_topic"][number] | undefined {
  return topicPlanInput.supportTopicKnowledge.segments_topic.find((topic) => {
    return topic.id_topic === idTopic;
  });
}

function addTopicPlanMessage(
  topicPlanInput: TopicPlanInput
): TopicPlanMessage[] {
  const {
    turnUnderstandingDelta,
    possibleSolutions,
    decisionSearchingSolution
  } = topicPlanInput;
  const topicSegments = turnUnderstandingDelta.segments_topic;

  if (topicSegments.length === 0) {
    return [];
  }

  const topicPlanMessage: TopicPlanMessage = {
    politeness_opening: "salutation_and_understanding_1",
    topic_relation_acknowledgement: {
      no_matched_historical_topic_count: topicSegments.filter((topicSegment) => {
        return topicSegment.matched_historical_topic === "no";
      }).length,
      matched_historical_topic_count: topicSegments.filter((topicSegment) => {
        return topicSegment.matched_historical_topic === "yes";
      }).length
    },
    ...(turnUnderstandingDelta.attachments
      ? { attachments: turnUnderstandingDelta.attachments }
      : {}),
    topics_responses: [],
    politeness_closure: "thanks_for_cooperation1"
  };

  for (const topicSegment of topicSegments) {
    const historicalTopic =
      topicSegment.matched_historical_topic === "yes"
        ? findHistoricalTopic(topicPlanInput, topicSegment.id_topic)
        : undefined;
    const topicTitleSource = historicalTopic ?? topicSegment;
    const topicDisplaySource = {
      topic_label: topicSegment.topic_label ?? topicTitleSource.topic_label,
      tool_or_product: topicSegment.tool_or_product ??
        topicTitleSource.tool_or_product,
      topic_action: topicSegment.topic_action ?? topicTitleSource.topic_action,
      topic_object: topicSegment.topic_object ?? topicTitleSource.topic_object
    };

    const mainResponse = addTopicMainResponse({
      topicSegment,
      possibleSolutions,
      decisionSearchingSolution
    });
    const topicDecision = decisionSearchingSolution.topics.find((decision) => {
      return decision.topic_id === topicSegment.id_topic;
    });

    const topicResponse: TopicPlanMessage["topics_responses"][number]["topic_response"] = {
      title: {
        topic_id: topicSegment.id_topic,
        topic_category: topicSegment.topic_category ??
          topicTitleSource.topic_category,
        ...(topicDisplaySource.tool_or_product
          ? { tool_or_product: topicDisplaySource.tool_or_product }
          : {}),
        ...(topicDisplaySource.topic_action
          ? { topic_action: topicDisplaySource.topic_action }
          : {}),
        ...(topicDisplaySource.topic_object
          ? { topic_object: topicDisplaySource.topic_object }
          : {}),
        matched_historical_topic: topicSegment.matched_historical_topic === "yes"
      },
      updated_fields_acknowledgement: {
        topic_details: topicSegment.topic_details,
        tested_solutions: topicSegment.tested_solutions
      },
      ...(topicDecision?.optional_evidence_requested
        ? {
            optional_evidence_requested:
              topicDecision.optional_evidence_requested
          }
        : {}),
      main_response: mainResponse,
      next_step: resolveNextStep(mainResponse)
    };

    topicPlanMessage.topics_responses.push({
      topic_response: topicResponse
    });
  }

  return [topicPlanMessage];
}

export { addTopicPlanMessage };
