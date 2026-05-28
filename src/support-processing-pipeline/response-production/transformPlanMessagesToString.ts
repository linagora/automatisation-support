import { dataBaseResponse } from "./dataBaseResponse";

import type {
  LackComprehensionPlanMessage,
  MessagesPlan,
  SecurityGatePlanMessage,
  SuspiciousPlanMessage,
  TopicMainResponse,
  TopicPlanMessage
} from "../response-plan/typesResponsePlan.types";
import type { LabelDatabase, ResponseLanguage } from "./dataBaseResponse";

type ScopeBoundaryPlanMessage = {
  signal_verbatim?: unknown;
  scope_boundary_type?: unknown;
};

type SignalPlanMessage = {
  signal_verbatim?: unknown;
  signal_types?: unknown;
};

type HandoverPlanMessage = Record<string, unknown>;

type StringTopicPlanMessage = {
  politenessOpening: string;
  topicRelationAcknowledgement: string;
  topicsResponses: string[];
  politenessClosure: string;
};

type StringMessagesPlan = {
  securityGatePlanMessage?: string;
  suspiciousPlanMessage?: string;
  lackComprehensionPlanMessage?: string;
  scopeBoundaryPlanMessages: string[];
  topicPlanMessages: StringTopicPlanMessage[];
  signalPlanMessages: string[];
  handoverPlanMessages: string[];
};

function interpolate(
  template: string,
  values: Record<string, string>
): string {
  let output = template;

  for (const [key, value] of Object.entries(values)) {
    output = output.replaceAll(`{${key}}`, value);
  }

  return output;
}

function quoteVerbatim(value: unknown): string {
  if (typeof value === "string" && value.trim() !== "") {
    return `"${value}"`;
  }

  return "\"\"";
}

function getStringField(
  value: unknown,
  fieldName: string
): string | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const fieldValue = record[fieldName];

  if (typeof fieldValue === "string") {
    return fieldValue;
  }

  return undefined;
}

function labelFromDatabase(
  labels: LabelDatabase,
  key: string | undefined
): string {
  if (key === undefined) {
    return labels.default;
  }

  return labels[key] || labels.default;
}

function stringifyValue(value: unknown): string {
  if (value === undefined) {
    return "undefined";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(stringifyValue).join(", ");
  }

  if (typeof value === "object" && value !== null) {
    return JSON.stringify(value);
  }

  return "undefined";
}

function valueFromLabels(labels: LabelDatabase, key: unknown): string {
  if (typeof key !== "string") {
    return labels.default;
  }

  return labels[key] || labels.default;
}

function transformSecurityGatePlanMessage(
  userLanguage: ResponseLanguage,
  securityGatePlanMessage: SecurityGatePlanMessage
): string {
  const templates = dataBaseResponse[userLanguage].securityGate;

  return securityGatePlanMessage.gateFailed
    .map((gateFailed) => {
      if (
        gateFailed === "latestUserMessageSecurityDecision" ||
        gateFailed === "attachmentAnalysisSecurityDecision"
      ) {
        return templates[gateFailed];
      }

      const checkName = getStringField(gateFailed, "checkName");

      if (
        checkName === "latestUserMessageSecurityDecision" ||
        checkName === "attachmentAnalysisSecurityDecision"
      ) {
        return templates[checkName];
      }

      return templates.default;
    })
    .join(" ");
}

function transformSuspiciousPlanMessage(
  userLanguage: ResponseLanguage,
  suspiciousPlanMessage: SuspiciousPlanMessage
): string {
  const templates = dataBaseResponse[userLanguage].suspicious;

  return suspiciousPlanMessage.segments_suspicious
    .map((segment) => {
      const checkName = getStringField(segment, "checkName");
      const reason = labelFromDatabase(templates.labels, checkName);

      return interpolate(templates.template, {
        reason,
        segment_verbatim: quoteVerbatim(getStringField(segment, "segment_verbatim"))
      });
    })
    .join(" ");
}

function transformLackComprehensionPlanMessage(
  userLanguage: ResponseLanguage,
  lackComprehensionPlanMessage: LackComprehensionPlanMessage
): string {
  const templates = dataBaseResponse[userLanguage].lackComprehension;

  return lackComprehensionPlanMessage.segments_lack_comprehension
    .map((segment) => {
      return interpolate(templates.template, {
        segment_verbatim: quoteVerbatim(getStringField(segment, "segment_verbatim"))
      });
    })
    .join(" ");
}

