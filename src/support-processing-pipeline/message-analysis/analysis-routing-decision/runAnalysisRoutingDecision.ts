type UnknownObject = Record<string, unknown>;

interface SupportKnowledge extends UnknownObject {}

interface SupportKnowledgeDelta extends UnknownObject {}

interface RunPreanalysisDecisionInput {
  latestUserMessage?: string;
  lastUserMessage?: string;
  userMessage?: string;
  message?: string;
  text?: string;

  supportKnowledge?: SupportKnowledge;
  lastSupportKnowledgeDelta?: SupportKnowledgeDelta | null;
  supportKnowledgeDeltaHistory?: SupportKnowledgeDelta[];
  conversationLogs?: UnknownObject[];
  userInformations?: UnknownObject | null;
  visibility?: UnknownObject;
  metadata?: UnknownObject;

  [key: string]: unknown;
}

interface RunDecisionPreAnalysis {
  /**
   * True means: run LLM0 first because the message is ambiguous,
   * contextual, non-actionable, potentially out-of-scope, or needs lightweight classification.
   *
   * False means: do not run LLM0 first. The pipeline can continue with its normal next step.
   */
  shouldRunLLM0: boolean;

  /**
   * Main reason for the decision.
   */
  reason: string;

  /**
   * All deterministic reasons that contributed to the decision.
   */
  reasons: string[];

  /**
   * Deterministically detected signal candidates.
   * LLM0 may later refine or reject these.
   */
  detectedSignals: string[];

  /**
   * Deterministically detected scope-boundary candidates.
   * LLM0 may later refine or reject these.
   */
  detectedScopeBoundaries: string[];
}

interface RunPreanalysisDecisionOutput {
  runDecisionPreAnalysis: RunDecisionPreAnalysis;
}

const SHORT_MESSAGE_MAX_WORDS = 5;
const MIN_ACTIONABLE_DETAIL_LENGTH = 40;

const ACTIONABLE_SUPPORT_PATTERNS = [
  /\berreur\b/i,
  /\berror\b/i,
  /\bbug\b/i,
  /\bprobleme\b/i,
  /\bproblem\b/i,
  /\bincident\b/i,
  /\bimpossible\b/i,
  /\bbloque\b/i,
  /\bblocked\b/i,
  /\bcrash\b/i,
  /\bconnexion\b/i,
  /\blogin\b/i,
  /\bconnecter\b/i,
  /\bauthentification\b/i,
  /\bmot de passe\b/i,
  /\bpassword\b/i,
  /\bcompte\b/i,
  /\baccount\b/i,
  /\bmail\b/i,
  /\bemail\b/i,
  /\bmessage\b/i,
  /\bcalendrier\b/i,
  /\bcalendar\b/i,
  /\bsynchronisation\b/i,
  /\bsync\b/i,
  /\bpiece jointe\b/i,
  /\battachment\b/i,
  /\bpage\b/i,
  /\bformulaire\b/i,
  /\bne fonctionne pas\b/i,
  /\bne marche pas\b/i,
  /\bca ne marche pas\b/i,
  /\bca marche pas\b/i,
  /\bje n'arrive pas\b/i,
  /\bje narrive pas\b/i,
  /\bje ne peux pas\b/i,
  /\bi cannot\b/i,
  /\bi can't\b/i,
  /\bdoes not work\b/i,
  /\bnot working\b/i,
  /\bquand je clique\b/i,
  /\bwhen i click\b/i
];

const ERROR_CODE_PATTERNS = [
  /\b[45][0-9]{2}\b/i,
  /\berreur\s*[0-9]{3,5}\b/i,
  /\berror\s*[0-9]{3,5}\b/i
];

const THANKS_PATTERNS = [
  /\bmerci\b/i,
  /\bmerci beaucoup\b/i,
  /\bthanks\b/i,
  /\bthank you\b/i,
  /\bthx\b/i
];

const POSITIVE_PATTERNS = [
  /\bparfait\b/i,
  /\bsuper\b/i,
  /\btop\b/i,
  /\bexcellent\b/i,
  /\bgenial\b/i,
  /\bgreat\b/i,
  /\bperfect\b/i
];

