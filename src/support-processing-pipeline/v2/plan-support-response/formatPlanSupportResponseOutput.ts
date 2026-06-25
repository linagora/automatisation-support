import {
  ALLOWED_RESPONSE_MOVE_VALUES,
  KNOWLEDGE_MODE_VALUES
} from "./planSupportResponse.taxonomy";

import type {
  AllowedResponseMove,
  FormatPlanSupportResponseOutput,
  FormatPlanSupportResponseOutputInput,
  KnowledgeGate,
  KnowledgeMode,
  QuestionDecision,
  RawKnowledgeGate,
  RawQuestionDecision,
  RawRendererTask,
  RawSupportResponsePlan,
  RendererTask,
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

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : undefined;
}

function buildFallbackPlan(reason: string): SupportResponsePlan {
  return {
    responsePlanId: "response_plan_fallback",
    knowledgeGate: {
      knowledgeMode: "knowledge_missing",
      solutionAllowed: false,
      allowedMoves: [
        "acknowledge"
      ],
      reason: `Fallback response plan used because: ${reason}`
    },
    questionDecision: {
      shouldAskQuestion: false,
      plannedQuestionCount: 0,
      fieldNames: [],
      questionInstruction: null,
      reason: `Fallback response plan used because: ${reason}`
    },
    rendererTask: {
      targetLanguage: "same_language_as_user",
      prompt:
        "Write a short acknowledgement. Do not ask questions, give solutions, promise actions, or invent operational details.",
      questionFieldNames: [],
      forbiddenClaims: [
        "No question.",
        "No solution.",
        "No diagnosis.",
        "No procedure.",
        "No refund.",
        "No reference.",
        "No status page.",
        "No timeline.",
        "No investigation promise.",
        "No escalation claim.",
        "No team action."
      ]
    },
    internalRationale: `Fallback response plan used because: ${reason}`
  };
}

function formatKnowledgeGate(
  rawKnowledgeGate: unknown,
  droppedItems: string[]
): KnowledgeGate | undefined {
  if (!isRecord(rawKnowledgeGate)) {
    droppedItems.push("knowledgeGate");
    return undefined;
  }

  const raw = rawKnowledgeGate as RawKnowledgeGate;
  const knowledgeMode = enumValue(
    raw.knowledgeMode,
    KNOWLEDGE_MODE_VALUES
  ) as KnowledgeMode | undefined;
  const solutionAllowed = booleanValue(raw.solutionAllowed);
  const allowedMoves = stringList(raw.allowedMoves).flatMap((rawMove) => {
    const move = enumValue(
      rawMove,
      ALLOWED_RESPONSE_MOVE_VALUES
    ) as AllowedResponseMove | undefined;

    return move ? [move] : [];
  });

  if (!knowledgeMode) {
    droppedItems.push("knowledgeGate.knowledgeMode");
    return undefined;
  }

  if (solutionAllowed === undefined) {
    droppedItems.push("knowledgeGate.solutionAllowed");
    return undefined;
  }

  if (!isString(raw.reason)) {
    droppedItems.push("knowledgeGate.reason");
    return undefined;
  }

  const normalizedSolutionAllowed =
    knowledgeMode === "knowledge_available" ? solutionAllowed : false;
  const normalizedAllowedMoves = normalizedSolutionAllowed
    ? allowedMoves
    : allowedMoves.filter((move) => {
        return move !== "answer_with_knowledge";
      });

  return {
    knowledgeMode,
    solutionAllowed: normalizedSolutionAllowed,
    allowedMoves: normalizedAllowedMoves.length > 0
      ? normalizedAllowedMoves
      : ["acknowledge"],
    reason: raw.reason.trim()
  };
}

function formatQuestionDecision(
  rawQuestionDecision: unknown,
  droppedItems: string[]
): QuestionDecision | undefined {
  if (!isRecord(rawQuestionDecision)) {
    droppedItems.push("questionDecision");
    return undefined;
  }

  const raw = rawQuestionDecision as RawQuestionDecision;
  const shouldAskQuestion = booleanValue(raw.shouldAskQuestion);
  const plannedQuestionCount = numberValue(raw.plannedQuestionCount);
  const fieldNames = stringList(raw.fieldNames);

  if (shouldAskQuestion === undefined) {
    droppedItems.push("questionDecision.shouldAskQuestion");
    return undefined;
  }

  if (plannedQuestionCount === undefined) {
    droppedItems.push("questionDecision.plannedQuestionCount");
    return undefined;
  }

  if (!isNullableString(raw.questionInstruction)) {
    droppedItems.push("questionDecision.questionInstruction");
    return undefined;
  }

  if (!isString(raw.reason)) {
    droppedItems.push("questionDecision.reason");
    return undefined;
  }

  return {
    shouldAskQuestion,
    plannedQuestionCount,
    fieldNames,
    questionInstruction: raw.questionInstruction,
    reason: raw.reason.trim()
  };
}

