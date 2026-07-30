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
- Use supportFacingKnowledgeText as the main source of truth.
- Use summaryTopic only to understand the issue already identified by the pipeline.
- Include log checks, admin-panel checks, escalation notes, internal data to inspect, or known backend/support hypotheses only when present in the knowledge.
- If there is no concrete support-side action, return null.
- Do not invent an action that is absent from supportFacingKnowledgeText.
- Do not return the whole supportFacingKnowledgeText as an action.
- Do not create vague support actions.
- actionToTakeForSupport can include the reason in the same string.
- Return only JSON.`
      },
      {
        role: "user",
        content: JSON.stringify({
          summaryTopic: input.summaryTopic,
          supportFacingKnowledgeText: input.supportFacingKnowledgeText,
          outputShape: outputJsonShapeForPrompt
        }, null, 2)
      }
    ]
  };
}

export {buildActionForSupportPrompt};
