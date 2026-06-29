import type {
  FormatPlanSupportResponseOutput,
  FormatPlanSupportResponseOutputInput,
  PlannedAnswerPoint,
  PlannedAnswerSupport,
  PlannedAskField,
  RawPlannedAnswerPoint,
  RawPlannedAskField,
  RawSupportResponsePlan,
  SupportResponsePlan
} from "./typesPlanSupportResponse.types";

const PLANNED_ANSWER_SUPPORT_VALUES = [
  "retrieved_knowledge",
  "selected_catalog_knowledge",
  "topic",
  "attachment",
  "policy"
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function nullableString(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }

  return isNonEmptyString(value) ? value.trim() : undefined;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    return isNonEmptyString(item) ? [item.trim()] : [];
  });
}

function answerSupport(value: unknown): PlannedAnswerSupport | undefined {
  return typeof value === "string" &&
    PLANNED_ANSWER_SUPPORT_VALUES.includes(
      value as PlannedAnswerSupport
    )
    ? value as PlannedAnswerSupport
    : undefined;
}

function getResolvedTopicId(
  input: FormatPlanSupportResponseOutputInput["input"]
): string | null {
  const topicEvidence = input.topicEvidence;
  const topicSnapshot = topicEvidence.topicSnapshot;

  return topicEvidence.topicId ??
    topicSnapshot?.topicId ??
    topicSnapshot?.temporaryTopicId ??
    null;
}

function selectedAskableFieldNames(
  input: FormatPlanSupportResponseOutputInput["input"]
): Set<string> {
  if (!isRecord(input.selectedCatalogKnowledge)) {
    return new Set();
  }

  const selectedFields = input.selectedCatalogKnowledge.selectedFields;

  if (!Array.isArray(selectedFields)) {
    return new Set();
  }

  return new Set(selectedFields.flatMap((field) => {
    if (!isRecord(field) || field.askableByUser === false) {
      return [];
    }

    const fieldName = field.fieldName;

    return isNonEmptyString(fieldName) ? [fieldName.trim()] : [];
  }));
}

function parseAnswer(
  value: unknown,
  droppedItems: string[],
  index: number
): PlannedAnswerPoint | null {
  if (!isRecord(value)) {
    droppedItems.push(`answer.${index}`);
    return null;
  }

  const raw = value as RawPlannedAnswerPoint;
  const point = isNonEmptyString(raw.point) ? raw.point.trim() : null;
  const support = answerSupport(raw.support);

  if (!point || !support) {
    droppedItems.push(`answer.${index}`);
    return null;
  }

  return {
    point,
    support
  };
}

function parseAsk(
  value: unknown,
  selectedFieldNames: Set<string>,
  droppedItems: string[],
  index: number
): PlannedAskField | null {
  if (!isRecord(value)) {
    droppedItems.push(`ask.${index}`);
    return null;
  }

  const raw = value as RawPlannedAskField;
  const fieldName = isNonEmptyString(raw.fieldName)
    ? raw.fieldName.trim()
    : null;
  const goal = isNonEmptyString(raw.goal) ? raw.goal.trim() : null;

  if (!fieldName || !goal) {
    droppedItems.push(`ask.${index}`);
    return null;
  }

  if (!selectedFieldNames.has(fieldName)) {
    droppedItems.push(`ask.${index}:field_not_selected:${fieldName}`);
    return null;
  }

  return {
    fieldName,
    goal
  };
}

function buildFallbackPlan(params: {
  input: FormatPlanSupportResponseOutputInput["input"];
  reason: string;
}): SupportResponsePlan {
  return {
    topicId: getResolvedTopicId(params.input),
    acknowledge: [],
    answer: [],
    ask: [],
    say: [
      "Acknowledge the user's topic without making unsupported claims. Ask for clarification only if necessary."
    ],
    review: `plan_support_response_fallback:${params.reason}`
  };
}

function formatPlanSupportResponseOutput(
  input: FormatPlanSupportResponseOutputInput
): FormatPlanSupportResponseOutput {
  if (input.rawPlanSupportResponse.status !== "completed") {
    const reason =
      input.rawPlanSupportResponse.error?.message ?? "llm_call_failed";

    return {
      responsePlan: buildFallbackPlan({
        input: input.input,
        reason
      }),
      validation: {
        status: "fallback",
        reason
      }
    };
  }

  if (!isRecord(input.rawPlanSupportResponse.parsedResponse)) {
    return {
      responsePlan: buildFallbackPlan({
        input: input.input,
        reason: "invalid_or_missing_parsed_response"
      }),
      validation: {
        status: "fallback",
        reason: "invalid_or_missing_parsed_response"
      }
    };
  }

  const raw = input.rawPlanSupportResponse.parsedResponse as RawSupportResponsePlan;
  const droppedItems: string[] = [];
  const topicId = raw.topicId === null
    ? null
    : isNonEmptyString(raw.topicId)
      ? raw.topicId.trim()
      : getResolvedTopicId(input.input);
  const acknowledge = stringArray(raw.acknowledge);
  const answer = Array.isArray(raw.answer)
    ? raw.answer.flatMap((item, index) => {
        const parsed = parseAnswer(item, droppedItems, index);

        return parsed ? [parsed] : [];
      })
    : [];
  const selectedFieldNames = selectedAskableFieldNames(input.input);
  const ask = Array.isArray(raw.ask)
    ? raw.ask.flatMap((item, index) => {
        const parsed = parseAsk(
          item,
          selectedFieldNames,
          droppedItems,
          index
        );

        return parsed ? [parsed] : [];
      })
    : [];
  const say = stringArray(raw.say);
  const review = nullableString(raw.review);

  if (review === undefined) {
    return {
      responsePlan: buildFallbackPlan({
        input: input.input,
        reason: "invalid_review"
      }),
      validation: {
        status: "fallback",
        reason: "invalid_review",
        droppedItems
      }
    };
  }

  if (say.length === 0 && review === null) {
    return {
      responsePlan: buildFallbackPlan({
        input: input.input,
        reason: "missing_say"
      }),
      validation: {
        status: "fallback",
        reason: "missing_say",
        droppedItems
      }
    };
  }

  return {
    responsePlan: {
      topicId,
      acknowledge,
      answer,
      ask,
      say: say.length > 0
        ? say
        : [
            "Mark this topic for review and avoid unsupported customer-facing claims."
          ],
      review
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
