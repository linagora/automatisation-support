import type {LiveMemoryTopicOptimized} from "../../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";
import type {LLMMessage} from "../../../../../../infrastructure/llm/types.llm-types";

export type BuildIdleModeDecisionPromptInput = {
  mode: "finalize_after_solution" | "reevaluate_existing_idle";
  currentUserMessage: {
    content: string;
    channel?: string;
  };
  summaryTopic: string | null;
  sourceTopicManager: LiveMemoryTopicOptimized["sourceTopicManager"];
};

function buildIdleModeDecisionPrompt(
  input: BuildIdleModeDecisionPromptInput
): {messages: LLMMessage[]} {
  const system = [
    "You are an internal support topic idle-mode evaluator.",
    "Your job is not to solve the issue again.",
    "Your job is only to decide whether the topic is solved or still unsolved after the automated route reached idle.",
    "Return strict JSON only."
  ].join("\n");

  const user = [
    "Evaluate the topic idle state.",
    "",
    `Mode: ${input.mode}`,
    `Topic summary: ${input.summaryTopic ?? "null"}`,
    "",
    "Current sourceTopicManager:",
    JSON.stringify(input.sourceTopicManager, null, 2),
    "",
    "Latest user message:",
    input.currentUserMessage.content,
    "",
    "Decision rules:",
    "- Output only solved_by_bot or unsolved as resolutionStatus.value.",
    "- Use solved_by_bot only when the user clearly says the issue is fixed, resolved, working now, or that the assistant's proposed action worked.",
    "- Use unsolved when the user says the previous action failed, did not help, cannot be done, asks for a human, or adds diagnostic information without confirming resolution.",
    "- Use unsolved when the automated route reached idle with an internal support action to take.",
    "- Never output in_progress from idle-mode. Idle-mode does not restart the automated route.",
    "- Never output solved_by_human from idle-mode. Human resolution is not confirmed here; use unsolved plus handover instead.",
    "- If resolutionStatus.value is solved_by_bot, handover.isRequested must be false.",
    "- If resolutionStatus.value is unsolved and the user asked for a human, an internal support action exists, or the latest message adds useful unresolved information, handover.isRequested should be true.",
    "- say must be English and user-facing. It can be null only when no acknowledgement is useful.",
    "",
    "JSON shape:",
    JSON.stringify({
      resolutionStatus: {
        value: "solved_by_bot | unsolved",
        reason: "short internal reason or null"
      },
      handover: {
        isRequested: true,
        reason: "short internal reason or null"
      },
      say: "short English user-facing acknowledgement or null"
    }, null, 2)
  ].join("\n");

  return {
    messages: [
      {role: "system", content: system},
      {role: "user", content: user}
    ]
  };
}

export {buildIdleModeDecisionPrompt};
