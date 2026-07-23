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
    "Your job is to decide whether the user just confirmed resolution, requested human support, or only added information after the automated route has reached idle.",
    "Return strict JSON only."
  ].join("\n");

  const user = [
    "Evaluate the topic state.",
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
    "- If the user clearly says the issue is now fixed, resolved, working, or that the assistant's previous suggestion was right, set resolutionStatus.value to solved_by_bot, handover.isRequested to false, and write a short human acknowledgement in English.",
    "- If the user explicitly asks for a human/support team/person to take over, set resolutionStatus.value to solved_by_human and handover.isRequested to true.",
    "- If the user says the previous proposed action failed, or adds more diagnostic information without saying it is resolved, set resolutionStatus.value to solved_by_human and handover.isRequested to true. The automated route has already reached idle, so the support team should now use the added information.",
    "- If the user only sends a neutral acknowledgement without new information or resolution, keep the current resolutionStatus if it is already solved_by_bot or solved_by_human; otherwise set solved_by_human with handover requested.",
    "- Use in_progress only if the current message clearly reopens the topic and still requires automated processing outside idle-mode. Do not use it for normal idle acknowledgement.",
    "- say must be English and user-facing. It can be null only when no user-facing acknowledgement is useful.",
    "",
    "JSON shape:",
    JSON.stringify({
      resolutionStatus: {
        value: "solved_by_bot | solved_by_human | in_progress",
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
