import type {
  ComposedResponseQuestion,
  ComposedResponseSection,
  ComposedSupportResponsePlan,
  ResponsePlanV2
} from "../typesSupportProcessingPipelineV2.types";
import type {
  FormatComposeSupportResponsePlanOutput,
  FormatComposeSupportResponsePlanOutputInput
} from "./typesComposeSupportResponsePlan.types";

type GlobalComposedQuestion = ComposedResponseQuestion & {
  sourceTopicIds: string[];
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

function hasHandoverRequest(input: FormatComposeSupportResponsePlanOutputInput): boolean {
  return input.input.standardResponseFragments.some((fragment) => {
    return isRecord(fragment) &&
      fragment.standardSubcategory === "handover_request";
  });
}

function standardSection(
  input: FormatComposeSupportResponsePlanOutputInput
): ComposedResponseSection[] {
  return input.input.standardResponseFragments.flatMap((fragment, index) => {
    if (!isRecord(fragment)) {
      return [];
    }

    const instruction = asString(fragment.content);

    if (!instruction) {
      return [];
    }

    const isHandover = fragment.standardSubcategory === "handover_request";

    return [{
      kind: isHandover ? "handover" : "standard_fragment",
      topicId: null,
      purpose: asString(fragment.standardSubcategory) ??
        `standard_fragment_${index + 1}`,
      say: [instruction],
      ask: [],
      forbid: isHandover
        ? [
            "Do not promise an immediate response.",
            "Do not ask the user to repeat the support problem."
          ]
        : []
    } satisfies ComposedResponseSection];
  });
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

function questionGoal(plan: ResponsePlanV2, fieldName: string): string {
  return plan.questionDecision.questionInstruction ??
    `Ask for ${fieldName}.`;
}

function topicSection(params: {
  plan: ResponsePlanV2;
  index: number;
  suppressQuestions: boolean;
}): ComposedResponseSection {
  const topicId = topicIdForPlan(params.plan, params.index);
  const questionFieldNames = params.suppressQuestions
    ? []
    : params.plan.rendererTask.questionFieldNames;

  return {
    kind: "topic",
    topicId,
    purpose: params.plan.responsePlanId,
    say: [params.plan.rendererTask.prompt],
    ask: questionFieldNames.map((fieldName) => ({
      fieldName,
      goal: questionGoal(params.plan, fieldName)
    })),
    forbid: params.plan.rendererTask.forbiddenClaims
  };
}

function deduplicateQuestions(params: {
  sections: ComposedResponseSection[];
  maxTotalQuestions?: number;
}): GlobalComposedQuestion[] {
  const questions = new Map<string, GlobalComposedQuestion>();

  for (const section of params.sections) {
    for (const question of section.ask) {
      const key = question.fieldName.trim().toLowerCase();
      const existing = questions.get(key);
      const sourceTopicId = section.topicId ?? section.purpose;

      if (existing) {
        existing.sourceTopicIds = Array.from(new Set([
          ...existing.sourceTopicIds,
          sourceTopicId
        ]));
      } else {
        questions.set(key, {
          ...question,
          sourceTopicIds: [sourceTopicId]
        });
      }
    }
  }

  const allQuestions = Array.from(questions.values());
  const maxQuestions = params.maxTotalQuestions;

  return typeof maxQuestions === "number" && maxQuestions >= 0
    ? allQuestions.slice(0, maxQuestions)
    : allQuestions;
}

function stripSectionQuestionsNotInGlobal(params: {
  sections: ComposedResponseSection[];
  globalQuestions: {
    fieldName: string;
  }[];
}): ComposedResponseSection[] {
  const allowed = new Set(
    params.globalQuestions.map((question) => {
      return question.fieldName.trim().toLowerCase();
    })
  );

  return params.sections.map((section) => ({
    ...section,
    ask: section.ask.filter((question) => {
      return allowed.has(question.fieldName.trim().toLowerCase());
    })
  }));
}

function globalForbid(sections: ComposedResponseSection[]): string[] {
  return Array.from(new Set(sections.flatMap((section) => {
    return section.forbid;
  })));
}

function buildFallbackPlan(
  input: FormatComposeSupportResponsePlanOutputInput,
  reason: string
): ComposedSupportResponsePlan {
  const handover = hasHandoverRequest(input);
  const standardSections = standardSection(input);
  const topicSections = input.input.topicResponsePlans.map((plan, index) => {
    return topicSection({
      plan,
      index,
      suppressQuestions: handover
    });
  });
  const sections = handover
    ? [
        ...standardSections,
        ...topicSections.map((section) => ({
          ...section,
          ask: []
        }))
      ]
    : [
        ...standardSections,
        ...topicSections
      ];
  const maxTotalQuestions =
    input.input.responsePlanningPolicy?.maxTotalQuestions;
  const globalQuestions = handover
    ? []
    : deduplicateQuestions({
        sections,
        maxTotalQuestions
      });
  const limitedSections = handover
    ? sections
    : stripSectionQuestionsNotInGlobal({
        sections,
        globalQuestions
      });

  return {
    targetLanguage: input.input.targetLanguage,
    channel: input.input.channel,
    messageIntent: handover
      ? "handover_reply"
      : standardSections.length > 0 && topicSections.length > 0
        ? "mixed_reply"
        : topicSections.length > 0
          ? "support_reply"
          : "standard_reply",
    globalTone: {
      opening: standardSections.length > 0
        ? "brief_acknowledgement"
        : "none",
      empathy: input.input.supportResponseCues?.length ? "light" : "none",
      formality: "standard"
    },
    sections: limitedSections,
    globalQuestions: globalQuestions.map((question) => ({
      fieldName: question.fieldName,
      goal: question.goal,
      sourceTopicIds: question.sourceTopicIds
    })),
    globalForbid: globalForbid(limitedSections),
    rendererInstructions: [
      "Write only from this composed plan.",
      "Do not add support facts, diagnoses, promises, actions, deadlines, refunds, or escalation claims.",
      "Do not expose field names, internal ids, JSON, or pipeline details.",
      `Composer fallback used because: ${reason}`
    ]
  };
}

function parseQuestion(value: unknown): ComposedResponseQuestion | null {
  if (!isRecord(value)) {
    return null;
  }

  const fieldName = asString(value.fieldName);
  const goal = asString(value.goal);

  return fieldName && goal
    ? { fieldName, goal }
    : null;
}

function parseSection(value: unknown): ComposedResponseSection | null {
  if (!isRecord(value)) {
    return null;
  }

  const kind = asString(value.kind);
  const purpose = asString(value.purpose);

  if (
    !kind ||
    ![
      "standard_fragment",
      "topic",
      "handover",
      "safety",
      "review"
    ].includes(kind) ||
    !purpose
  ) {
    return null;
  }

  return {
    kind: kind as ComposedResponseSection["kind"],
    topicId: asString(value.topicId),
    purpose,
    say: stringArray(value.say),
    ask: Array.isArray(value.ask)
      ? value.ask.flatMap((item) => {
          const question = parseQuestion(item);

          return question ? [question] : [];
        })
      : [],
    forbid: stringArray(value.forbid)
  };
}

function parsePlan(value: unknown): ComposedSupportResponsePlan | null {
  if (!isRecord(value) || !isRecord(value.globalTone)) {
    return null;
  }

  const targetLanguage = asString(value.targetLanguage);
  const channel = asString(value.channel);
  const messageIntent = asString(value.messageIntent);
  const opening = asString(value.globalTone.opening);
  const empathy = asString(value.globalTone.empathy);
  const formality = asString(value.globalTone.formality);

  if (
    !targetLanguage ||
    !channel ||
    !messageIntent ||
    ![
      "support_reply",
      "standard_reply",
      "mixed_reply",
      "handover_reply",
      "review_reply"
    ].includes(messageIntent) ||
    !opening ||
    !empathy ||
    !formality
  ) {
    return null;
  }

  const sections = Array.isArray(value.sections)
    ? value.sections.flatMap((item) => {
        const section = parseSection(item);

        return section ? [section] : [];
      })
    : [];

  if (sections.length === 0) {
    return null;
  }

  const globalQuestions = Array.isArray(value.globalQuestions)
    ? value.globalQuestions.flatMap((item) => {
        const question = parseQuestion(item);

        if (!question || !isRecord(item)) {
          return [];
        }

        return [{
          ...question,
          sourceTopicIds: stringArray(item.sourceTopicIds)
        }];
      })
    : [];

  return {
    targetLanguage,
    channel,
    messageIntent: messageIntent as ComposedSupportResponsePlan["messageIntent"],
    globalTone: {
      opening: opening as ComposedSupportResponsePlan["globalTone"]["opening"],
      empathy: empathy as ComposedSupportResponsePlan["globalTone"]["empathy"],
      formality:
        formality as ComposedSupportResponsePlan["globalTone"]["formality"]
    },
    sections,
    globalQuestions,
    globalForbid: stringArray(value.globalForbid),
    rendererInstructions: stringArray(value.rendererInstructions)
  };
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

  const parsedPlan = parsePlan(input.rawComposeSupportResponsePlan.parsedResponse);

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
