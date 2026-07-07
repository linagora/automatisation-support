import type {
  DecisionSearchingSolutionForResponsePlan,
  TopicMainResponse,
  TopicSolution
} from "./typesResponsePlan.types";

type TopicMainResponseInput = {
  topicSegment: {
    id_topic?: unknown;
  };
  possibleSolutions: TopicSolution[];
  decisionSearchingSolution: DecisionSearchingSolutionForResponsePlan;
};

function isNonEmptyStringArray(value: unknown): value is [string, ...string[]] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => {
      return typeof item === "string";
    })
  );
}

function addTopicMainResponse(
  topicMainResponseInput: TopicMainResponseInput
): TopicMainResponse {
  const { topicSegment, decisionSearchingSolution, possibleSolutions } =
    topicMainResponseInput;
  const topicDecision = decisionSearchingSolution.topics.find((decision) => {
    return decision.topic_id === topicSegment.id_topic;
  });

  if (
    topicDecision?.type === "ask_more_info" &&
    isNonEmptyStringArray(topicDecision.missing_fields)
  ) {
    return {
      type: "ask_fields",
      details: {
        fields_requested: topicDecision.missing_fields
      }
    };
  }

  if (topicDecision?.type === "acknowledgement" || topicDecision === undefined) {
    return {
      type: "acknowledgement"
    };
  }

  const [firstSolution, ...otherSolutions] = possibleSolutions;

  if (firstSolution !== undefined) {
    return {
      type: "propose_solution",
      details: {
        solutions: [firstSolution, ...otherSolutions]
      }
    };
  }

  return {
    type: "acknowledgement"
  };
}

export { addTopicMainResponse };
