import type { ResponsePlan } from "../response-plan/typesResponsePlan.types";
import type {
  DataBaseResponse,
  ResponseLanguage
} from "./dataBaseResponse";

type StringResponsePlan = {
  securityGate: string[];
  suspicious: string[];
  lackComprehension: string[];
  scopeBoundary: string[];
  topic: string[];
  signal: string[];
  handover: string[];
};

function resolveTemplateLanguage(
  responseLanguage: string,
  dataBaseResponse: DataBaseResponse
): ResponseLanguage {
  if (responseLanguage === "french" || responseLanguage === "english") {
    return responseLanguage;
  }

  if (responseLanguage in dataBaseResponse) {
    return responseLanguage as ResponseLanguage;
  }

  return "english";
}

function transformPlanToStringPlan(
  responsePlan: ResponsePlan,
  dataBaseResponse: DataBaseResponse
): StringResponsePlan {
  const templates =
    dataBaseResponse[
      resolveTemplateLanguage(responsePlan.responseLanguage, dataBaseResponse)
    ];

  const { messagesPlan } = responsePlan;

  const stringResponsePlan: StringResponsePlan = {
    securityGate: [],
    suspicious: [],
    lackComprehension: [],
    scopeBoundary: [],
    topic: [],
    signal: [],
    handover: []
  };

  if (messagesPlan.securityGatePlanMessage !== undefined) {
    stringResponsePlan.securityGate.push(templates.securityGate);
  }

  if (messagesPlan.suspiciousPlanMessage !== undefined) {
    stringResponsePlan.suspicious.push(templates.suspicious);
  }

  if (messagesPlan.lackComprehensionPlanMessage !== undefined) {
    stringResponsePlan.lackComprehension.push(templates.lackComprehension);
  }

  stringResponsePlan.scopeBoundary.push(
    ...messagesPlan.scopeBoundaryPlanMessages.map(() => {
      return templates.scopeBoundary;
    })
  );

  for (const topicPlanMessage of messagesPlan.topicPlanMessages) {
    for (const topicResponse of topicPlanMessage.topics_responses) {
      const mainResponse = topicResponse.topic_response.main_response;

      if (mainResponse.type === "ask_fields") {
        stringResponsePlan.topic.push(templates.topic.askFields);
      } else if (mainResponse.type === "propose_solution") {
        stringResponsePlan.topic.push(templates.topic.proposeSolution);
      } else {
        stringResponsePlan.topic.push(templates.topic.acknowledgement);
      }
    }
  }

  stringResponsePlan.signal.push(
    ...messagesPlan.signalPlanMessages.map(() => {
      return templates.signal;
    })
  );

  stringResponsePlan.handover.push(
    ...messagesPlan.handoverPlanMessages.map(() => {
      return templates.handover;
    })
  );

  return stringResponsePlan;
}

export { transformPlanToStringPlan };
export type { StringResponsePlan };
