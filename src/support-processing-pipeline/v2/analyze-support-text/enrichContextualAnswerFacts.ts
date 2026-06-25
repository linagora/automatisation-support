import type {
  ExtractableFieldDefinition,
  RecentInteractionContext,
  TextUnderstanding
} from "../typesSupportProcessingPipelineV2.types";

const CONTEXTUAL_BOOLEAN_FIELD_VALUES: Record<
  string,
  { affirmative: string; negative: string }
> = {
  notification_permission_status: {
    affirmative: "granted",
    negative: "not_granted"
  },
  notification_channel_status: {
    affirmative: "enabled",
    negative: "disabled"
  }
};

function enrichContextualAnswerFacts(params: {
  textUnderstandings: TextUnderstanding[];
  recentInteractionContext: RecentInteractionContext;
  extractableFieldCatalog: ExtractableFieldDefinition[];
}): TextUnderstanding[] {
  const askedFieldNames =
    params.recentInteractionContext.previousBotQuestionFieldNames ?? [];

  if (askedFieldNames.length !== 1) {
    return params.textUnderstandings;
  }

  const fieldName = askedFieldNames[0];
  const contextualValues = CONTEXTUAL_BOOLEAN_FIELD_VALUES[fieldName];
  const fieldIsExtractable = params.extractableFieldCatalog.some((field) => {
    return field.fieldName === fieldName;
  });

  if (!contextualValues || !fieldIsExtractable) {
    return params.textUnderstandings;
  }

  return params.textUnderstandings.map((understanding) => {
    const answerType = understanding.contextualAnswer.type;

    if (answerType !== "affirmative" && answerType !== "negative") {
      return understanding;
    }

    if (understanding.facts.some((fact) => {
      return fact.type === "catalogued_field" &&
        fact.fieldName === fieldName;
    })) {
      return understanding;
    }

    return {
      ...understanding,
      facts: [
        ...understanding.facts,
        {
          type: "catalogued_field" as const,
          fieldName,
          value: contextualValues[answerType],
          evidence: understanding.contextualAnswer.evidence
        }
      ]
    };
  });
}

export {
  enrichContextualAnswerFacts
};
