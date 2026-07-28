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

Translate all user-visible text, including headings and titles.

Important:
Lines written in uppercase are usually topic headings or titles.
They are user-visible text and must be translated too.
Do not keep an English uppercase heading unchanged when the target language is not English.
Translate the words of the heading into the target language, then keep the translated heading uppercase.
Preserve product names and brand names such as Twake Chat, Drive, Twake, Linagora.

Examples for French:
- "MESSAGES DISAPPEARING IN TWAKE CHAT" must become "MESSAGES QUI DISPARAISSENT DANS TWAKE CHAT".
- "UNABLE TO RENAME A FILE IN THE DRIVE" must become "IMPOSSIBLE DE RENOMMER UN FICHIER DANS LE DRIVE".

Do not include wrapper tags such as <message> or </message> in the translatedMessage.
Return only JSON matching the requested schema.
`.trim();

  const userPrompt = `
# Target language
${input.targetLanguage}

# Message to translate

${input.message}

# Output JSON shape
${outputJsonShapeForPrompt}

Return only JSON.
`.trim();

  return {messages: [{role: "system", content: systemPrompt}, {role: "user", content: userPrompt}], responseFormat};
}

export {buildTranslateMessagePrompt};
export type {BuildTranslateMessagePromptInput};