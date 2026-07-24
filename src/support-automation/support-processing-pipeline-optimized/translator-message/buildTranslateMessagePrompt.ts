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
Translate the message into the target language.
If the message is already in the target language, return it unchanged.
Do not rewrite.
Do not summarize.
Do not add explanations.
Do not add greetings.
Do not change formatting except what is necessary for translation.
If the letters are in uppercase, keep them in uppercase.
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
