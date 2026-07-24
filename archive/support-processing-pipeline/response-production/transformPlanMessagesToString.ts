import type {
  MessagesPlan,
  QuotedPlanMessage,
  ResponseQuestion,
  TopicMainResponse
} from "../response-plan/typesResponsePlan.types";
import type { ResponseLanguage } from "./dataBaseResponse";

type StringTopicPlanMessage = {
  politenessOpening: string;
  topicRelationAcknowledgement: string;
  topicsResponses: string[];
  politenessClosure: string;
};

type StringMessagesPlan = {
  globalMessages: string[];
  securityGatePlanMessage?: string;
  suspiciousPlanMessage?: string;
  lackComprehensionPlanMessage?: string;
  scopeBoundaryPlanMessages: string[];
  topicPlanMessages: StringTopicPlanMessage[];
  signalPlanMessages: string[];
  handoverPlanMessages: string[];
};

const NO_AUTOMATIC_ANSWER = [
  "Aucune réponse automatique n’est disponible pour le moment.",
  "Un membre du support prendra le relais."
].join("\n");
const BOT_IDENTITY_RESPONSE = [
  "Je suis l’assistant du support. J’aide à qualifier votre demande pour que l’équipe humaine puisse vous répondre plus vite et avec les bonnes informations.",
  "",
  "Que puis-je faire pour vous ?"
].join("\n");

function nonEmpty(value: string | undefined): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function uniqueByWording(questions: ResponseQuestion[]): ResponseQuestion[] {
  const seen = new Set<string>();
  const output: ResponseQuestion[] = [];

  for (const question of questions) {
    if (seen.has(question.wording)) {
      continue;
    }

    seen.add(question.wording);
    output.push(question);
  }

  return output;
}

function renderBulletList(lines: string[]): string {
  return lines.map((line, index) => {
    const punctuation = index === lines.length - 1 ? "." : ";";
    const trimmed = line.trim().replace(/[.;:]$/, "");

    return `- ${trimmed}${punctuation}`;
  }).join("\n");
}

function renderQuestions(messagesPlan: MessagesPlan): string | undefined {
  const questions = [
    ...(messagesPlan.questions?.common ?? []),
    ...(messagesPlan.questions?.specific ?? [])
  ];
  const visibleQuestions = uniqueByWording(questions).slice(0, 3);

  if (visibleQuestions.length === 0) {
    return undefined;
  }

  return [
    "Pour avancer, pouvez-vous préciser :",
    renderBulletList(visibleQuestions.map((question) => question.wording))
  ].join("\n");
}

function renderQuotedMessages(
  messages: QuotedPlanMessage[] | undefined
): string[] {
  return (messages ?? []).map((message) => {
    return [
      `${message.message} :`,
      `> ${message.segment_verbatim}`
    ].join("\n");
  });
}

function getSegmentVerbatim(value: unknown): string {
  if (typeof value !== "object" || value === null) {
    return "";
  }

  const record = value as Record<string, unknown>;
  const raw = record.segment_verbatim ?? record.signal_verbatim;

  return typeof raw === "string" ? raw.trim() : "";
}

function renderLegacyQuotedMessages(params: {
  segments: unknown[];
  message: string;
}): string[] {
  return params.segments.flatMap((segment) => {
    const segmentVerbatim = getSegmentVerbatim(segment);

    return segmentVerbatim
      ? [`${params.message} :\n> ${segmentVerbatim}`]
      : [];
  });
}

function getLegacySignalTypes(messagesPlan: MessagesPlan): string[] {
  return messagesPlan.signalPlanMessages.flatMap((signalPlanMessage) => {
    if (typeof signalPlanMessage !== "object" || signalPlanMessage === null) {
      return [];
    }

    const signalTypes =
      (signalPlanMessage as Record<string, unknown>).signal_types;

    return Array.isArray(signalTypes)
      ? signalTypes.filter((signalType): signalType is string => {
          return typeof signalType === "string";
        })
      : [];
  });
}

