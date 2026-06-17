import {
  KNOWLEDGE_STATUS_VALUES,
  PLANNED_MESSAGE_ROLE_VALUES,
  QUESTION_PRIORITY_VALUES,
  RESPONSE_MODE_VALUES,
  RESPONSE_STRATEGY_VALUES
} from "./planSupportResponse.taxonomy";

import type {
  FormatPlanSupportResponseOutput,
  FormatPlanSupportResponseOutputInput,
  KnowledgeStatus,
  PlannedMessageRole,
  PlannedQuestion,
  PlannedResponseMessage,
  QuestionPriority,
  RawPlannedQuestion,
  RawPlannedResponseMessage,
  RawSupportResponsePlan,
  ResponseMode,
  ResponseStrategy,
  SupportResponsePlan
} from "./typesPlanSupportResponse.types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function stringValue(value: unknown, fallback: string): string {
  return isString(value) ? value.trim() : fallback;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    return isString(item) ? [item.trim()] : [];
  });
}

function enumValue<TValues extends readonly string[]>(
  value: unknown,
  values: TValues
): TValues[number] | undefined {
  return typeof value === "string" &&
    values.includes(value as TValues[number])
    ? value as TValues[number]
    : undefined;
}

function numericOrder(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.floor(value));
}

function buildFallbackPlan(reason: string): SupportResponsePlan {
  return {
    responsePlanId: "response_plan_fallback",
    responseStrategy: "single_response",
    responseMode: "acknowledge_and_wait",
    rendererInstructions:
      "Rédiger une réponse courte indiquant que la demande est bien prise en compte et que le support va revenir vers l'utilisateur. Ne pas inventer de solution.",
    plannedMessages: [
      {
        messageOrder: 1,
        messageRole: "support_answer",
        relatedTopicIds: [],
        relatedProposalIds: [],
        relatedUnderstandingIds: [],
        goal: "Acknowledge the support request safely.",
        instructionsToRenderer:
          "Acknowledge the user's support request without inventing a technical solution. Mention that the support team will use the provided information.",
        mustMention: [],
        mustAsk: [],
        mustAvoid: [
          "Do not invent a troubleshooting procedure.",
          "Do not claim the issue is solved."
        ],
        knowledgeStatus: "knowledge_missing",
        internalRationale: `Fallback response plan used because: ${reason}`
      }
    ],
    commonQuestions: [],
    topicSpecificQuestions: [],
    globalMustInclude: [],
    globalMustAvoid: [
      "Do not invent a technical solution.",
      "Do not claim the issue is solved."
    ],
    standardHandlingInstructions: null,
    cueHandlingInstructions: null,
    internalRationale: `Fallback response plan used because: ${reason}`
  };
}

function formatPlannedMessage(params: {
  raw: RawPlannedResponseMessage;
  index: number;
  droppedItems: string[];
}): PlannedResponseMessage | undefined {
  const messageRole = enumValue(
    params.raw.messageRole,
    PLANNED_MESSAGE_ROLE_VALUES
  ) as PlannedMessageRole | undefined;
  const knowledgeStatus = enumValue(
    params.raw.knowledgeStatus,
    KNOWLEDGE_STATUS_VALUES
  ) as KnowledgeStatus | undefined;

  if (!messageRole) {
    params.droppedItems.push(`plannedMessages[${params.index}].messageRole`);
    return undefined;
  }

  if (!knowledgeStatus) {
    params.droppedItems.push(`plannedMessages[${params.index}].knowledgeStatus`);
    return undefined;
  }

  return {
    messageOrder: numericOrder(params.raw.messageOrder, params.index + 1),
    messageRole,
    relatedTopicIds: stringList(params.raw.relatedTopicIds),
    relatedProposalIds: stringList(params.raw.relatedProposalIds),
    relatedUnderstandingIds: stringList(params.raw.relatedUnderstandingIds),
    goal: stringValue(params.raw.goal, "Plan this response message."),
    instructionsToRenderer: stringValue(
      params.raw.instructionsToRenderer,
      "Write a concise support response for this planned message."
    ),
    mustMention: stringList(params.raw.mustMention),
    mustAsk: stringList(params.raw.mustAsk),
    mustAvoid: stringList(params.raw.mustAvoid),
    knowledgeStatus,
    internalRationale: stringValue(
      params.raw.internalRationale,
      "No internal rationale provided."
    )
  };
}

function formatQuestion(params: {
  raw: RawPlannedQuestion;
  index: number;
  prefix: "common" | "topic";
  droppedItems: string[];
}): PlannedQuestion | undefined {
  const priority = enumValue(
    params.raw.priority,
    QUESTION_PRIORITY_VALUES
  ) as QuestionPriority | undefined;
  const fieldNames = stringList(params.raw.fieldNames);
  const appliesToTopicIds = stringList(params.raw.appliesToTopicIds);

  if (!priority) {
    params.droppedItems.push(`${params.prefix}Questions[${params.index}].priority`);
    return undefined;
  }

  if (fieldNames.length === 0) {
    params.droppedItems.push(`${params.prefix}Questions[${params.index}].fieldNames`);
    return undefined;
  }

  return {
    questionId: stringValue(
      params.raw.questionId,
      `${params.prefix}_question_${params.index + 1}`
    ),
    appliesToTopicIds,
    fieldNames,
    wordingInstruction: stringValue(
      params.raw.wordingInstruction,
      "Ask for this missing information clearly and concisely."
    ),
    reason: stringValue(
      params.raw.reason,
      "This information may help support handle the topic."
    ),
    priority
  };
}