function transformScopeBoundaryPlanMessage(
  userLanguage: ResponseLanguage,
  scopeBoundaryPlanMessage: ScopeBoundaryPlanMessage
): string {
  const templates = dataBaseResponse[userLanguage].scopeBoundary;
  const reason = labelFromDatabase(
    templates.labels,
    getStringField(scopeBoundaryPlanMessage, "scope_boundary_type")
  );

  return interpolate(templates.template, {
    reason,
    signal_verbatim: quoteVerbatim(scopeBoundaryPlanMessage.signal_verbatim)
  });
}

function transformTopicMainResponse(
  userLanguage: ResponseLanguage,
  mainResponse: TopicMainResponse
): string {
  const templates = dataBaseResponse[userLanguage].topic;

  if (mainResponse.type === "ask_fields") {
    const requestedFieldMessages = mainResponse.details.fields_requested.map(
      (field) => {
        return formatRequestedField(userLanguage, field);
      }
    );

    return [templates.askFields, ...requestedFieldMessages].join("\n");
  }

  if (mainResponse.type === "propose_solution") {
    return interpolate(templates.proposeSolution, {
      solutions: mainResponse.details.solutions
        .map((solution) => {
          return solution.solution;
        })
        .join(", ")
    });
  }

  return templates.acknowledgement;
}

function formatRequestedField(
  userLanguage: ResponseLanguage,
  field: string
): string {
  const templates = dataBaseResponse[userLanguage].topic;
  const label = capitalizeFirst(
    templates.topicDetailsLabels[field] || field || templates.topicDetailsLabels.default
  );
  const description =
    templates.topicDetailsDescriptions[field] ||
    templates.topicDetailsDescriptions.default;
  const separator = userLanguage === "french" ? " : " : ": ";

  return `- ${label}${separator}${ensureFinalPeriod(description)}`;
}

function capitalizeFirst(value: string): string {
  if (value.length === 0) {
    return value;
  }

  return `${value[0].toUpperCase()}${value.slice(1)}`;
}

function ensureFinalPeriod(value: string): string {
  return /[.!?]$/.test(value) ? value : `${value}.`;
}

function transformTopicRelationAcknowledgement(
  userLanguage: ResponseLanguage,
  topicPlanMessage: TopicPlanMessage
): string {
  const templates = dataBaseResponse[userLanguage].topic
    .topicRelationAcknowledgement;
  const {
    no_matched_historical_topic_count: newTopicCount,
    matched_historical_topic_count: ongoingTopicCount
  } = topicPlanMessage.topic_relation_acknowledgement;
  const parts: string[] = [];

  if (newTopicCount === 1) {
    parts.push(templates.newTopicSingular);
  } else if (newTopicCount > 1) {
    parts.push(
      interpolate(templates.newTopicPlural, {
        count: formatCount(userLanguage, newTopicCount)
      })
    );
  }

  if (ongoingTopicCount === 1) {
    parts.push(templates.ongoingTopicSingular);
  } else if (ongoingTopicCount > 1) {
    parts.push(
      interpolate(templates.ongoingTopicPlural, {
        count: formatCount(userLanguage, ongoingTopicCount)
      })
    );
  }

  if (parts.length === 0) {
    return "";
  }

  return `${templates.prefix}${parts.join(templates.separator)}${templates.suffix}`;
}

function formatCount(userLanguage: ResponseLanguage, count: number): string {
  if (userLanguage === "french") {
    if (count === 1) {
      return "un";
    }

    if (count === 2) {
      return "deux";
    }
  }

  if (userLanguage === "english") {
    if (count === 1) {
      return "one";
    }

    if (count === 2) {
      return "two";
    }
  }

  return String(count);
}

