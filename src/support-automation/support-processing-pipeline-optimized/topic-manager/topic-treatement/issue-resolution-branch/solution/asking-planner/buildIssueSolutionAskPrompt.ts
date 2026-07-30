import {outputJsonShapeForPrompt} from "./responseFormat";

import type {LLMMessage} from "../../../../../../../infrastructure/llm/llm-client";
import type {PlanIssueSolutionAskInput} from "./planIssueSolutionAsk";

function buildIssueSolutionAskPrompt(input: PlanIssueSolutionAskInput): {messages: LLMMessage[]} {
  const actionsStillAsking = buildActionsStillAsking(input);
  const caseDetailsStillAsking = buildCaseDetailsStillAsking(input);

  return {
    messages: [
      {
        role: "system",
        content: `You are the final solution asking planner of a support issue-resolution pipeline.

The system found pending solution actions and/or specific case-detail questions.
Your only job is to write the English message asking the user to try the pending action(s) and/or answer the pending question(s).

Rules:
- Write in English only.
- Sound human, direct, and practical.
- Do not expose support-facing information.
- Do not mention internal memory, RAG, segmentation, pipeline, or status fields.
- Ask pending actions first.
- Ask specific case-detail questions after actions.
- Explain briefly why an action or question may help when the reason is useful.
- If asking an action, ask the user to tell us whether it worked after trying it.
- If there are multiple items, order them clearly but avoid a cold raw checklist.
- Return only JSON.`
      },
      {
        role: "user",
        content: JSON.stringify({
          previousConversationTurn: input.previousConversationTurn,
          actionsStillAsking,
          caseDetailsStillAsking,
          outputShape: outputJsonShapeForPrompt
        }, null, 2)
      }
    ]
  };
}

function buildDeterministicIssueSolutionAsk(input: PlanIssueSolutionAskInput): string | null {
  const actionsStillAsking = buildActionsStillAsking(input);
  const caseDetailsStillAsking = buildCaseDetailsStillAsking(input);

  if (actionsStillAsking.length === 0 && caseDetailsStillAsking.length === 0) {
    return null;
  }

  const actionBlock = actionsStillAsking.length === 0
    ? null
    : `Could you try the following step${actionsStillAsking.length > 1 ? "s" : ""} and tell me whether it works?\n\n${renderActions(actionsStillAsking)}`;

  const questionBlock = caseDetailsStillAsking.length === 0
    ? null
    : buildQuestionBlock({
      hasActions: actionsStillAsking.length > 0,
      caseDetailsStillAsking
    });

  return [actionBlock, questionBlock].filter((block): block is string => block !== null).join("\n\n");
}

function buildActionsStillAsking(input: PlanIssueSolutionAskInput): Array<{
  action: string;
  reason: string | null;
  status: "asking";
}> {
  return input.solution.attemptedActionsToAskBecauseOfSolutionFound
    .filter((action) => {
      return action.status === "asking" && typeof action.action === "string" && action.action.trim() !== "";
    })
    .map((action) => {
      return {
        action: typeof action.action === "string" ? action.action.trim() : "",
        reason: action.reason,
        status: "asking"
      };
    });
}

function buildCaseDetailsStillAsking(input: PlanIssueSolutionAskInput): Array<{
  key: string;
  question: string;
  reason: string | null;
  status: "asking";
}> {
  return input.solution.caseDetailsToAskBecauseOfSolutionFound
    .filter((caseDetail) => {
      return caseDetail.status === "asking" &&
        typeof caseDetail.key === "string" &&
        caseDetail.key.trim() !== "" &&
        typeof caseDetail.question === "string" &&
        caseDetail.question.trim() !== "";
    })
    .map((caseDetail) => {
      return {
        key: caseDetail.key.trim(),
        question: caseDetail.question.trim(),
        reason: caseDetail.reason,
        status: "asking"
      };
    });
}

function renderActions(actionsStillAsking: Array<{
  action: string;
  reason: string | null;
  status: "asking";
}>): string {
  return actionsStillAsking
    .map((action, index) => {
      const reasonText = action.reason ? ` This may help because ${lowercaseFirst(action.reason)}.` : "";
      return `${index + 1}. ${action.action}.${reasonText}`;
    })
    .join("\n");
}

function renderCaseDetailQuestions(caseDetailsStillAsking: Array<{
  key: string;
  question: string;
  reason: string | null;
  status: "asking";
}>): string {
  return caseDetailsStillAsking
    .map((caseDetail, index) => {
      const reasonText = caseDetail.reason ? ` This helps because ${lowercaseFirst(caseDetail.reason)}.` : "";
      return `${index + 1}. ${caseDetail.question}${endsWithTerminalPunctuation(caseDetail.question) ? "" : "."}${reasonText}`;
    })
    .join("\n");
}

function buildQuestionBlock(input: {
  hasActions: boolean;
  caseDetailsStillAsking: Array<{
    key: string;
    question: string;
    reason: string | null;
    status: "asking";
  }>;
}): string {
  if (!input.hasActions && input.caseDetailsStillAsking.length === 1) {
    const [caseDetail] = input.caseDetailsStillAsking;
    const reasonText = caseDetail.reason ? ` This helps because ${lowercaseFirst(caseDetail.reason)}.` : "";
    return `${caseDetail.question}${endsWithTerminalPunctuation(caseDetail.question) ? "" : "."}${reasonText}`;
  }

  const prefix = input.hasActions ? "Also, could you answer" : "Could you answer";
  const target = input.caseDetailsStillAsking.length > 1 ? "these questions" : "this question";

  return `${prefix} ${target}?\n\n${renderCaseDetailQuestions(input.caseDetailsStillAsking)}`;
}

function endsWithTerminalPunctuation(value: string): boolean {
  return /[.!?]$/.test(value.trim());
}

function lowercaseFirst(value: string): string {
  if (value.length === 0) return value;
  return value.charAt(0).toLowerCase() + value.slice(1);
}

export {
  buildDeterministicIssueSolutionAsk,
  buildIssueSolutionAskPrompt
};
