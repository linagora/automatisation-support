import {outputJsonShapeForPrompt} from "./responseFormat";

import type {LLMMessage} from "../../../../../../infrastructure/llm/llm-client";
import type {RunBuildActionForUserInput} from "./runBuildActionForUser--oneShotStep";

function buildActionForUserPrompt(input: RunBuildActionForUserInput): {messages: LLMMessage[]} {
  return {
    messages: [
      {
        role: "system",
        content: `You are the user-action builder of an internal support issue-resolution pipeline.

You do not answer the user yet.
You do not write the final message.
You only extract safe, atomic actions that the user should be asked to try because the selected user-facing knowledge suggests they may resolve or diagnose the issue.

Rules:
- Use userFacingInformation as the main source of truth.
- Create an action only when the knowledge contains a concrete user-facing thing to try, verify, clear, reload, reconnect, update, test, or change.
- Do not create an action for a vague explanation, a support-only investigation, or product internals.
- Keep actions atomic and testable by the user.
- Prefer 0 to 3 actions.
- Every action status must be "asking".
- Return only JSON.`
      },
      {
        role: "user",
        content: JSON.stringify({
          summaryTopic: input.summaryTopic,
          userFacingInformation: input.userFacingInformation,
          currentUserMessage: input.currentUserMessage,
          outputShape: outputJsonShapeForPrompt
        }, null, 2)
      }
    ]
  };
}

export {buildActionForUserPrompt};