function formatRendererTask(
  rawRendererTask: unknown,
  droppedItems: string[]
): RendererTask | undefined {
  if (!isRecord(rawRendererTask)) {
    droppedItems.push("rendererTask");
    return undefined;
  }

  const raw = rawRendererTask as RawRendererTask;

  if (!isString(raw.targetLanguage)) {
    droppedItems.push("rendererTask.targetLanguage");
    return undefined;
  }

  if (!isString(raw.prompt)) {
    droppedItems.push("rendererTask.prompt");
    return undefined;
  }

  return {
    targetLanguage: raw.targetLanguage.trim(),
    prompt: raw.prompt.trim(),
    questionFieldNames: stringList(raw.questionFieldNames),
    forbiddenClaims: stringList(raw.forbiddenClaims)
  };
}

function sameStringSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const rightValues = new Set(right);

  return left.every((value) => {
    return rightValues.has(value);
  });
}

function hasInvalidQuestionConsistency(params: {
  questionDecision: QuestionDecision;
  rendererTask: RendererTask;
}): boolean {
  const { questionDecision, rendererTask } = params;

  if (!questionDecision.shouldAskQuestion) {
    return (
      questionDecision.plannedQuestionCount !== 0 ||
      questionDecision.fieldNames.length !== 0 ||
      questionDecision.questionInstruction !== null ||
      rendererTask.questionFieldNames.length !== 0
    );
  }

  return (
    questionDecision.plannedQuestionCount !== questionDecision.fieldNames.length ||
    !sameStringSet(rendererTask.questionFieldNames, questionDecision.fieldNames)
  );
}

function appendForbiddenClaims(
  rendererTask: RendererTask,
  forbiddenClaims: string[]
): void {
  rendererTask.forbiddenClaims = Array.from(new Set([
    ...rendererTask.forbiddenClaims,
    ...forbiddenClaims
  ]));
}

function addPromptGuard(rendererTask: RendererTask, guard: string): void {
  if (!rendererTask.prompt.includes(guard)) {
    rendererTask.prompt = `${rendererTask.prompt} ${guard}`.trim();
  }
}

function removeFieldNameInstructions(prompt: string): string {
  return prompt
    .replace(
      /\s*Use the field name ['"][^'"]+['"] for the question\./gi,
      ""
    )
    .replace(
      /\s*Do not expose field names to the user\./gi,
      ""
    )
    .trim();
}

function removeForbiddenOperationalLanguage(prompt: string): string {
  return prompt
    .replace(
      /assure them that you will look into it\.?/gi,
      "acknowledge their concern without promising any action."
    )
    .replace(
      /assure (the user|them) that (their|the) concern will be addressed\.?/gi,
      "acknowledge the user's concern without promising any action."
    )
    .replace(
      /you will look into it\.?/gi,
      "their concern is understood."
    )
    .replace(
      /support will look into it\.?/gi,
      "their concern is understood."
    )
    .replace(
      /will be addressed\.?/gi,
      "is understood."
    )
    .trim();
}

function isDuplicateInvoiceOnly(message: string): boolean {
  const normalizedMessage = message.toLowerCase();
  const mentionsInvoice = /\b(facture|invoice)\b/i.test(normalizedMessage);
  const mentionsDuplicate = /\b(double|deux fois|twice|duplicate)\b/i.test(
    normalizedMessage
  );
  const mentionsPaymentOrCharge =
    /\b(paiement|pay[eé]|prélev[ée]|prélèvement|d[ée]bit[ée]?|montant|devise|charge|payment|paid|charged|amount|currency)\b/i.test(
      normalizedMessage
    );

  return mentionsInvoice && mentionsDuplicate && !mentionsPaymentOrCharge;
}

function sanitizeNoSolutionPlan(params: {
  knowledgeGate: KnowledgeGate;
  rendererTask: RendererTask;
}): void {
  if (params.knowledgeGate.solutionAllowed) {
    return;
  }

  params.rendererTask.prompt = removeForbiddenOperationalLanguage(
    params.rendererTask.prompt
  );
  const guard =
    "Do not add a solution, diagnosis, procedure, refund, reference, status page, timeline, investigation promise, resolution promise, escalation claim, or team action.";

  addPromptGuard(params.rendererTask, guard);
  appendForbiddenClaims(params.rendererTask, [
    "No solution.",
    "No diagnosis.",
    "No procedure.",
    "No refund.",
    "No reference number.",
    "No status page.",
    "No timeline.",
    "No investigation promise.",
    "No resolution promise.",
    "No escalation claim.",
    "No team action."
  ]);
}

