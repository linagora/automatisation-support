// src/support-processing-pipeline/message-analysis/analysis-gate/runAnalysisGate.ts

/**
 * Analysis Gate
 *
 * Decides whether the latest user message should go:
 * - first through lightweight analysis
 * - directly through full-weight analysis
 *
 * This gate is deterministic.
 * It only reads latestUserMessage.
 */

import type {
  LatestUserMessage
} from "../../typesSupportProcessingPipeline.types";

type AnalysisGateRoute =
  | "light_weight_first"
  | "full_weight_direct";

type AnalysisGateCheckName =
  | "empty_message"
  | "short_message"
  | "pure_signal_message"
  | "closure_or_confirmation_message"
  | "scope_boundary_candidate"
  | "vague_complaint_without_actionable_detail"
  | "ambiguous_message_without_actionable_detail"
  | "explicit_bug_or_error"
  | "explicit_access_security_issue"
  | "explicit_billing_issue"
  | "explicit_question_or_request"
  | "actionable_trigger_context"
  | "error_code_detected"
  | "detailed_actionable_message";

export type AnalysisGateInput = {
  latestUserMessage: LatestUserMessage;
};

export type AnalysisGateOutput = {
  decision: {
    route: AnalysisGateRoute;
  };
  history: {
    prefer_light_first: AnalysisGateCheckName[];
    prefer_full_direct: AnalysisGateCheckName[];
  };
};

const SHORT_MESSAGE_MAX_WORDS = 5;
const DETAILED_MESSAGE_MIN_LENGTH = 40;

const BUG_OR_ERROR_PATTERNS = [
  /\berreur\b/i,
  /\berror\b/i,
  /\bbug\b/i,
  /\bprobleme\b/i,
  /\bproblem\b/i,
  /\bincident\b/i,
  /\bimpossible\b/i,
  /\bcrash\b/i,
  /\bne fonctionne pas\b/i,
  /\bne marche pas\b/i,
  /\bca ne marche pas\b/i,
  /\bca marche pas\b/i,
  /\brien ne se passe\b/i,
  /\bnot working\b/i,
  /\bdoes not work\b/i,
  /\bi cannot\b/i,
  /\bi can't\b/i
];

const ACCESS_SECURITY_PATTERNS = [
  /\bconnexion\b/i,
  /\blogin\b/i,
  /\bconnecter\b/i,
  /\bauthentification\b/i,
  /\bmot de passe\b/i,
  /\bpassword\b/i,
  /\bcompte\b/i,
  /\baccount\b/i,
  /\bmfa\b/i,
  /\bpermission\b/i,
  /\binvitation\b/i
];

const BILLING_PATTERNS = [
  /\bfacture\b/i,
  /\bfacturation\b/i,
  /\bpaiement\b/i,
  /\babonnement\b/i,
  /\bprelevement\b/i,
  /\bprélèvement\b/i,
  /\bdebite\b/i,
  /\bdébité\b/i,
  /\brefund\b/i,
  /\bbilling\b/i,
  /\bpayment\b/i,
  /\bsubscription\b/i,
  /\binvoice\b/i
];

const QUESTION_OR_REQUEST_PATTERNS = [
  /\bcomment\b/i,
  /\bhow to\b/i,
  /\best-ce possible\b/i,
  /\bis it possible\b/i,
  /\bje voudrais\b/i,
  /\bj'aimerais\b/i,
  /\bi would like\b/i,
  /\bcan you\b/i,
  /\bpouvez-vous\b/i
];

const TRIGGER_CONTEXT_PATTERNS = [
  /\bquand je\b/i,
  /\blorsque je\b/i,
  /\bdes que je\b/i,
  /\bdès que je\b/i,
  /\bwhen i\b/i,
  /\bwhenever i\b/i,
  /\bafter i\b/i,
  /\ben cliquant\b/i,
  /\bquand je clique\b/i,
  /\bwhen i click\b/i
];

const ERROR_CODE_PATTERNS = [
  /\b[45][0-9]{2}\b/i,
  /\berreur\s*[0-9]{3,5}\b/i,
  /\berror\s*[0-9]{3,5}\b/i
];

const SIGNAL_PATTERNS = [
  /\bmerci\b/i,
  /\bthanks\b/i,
  /\bthank you\b/i,
  /\bparfait\b/i,
  /\bsuper\b/i,
  /\btop\b/i,
  /\bdesole\b/i,
  /\bdésolé\b/i,
  /\bsorry\b/i,
  /\bj'attends\b/i,
  /\bany update\b/i,
  /\bpas satisfait\b/i,
  /\bdéçu\b/i,
  /\bdisappointed\b/i,
  /\brésilier\b/i,
  /\bcancel my subscription\b/i
];

const CLOSURE_OR_CONFIRMATION_PATTERNS = [
  /\bok\b/i,
  /\boui\b/i,
  /\bnon\b/i,
  /\bd'accord\b/i,
  /\bbien recu\b/i,
  /\bbien reçu\b/i,
  /\bca marche\b/i,
  /\bça marche\b/i,
  /\bc'est bon\b/i,
  /\bresolu\b/i,
  /\brésolu\b/i,
  /\bfixed\b/i,
  /\bsolved\b/i,
  /\bdone\b/i
];

