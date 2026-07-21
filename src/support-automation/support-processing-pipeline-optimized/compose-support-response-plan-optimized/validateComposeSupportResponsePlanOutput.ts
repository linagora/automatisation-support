import type {TopicPlannerOutput} from "./buildComposeSupportResponsePlanPrompt";

type MessageIntent =
  | "support_reply"
  | "standard_reply"
  | "mixed_reply"
  | "handover_reply"
  | "review_reply";

type ComposedSupportResponsePlan = {
  messageIntent: MessageIntent;
  topicIds: Array<number | null>;
  say: string[];
  review: string | null;
};

type ValidatedComposeSupportResponsePlanOutput = ComposedSupportResponsePlan;

function validateComposeSupportResponsePlanOutput(
  parsedResponse: unknown
): ValidatedComposeSupportResponsePlanOutput | null {
  if (!isRecord(parsedResponse)) return null;
  if (!isMessageIntent(parsedResponse.messageIntent)) return null;

  const topicIds = validateTopicIds(parsedResponse.topicIds);
  if (!topicIds) return null;

  const say = validateSayArray(parsedResponse.say);
  if (!say) return null;

  const review = validateNullableString(parsedResponse.review);
  if (review === undefined) return null;

  return {
    messageIntent: parsedResponse.messageIntent,
    topicIds,
    say,
    review
  };
}

function buildDeterministicComposedSupportResponsePlan(input: {
  topicPlannerOutputs: TopicPlannerOutput[];
  standardResponseFragments?: Array<{content?: string | null; standardSubcategory?: string | null}>;
}): ComposedSupportResponsePlan {
  const topicOutputs = input.topicPlannerOutputs.filter((plan) => plan.say.trim() !== "");
  const topicSay = topicOutputs.map((plan) => plan.say.trim());
  const standardSay = (input.standardResponseFragments ?? []).flatMap((fragment) => {
    return typeof fragment.content === "string" && fragment.content.trim() !== ""
      ? [fragment.content.trim()]
      : [];
  });

  const say = deduplicateStrings([...topicSay, ...standardSay]);
  const hasTopic = topicSay.length > 0;
  const hasStandard = standardSay.length > 0;
  const hasHandover = (input.standardResponseFragments ?? []).some((fragment) => {
    return fragment.standardSubcategory === "handover_request";
  });

  return {
    messageIntent: hasHandover && !hasTopic
      ? "handover_reply"
      : hasTopic && hasStandard
        ? "mixed_reply"
        : hasTopic
          ? "support_reply"
          : "standard_reply",
    topicIds: deduplicateTopicIds(topicOutputs.map((plan) => plan.topicId)),
    say: say.length > 0
      ? say
      : ["Ask the user to clarify their request because there is not enough information to answer safely."],
    review: null
  };
}

function validateTopicIds(value: unknown): Array<number | null> | null {
  if (!Array.isArray(value)) return null;

  const topicIds: Array<number | null> = [];

  for (const item of value) {
    if (item === null) {
      topicIds.push(null);
    } else if (typeof item === "number" && Number.isFinite(item)) {
      topicIds.push(item);
    } else {
      return null;
    }
  }

  return deduplicateTopicIds(topicIds);
}

function validateSayArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;

  const say = value.flatMap((item) => {
    return typeof item === "string" && item.trim() !== ""
      ? [item.trim()]
      : [];
  });

  return say.length > 0 ? deduplicateStrings(say) : null;
}

function validateNullableString(value: unknown): string | null | undefined {
  if (value === null) return null;

  return typeof value === "string"
    ? value.trim() || null
    : undefined;
}

function isMessageIntent(value: unknown): value is MessageIntent {
  return value === "support_reply" ||
    value === "standard_reply" ||
    value === "mixed_reply" ||
    value === "handover_reply" ||
    value === "review_reply";
}

function deduplicateStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function deduplicateTopicIds(values: Array<number | null>): Array<number | null> {
  const seen = new Set<string>();
  const deduped: Array<number | null> = [];

  for (const value of values) {
    const key = value === null ? "null" : String(value);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(value);
  }

  return deduped;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export {
  buildDeterministicComposedSupportResponsePlan,
  validateComposeSupportResponsePlanOutput
};

export type {
  ComposedSupportResponsePlan,
  MessageIntent,
  ValidatedComposeSupportResponsePlanOutput
};
