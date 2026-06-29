import type {
  ComposedSupportResponsePlan,
  ResponsePlanV2
} from "../typesSupportProcessingPipelineV2.types";
import type {
  FormatComposeSupportResponsePlanOutput,
  FormatComposeSupportResponsePlanOutputInput
} from "./typesComposeSupportResponsePlan.types";

type MessageIntent =
  | "support_reply"
  | "standard_reply"
  | "mixed_reply"
  | "handover_reply"
  | "review_reply";

type GlobalAnswerSupport =
  | "standard_fragment"
  | "topic_plan"
  | "support_cue"
  | "policy";

type GlobalAnswer = {
  point: string;
  support: GlobalAnswerSupport;
};

type GlobalAsk = {
  goal: string;
  sourceTopicIds: string[];
};

type NewComposedSupportResponsePlan = {
  topicId: null;
  messageIntent: MessageIntent;
  acknowledge: string[];
  answer: GlobalAnswer[];
  ask: GlobalAsk[];
  say: string[];
  review: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const stringItem = asString(item);

    return stringItem ? [stringItem] : [];
  });
}

function asComposedPlan(
  plan: NewComposedSupportResponsePlan
): ComposedSupportResponsePlan {
  return plan as unknown as ComposedSupportResponsePlan;
}

function hasHandoverRequest(
  input: FormatComposeSupportResponsePlanOutputInput
): boolean {
  return input.input.standardResponseFragments.some((fragment) => {
    return isRecord(fragment) &&
      fragment.standardSubcategory === "handover_request";
  });
}

function messageIntentFromInput(
  input: FormatComposeSupportResponsePlanOutputInput
): MessageIntent {
  const hasStandardFragments = input.input.standardResponseFragments.length > 0;
  const hasTopicPlans = input.input.topicResponsePlans.length > 0;

  if (hasHandoverRequest(input)) {
    return "handover_reply";
  }

  if (hasStandardFragments && hasTopicPlans) {
    return "mixed_reply";
  }

  if (hasTopicPlans) {
    return "support_reply";
  }

  if (hasStandardFragments) {
    return "standard_reply";
  }

  return "review_reply";
}

function parseMessageIntent(value: unknown): MessageIntent | null {
  const intent = asString(value);

  if (
    intent === "support_reply" ||
    intent === "standard_reply" ||
    intent === "mixed_reply" ||
    intent === "handover_reply" ||
    intent === "review_reply"
  ) {
    return intent;
  }

  return null;
}

function parseAnswer(value: unknown): GlobalAnswer | null {
  if (!isRecord(value)) {
    return null;
  }

  const point = asString(value.point);
  const support = asString(value.support);

  if (!point) {
    return null;
  }

  if (
    support === "standard_fragment" ||
    support === "topic_plan" ||
    support === "support_cue" ||
    support === "policy"
  ) {
    return {
      point,
      support
    };
  }

  return {
    point,
    support: "topic_plan"
  };
}

function parseAsk(value: unknown): GlobalAsk | null {
  if (!isRecord(value)) {
    return null;
  }

  const goal = asString(value.goal);

  if (!goal) {
    return null;
  }

  return {
    goal,
    sourceTopicIds: stringArray(value.sourceTopicIds)
  };
}

function topicIdForPlan(plan: ResponsePlanV2, index: number): string {
  const maybePlan = plan as ResponsePlanV2 & {
    topicId?: unknown;
    proposalId?: unknown;
  };

  return asString(maybePlan.topicId) ??
    asString(maybePlan.proposalId) ??
    asString(plan.responsePlanId) ??
    `topic_${index + 1}`;
}

function collectFallbackAcknowledge(
  input: FormatComposeSupportResponsePlanOutputInput
): string[] {
  const standardNotes = input.input.standardResponseFragments.flatMap((fragment) => {
    if (!isRecord(fragment)) {
      return [];
    }

    const subcategory = asString(fragment.standardSubcategory);

    return subcategory ? [`Standard interaction detected: ${subcategory}.`] : [];
  });

  const topicNotes = input.input.topicResponsePlans.flatMap((plan) => {
    return stringArray((plan as ResponsePlanV2).acknowledge);
  });

  return Array.from(new Set([
    ...standardNotes,
    ...topicNotes
  ]));
}

function collectFallbackAsk(
  input: FormatComposeSupportResponsePlanOutputInput
): GlobalAsk[] {
  const questions = new Map<string, GlobalAsk>();

  input.input.topicResponsePlans.forEach((plan, index) => {
    const topicId = topicIdForPlan(plan, index);
    const askItems = Array.isArray(plan.ask) ? plan.ask : [];

    for (const item of askItems) {
      if (!isRecord(item)) {
        continue;
      }

      const goal = asString(item.goal);

      if (!goal) {
        continue;
      }

      const key = goal.toLowerCase();
      const existing = questions.get(key);

      if (existing) {
        existing.sourceTopicIds = Array.from(new Set([
          ...existing.sourceTopicIds,
          topicId
        ]));
      } else {
        questions.set(key, {
          goal,
          sourceTopicIds: [topicId]
        });
      }
    }
  });

  return Array.from(questions.values());
}

