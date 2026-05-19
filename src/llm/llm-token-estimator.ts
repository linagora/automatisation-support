/**
 * LLM Token Estimator
 *
 * This file estimates the number of tokens that will be sent to the LLM.
 *
 * It is intentionally called at the last moment by llm-client, once the final
 * messages and final attachments have been built.
 *
 * If an input cannot be estimated safely, it throws and the LLM call must not
 * be sent.
 */

import type {
  LLMMessage,
  LLMTokenEstimate
} from "./types.llm-types";

export type LLMTokenEstimate = {
  textTokens: number;
  imageTokens: number;
  outputTokens: number;
  totalTokens: number;
};

function estimateTextTokens(text: string): number {
  return Math.ceil(text.length / 4);
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

function estimateImageTokensFromDataUrl(url: string): number {
  const base64Payload = getBase64PayloadFromDataUrl(url);

  if (!base64Payload) {
    throw new Error("cannot_estimate_image_tokens_without_data_url");
  }

  const sizeBytes = estimateBytesFromBase64(base64Payload);
  const sizeKilobytes = sizeBytes / 1024;

  return Math.max(85, Math.ceil(sizeKilobytes));
}

function estimateImageTokensFromUrl(url: string): number {
  if (url.startsWith("data:image/")) {
    return estimateImageTokensFromDataUrl(url);
  }

  throw new Error("cannot_estimate_remote_image_tokens_without_size");
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
          imageTokens += estimateImageTokensFromUrl(
            contentItem.image_url.url
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