function sanitizeDuplicateInvoiceOnlyPlan(params: {
  topicUserMessageContent: string;
  questionDecision: QuestionDecision;
  rendererTask: RendererTask;
}): void {
  if (!isDuplicateInvoiceOnly(params.topicUserMessageContent)) {
    return;
  }

  params.questionDecision.fieldNames = params.questionDecision.fieldNames.filter(
    (fieldName) => {
      return !["amount", "currency"].includes(fieldName);
    }
  );
  params.rendererTask.questionFieldNames =
    params.rendererTask.questionFieldNames.filter((fieldName) => {
      return !["amount", "currency"].includes(fieldName);
    });

  if (params.questionDecision.fieldNames.length === 0) {
    params.questionDecision.shouldAskQuestion = false;
    params.questionDecision.plannedQuestionCount = 0;
    params.questionDecision.questionInstruction = null;
    params.rendererTask.questionFieldNames = [];
  } else {
    params.questionDecision.plannedQuestionCount =
      params.questionDecision.fieldNames.length;
  }

  addPromptGuard(
    params.rendererTask,
    "Do not describe the duplicate invoice as a duplicate payment or duplicate charge unless the user explicitly says they were charged or paid twice. Do not ask for amount or currency first. Do not mention refund, investigation, case processing, or team action."
  );
  appendForbiddenClaims(params.rendererTask, [
    "No duplicate payment claim.",
    "No duplicate charge claim.",
    "No amount question first.",
    "No currency question first.",
    "No refund.",
    "No investigation promise.",
    "No case processing claim.",
    "No team action."
  ]);
}

function getNonAskableFieldNames(input: unknown): Set<string> {
  if (!isRecord(input) || !isRecord(input.selectedCatalogKnowledge)) {
    return new Set();
  }

  const selectedFields = input.selectedCatalogKnowledge.selectedFields;

  if (!Array.isArray(selectedFields)) {
    return new Set();
  }

  return new Set(selectedFields.flatMap((field) => {
    if (
      !isRecord(field) ||
      field.askableByUser !== false ||
      !isString(field.fieldName)
    ) {
      return [];
    }

    return [field.fieldName.trim()];
  }));
}

function sanitizeNonAskableQuestions(params: {
  input: unknown;
  questionDecision: QuestionDecision;
  rendererTask: RendererTask;
}): void {
  const nonAskableFieldNames = getNonAskableFieldNames(params.input);

  if (nonAskableFieldNames.size === 0) {
    return;
  }

  params.questionDecision.fieldNames =
    params.questionDecision.fieldNames.filter((fieldName) => {
      return !nonAskableFieldNames.has(fieldName);
    });
  params.rendererTask.questionFieldNames =
    params.rendererTask.questionFieldNames.filter((fieldName) => {
      return !nonAskableFieldNames.has(fieldName);
    });

  if (params.questionDecision.fieldNames.length === 0) {
    params.questionDecision.shouldAskQuestion = false;
    params.questionDecision.plannedQuestionCount = 0;
    params.questionDecision.questionInstruction = null;
    params.rendererTask.questionFieldNames = [];
    addPromptGuard(
      params.rendererTask,
      "Do not ask the user for fields that require internal support or system verification."
    );
    return;
  }

  params.questionDecision.plannedQuestionCount =
    params.questionDecision.fieldNames.length;
}

function getStringValues(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    return isString(item) ? [item.trim()] : [];
  });
}

function getAlreadyAnsweredOrUnavailableFieldNames(input: unknown): Set<string> {
  if (!isRecord(input)) {
    return new Set();
  }

  const fieldNames = new Set<string>();
  const topicEvidence = isRecord(input.topicEvidence)
    ? input.topicEvidence
    : {};
  const relatedTextUnderstandings = topicEvidence.relatedTextUnderstandings;

  if (Array.isArray(relatedTextUnderstandings)) {
    for (const understanding of relatedTextUnderstandings) {
      if (!isRecord(understanding) || !Array.isArray(understanding.facts)) {
        continue;
      }

      for (const fact of understanding.facts) {
        if (
          isRecord(fact) &&
          fact.type === "catalogued_field" &&
          isString(fact.fieldName)
        ) {
          fieldNames.add(fact.fieldName.trim());
        }
      }
    }
  }

  const relatedAttachmentUnderstandings =
    topicEvidence.relatedAttachmentUnderstandings;

  if (Array.isArray(relatedAttachmentUnderstandings)) {
    for (const attachment of relatedAttachmentUnderstandings) {
      if (!isRecord(attachment) || !isRecord(attachment.extractedFields)) {
        continue;
      }

      for (const fieldName of Object.keys(attachment.extractedFields)) {
        fieldNames.add(fieldName);
      }
    }
  }

  if (isRecord(topicEvidence.existingTopic)) {
    const existingTopic = topicEvidence.existingTopic;

    if (isRecord(existingTopic.topic_details)) {
      for (const [fieldName, value] of Object.entries(
        existingTopic.topic_details
      )) {
        if (value !== undefined && value !== null && value !== "") {
          fieldNames.add(fieldName);
        }
      }
    }

    for (const fieldName of [
      ...getStringValues(existingTopic.refusedFields),
      ...getStringValues(existingTopic.refused_fields),
      ...getStringValues(existingTopic.declinedFields),
      ...getStringValues(existingTopic.declined_fields),
      ...getStringValues(existingTopic.unavailableFields),
      ...getStringValues(existingTopic.unavailable_fields),
      ...getStringValues(existingTopic.impossibleFields),
      ...getStringValues(existingTopic.impossible_fields)
    ]) {
      fieldNames.add(fieldName);
    }

    if (isRecord(existingTopic.knownFacts)) {
      for (const fieldName of Object.keys(existingTopic.knownFacts)) {
        fieldNames.add(fieldName);
      }
    }
  }

  return fieldNames;
}

