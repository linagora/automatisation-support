/**
 * LLM Token Estimator
 *
 * Estimates token usage before sending a request to the LLM.
 *
 * If an input cannot be estimated safely, this file throws.
 * The LLM client must then block the API call.
 */

import type {
  LLMMessage,
  LLMTokenEstimate
} from "./types.llm-types";

const TEXT_CHARS_PER_TOKEN = 4;

const IMAGE_TOKEN_ESTIMATE_BY_DETAIL = {
  low: 85,
  auto: 500,
  high: 1000
} as const;

const MIN_DATA_IMAGE_TOKEN_ESTIMATE = 500;

function estimateTextTokens(text: string): number {
  return Math.ceil(text.length / TEXT_CHARS_PER_TOKEN);
}

function assertNoBase64InText(text: string): void {
  if (
    text.includes("data:image/") ||
    text.includes("data:video/") ||
    text.includes("base64,")
  ) {
    throw new Error("unsafe_text_contains_base64_payload");
  }
}

function getBase64PayloadFromDataUrl(url: string): string | undefined {
  const match = url.match(/^data:[^;]+;base64,(.+)$/);

  return match?.[1];
}

function estimateBytesFromBase64(base64Payload: string): number {
  const padding = base64Payload.endsWith("==")
    ? 2
    : base64Payload.endsWith("=")
      ? 1
      : 0;

  return Math.floor((base64Payload.length * 3) / 4) - padding;
}

function estimateImageTokensFromDataUrl(
  url: string,
  detail: "low" | "high" | "auto"
): number {
  const base64Payload = getBase64PayloadFromDataUrl(url);

  if (!base64Payload) {
    throw new Error("cannot_estimate_image_tokens_without_data_url");
  }

  const sizeBytes = estimateBytesFromBase64(base64Payload);

  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    throw new Error("invalid_data_url_image_size");
  }

  const detailEstimate = IMAGE_TOKEN_ESTIMATE_BY_DETAIL[detail];

  return Math.max(
    MIN_DATA_IMAGE_TOKEN_ESTIMATE,
    detailEstimate
  );
}

function estimateImageTokens(
  url: string,
  detail?: "low" | "high" | "auto"
): number {
  const resolvedDetail = detail ?? "auto";

  if (url.startsWith("data:image/")) {
    return estimateImageTokensFromDataUrl(
      url,
      resolvedDetail
    );
  }

  if (
    url.startsWith("http://") ||
    url.startsWith("https://")
  ) {
    return IMAGE_TOKEN_ESTIMATE_BY_DETAIL[resolvedDetail];
  }

  throw new Error("cannot_estimate_image_tokens_for_unknown_url_type");
}

function estimateLLMTokenUsage(
  messages: LLMMessage[],
  outputTokens: number
): LLMTokenEstimate {
  let textTokens = 0;
  let imageTokens = 0;

  for (const message of messages) {
    if (typeof message.content === "string") {
      assertNoBase64InText(message.content);
      textTokens += estimateTextTokens(message.content);
      continue;
    }

    for (const contentItem of message.content) {
      switch (contentItem.type) {
        case "text": {
          assertNoBase64InText(contentItem.text);
          textTokens += estimateTextTokens(contentItem.text);
          break;
        }

        case "image_url": {
          imageTokens += estimateImageTokens(
            contentItem.image_url.url,
            contentItem.image_url.detail
          );
          break;
        }

        default: {
          throw new Error("unsupported_message_content_type");
        }
      }
    }
  }

  return {
    textTokens,
    imageTokens,
    outputTokens,
    totalTokens: textTokens + imageTokens + outputTokens
  };
}

export {
  estimateLLMTokenUsage
};