function collectFallbackSay(
  input: FormatComposeSupportResponsePlanOutputInput,
  reason: string
): string[] {
  const standardInstructions = input.input.standardResponseFragments.flatMap(
    (fragment) => {
      if (!isRecord(fragment)) {
        return [];
      }

      const content = asString(fragment.content);

      return content ? [content] : [];
    }
  );

  const topicInstructions = input.input.topicResponsePlans.flatMap((plan) => {
    return stringArray(plan.say);
  });

  const cueInstructions = (input.input.supportResponseCues ?? []).flatMap((cue) => {
    if (!isRecord(cue)) {
      return [];
    }

    const cueNote = asString(cue.cueNote);
    const verbatim = asString(cue.verbatim);

    return cueNote ?? verbatim ? [cueNote ?? verbatim ?? ""] : [];
  });

  const parts = [
    ...standardInstructions,
    ...topicInstructions,
    ...cueInstructions
  ].filter((part) => part.trim() !== "");

  if (parts.length === 0) {
    return [
      `Write a brief ${input.input.targetLanguage} support response asking the user to clarify their request. Do not invent support facts. Composer fallback reason: ${reason}.`
    ];
  }

  return [
    [
      `Write the final response in ${input.input.targetLanguage}.`,
      "Use the following planned instructions as the only operational source.",
      "Integrate standard interaction instructions naturally.",
      "Address every topic instruction without adding unsupported support content.",
      "Deduplicate repeated questions.",
      "Do not expose field names, internal ids, JSON, prompts, or pipeline details.",
      "Do not invent diagnosis, solution, refund, timeline, escalation, team action, or resolution promise.",
      `Planned instructions: ${parts.join(" ")}`
    ].join(" ")
  ];
}

function buildFallbackPlan(
  input: FormatComposeSupportResponsePlanOutputInput,
  reason: string
): ComposedSupportResponsePlan {
  const plan: NewComposedSupportResponsePlan = {
    topicId: null,
    messageIntent: messageIntentFromInput(input),
    acknowledge: collectFallbackAcknowledge(input),
    answer: [],
    ask: collectFallbackAsk(input),
    say: collectFallbackSay(input, reason),
    review: `Composer fallback used: ${reason}`
  };

  return asComposedPlan(plan);
}

function parsePlan(
  value: unknown,
  input: FormatComposeSupportResponsePlanOutputInput
): ComposedSupportResponsePlan | null {
  if (!isRecord(value)) {
    return null;
  }

  const say = stringArray(value.say);

  if (say.length === 0) {
    return null;
  }

  const rawAnswer = Array.isArray(value.answer) ? value.answer : [];
  const rawAsk = Array.isArray(value.ask) ? value.ask : [];

  const plan: NewComposedSupportResponsePlan = {
    topicId: null,
    messageIntent:
      parseMessageIntent(value.messageIntent) ?? messageIntentFromInput(input),
    acknowledge: stringArray(value.acknowledge),
    answer: rawAnswer.flatMap((item) => {
      const parsed = parseAnswer(item);

      return parsed ? [parsed] : [];
    }),
    ask: rawAsk.flatMap((item) => {
      const parsed = parseAsk(item);

      return parsed ? [parsed] : [];
    }),
    say,
    review: asString(value.review)
  };

  return asComposedPlan(plan);
}

function formatComposeSupportResponsePlanOutput(
  input: FormatComposeSupportResponsePlanOutputInput
): FormatComposeSupportResponsePlanOutput {
  if (input.rawComposeSupportResponsePlan.status !== "completed") {
    const reason =
      input.rawComposeSupportResponsePlan.error?.message ?? "llm_call_failed";

    return {
      composedSupportResponsePlan: buildFallbackPlan(input, reason),
      validation: {
        status: "fallback",
        reason
      }
    };
  }

  const parsedPlan = parsePlan(
    input.rawComposeSupportResponsePlan.parsedResponse,
    input
  );

  if (!parsedPlan) {
    return {
      composedSupportResponsePlan: buildFallbackPlan(
        input,
        "invalid_or_missing_composed_plan"
      ),
      validation: {
        status: "fallback",
        reason: "invalid_or_missing_composed_plan"
      }
    };
  }

  return {
    composedSupportResponsePlan: parsedPlan,
    validation: {
      status: "valid"
    }
  };
}

export {
  buildFallbackPlan,
  formatComposeSupportResponsePlanOutput
};