function transformTopicTitle(
  userLanguage: ResponseLanguage,
  topicResponse: TopicPlanMessage["topics_responses"][number]["topic_response"]
): string {
  const topicCategory = stringifyValue(topicResponse.title.topic_category);
  const topicCategoryLabels = dataBaseResponse[userLanguage].topic
    .topicCategoryLabels;
  const topicStatusLabel = topicResponse.title.matched_historical_topic
    ? valueFromLabels(
        dataBaseResponse[userLanguage].topic.topicStatusLabels,
        "previous"
      )
    : valueFromLabels(dataBaseResponse[userLanguage].topic.topicStatusLabels, "new");
  const topicCategoryLabel =
    topicCategoryLabels[topicCategory] || topicCategory.replaceAll("_", " ");

  return interpolate(dataBaseResponse[userLanguage].topic.title, {
    topic_id: stringifyValue(topicResponse.title.topic_id),
    topic_category: topicCategoryLabel,
    topic_label: stringifyValue(topicResponse.title.topic_label),
    topic_status: topicStatusLabel
  });
}

function translateTopicDetailValue(
  userLanguage: ResponseLanguage,
  fieldName: string,
  value: unknown
): string {
  const rawValue = stringifyValue(value);
  const normalizedValue = rawValue.trim().toLowerCase();
  const translations = dataBaseResponse[userLanguage].topic
    .topicDetailValueTranslations;

  return (
    translations[`${fieldName}:${normalizedValue}`] ||
    translations[normalizedValue] ||
    rawValue
  );
}

function transformUpdatedTopicDetails(
  userLanguage: ResponseLanguage,
  topicDetails: unknown
): string[] {
  if (typeof topicDetails !== "object" || topicDetails === null) {
    return [];
  }

  const labels = dataBaseResponse[userLanguage].topic.topicDetailsLabels;

  return Object.entries(topicDetails as Record<string, unknown>).map(
    ([field, value]) => {
      return `${valueFromLabels(labels, field)} (${translateTopicDetailValue(
        userLanguage,
        field,
        value
      )})`;
    }
  );
}

function transformTestedSolutions(
  userLanguage: ResponseLanguage,
  testedSolutions: unknown
): string[] {
  if (!Array.isArray(testedSolutions)) {
    return [];
  }

  const templates = dataBaseResponse[userLanguage].topic;

  return testedSolutions.map((testedSolution) => {
    const action = getStringField(testedSolution, "action") || "undefined";
    const outcome = valueFromLabels(
      templates.testedSolutionOutcomeLabels,
      getStringField(testedSolution, "outcome")
    );

    return interpolate(templates.testedSolution, {
      action,
      outcome
    });
  });
}

function transformUpdatedFieldsAcknowledgement(
  userLanguage: ResponseLanguage,
  updatedFieldsAcknowledgement: TopicPlanMessage["topics_responses"][number]["topic_response"]["updated_fields_acknowledgement"]
): string {
  const templates = dataBaseResponse[userLanguage].topic;
  const updatedDetails = transformUpdatedTopicDetails(
    userLanguage,
    updatedFieldsAcknowledgement.topic_details
  );
  const testedSolutions = transformTestedSolutions(
    userLanguage,
    updatedFieldsAcknowledgement.tested_solutions
  );
  const messages: string[] = [];

  if (updatedDetails.length > 0) {
    messages.push(
      interpolate(templates.updatedFieldsAcknowledgement, {
        updated_fields: updatedDetails.join(", ")
      })
    );
  }

  messages.push(...testedSolutions);

  return messages.length > 0 ? messages.join(" ") : "undefined";
}

function transformNextStep(userLanguage: ResponseLanguage, nextStep: unknown): string {
  return valueFromLabels(dataBaseResponse[userLanguage].topic.nextStep, nextStep);
}

function transformTopicResponse(
  userLanguage: ResponseLanguage,
  topicResponse: TopicPlanMessage["topics_responses"][number]["topic_response"]
): string {
  return [
    transformTopicTitle(userLanguage, topicResponse),
    transformUpdatedFieldsAcknowledgement(
      userLanguage,
      topicResponse.updated_fields_acknowledgement
    ),
    transformTopicMainResponse(userLanguage, topicResponse.main_response),
    transformNextStep(userLanguage, topicResponse.next_step)
  ].join("\n");
}