const CLOSURE_PATTERNS = [
  /\bresolu\b/i,
  /\bresolue\b/i,
  /\bregle\b/i,
  /\breglee\b/i,
  /\bc'est bon\b/i,
  /\bca marche\b/i,
  /\bça marche\b/i,
  /\bsolved\b/i,
  /\bfixed\b/i,
  /\bdone\b/i
];

const WAITING_PATTERNS = [
  /\bj'attends\b/i,
  /\bje suis en attente\b/i,
  /\btoujours pas de retour\b/i,
  /\bdes nouvelles\b/i,
  /\bany update\b/i,
  /\bwaiting\b/i
];

const APOLOGY_PATTERNS = [
  /\bdesole\b/i,
  /\bdésolé\b/i,
  /\bpardon\b/i,
  /\bsorry\b/i
];

const TIME_SENSITIVE_PATTERNS = [
  /\burgent\b/i,
  /\bcritique\b/i,
  /\basap\b/i,
  /\bimmediatement\b/i,
  /\bimmédiatement\b/i,
  /\bau plus vite\b/i,
  /\bdes que possible\b/i,
  /\bdès que possible\b/i,
  /\bprod\b/i,
  /\bproduction\b/i,
  /\bbloquant\b/i
];

const IMPOLITE_PATTERNS = [
  /\binacceptable\b/i,
  /\bhonteux\b/i,
  /\bnul\b/i,
  /\bcatastrophique\b/i,
  /\bscandaleux\b/i,
  /\bmerde\b/i,
  /\bfoutage\b/i,
  /\bshame\b/i,
  /\bterrible service\b/i
];

const NEGATIVE_FEEDBACK_PATTERNS = [
  /\bpas satisfait\b/i,
  /\binsatisfait\b/i,
  /\bdecu\b/i,
  /\bdéçu\b/i,
  /\bdisappointed\b/i,
  /\bmauvaise experience\b/i,
  /\bbad experience\b/i
];

const CHURN_PATTERNS = [
  /\bresilier\b/i,
  /\brésilier\b/i,
  /\bchanger de fournisseur\b/i,
  /\bpartir chez\b/i,
  /\bquitter\b/i,
  /\bcancel my subscription\b/i,
  /\bunsubscribe\b/i
];

const PRICING_PATTERNS = [
  /\btrop cher\b/i,
  /\bprix\b/i,
  /\btarif\b/i,
  /\bfacturation\b/i,
  /\bbilling\b/i,
  /\bexpensive\b/i,
  /\bprice\b/i,
  /\bpricing\b/i
];

const COMMUNICATION_FEEDBACK_PATTERNS = [
  /\bpas de reponse\b/i,
  /\bpas de réponse\b/i,
  /\bmauvaise communication\b/i,
  /\bcommunication\b/i,
  /\bpersonne ne repond\b/i,
  /\bno answer\b/i,
  /\bno response\b/i
];

const FEATURE_LOSS_PATTERNS = [
  /\bfonctionnalite perdue\b/i,
  /\bfonctionnalité perdue\b/i,
  /\boption disparue\b/i,
  /\bavant je pouvais\b/i,
  /\bfeature removed\b/i,
  /\bmissing feature\b/i
];

const SPAM_OR_COMMERCIAL_PATTERNS = [
  /\bseo\b/i,
  /\bbacklink\b/i,
  /\bcasino\b/i,
  /\bcrypto\b/i,
  /\binvestment\b/i,
  /\bviagra\b/i,
  /\boffre commerciale\b/i,
  /\bprospection\b/i,
  /\bagence marketing\b/i,
  /\bpartenariat commercial\b/i,
  /\bwe can improve your\b/i,
  /\bgrow your business\b/i
];

const UNRELATED_REQUEST_PATTERNS = [
  /\becris-moi un poeme\b/i,
  /\bécris-moi un poème\b/i,
  /\braconte une blague\b/i,
  /\bfais mes devoirs\b/i,
  /\brecette de cuisine\b/i,
  /\bgenerate an image\b/i,
  /\bwrite me a poem\b/i,
  /\btell me a joke\b/i
];

