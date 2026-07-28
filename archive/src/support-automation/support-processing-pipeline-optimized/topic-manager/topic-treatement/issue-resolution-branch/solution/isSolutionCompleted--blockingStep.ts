import type {LiveMemoryTopicOptimized} from "../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";

type Solution = LiveMemoryTopicOptimized["sourceTopicManager"]["solution"];
type AttemptedActionToAsk = Solution["attemptedActionsToAskBecauseOfSolutionFound"][number];
type AttemptedActionExtracted = LiveMemoryTopicOptimized["sourceAnalyzeSupportText"]["attemptedActionsExtracted"][number];

export type IsSolutionCompletedInput = {
  solution: Solution;
  attemptedActionsExtracted: AttemptedActionExtracted[];
};

export type IsSolutionCompletedOutput = {
  solution: Solution;
};

function isSolutionCompleted(input: IsSolutionCompletedInput): IsSolutionCompletedOutput {
  const attemptedActionsToAskBecauseOfSolutionFound = input.solution.attemptedActionsToAskBecauseOfSolutionFound.map((actionToAsk) => {
    if (actionToAsk.status !== "asking") return actionToAsk;

    const matchingExtractedAction = findMatchingExtractedAction(actionToAsk, input.attemptedActionsExtracted);
    if (!matchingExtractedAction) return actionToAsk;

    const nextStatus = mapExtractedActionToSolutionStatus(matchingExtractedAction);
    if (!nextStatus) return actionToAsk;

    return {
      ...actionToAsk,
      status: nextStatus
    } satisfies AttemptedActionToAsk;
  });

  const isCompleted = input.solution.isActionForUserBuilt &&
    input.solution.isActionForSupportBuilt &&
    attemptedActionsToAskBecauseOfSolutionFound.every((actionToAsk) => actionToAsk.status !== "asking");

  return {
    solution: {
      ...input.solution,
      isCompleted,
      attemptedActionsToAskBecauseOfSolutionFound
    }
  };
}

function findMatchingExtractedAction(
  actionToAsk: AttemptedActionToAsk,
  attemptedActionsExtracted: AttemptedActionExtracted[]
): AttemptedActionExtracted | null {
  if (!actionToAsk.action) return null;

  for (const attemptedAction of attemptedActionsExtracted) {
    if (!attemptedAction.action && !attemptedAction.evidence) continue;

    if (areSimilarActions(actionToAsk.action, attemptedAction.action ?? attemptedAction.evidence ?? "")) {
      return attemptedAction;
    }
  }

  return null;
}

function mapExtractedActionToSolutionStatus(
  attemptedAction: AttemptedActionExtracted
): AttemptedActionToAsk["status"] | null {
  if (attemptedAction.status === "user_declared_unavailable") {
    return "user_declared_unavailable";
  }

  const outcome = normalizeText(attemptedAction.outcome ?? attemptedAction.evidence ?? "");
  if (!outcome) return null;

  if (containsAny(outcome, [
    "worked",
    "works",
    "succeeded",
    "success",
    "resolved",
    "fixed",
    "done",
    "ok",
    "yes",
    "fonctionne",
    "marche",
    "resolu",
    "résolu",
    "corrige",
    "corrigé",
    "regle",
    "réglé"
  ])) {
    return "succeeded";
  }

  if (containsAny(outcome, [
    "failed",
    "fails",
    "failure",
    "not worked",
    "did not work",
    "does not work",
    "still",
    "same issue",
    "no",
    "blocked",
    "error",
    "erreur",
    "echec",
    "échec",
    "marche pas",
    "fonctionne pas",
    "toujours",
    "pareil",
    "bloque"
  ])) {
    return "failed";
  }

  return null;
}

function areSimilarActions(expectedAction: string, extractedAction: string): boolean {
  const expectedTokens = tokenize(expectedAction);
  const extractedTokens = tokenize(extractedAction);

  if (expectedTokens.length === 0 || extractedTokens.length === 0) return false;

  const expectedText = expectedTokens.join(" ");
  const extractedText = extractedTokens.join(" ");

  if (expectedText.includes(extractedText) || extractedText.includes(expectedText)) return true;

  const extractedTokenSet = new Set(extractedTokens);
  const sharedTokenCount = expectedTokens.filter((token) => extractedTokenSet.has(token)).length;

  return sharedTokenCount >= Math.min(2, expectedTokens.length);
}

function tokenize(value: string): string[] {
  const stopwords = new Set([
    "the", "a", "an", "to", "try", "please", "your", "you", "and", "or", "of", "for", "with", "in", "on",
    "le", "la", "les", "un", "une", "de", "du", "des", "pour", "avec", "dans", "sur", "et", "ou", "vous"
  ]);

  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 2 && !stopwords.has(token));
}

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsAny(value: string, needles: string[]): boolean {
  return needles.some((needle) => value.includes(normalizeText(needle)));
}

export {isSolutionCompleted};
