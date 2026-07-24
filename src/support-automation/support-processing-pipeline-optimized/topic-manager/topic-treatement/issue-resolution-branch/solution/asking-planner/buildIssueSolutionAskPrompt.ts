import {outputJsonShapeForPrompt} from "./responseFormat";

import type {LLMMessage} from "../../../../../../../infrastructure/llm/llm-client";
import type {PlanIssueSolutionAskInput} from "./planIssueSolutionAsk";

function buildIssueSolutionAskPrompt(input: PlanIssueSolutionAskInput): {messages: LLMMessage[]} {
  const actionsStillAsking = input.solution.attemptedActionsToAskBecauseOfSolutionFound.filter((action) => action.status === "asking");

  return {
    messages: [
      {
        role: "system",
        content: `You are the final user-action asking planner of a support issue-resolution pipeline.

The system found one or more user-facing actions that may resolve or diagnose the issue.
Your only job is to write the English message asking the user to try the pending action(s).

Rules:
- Write in English only.
- Sound human, direct, and practical.
- Do not expose support-facing information.
- Do not mention internal memory, RAG, segmentation, pipeline, or status fields.
- Explain briefly why the action may help when the reason is useful.
- Ask the user to tell us whether it worked after trying it.
- If there are multiple actions, order them clearly but avoid a cold raw checklist.
- Return only JSON.`
      },
      {
        role: "user",
        content: JSON.stringify({
          currentUserMessage: input.currentUserMessage,
          previousConversationTurn: input.previousConversationTurn,
          actionsStillAsking,
          outputShape: outputJsonShapeForPrompt
        }, null, 2)
      }
    ]
  };
}

function buildDeterministicIssueSolutionAsk(input: PlanIssueSolutionAskInput): string {
  const actionsStillAsking = input.solution.attemptedActionsToAskBecauseOfSolutionFound.filter((action) => action.status === "asking");

  if (actionsStillAsking.length === 0) {
    return "I don’t have a user-side step to ask you to try right now. I’m going to keep the support-side information attached to this case.";
  }

  const renderedActions = actionsStillAsking
    .map((action, index) => {
      const actionText = action.action ?? "try the suggested troubleshooting step";
      const reasonText = action.reason ? ` This may help because ${lowercaseFirst(action.reason)}.` : "";
      return `${index + 1}. ${actionText}.${reasonText}`;
    })
    .join("\n");

  return `Could you try the following step${actionsStillAsking.length > 1 ? "s" : ""} and tell me whether it works?\n\n${renderedActions}`;
}

function lowercaseFirst(value: string): string {
  if (value.length === 0) return value;
  return value.charAt(0).toLowerCase() + value.slice(1);
}

export {
  buildDeterministicIssueSolutionAsk,
  buildIssueSolutionAskPrompt
};