const SCOPE_BOUNDARY_PATTERNS = [
  /\bseo\b/i,
  /\bbacklink\b/i,
  /\bcasino\b/i,
  /\bcrypto\b/i,
  /\bviagra\b/i,
  /\boffre commerciale\b/i,
  /\bprospection\b/i,
  /\bagence marketing\b/i,
  /\becris-moi un poeme\b/i,
  /\bécris-moi un poème\b/i,
  /\braconte une blague\b/i,
  /\bfais mes devoirs\b/i,
  /\brecette de cuisine\b/i,
  /\bgenerate an image\b/i,
  /\bwrite me a poem\b/i,
  /\btell me a joke\b/i,
  /\bchatgpt\b/i,
  /\bopenai\b/i,
  /\bfacebook\b/i,
  /\binstagram\b/i,
  /\btiktok\b/i
];

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function countWords(value: string): number {
  const normalized = normalizeText(value);

  if (!normalized) {
    return 0;
  }

  return normalized.split(" ").length;
}

function matchesAny(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

function addCheck(
  checks: AnalysisGateCheckName[],
  check: AnalysisGateCheckName
): void {
  if (!checks.includes(check)) {
    checks.push(check);
  }
}

function hasActionableDetail(message: string): boolean {
  const normalized = normalizeText(message);

  return (
    message.length >= DETAILED_MESSAGE_MIN_LENGTH ||
    matchesAny(normalized, ERROR_CODE_PATTERNS) ||
    matchesAny(normalized, TRIGGER_CONTEXT_PATTERNS) ||
    /https?:\/\//i.test(message)
  );
}

function collectFullDirectChecks(
  message: string
): AnalysisGateCheckName[] {
  const normalized = normalizeText(message);
  const checks: AnalysisGateCheckName[] = [];

  if (matchesAny(normalized, ERROR_CODE_PATTERNS)) {
    addCheck(checks, "error_code_detected");
  }

  if (matchesAny(normalized, BUG_OR_ERROR_PATTERNS)) {
    addCheck(checks, "explicit_bug_or_error");
  }

  if (matchesAny(normalized, ACCESS_SECURITY_PATTERNS)) {
    addCheck(checks, "explicit_access_security_issue");
  }

  if (matchesAny(normalized, BILLING_PATTERNS)) {
    addCheck(checks, "explicit_billing_issue");
  }

  if (matchesAny(normalized, QUESTION_OR_REQUEST_PATTERNS)) {
    addCheck(checks, "explicit_question_or_request");
  }

  if (matchesAny(normalized, TRIGGER_CONTEXT_PATTERNS)) {
    addCheck(checks, "actionable_trigger_context");
  }

  if (hasActionableDetail(message)) {
    addCheck(checks, "detailed_actionable_message");
  }

  return checks;
}

function collectLightFirstChecks(
  message: string,
  fullDirectChecks: AnalysisGateCheckName[]
): AnalysisGateCheckName[] {
  const normalized = normalizeText(message);
  const checks: AnalysisGateCheckName[] = [];

  if (!normalized) {
    addCheck(checks, "empty_message");
    return checks;
  }

  const isShort = countWords(message) <= SHORT_MESSAGE_MAX_WORDS;
  const hasFullDirectSignal = fullDirectChecks.length > 0;

  if (isShort) {
    addCheck(checks, "short_message");
  }

  if (
    matchesAny(normalized, SIGNAL_PATTERNS) &&
    !hasFullDirectSignal
  ) {
    addCheck(checks, "pure_signal_message");
  }

  if (
    matchesAny(normalized, CLOSURE_OR_CONFIRMATION_PATTERNS) &&
    !hasFullDirectSignal
  ) {
    addCheck(checks, "closure_or_confirmation_message");
  }

  if (matchesAny(normalized, SCOPE_BOUNDARY_PATTERNS)) {
    addCheck(checks, "scope_boundary_candidate");
  }

  if (
    matchesAny(normalized, BUG_OR_ERROR_PATTERNS) &&
    !hasActionableDetail(message)
  ) {
    addCheck(checks, "vague_complaint_without_actionable_detail");
  }

  if (
    !hasFullDirectSignal &&
    checks.length === 0
  ) {
    addCheck(checks, "ambiguous_message_without_actionable_detail");
  }

  return checks;
}

function decideRoute(params: {
  preferLightFirst: AnalysisGateCheckName[];
  preferFullDirect: AnalysisGateCheckName[];
}): AnalysisGateRoute {
  const hasFullDirectEvidence = params.preferFullDirect.length > 0;
  const hasOnlyLightEvidence =
    params.preferLightFirst.length > 0 &&
    params.preferFullDirect.length === 0;

  if (hasFullDirectEvidence) {
    return "full_weight_direct";
  }

  if (hasOnlyLightEvidence) {
    return "light_weight_first";
  }

  return "light_weight_first";
}

function runAnalysisGate(
  input: AnalysisGateInput
): AnalysisGateOutput {
  const latestUserMessageContent =
    input.latestUserMessage.content.trim();

  const preferFullDirect = collectFullDirectChecks(
    latestUserMessageContent
  );

  const preferLightFirst = collectLightFirstChecks(
    latestUserMessageContent,
    preferFullDirect
  );

  return {
    decision: {
      route: decideRoute({
        preferLightFirst,
        preferFullDirect
      })
    },
    history: {
      prefer_light_first: preferLightFirst,
      prefer_full_direct: preferFullDirect
    }
  };
}

export {
  runAnalysisGate
};

export type {
  AnalysisGateRoute,
  AnalysisGateCheckName
};