function transformTopicPlanMessage(
  userLanguage: ResponseLanguage,
  topicPlanMessage: TopicPlanMessage
): StringTopicPlanMessage {
  const templates = dataBaseResponse[userLanguage].topic;

  return {
    politenessOpening: valueFromLabels(
      templates.politenessOpening,
      topicPlanMessage.politeness_opening
    ),
    topicRelationAcknowledgement: transformTopicRelationAcknowledgement(
      userLanguage,
      topicPlanMessage
    ),
    topicsResponses: topicPlanMessage.topics_responses.map((topicResponse) => {
      return transformTopicResponse(userLanguage, topicResponse.topic_response);
    }),
    politenessClosure: valueFromLabels(
      templates.politenessClosure,
      topicPlanMessage.politeness_closure
    )
  };
}

function transformSignalPlanMessages(
  userLanguage: ResponseLanguage,
  signalPlanMessages: SignalPlanMessage[]
): string[] {
  const templates = dataBaseResponse[userLanguage].signal;

  if (signalPlanMessages.length === 0) {
    return [];
  }

  const signalTypes = signalPlanMessages.flatMap((signalPlanMessage) => {
    if (!Array.isArray(signalPlanMessage.signal_types)) {
      return [];
    }

    return signalPlanMessage.signal_types.filter((signalType) => {
      return typeof signalType === "string";
    });
  });
  const messages: string[] = [];

  if (
    signalTypes.includes("thanks_neutral") ||
    signalTypes.includes("thanks_positive")
  ) {
    messages.push(templates.responses.thanks);
  }

  if (signalTypes.includes("time_sensitive")) {
    messages.push(templates.responses.timeSensitive);
  }

  if (messages.length === 0) {
    messages.push(templates.responses.default);
  }

  return [messages.join(" ")];
}

function transformHandoverPlanMessage(
  userLanguage: ResponseLanguage,
  handoverPlanMessage: HandoverPlanMessage
): string {
  if (handoverPlanMessage !== undefined) {
    return dataBaseResponse[userLanguage].handover.default;
  }

  return "";
}

function transformPlanMessagesToStringMessages(
  userLanguage: ResponseLanguage,
  messagesPlan: MessagesPlan
): StringMessagesPlan {
  const stringMessagesPlan: StringMessagesPlan = {
    securityGatePlanMessage: undefined,
    suspiciousPlanMessage: undefined,
    lackComprehensionPlanMessage: undefined,
    scopeBoundaryPlanMessages: [],
    topicPlanMessages: [],
    signalPlanMessages: [],
    handoverPlanMessages: []
  };

  if (messagesPlan.securityGatePlanMessage !== undefined) {
    stringMessagesPlan.securityGatePlanMessage =
      transformSecurityGatePlanMessage(
        userLanguage,
        messagesPlan.securityGatePlanMessage
      );
  }

  if (messagesPlan.suspiciousPlanMessage !== undefined) {
    stringMessagesPlan.suspiciousPlanMessage = transformSuspiciousPlanMessage(
      userLanguage,
      messagesPlan.suspiciousPlanMessage
    );
  }

  if (messagesPlan.lackComprehensionPlanMessage !== undefined) {
    stringMessagesPlan.lackComprehensionPlanMessage =
      transformLackComprehensionPlanMessage(
        userLanguage,
        messagesPlan.lackComprehensionPlanMessage
      );
  }

  stringMessagesPlan.scopeBoundaryPlanMessages =
    messagesPlan.scopeBoundaryPlanMessages.map((scopeBoundaryPlanMessage) => {
      return transformScopeBoundaryPlanMessage(
        userLanguage,
        scopeBoundaryPlanMessage
      );
    });

  stringMessagesPlan.topicPlanMessages = messagesPlan.topicPlanMessages.map(
    (topicPlanMessage) => {
      return transformTopicPlanMessage(userLanguage, topicPlanMessage);
    }
  );

  stringMessagesPlan.signalPlanMessages = transformSignalPlanMessages(
    userLanguage,
    messagesPlan.signalPlanMessages
  );

  stringMessagesPlan.handoverPlanMessages =
    messagesPlan.handoverPlanMessages.map((handoverPlanMessage) => {
      return transformHandoverPlanMessage(userLanguage, handoverPlanMessage);
    });

  return stringMessagesPlan;
}

export { transformPlanMessagesToStringMessages };
export type { StringMessagesPlan, StringTopicPlanMessage };