function renderLegacySignalMessages(messagesPlan: MessagesPlan): string[] {
  if (messagesPlan.signalMessages !== undefined) {
    return messagesPlan.signalMessages;
  }

  const signalTypes = getLegacySignalTypes(messagesPlan);
  const messages: string[] = [];
  const hasTopicResponse = messagesPlan.topicPlanMessages.some(
    (topicPlanMessage) => {
      return (
        (topicPlanMessage.topicActions?.length ?? 0) > 0 ||
        topicPlanMessage.topics_responses.length > 0
      );
    }
  );

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
        ? "Votre retour sera également transmis à l’équipe support."
        : "Merci pour votre retour, il sera transmis à l’équipe support."
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

function renderSummary(messagesPlan: MessagesPlan): string | undefined {
  const summary = messagesPlan.understoodSummary;

  if (!summary || summary.type === "none" || summary.lines.length === 0) {
    return undefined;
  }

  if (summary.type === "multiple_issues") {
    return renderBulletList(summary.lines);
  }

  return summary.lines[0];
}

function renderLegacyTopicSummary(messagesPlan: MessagesPlan): string | undefined {
  const legacyTopicResponses = messagesPlan.topicPlanMessages.flatMap(
    (topicPlanMessage) => topicPlanMessage.topics_responses
  );

  if (messagesPlan.understoodSummary !== undefined || legacyTopicResponses.length === 0) {
    return undefined;
  }

  return legacyTopicResponses.length > 1
    ? renderBulletList(
        legacyTopicResponses.map(() => "une demande support")
      )
    : "une demande support";
}

function getFieldsRequested(mainResponse: TopicMainResponse): string[] {
  if (mainResponse.type !== "ask_fields") {
    return [];
  }

  return mainResponse.details.fields_requested;
}

function renderLegacyQuestions(messagesPlan: MessagesPlan): string | undefined {
  if (messagesPlan.questions !== undefined) {
    return undefined;
  }

  const fields = [
    ...new Set(
      messagesPlan.topicPlanMessages.flatMap((topicPlanMessage) => {
        return topicPlanMessage.topics_responses.flatMap((topicResponse) => {
          return getFieldsRequested(topicResponse.topic_response.main_response);
        });
      })
    )
  ];

  if (fields.length === 0) {
    return undefined;
  }

  return [
    "Pour avancer, pouvez-vous préciser :",
    renderBulletList(fields.slice(0, 3).map((field) => {
      return field === "platform"
        ? "la plateforme utilisée"
        : field.replaceAll("_", " ");
    }))
  ].join("\n");
}

function renderNextStep(messagesPlan: MessagesPlan): string | undefined {
  if (
    messagesPlan.nextStep?.type === "no_automatic_answer" ||
    messagesPlan.nextStep?.type === "human_support" ||
    messagesPlan.handoverPlanMessages.length > 0
  ) {
    return NO_AUTOMATIC_ANSWER;
  }

  return undefined;
}

function transformPlanMessagesToStringMessages(
  userLanguage: ResponseLanguage,
  messagesPlan: MessagesPlan
): StringMessagesPlan {
  void userLanguage;

  const acknowledgement = messagesPlan.acknowledgement?.text;
  const summary = renderSummary(messagesPlan) ??
    renderLegacyTopicSummary(messagesPlan);
  const questions = renderQuestions(messagesPlan) ??
    renderLegacyQuestions(messagesPlan);
  const signalMessages = renderLegacySignalMessages(messagesPlan);
  const quotedMessages = [
    ...renderQuotedMessages(messagesPlan.scopeBoundaryMessages),
    ...renderQuotedMessages(messagesPlan.securityMessages),
    ...renderQuotedMessages(messagesPlan.lackComprehensionMessages),
    ...renderLegacyQuotedMessages({
      segments: messagesPlan.scopeBoundaryMessages === undefined
        ? messagesPlan.scopeBoundaryPlanMessages
        : [],
      message:
        "Cette partie ne relève pas du support et ne sera pas traitée ici"
    }),
    ...renderLegacyQuotedMessages({
      segments: messagesPlan.securityMessages === undefined
        ? messagesPlan.suspiciousPlanMessage?.segments_suspicious ?? []
        : [],
      message:
        "Je ne peux pas fournir d’informations internes ou confidentielles"
    }),
    ...renderLegacyQuotedMessages({
      segments: messagesPlan.lackComprehensionMessages === undefined
        ? messagesPlan.lackComprehensionPlanMessage
          ?.segments_lack_comprehension ?? []
        : [],
      message: "Je n’ai pas bien compris cette partie"
    })
  ];
  const nextStep = renderNextStep(messagesPlan);
  const globalMessage = [
    acknowledgement,
    summary,
    questions,
    ...signalMessages,
    ...quotedMessages,
    nextStep
  ].filter(nonEmpty).join("\n\n");

  return {
    globalMessages: globalMessage ? [globalMessage] : [],
    scopeBoundaryPlanMessages: [],
    topicPlanMessages: [],
    signalPlanMessages: [],
    handoverPlanMessages: []
  };
}

export { transformPlanMessagesToStringMessages };
export type {
  StringMessagesPlan,
  StringTopicPlanMessage
};