function sanitizeAlreadyAnsweredQuestions(params: {
  input: unknown;
  questionDecision: QuestionDecision;
  rendererTask: RendererTask;
}): void {
  const unavailableFieldNames =
    getAlreadyAnsweredOrUnavailableFieldNames(params.input);

  if (unavailableFieldNames.size === 0) {
    return;
  }

  params.questionDecision.fieldNames =
    params.questionDecision.fieldNames.filter((fieldName) => {
      return !unavailableFieldNames.has(fieldName);
    });
  params.rendererTask.questionFieldNames =
    params.rendererTask.questionFieldNames.filter((fieldName) => {
      return !unavailableFieldNames.has(fieldName);
    });

  if (params.questionDecision.fieldNames.length === 0) {
    params.questionDecision.shouldAskQuestion = false;
    params.questionDecision.plannedQuestionCount = 0;
    params.questionDecision.questionInstruction = null;
    params.rendererTask.questionFieldNames = [];
    addPromptGuard(
      params.rendererTask,
      "Do not ask again for information already provided, refused, or unavailable."
    );
    return;
  }

  params.questionDecision.plannedQuestionCount =
    params.questionDecision.fieldNames.length;
}

function normalizeQuestionFields(params: {
  questionDecision: QuestionDecision;
  rendererTask: RendererTask;
}): void {
  params.rendererTask.prompt = removeFieldNameInstructions(
    params.rendererTask.prompt
  );

  if (!params.questionDecision.shouldAskQuestion) {
    params.questionDecision.plannedQuestionCount = 0;
    params.questionDecision.fieldNames = [];
    params.questionDecision.questionInstruction = null;
    params.rendererTask.questionFieldNames = [];
    addPromptGuard(params.rendererTask, "Do not ask any question.");
    appendForbiddenClaims(params.rendererTask, ["No question."]);
    return;
  }

  params.questionDecision.plannedQuestionCount =
    params.questionDecision.fieldNames.length;
  params.rendererTask.questionFieldNames = params.questionDecision.fieldNames;
  addPromptGuard(
    params.rendererTask,
    `Ask exactly ${params.questionDecision.fieldNames.length} natural question(s), and do not add any separate rephrasing or follow-up question. Do not mention field names.`
  );
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
  const droppedItems: string[] = [];
  const knowledgeGate = formatKnowledgeGate(raw.knowledgeGate, droppedItems);
  const questionDecision = formatQuestionDecision(
    raw.questionDecision,
    droppedItems
  );
  const rendererTask = formatRendererTask(raw.rendererTask, droppedItems);

  if (!knowledgeGate || !questionDecision || !rendererTask) {
    return {
      responsePlan: buildFallbackPlan("invalid_response_plan_contract"),
      validation: {
        status: "fallback",
        reason: "invalid_response_plan_contract",
        droppedItems
      }
    };
  }

  sanitizeNoSolutionPlan({
    knowledgeGate,
    rendererTask
  });
  sanitizeDuplicateInvoiceOnlyPlan({
    topicUserMessageContent: input.input.topicUserMessageContent,
    questionDecision,
    rendererTask
  });
  sanitizeNonAskableQuestions({
    input: input.input,
    questionDecision,
    rendererTask
  });
  sanitizeAlreadyAnsweredQuestions({
    input: input.input,
    questionDecision,
    rendererTask
  });
  normalizeQuestionFields({
    questionDecision,
    rendererTask
  });

  if (
    hasInvalidQuestionConsistency({
      questionDecision,
      rendererTask
    })
  ) {
    return {
      responsePlan: buildFallbackPlan("invalid_question_consistency"),
      validation: {
        status: "fallback",
        reason: "invalid_question_consistency"
      }
    };
  }

  return {
    responsePlan: {
      responsePlanId: stringValue(raw.responsePlanId, "response_plan_1"),
      knowledgeGate,
      questionDecision,
      rendererTask,
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