const NON_SUPPORT_LINAGORA_PATTERNS = [
  /\bopenai\b/i,
  /\bchatgpt\b/i,
  /\bfacebook\b/i,
  /\binstagram\b/i,
  /\btiktok\b/i,
  /\bgoogle ads\b/i
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
  return patterns.some(function (pattern) {
    return pattern.test(value);
  });
}

function addIfMatch(
  output: string[],
  value: string,
  patterns: RegExp[],
  signal: string
): void {
  if (matchesAny(value, patterns) && !output.includes(signal)) {
    output.push(signal);
  }
}

function getStringField(object: UnknownObject, key: string): string {
  const value = object[key];
  return typeof value === "string" ? value : "";
}

function getNestedString(object: UnknownObject, path: string[]): string | null {
  let current: unknown = object;

  for (const key of path) {
    if (!current || typeof current !== "object") {
      return null;
    }

    current = (current as UnknownObject)[key];
  }

  return typeof current === "string" ? current : null;
}

function extractLatestUserMessage(input: RunPreanalysisDecisionInput): string {
  const directCandidates = [
    input.latestUserMessage,
    input.lastUserMessage,
    input.userMessage,
    input.message,
    input.text
  ];

  for (const candidate of directCandidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  const nestedCandidates = [
    getNestedString(input, ["inputClean", "latestUserMessage"]),
    getNestedString(input, ["inputCleaning", "latestUserMessage"]),
    getNestedString(input, ["messageAnalysis", "latestUserMessage"]),
    getNestedString(input, ["supportKnowledge", "latestUserMessage"])
  ];

  for (const candidate of nestedCandidates) {
    if (candidate && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return extractLatestUserMessageFromLogs(input.conversationLogs);
}

function extractLatestUserMessageFromLogs(
  conversationLogs?: UnknownObject[]
): string {
  if (!Array.isArray(conversationLogs)) {
    return "";
  }

  for (let index = conversationLogs.length - 1; index >= 0; index--) {
    const log = conversationLogs[index];
    const role = String(log.role || log.sender || "").toLowerCase();

    const isUser =
      role === "user" ||
      role === "customer" ||
      role === "client" ||
      role === "end_user";

    if (!isUser) {
      continue;
    }

    const content =
      getStringField(log, "content") ||
      getStringField(log, "message") ||
      getStringField(log, "text") ||
      getStringField(log, "body");

    if (content.trim().length > 0) {
      return content.trim();
    }
  }

  return "";
}

function detectSignals(message: string): string[] {
  const normalized = normalizeText(message);
  const signals: string[] = [];

  addIfMatch(signals, normalized, THANKS_PATTERNS, "thanks_neutral");
  addIfMatch(signals, normalized, POSITIVE_PATTERNS, "positive_feedback");
  addIfMatch(signals, normalized, NEGATIVE_FEEDBACK_PATTERNS, "negative_feedback");
  addIfMatch(signals, normalized, NEGATIVE_FEEDBACK_PATTERNS, "disappointment");
  addIfMatch(signals, normalized, CHURN_PATTERNS, "churn_intent");
  addIfMatch(signals, normalized, WAITING_PATTERNS, "waiting");
  addIfMatch(signals, normalized, APOLOGY_PATTERNS, "apology");
  addIfMatch(signals, normalized, CLOSURE_PATTERNS, "closure");
  addIfMatch(signals, normalized, TIME_SENSITIVE_PATTERNS, "time_sensitive");
  addIfMatch(signals, normalized, IMPOLITE_PATTERNS, "impolite");
  addIfMatch(signals, normalized, COMMUNICATION_FEEDBACK_PATTERNS, "communication_feedback");
  addIfMatch(signals, normalized, PRICING_PATTERNS, "pricing_feedback");
  addIfMatch(signals, normalized, FEATURE_LOSS_PATTERNS, "feature_loss_feedback");

  if (isShortConfirmation(normalized)) {
    signals.push("confirmation_without_new_field");
  }

  if (isComplaintWithoutActionableDetail(message)) {
    signals.push("complaint_without_actionable_detail");
  }

  return Array.from(new Set(signals));
}

function detectScopeBoundaries(
  message: string,
  input: RunPreanalysisDecisionInput
): string[] {
  const normalized = normalizeText(message);
  const scopeBoundaries: string[] = [];

  if (
    matchesAny(normalized, SPAM_OR_COMMERCIAL_PATTERNS) ||
    hasPotentialSpamMetadata(input.metadata)
  ) {
    scopeBoundaries.push("spam_or_commercial");
  }

  if (matchesAny(normalized, UNRELATED_REQUEST_PATTERNS)) {
    scopeBoundaries.push("unrelated_request");
  }

  if (matchesAny(normalized, NON_SUPPORT_LINAGORA_PATTERNS)) {
    scopeBoundaries.push("non_support_linagora");
  }

  return Array.from(new Set(scopeBoundaries));
}

function hasPotentialSpamMetadata(metadata?: UnknownObject): boolean {
  if (!metadata) {
    return false;
  }

  const spamKeys = [
    "potentialSpammer",
    "potential_spammer",
    "isSpam",
    "is_spam",
    "spam",
    "commercial"
  ];

  return spamKeys.some(function (key) {
    return metadata[key] === true;
  });
}

function isShortConfirmation(normalizedMessage: string): boolean {
  const confirmations = [
    "ok",
    "okay",
    "daccord",
    "d'accord",
    "oui",
    "yes",
    "non",
    "no",
    "bien recu",
    "bien reçu",
    "recu",
    "reçu"
  ];

  return confirmations.includes(normalizedMessage);
}

function isComplaintWithoutActionableDetail(message: string): boolean {
  const normalized = normalizeText(message);

  const vagueComplaint =
    normalized.includes("ca ne marche pas") ||
    normalized.includes("ça ne marche pas") ||
    normalized.includes("ca marche pas") ||
    normalized.includes("ne fonctionne pas") ||
    normalized.includes("probleme") ||
    normalized.includes("bug");

  if (!vagueComplaint) {
    return false;
  }

  return !hasActionableDetails(message);
}

function hasStrongActionableSupportContent(message: string): boolean {
  const normalized = normalizeText(message);

  const hasActionablePattern =
    matchesAny(normalized, ACTIONABLE_SUPPORT_PATTERNS) ||
    matchesAny(normalized, ERROR_CODE_PATTERNS);

  if (!hasActionablePattern) {
    return false;
  }

  return hasActionableDetails(message);
}

function hasActionableDetails(message: string): boolean {
  const normalized = normalizeText(message);

  if (message.length >= MIN_ACTIONABLE_DETAIL_LENGTH) {
    return true;
  }

  if (matchesAny(normalized, ERROR_CODE_PATTERNS)) {
    return true;
  }

  if (normalized.includes("quand je") || normalized.includes("when i")) {
    return true;
  }

  if (normalized.includes("depuis")) {
    return true;
  }

  if (normalized.includes("capture") || normalized.includes("screenshot")) {
    return true;
  }

  if (/https?:\/\//i.test(message)) {
    return true;
  }

  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(message)) {
    return true;
  }

  return false;
}

function previousContextSuggestsResolutionOrClosure(
  input: RunPreanalysisDecisionInput
): boolean {
  const objectsToInspect = [
    input.lastSupportKnowledgeDelta,
    input.supportKnowledge,
    ...(Array.isArray(input.supportKnowledgeDeltaHistory)
      ? input.supportKnowledgeDeltaHistory.slice(-3)
      : [])
  ];

  const text = objectsToInspect
    .filter(Boolean)
    .map(function (value) {
      return JSON.stringify(value);
    })
    .join(" ");

  const normalized = normalizeText(text);

  return (
    normalized.includes("resolved") ||
    normalized.includes("resolu") ||
    normalized.includes("closed") ||
    normalized.includes("closure") ||
    normalized.includes("solved") ||
    normalized.includes("fixed")
  );
}

function createDecision(params: {
  shouldRunLLM0: boolean;
  reason: string;
  reasons?: string[];
  detectedSignals: string[];
  detectedScopeBoundaries: string[];
}): RunDecisionPreAnalysis {
  const reasons = params.reasons && params.reasons.length > 0
    ? params.reasons
    : [params.reason];

  return {
    shouldRunLLM0: params.shouldRunLLM0,
    reason: params.reason,
    reasons: Array.from(new Set(reasons)),
    detectedSignals: params.detectedSignals,
    detectedScopeBoundaries: params.detectedScopeBoundaries
  };
}

function decideShouldRunLLM0(params: {
  message: string;
  signals: string[];
  scopeBoundaries: string[];
  hasStrongActionableSupportContent: boolean;
  previousContextSuggestsResolution: boolean;
}): RunDecisionPreAnalysis {
  const {
    message,
    signals,
    scopeBoundaries,
    hasStrongActionableSupportContent,
    previousContextSuggestsResolution
  } = params;

  if (!message.trim()) {
    return createDecision({
      shouldRunLLM0: false,
      reason: "no_latest_user_message_found",
      detectedSignals: [],
      detectedScopeBoundaries: []
    });
  }

  const reasons: string[] = [];

  const isShort = countWords(message) <= SHORT_MESSAGE_MAX_WORDS;

  if (previousContextSuggestsResolution) {
    reasons.push("previous_context_suggests_resolution_or_closure");
  }

  if (scopeBoundaries.length > 0) {
    reasons.push("scope_boundary_detected");
  }

  if (signals.length > 0) {
    reasons.push("non_actionable_or_contextual_signal_detected");
  }

  if (isShort) {
    reasons.push("short_message");
  }

  /**
   * Strong actionable support content means LLM0 is not needed.
   * This function does not decide to run LLM1.
   * It only decides whether LLM0 is needed before the rest of the pipeline.
   */
  if (hasStrongActionableSupportContent) {
    return createDecision({
      shouldRunLLM0: false,
      reason: "strong_actionable_support_content_detected",
      reasons: ["strong_actionable_support_content_detected", ...reasons],
      detectedSignals: signals,
      detectedScopeBoundaries: scopeBoundaries
    });
  }

  if (
    scopeBoundaries.length > 0 ||
    signals.length > 0 ||
    isShort ||
    previousContextSuggestsResolution
  ) {
    return createDecision({
      shouldRunLLM0: true,
      reason: reasons[0] || "preanalysis_needed",
      reasons,
      detectedSignals: signals,
      detectedScopeBoundaries: scopeBoundaries
    });
  }

  return createDecision({
    shouldRunLLM0: true,
    reason: "ambiguous_message_without_enough_actionable_support_detail",
    detectedSignals: signals,
    detectedScopeBoundaries: scopeBoundaries
  });
}

function runPreanalysisDecision(
  input: RunPreanalysisDecisionInput
): RunPreanalysisDecisionOutput {
  const latestUserMessage = extractLatestUserMessage(input);

  const signals = detectSignals(latestUserMessage);
  const scopeBoundaries = detectScopeBoundaries(latestUserMessage, input);

  const decision = decideShouldRunLLM0({
    message: latestUserMessage,
    signals,
    scopeBoundaries,
    hasStrongActionableSupportContent: hasStrongActionableSupportContent(latestUserMessage),
    previousContextSuggestsResolution: previousContextSuggestsResolutionOrClosure(input)
  });

  return {
    runDecisionPreAnalysis: decision
  };
}

export {
  runPreanalysisDecision,
  hasStrongActionableSupportContent,
  isComplaintWithoutActionableDetail,
  detectSignals,
  detectScopeBoundaries,
  extractLatestUserMessage,
  decideShouldRunLLM0
};

export type {
  RunDecisionPreAnalysis,
  RunPreanalysisDecisionInput,
  RunPreanalysisDecisionOutput
};