function formatQuestions(params: {
  rawQuestions: unknown;
  prefix: "common" | "topic";
  droppedItems: string[];
}): PlannedQuestion[] {
  if (!Array.isArray(params.rawQuestions)) {
    return [];
  }

  return params.rawQuestions.flatMap((rawQuestion, index) => {
    if (!isRecord(rawQuestion)) {
      params.droppedItems.push(`${params.prefix}Questions[${index}]`);
      return [];
    }

    const formattedQuestion = formatQuestion({
      raw: rawQuestion,
      index,
      prefix: params.prefix,
      droppedItems: params.droppedItems
    });

    return formattedQuestion ? [formattedQuestion] : [];
  });
}

function formatPlanSupportResponseOutput(
  input: FormatPlanSupportResponseOutputInput
): FormatPlanSupportResponseOutput {
  if (input.rawPlanSupportResponse.status !== "completed") {
    const reason =
      input.rawPlanSupportResponse.error?.message ?? "llm_call_failed";

    return {
      responsePlan: buildFallbackPlan(reason),
      validation: {
        status: "fallback",
        reason
      }
    };
  }

  if (!isRecord(input.rawPlanSupportResponse.parsedResponse)) {
    return {
      responsePlan: buildFallbackPlan("invalid_or_missing_parsed_response"),
      validation: {
        status: "fallback",
        reason: "invalid_or_missing_parsed_response"
      }
    };
  }

  const raw = input.rawPlanSupportResponse.parsedResponse as RawSupportResponsePlan;
  const responseStrategy = enumValue(
    raw.responseStrategy,
    RESPONSE_STRATEGY_VALUES
  ) as ResponseStrategy | undefined;
  const responseMode = enumValue(
    raw.responseMode,
    RESPONSE_MODE_VALUES
  ) as ResponseMode | undefined;

  if (!responseStrategy) {
    return {
      responsePlan: buildFallbackPlan("invalid_response_strategy"),
      validation: {
        status: "fallback",
        reason: "invalid_response_strategy"
      }
    };
  }

  if (!responseMode) {
    return {
      responsePlan: buildFallbackPlan("invalid_response_mode"),
      validation: {
        status: "fallback",
        reason: "invalid_response_mode"
      }
    };
  }

  const droppedItems: string[] = [];
  const plannedMessages = Array.isArray(raw.plannedMessages)
    ? raw.plannedMessages.flatMap((rawMessage, index) => {
        if (!isRecord(rawMessage)) {
          droppedItems.push(`plannedMessages[${index}]`);
          return [];
        }

        const formattedMessage = formatPlannedMessage({
          raw: rawMessage,
          index,
          droppedItems
        });

        return formattedMessage ? [formattedMessage] : [];
      })
    : [];

  if (plannedMessages.length === 0) {
    return {
      responsePlan: buildFallbackPlan("no_valid_planned_messages"),
      validation: {
        status: "fallback",
        reason: "no_valid_planned_messages",
        droppedItems
      }
    };
  }

  const standardHandlingInstructions = isNullableString(
    raw.standardHandlingInstructions
  )
    ? raw.standardHandlingInstructions
    : null;
  const cueHandlingInstructions = isNullableString(raw.cueHandlingInstructions)
    ? raw.cueHandlingInstructions
    : null;

  return {
    responsePlan: {
      responsePlanId: stringValue(raw.responsePlanId, "response_plan_1"),
      responseStrategy,
      responseMode,
      rendererInstructions: stringValue(
        raw.rendererInstructions,
        "Follow the planned messages and constraints."
      ),
      plannedMessages: plannedMessages.sort((left, right) => {
        return left.messageOrder - right.messageOrder;
      }),
      commonQuestions: formatQuestions({
        rawQuestions: raw.commonQuestions,
        prefix: "common",
        droppedItems
      }),
      topicSpecificQuestions: formatQuestions({
        rawQuestions: raw.topicSpecificQuestions,
        prefix: "topic",
        droppedItems
      }),
      globalMustInclude: stringList(raw.globalMustInclude),
      globalMustAvoid: stringList(raw.globalMustAvoid),
      standardHandlingInstructions,
      cueHandlingInstructions,
      internalRationale: stringValue(
        raw.internalRationale,
        "No internal rationale provided."
      )
    },
    validation: {
      status: "valid",
      ...(droppedItems.length > 0 ? { droppedItems } : {})
    }
  };
}

export {
  buildFallbackPlan,
  formatPlanSupportResponseOutput
};
