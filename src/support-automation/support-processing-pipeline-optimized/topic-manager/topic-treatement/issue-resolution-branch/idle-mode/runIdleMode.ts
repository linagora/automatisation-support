import type {
  LiveMemoryIssueIdle,
  LiveMemoryTopicOptimized
} from "../../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";

type RunIdleModeInput = {
  mode: "finalize_after_solution" | "reevaluate_existing_idle";
  topicId: number | null;
  currentUserMessage: {
    content: string;
    channel?: string;
  };
  summaryTopic: string | null;
  sourceTopicManager: LiveMemoryTopicOptimized["sourceTopicManager"];
};

type RunIdleModeOutput = {
  say: string | null;
  topicStatus: LiveMemoryTopicOptimized["status"];
  topicHandoverRequest: {
    isRequested: boolean;
    reason: string | null;
  };
  idleMode: LiveMemoryIssueIdle;
};

async function runIdleMode(input: RunIdleModeInput): Promise<RunIdleModeOutput> {
  const hasSuccessfulProposedAction = hasSucceededProposedAction(
    input.sourceTopicManager
  );

  if (hasSuccessfulProposedAction) {
    return buildResolvedIdleOutput(input);
  }

  return buildUnresolvedIdleOutput(input);
}

function hasSucceededProposedAction(
  sourceTopicManager: LiveMemoryTopicOptimized["sourceTopicManager"]
): boolean {
  return sourceTopicManager.workflows.issueResolution.solution.attemptedActionsToAskBecauseOfSolutionFound.some(
    (action) => action.status === "succeeded"
  );
}

function buildResolvedIdleOutput(input: RunIdleModeInput): RunIdleModeOutput {
  return {
    say: buildResolvedMessage(),
    topicStatus: "solved_by_bot",
    topicHandoverRequest: {
      isRequested: true,
      reason: buildHandoverReason({
        label: "issue_finished_resolved",
        topicId: input.topicId,
        detail: "finished and considered resolved by bot"
      })
    },
    idleMode: {
      isActivated: true
    }
  };
}

function buildUnresolvedIdleOutput(input: RunIdleModeInput): RunIdleModeOutput {
  return {
    say: buildUnresolvedMessage(),
    topicStatus: "unsolved",
    topicHandoverRequest: {
      isRequested: true,
      reason: buildHandoverReason({
        label: "issue_finished_unresolved_need_review",
        topicId: input.topicId,
        detail: "finished but needs support review"
      })
    },
    idleMode: {
      isActivated: true
    }
  };
}

function buildHandoverReason(input: {
  label: string;
  topicId: number | null;
  detail: string;
}): string {
  const topicLabel = input.topicId === null
    ? "topic"
    : `topic ${input.topicId}`;

  return `${input.label}: ${topicLabel} ${input.detail}`;
}

function buildResolvedMessage(): string {
  return [
    "Thanks for your feedback. I understand that the proposed action resolved the issue.",
    "",
    "I’ll still pass the topic to the support team with the collected information so they can keep a record and review it if needed.",
    "",
    "If the situation changes or the issue comes back, you can add a message here."
  ].join("\n");
}

function buildUnresolvedMessage(): string {
  return [
    "Thanks for the information. I consider that the issue is not resolved yet on the bot side.",
    "",
    "I’ll pass the topic to the support team with the collected details so someone can review it.",
    "",
    "If you have more details, screenshots, logs, or context, you can add them here."
  ].join("\n");
}

export {runIdleMode};

export type {RunIdleModeInput, RunIdleModeOutput};
