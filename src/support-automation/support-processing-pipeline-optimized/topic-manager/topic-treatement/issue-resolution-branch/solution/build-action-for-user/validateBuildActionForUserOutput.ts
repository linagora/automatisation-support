import type {LiveMemoryTopicOptimized} from "../../../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";

type Solution = LiveMemoryTopicOptimized["sourceTopicManager"]["solution"];
type AttemptedActionToAsk = Solution["attemptedActionsToAskBecauseOfSolutionFound"][number];

export type BuildActionForUserValidatedOutput = {
  attemptedActionsToAskBecauseOfSolutionFound: Solution["attemptedActionsToAskBecauseOfSolutionFound"];
};

function validateBuildActionForUserOutput(parsedResponse: unknown): BuildActionForUserValidatedOutput | null {
  if (!isRecord(parsedResponse)) return null;
  if (!hasOnlyKeys(parsedResponse, ["attemptedActionsToAskBecauseOfSolutionFound"])) return null;
  if (!Array.isArray(parsedResponse.attemptedActionsToAskBecauseOfSolutionFound)) return null;

  const attemptedActionsToAskBecauseOfSolutionFound: AttemptedActionToAsk[] = [];

  for (const rawAction of parsedResponse.attemptedActionsToAskBecauseOfSolutionFound) {
    const action = validateAttemptedActionToAsk(rawAction);
    if (!action) continue;
    attemptedActionsToAskBecauseOfSolutionFound.push(action);
    if (attemptedActionsToAskBecauseOfSolutionFound.length >= 3) break;
  }

  return {attemptedActionsToAskBecauseOfSolutionFound};
}

function validateAttemptedActionToAsk(value: unknown): AttemptedActionToAsk | null {
  if (!isRecord(value)) return null;
  if (!hasOnlyKeys(value, ["action", "reason", "status"])) return null;
  if (value.status !== "asking") return null;

  const action = validateRequiredString(value.action);
  if (action === null) return null;

  return {
    action,
    reason: validateNullableString(value.reason),
    status: "asking"
  };
}

function validateRequiredString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmedValue = value.trim();
  return trimmedValue === "" ? null : trimmedValue;
}

function validateNullableString(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value === "string") return value.trim() === "" ? null : value.trim();
  return null;
}

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: string[]): boolean {
  const allowedKeySet = new Set(allowedKeys);
  return Object.keys(value).every((key) => allowedKeySet.has(key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export {validateBuildActionForUserOutput};
