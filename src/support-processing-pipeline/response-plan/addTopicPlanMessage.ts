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
    topics_responses: [],
    politeness_closure: "thanks_for_cooperation1"
  };

  for (const topicSegment of topicSegments) {
    const mainResponse = addTopicMainResponse({
      topicSegment,
      possibleSolutions,
      decisionSearchingSolution
    });

    const topicResponse: TopicPlanMessage["topics_responses"][number]["topic_response"] = {
      title: {
        topic_id: topicSegment.id_topic,
        topic_category: topicSegment.topic_category,
        topic_label: topicSegment.topic_label,
        matched_historical_topic: topicSegment.matched_historical_topic === "yes"
      },
      updated_fields_acknowledgement: {
        topic_details: topicSegment.topic_details,
        tested_solutions: topicSegment.tested_solutions
      },
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
