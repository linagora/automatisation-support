import type {
  DecisionSearchingSolutionForResponsePlan,
  TopicMainResponse,
  TopicSolution
} from "./typesResponsePlan.types";

type TopicMainResponseInput = {
  topicSegment: unknown;
  possibleSolutions: TopicSolution[];
  decisionSearchingSolution: DecisionSearchingSolutionForResponsePlan;
};

function addTopicMainResponse(
  topicMainResponseInput: TopicMainResponseInput
): TopicMainResponse {
  const { decisionSearchingSolution, possibleSolutions } =
    topicMainResponseInput;

  if (decisionSearchingSolution.type === "ask_more_info") {
    return {
      type: "ask_fields",
      details: {
        fields_requested: decisionSearchingSolution.missing_fields
      }
    };
  }

  if (decisionSearchingSolution.type === "acknowledgement") {
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
