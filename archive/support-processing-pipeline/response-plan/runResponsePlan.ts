import { addHandoverPlanMessage } from "./addHandoverPlanMessage";
import {
  addTopicPlanMessage,
  buildQuestions,
  describeTopic
} from "./addTopicPlanMessage";

import type {
  HandoverPlanInput,
  QuotedPlanMessage,
  ResponsePlanInput,
  ResponsePlan,
  ResponseNextStepType,
  TopicPlanInput
} from "./typesResponsePlan.types";

const BOT_IDENTITY_RESPONSE = [
  "Je suis l’assistant du support. J’aide à qualifier votre demande pour que l’équipe humaine puisse vous répondre plus vite et avec les bonnes informations.",
  "",
  "Que puis-je faire pour vous ?"
].join("\n");

const POSITIVE_FEEDBACK_RESPONSE =
  "Merci pour votre retour, il sera transmis à l’équipe support.";
const MIXED_POSITIVE_FEEDBACK_RESPONSE =
  "Votre retour sera également transmis à l’équipe support.";

function resolveResponseLanguage(userLanguage: string | null | undefined): string {
  const normalizedLanguage = userLanguage?.toLowerCase();

  if (normalizedLanguage === "fr" || normalizedLanguage === "french") {
    return "french";
  }

  if (normalizedLanguage === "en" || normalizedLanguage === "english") {
    return "english";
  }

  return "english";
}

function segmentVerbatimFrom(value: unknown): string {
  if (typeof value !== "object" || value === null) {
    return "";
  }

  const record = value as Record<string, unknown>;
  const raw =
    record.segment_verbatim ??
    record.signal_verbatim ??
    record.message ??
    record.reason;

  return typeof raw === "string" ? raw.trim() : "";
}

function buildQuotedMessages(
  segments: unknown[],
  message: string
): QuotedPlanMessage[] {
  return segments.flatMap((segment) => {
    const segmentVerbatim = segmentVerbatimFrom(segment);

    return segmentVerbatim
      ? [{ segment_verbatim: segmentVerbatim, message }]
      : [];
  });
}

function getSignalTypes(signalSegments: unknown[]): string[] {
  return signalSegments.flatMap((signalSegment) => {
    if (typeof signalSegment !== "object" || signalSegment === null) {
      return [];
    }

    const signalTypes = (signalSegment as Record<string, unknown>).signal_types;

    return Array.isArray(signalTypes)
      ? signalTypes.filter((signalType): signalType is string => {
          return typeof signalType === "string";
        })
      : [];
  });
}

function buildSignalMessages(
  signalSegments: unknown[],
  hasTopicResponse: boolean
): string[] {
  const signalTypes = getSignalTypes(signalSegments);
  const messages: string[] = [];

  if (signalTypes.includes("bot_identity_question")) {
    messages.push(BOT_IDENTITY_RESPONSE);
  }

  if (
    signalTypes.includes("thanks_positive") ||
    signalTypes.includes("positive_feedback") ||
    signalTypes.includes("appreciation_positive")
  ) {
    messages.push(
      hasTopicResponse
        ? MIXED_POSITIVE_FEEDBACK_RESPONSE
        : POSITIVE_FEEDBACK_RESPONSE
    );
  }

  if (
    signalTypes.includes("negative_feedback") ||
    signalTypes.includes("disappointment") ||
    signalTypes.includes("churn_intent")
  ) {
    messages.push(
      "Votre retour est bien pris en compte. Le support peut reprendre la main si nécessaire."
    );
  }

  return messages;
}

function resolveNextStepType(params: {
  signalTypes: string[];
  handoverCount: number;
  hasQuestions: boolean;
  hasTopics: boolean;
}): ResponseNextStepType {
  if (
    params.signalTypes.includes("support_team_question") ||
    params.signalTypes.includes("concern_support_continuity")
  ) {
    return "no_automatic_answer";
  }

  if (params.handoverCount > 0) {
    return "human_support";
  }

  if (params.hasQuestions) {
    return "wait_user_info";
  }

  if (params.hasTopics) {
    return "human_support";
  }

  return "none";
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
      gateFailed: securityGateSummary.gateFailed,
      securityMessages: buildQuotedMessages(
        securityGateSummary.gateFailed,
        "Je ne peux pas fournir d’informations internes ou confidentielles"
      )
    };
    responsePlan.messagesPlan.securityMessages =
      responsePlan.messagesPlan.securityGatePlanMessage.securityMessages;

    return responsePlan;
  }

  if (turnUnderstandingDelta.segments_suspicious.length > 0) {
    responsePlan.messagesPlan.suspiciousPlanMessage = {
      segments_suspicious: turnUnderstandingDelta.segments_suspicious
    };
    responsePlan.messagesPlan.securityMessages = buildQuotedMessages(
      turnUnderstandingDelta.segments_suspicious,
      "Je ne peux pas fournir d’informations internes ou confidentielles"
    );
  }

  if (turnUnderstandingDelta.segments_lack_comprehension.length > 0) {
    responsePlan.messagesPlan.lackComprehensionPlanMessage = {
      segments_lack_comprehension:
        turnUnderstandingDelta.segments_lack_comprehension
    };
    responsePlan.messagesPlan.lackComprehensionMessages = buildQuotedMessages(
      turnUnderstandingDelta.segments_lack_comprehension,
      "Je n’ai pas bien compris cette partie"
    );
  }

  responsePlan.messagesPlan.scopeBoundaryPlanMessages =
    turnUnderstandingDelta.segments_scope_boundary;
  responsePlan.messagesPlan.scopeBoundaryMessages = buildQuotedMessages(
    turnUnderstandingDelta.segments_scope_boundary,
    "Cette partie ne relève pas du support et ne sera pas traitée ici"
  );

  const topicPlanInput: TopicPlanInput = {
    supportTopicKnowledge,
    turnUnderstandingDelta,
    possibleSolutions,
    decisionSearchingSolution
  };

  responsePlan.messagesPlan.topicPlanMessages =
    addTopicPlanMessage(topicPlanInput);

  const topicActions =
    responsePlan.messagesPlan.topicPlanMessages[0]?.topicActions ?? [];
  const questions = buildQuestions(
    turnUnderstandingDelta.segments_topic,
    topicActions,
    responsePlan.responseLanguage
  );

  if (topicActions.length > 0) {
    responsePlan.messagesPlan.acknowledgement = {
      type: topicActions.length > 1 ? "multiple_issues" : "single_issue",
      text: topicActions.length > 1
        ? "J’ai bien pris en compte vos retours sur plusieurs points :"
        : "J’ai bien pris en compte votre demande."
    };
    responsePlan.messagesPlan.understoodSummary = {
      type: topicActions.length > 1 ? "multiple_issues" : "single_issue",
      lines: turnUnderstandingDelta.segments_topic.map((topicSegment) => {
        return describeTopic(topicSegment, responsePlan.responseLanguage);
      })
    };
  }

  responsePlan.messagesPlan.questions = questions;
  responsePlan.messagesPlan.signalPlanMessages =
    turnUnderstandingDelta.segments_signal;
  responsePlan.messagesPlan.signalMessages = buildSignalMessages(
    turnUnderstandingDelta.segments_signal,
    topicActions.length > 0
  );

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
  responsePlan.messagesPlan.nextStep = {
    type: resolveNextStepType({
      signalTypes: getSignalTypes(turnUnderstandingDelta.segments_signal),
      handoverCount: responsePlan.messagesPlan.handoverPlanMessages.length,
      hasQuestions:
        questions.common.length > 0 || questions.specific.length > 0,
      hasTopics: topicActions.length > 0
    })
  };

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
