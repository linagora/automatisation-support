import {callLLM} from "../../infrastructure/llm/llm-client";
import {parseLLMResponse} from "../../infrastructure/llm/parseLLMResponse";
import {buildTranslateMessagePrompt} from "./buildTranslateMessagePrompt";
import {validateTranslateMessageOutput} from "./validateTranslateMessageOutput";

type TranslateMessageInput = {
  message: string;
  targetLanguage: string | null;
};

type TranslateMessageOutput =
  | {status: "processed"; fallbackReason: null; message: string; translated: boolean; targetLanguage: string | null}
  | {status: "fallback"; fallbackReason: TranslateMessageFallbackReason; message: string; translated: false; targetLanguage: string | null};

type TranslateMessageFallbackReason =
  | {source: "translator_message"; reason: "empty_message"}
  | {source: "translator_message"; reason: "llm_call_failed"}
  | {source: "translator_message"; reason: "missing_llm_content"}
  | {source: "translator_message"; reason: "invalid_llm_output"};

async function runTranslateMessage(input: TranslateMessageInput): Promise<TranslateMessageOutput> {
  const message = input.message.trim();
  if (message === "") return buildFallback(input, {source: "translator_message", reason: "empty_message"});

  if (!shouldTranslate(input.targetLanguage)) {
    return {status: "processed", fallbackReason: null, message, translated: false, targetLanguage: input.targetLanguage};
  }

  const {messages, responseFormat} = buildTranslateMessagePrompt({message, targetLanguage: input.targetLanguage as string});

  try {
    const result = await callLLM(messages, {
      stage: "translate_support_message",
      preset: "standard",
      temperature: 0,
      maxTokens: 1200,
      responseFormat
    });

    if (!result.success) return buildFallback(input, {source: "translator_message", reason: "llm_call_failed"});
    if (!result.content || result.content.trim() === "") return buildFallback(input, {source: "translator_message", reason: "missing_llm_content"});

    const parsedResponse = parseLLMResponse(result.content);
    if (!parsedResponse) return buildFallback(input, {source: "translator_message", reason: "invalid_llm_output"});

    const validatedOutput = validateTranslateMessageOutput(parsedResponse);
    if (!validatedOutput) return buildFallback(input, {source: "translator_message", reason: "invalid_llm_output"});

    return {
      status: "processed",
      fallbackReason: null,
      message: validatedOutput.translatedMessage,
      translated: true,
      targetLanguage: input.targetLanguage
    };
  } catch {
    return buildFallback(input, {source: "translator_message", reason: "llm_call_failed"});
  }
}

function shouldTranslate(targetLanguage: string | null): boolean {
  if (targetLanguage === null) return false;
  const normalized = targetLanguage.trim().toLowerCase();
  if (normalized === "" || normalized === "unknown") return false;

  return !["en", "eng", "english", "anglais"].includes(normalized);
}

function buildFallback(input: TranslateMessageInput, fallbackReason: TranslateMessageFallbackReason): TranslateMessageOutput {
  return {status: "fallback", fallbackReason, message: input.message.trim(), translated: false, targetLanguage: input.targetLanguage};
}

export {runTranslateMessage};
export type {TranslateMessageFallbackReason, TranslateMessageInput, TranslateMessageOutput};
