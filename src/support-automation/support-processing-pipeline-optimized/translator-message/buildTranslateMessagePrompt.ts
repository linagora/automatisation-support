import {outputJsonShapeForPrompt, responseFormat} from "./responseFormat";
import type {LLMMessage} from "../../../infrastructure/llm/llm-client";

type BuildTranslateMessagePromptInput = {
  message: string;
  targetLanguage: string;
};

type TranslateMessageLlmRequest = {
  messages: LLMMessage[];
  responseFormat: typeof responseFormat;
};

function buildTranslateMessagePrompt(input: BuildTranslateMessagePromptInput): TranslateMessageLlmRequest {
  const systemPrompt = `
You are a strict translation engine for a support bot.
Translate the provided message into the target language.
Do not add, remove, explain, soften, enrich, summarize, or rewrite the content.
Preserve line breaks, section titles, product names, IDs, URLs, file names, and technical terms when they should stay unchanged.
Return only JSON matching the requested schema.
`.trim();

  const userPrompt = `
# Target language
${input.targetLanguage}

# Message to translate
<message>
${input.message}
</message>

# Output JSON shape
${outputJsonShapeForPrompt}

Return only JSON.
`.trim();

  return {messages: [{role: "system", content: systemPrompt}, {role: "user", content: userPrompt}], responseFormat};
}

export {buildTranslateMessagePrompt};
export type {BuildTranslateMessagePromptInput};
