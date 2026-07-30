import {outputJsonShapeForPrompt} from "./responseFormat";

import type {LLMMessage} from "../../../../../../../infrastructure/llm/llm-client";
import type {RunBuildCaseDetailsForSolutionInput} from "./runBuildCaseDetailsForSolution--oneShotStep";

function buildCaseDetailsForSolutionPrompt(input: RunBuildCaseDetailsForSolutionInput): {messages: LLMMessage[]} {
  return {
    messages: [
      {
        role: "system",
        content: `You find specific missing case details justified by similar known issues.

Use the support topic summary and selected knowledge.
Ask only for information clearly useful according to the knowledge.
Do not ask generic questions.
Do not ask for information already known or already requested.
Use only extractable catalog-compatible keys.
Ask at most 3 questions.
Each question must be precise, user-answerable, and directly useful for this issue.
Return an empty array if no specific useful detail is justified.
Return only JSON matching the schema.`
      },
      {
        role: "user",
        content: JSON.stringify({
          summaryTopic: input.summaryTopic,
          userFacingKnowledgeText: input.userFacingKnowledgeText,
          supportFacingKnowledgeText: input.supportFacingKnowledgeText,
          knownCaseDetailsExtracted: input.knownCaseDetailsExtracted,
          alreadyRequestedCaseDetailKeys: input.alreadyRequestedCaseDetailKeys,
          alreadyRequestedCaseDetailQuestions: input.alreadyRequestedCaseDetailQuestions,
          outputShape: outputJsonShapeForPrompt
        }, null, 2)
      }
    ]
  };
}

export {buildCaseDetailsForSolutionPrompt};
