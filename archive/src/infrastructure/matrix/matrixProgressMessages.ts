import {
  normalizeUserLanguageForTemplate
} from "../../support-automation/support-processing-pipeline-v2-LEGACY/response-language/normalizeUserLanguageForResponse";

const FRENCH_MATRIX_PROGRESS_MESSAGES = {
  buffer_started: "Je vous lis…",
  buffer_waiting: "Je regroupe vos messages…",
  buffer_flushed: "J’analyse votre demande…",
  analyzing: "J’analyse votre demande…",
  analyzing_surface: "Je comprends votre message…",
  analyzing_support: "Je qualifie le problème rencontré…",
  updating_topics: "Je rattache votre demande au bon sujet…",
  searching: "Je vérifie les informations utiles…",
  planning_response: "Je prépare la réponse…",
  rendering_response: "Je rédige la réponse…",
  building_user_response: "Je finalise la réponse…",
  sending_response: "J’envoie la réponse…",
  done: "Ci-dessous, voici ma réponse générée automatiquement.",
  failed: "Le traitement a échoué."
} as const;

type MatrixProgressMessageKey = keyof typeof FRENCH_MATRIX_PROGRESS_MESSAGES;
type MatrixProgressMessageSet = Record<MatrixProgressMessageKey, string>;

const ENGLISH_MATRIX_PROGRESS_MESSAGES: MatrixProgressMessageSet = {
  buffer_started: "I'm reading your message...",
  buffer_waiting: "I'm grouping your messages...",
  buffer_flushed: "I'm analyzing your request...",
  analyzing: "I'm analyzing your request...",
  analyzing_surface: "I understand your message...",
  analyzing_support: "I'm qualifying the issue...",
  updating_topics: "I'm linking your request to the right topic...",
  searching: "I'm checking the useful information...",
  planning_response: "I'm preparing the response...",
  rendering_response: "I'm writing the response...",
  building_user_response: "I'm finalizing the response...",
  sending_response: "I'm sending the response...",
  done: "Below is my automatically generated response.",
  failed: "Processing failed."
} as const;

const DEFAULT_MATRIX_PROGRESS_MESSAGES: MatrixProgressMessageSet =
  FRENCH_MATRIX_PROGRESS_MESSAGES;

function resolveMatrixProgressMessages(params: {
  userLanguage?: string;
}): MatrixProgressMessageSet {
  return normalizeUserLanguageForTemplate(params.userLanguage) === "French"
    ? FRENCH_MATRIX_PROGRESS_MESSAGES
    : ENGLISH_MATRIX_PROGRESS_MESSAGES;
}

function formatMatrixProgressStageMessage(params: {
  stage: keyof typeof DEFAULT_MATRIX_PROGRESS_MESSAGES;
  userLanguage?: string;
}): string {
  return resolveMatrixProgressMessages(params)[params.stage];
}

function formatMatrixProgressFinalMessage(params: {
  userLanguage?: string;
}): string {
  return formatMatrixProgressStageMessage({
    stage: "done",
    userLanguage: params.userLanguage
  });
}

export {
  DEFAULT_MATRIX_PROGRESS_MESSAGES,
  formatMatrixProgressFinalMessage,
  formatMatrixProgressStageMessage
};
