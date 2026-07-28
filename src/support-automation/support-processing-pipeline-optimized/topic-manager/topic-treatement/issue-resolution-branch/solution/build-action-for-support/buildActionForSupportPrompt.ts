import {outputJsonShapeForPrompt} from "./responseFormat";

import type {LLMMessage} from "../../../../../../../infrastructure/llm/llm-client";
import type {RunBuildActionForSupportInput} from "./runBuildActionForSupport--oneShotStep";

function buildActionForSupportPrompt(input: RunBuildActionForSupportInput): {messages: LLMMessage[]} {
  return {
    messages: [
      {
        role: "system",
        content: `You are the support-action builder of an internal support issue-resolution pipeline.

You do not answer the user.
You do not include user-facing advice.
You only transform support-facing knowledge into one concise internal support action when such an action exists.

Rules:
- Use supportFacingInformation as the main source of truth.
- Include log checks, admin-panel checks, escalation notes, internal data to inspect, or known backend/support hypotheses only when present in the knowledge.
- If there is no concrete support-side action, return null.
- actionToTakeForSupport can include the reason in the same string.
- Return only JSON.`
      },
      {
        role: "user",
        content: JSON.stringify({
          summaryTopic: input.summaryTopic,
          supportFacingInformation: input.supportFacingInformation,
          currentUserMessage: input.currentUserMessage,
          outputShape: outputJsonShapeForPrompt
        }, null, 2)
      }
    ]
  };
}

export {buildActionForSupportPrompt};
