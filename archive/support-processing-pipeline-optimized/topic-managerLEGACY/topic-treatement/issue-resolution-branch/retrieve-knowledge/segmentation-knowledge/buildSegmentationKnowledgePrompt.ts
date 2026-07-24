import {outputJsonShapeForPrompt} from "./responseFormat";

import type {LLMMessage} from "../../../../../../../infrastructure/llm/llm-client";
import type {RunSegmentationKnowledgeInput} from "./runSegmentationKnowledge--oneShotStep";

function buildSegmentationKnowledgePrompt(
  input: RunSegmentationKnowledgeInput
): {messages: LLMMessage[]} {
  return {
    messages: [
      {
        role: "system",
        content: `You segment selected internal RAG knowledge for a support automation pipeline.

You do not answer the user.
You do not ask clarification questions.
You only split selected knowledge into two safe memory fields.

Definitions:
- userFacingInformation: information that may help the assistant ask better follow-up questions or later explain a user-safe workaround, known behavior, limitation, or procedure.
- supportFacingInformation: internal support notes that should not be sent directly to the user, such as logs to inspect, admin-side checks, internal service names, escalation hints, or debugging context.

Rules:
- Do not invent facts not present in selectedfilteredRagKnowledge.
- If no user-facing information is present, use null.
- If no support-facing information is present, use null.
- Keep both fields concise.
- Return only JSON.`
      },
      {
        role: "user",
        content: JSON.stringify({
          summaryTopic: input.summaryTopic,
          selectedfilteredRagKnowledge: input.selectedfilteredRagKnowledge,
          outputShape: outputJsonShapeForPrompt
        }, null, 2)
      }
    ]
  };
}

export {buildSegmentationKnowledgePrompt};
