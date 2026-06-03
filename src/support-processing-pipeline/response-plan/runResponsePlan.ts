import { addHandoverPlanMessage } from "./addHandoverPlanMessage";
import { addTopicPlanMessage } from "./addTopicPlanMessage";

import type {
  HandoverPlanInput,
  ResponsePlanInput,
  ResponsePlan,
  TopicPlanInput
} from "./typesResponsePlan.types";

function resolveResponseLanguage(userLanguage: string | null | undefined): string {
  if (userLanguage === "fr" || userLanguage === "french") {
    return "french";
  }

  if (userLanguage === "en" || userLanguage === "english") {
    return "english";
  }

  return "english";
}

function runResponsePlan(input: ResponsePlanInput): ResponsePlan {
  const {
    securityGateSummary,
    accountTrustStatus,
    accountProfile,
    accountInteractionTraits,
    supportTopicKnowledge,
    turnUnderstandingDelta,
    possibleSolutions,
    decisionSearchingSolution
  } = input;

  const responsePlan: ResponsePlan = {
    responseLanguage: resolveResponseLanguage(turnUnderstandingDelta.user_language),
    messagesPlan: {
      securityGatePlanMessage: undefined,
      suspiciousPlanMessage: undefined,
      lackComprehensionPlanMessage: undefined,
      scopeBoundaryPlanMessages: [],
      topicPlanMessages: [],
      signalPlanMessages: [],
      handoverPlanMessages: []
    }
  };

  if (securityGateSummary.gateFailed.length > 0) {
    responsePlan.messagesPlan.securityGatePlanMessage = {
      gateFailed: securityGateSummary.gateFailed
    };
  } else if (turnUnderstandingDelta.segments_suspicious.length > 0) {
    responsePlan.messagesPlan.suspiciousPlanMessage = {
      segments_suspicious: turnUnderstandingDelta.segments_suspicious
    };
  } else {
    if (turnUnderstandingDelta.segments_lack_comprehension.length > 0) {
      responsePlan.messagesPlan.lackComprehensionPlanMessage = {
        segments_lack_comprehension:
          turnUnderstandingDelta.segments_lack_comprehension
      };
    }

    responsePlan.messagesPlan.scopeBoundaryPlanMessages =
      turnUnderstandingDelta.segments_scope_boundary;

    const topicPlanInput: TopicPlanInput = {
      supportTopicKnowledge,
      turnUnderstandingDelta,
      possibleSolutions,
      decisionSearchingSolution
    };

    responsePlan.messagesPlan.topicPlanMessages =
      addTopicPlanMessage(topicPlanInput);

    responsePlan.messagesPlan.signalPlanMessages =
      turnUnderstandingDelta.segments_signal;
  }

  const handoverPlanInput: HandoverPlanInput = {
    turnUnderstandingDelta,
    responsePlan,
    securityGateSummary,
    accountTrustStatus,
    accountProfile,
    accountInteractionTraits
  };

  responsePlan.messagesPlan.handoverPlanMessages =
    addHandoverPlanMessage(handoverPlanInput);

  return responsePlan;
}

export {
  runResponsePlan,
  resolveResponseLanguage
};

export type {
  ResponsePlanInput,
  ResponsePlan
};
