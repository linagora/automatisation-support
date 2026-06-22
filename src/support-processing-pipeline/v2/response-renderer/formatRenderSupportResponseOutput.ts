import {
  RENDERED_MESSAGE_PURPOSE_VALUES
} from "./renderSupportResponse.taxonomy";

import type {
  FormatRenderSupportResponseOutput,
  FormatRenderSupportResponseOutputInput,
  RawRenderedMessage,
  RawRenderedSupportResponse,
  RenderedMessage,
  RenderedMessagePurpose,
  RenderedSupportResponse
} from "./typesRenderSupportResponse.types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function stringValue(value: unknown, fallback: string): string {
  return isString(value) ? value.trim() : fallback;
}

function numberValue(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.floor(value));
}

function numberList(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (typeof item !== "number" || !Number.isFinite(item)) {
      return [];
    }

    return [Math.max(1, Math.floor(item))];
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

function getStandardFragmentSubcategories(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((fragment) => {
    if (!isRecord(fragment)) {
      return [];
    }

    return isString(fragment.standardSubcategory)
      ? [fragment.standardSubcategory.trim()]
      : [];
  });
}

function buildFallbackText(input: FormatRenderSupportResponseOutputInput): string {
  const standardSubcategories = getStandardFragmentSubcategories(
    input.input.standardResponseFragments
  );
  const useFrench = input.input.topicResponsePlans.some((plan) => {
    return plan.rendererTask.targetLanguage === "French";
  }) || input.input.targetLanguage === "French" ||
    /\b(bonjour|merci|probl[eè]me|aide|je|j['’]|oui|non|normalement|semaine derni[eè]re|derni[eè]re fois|mot de passe|[çc]a marche|[çc]a ne marche pas)\b/i.test(
      input.input.latestUserMessageContent
    );

  if (standardSubcategories.includes("handover_request")) {
    return useFrench
      ? "Votre demande va être transmise à l’équipe support. Je reste disponible en attendant si vous souhaitez ajouter du contexte ou obtenir une première aide."
      : "Your request will be passed on to the support team. I remain available in the meantime if you want to add context or get initial help.";
  }

  if (standardSubcategories.includes("greeting")) {
    return useFrench
      ? "Bonjour, je suis l’assistant du support. Comment puis-je vous aider ?"
      : "Hello, I’m the support assistant. How can I help?";
  }

  if (standardSubcategories.includes("unclear_message")) {
    return useFrench
      ? "Je n’ai pas bien compris votre demande. Pouvez-vous la reformuler ?"
      : "I did not fully understand your request. Could you rephrase it?";
  }

  return useFrench
    ? "Merci pour votre message."
    : "Thank you for your message.";
}

function buildFallbackResponse(
  input: FormatRenderSupportResponseOutputInput,
  reason: string
): RenderedSupportResponse {
  const fallbackText = buildFallbackText(input);

  return {
    renderedMessages: [
      {
        messageId: "rendered_message_fallback_1",
        messageOrder: 1,
        purpose: "fallback",
        relatedPlannedMessageOrders: [],
        content: fallbackText
      }
    ],
    finalResponseText: fallbackText,
    internalRenderingNotes: `Fallback rendered response used because: ${reason}`
  };
}

function formatRenderedMessage(params: {
  raw: RawRenderedMessage;
  index: number;
  droppedItems: string[];
}): RenderedMessage | undefined {
  const purpose = enumValue(
    params.raw.purpose,
    RENDERED_MESSAGE_PURPOSE_VALUES
  ) as RenderedMessagePurpose | undefined;
  const content = stringValue(params.raw.content, "");

  if (!purpose) {
    params.droppedItems.push(`renderedMessages[${params.index}].purpose`);
    return undefined;
  }

  if (!content) {
    params.droppedItems.push(`renderedMessages[${params.index}].content`);
    return undefined;
  }

  return {
    messageId: stringValue(
      params.raw.messageId,
      `rendered_message_${params.index + 1}`
    ),
    messageOrder: numberValue(params.raw.messageOrder, params.index + 1),
    purpose,
    relatedPlannedMessageOrders: numberList(
      params.raw.relatedPlannedMessageOrders
    ),
    content
  };
}

function formatRenderSupportResponseOutput(
  input: FormatRenderSupportResponseOutputInput
): FormatRenderSupportResponseOutput {
  if (input.rawRenderSupportResponse.status !== "completed") {
    const reason =
      input.rawRenderSupportResponse.error?.message ?? "llm_call_failed";

    return {
      renderedResponse: buildFallbackResponse(input, reason),
      validation: {
        status: "fallback",
        reason
      }
    };
  }

  if (!isRecord(input.rawRenderSupportResponse.parsedResponse)) {
    return {
      renderedResponse: buildFallbackResponse(
        input,
        "invalid_or_missing_parsed_response"
      ),
      validation: {
        status: "fallback",
        reason: "invalid_or_missing_parsed_response"
      }
    };
  }

  const raw = input.rawRenderSupportResponse
    .parsedResponse as RawRenderedSupportResponse;
  const droppedItems: string[] = [];
  const renderedMessages = Array.isArray(raw.renderedMessages)
    ? raw.renderedMessages.flatMap((rawMessage, index) => {
        if (!isRecord(rawMessage)) {
          droppedItems.push(`renderedMessages[${index}]`);
          return [];
        }

        const formattedMessage = formatRenderedMessage({
          raw: rawMessage,
          index,
          droppedItems
        });

        return formattedMessage ? [formattedMessage] : [];
      })
    : [];

  if (renderedMessages.length === 0) {
    return {
      renderedResponse: buildFallbackResponse(input, "no_valid_rendered_messages"),
      validation: {
        status: "fallback",
        reason: "no_valid_rendered_messages",
        droppedItems
      }
    };
  }

  const sortedMessages = renderedMessages.sort((left, right) => {
    return left.messageOrder - right.messageOrder;
  });
  const computedFinalResponseText = sortedMessages
    .map((message) => {
      return message.content;
    })
    .join("\n\n");
  const rawFinalResponseText = stringValue(raw.finalResponseText, "");

  return {
    renderedResponse: {
      renderedMessages: sortedMessages,
      finalResponseText: rawFinalResponseText || computedFinalResponseText,
      internalRenderingNotes: stringValue(
        raw.internalRenderingNotes,
        "No internal rendering notes provided."
      )
    },
    validation: {
      status: "valid",
      ...(droppedItems.length > 0 ? { droppedItems } : {})
    }
  };
}

export {
  buildFallbackResponse,
  formatRenderSupportResponseOutput
};
