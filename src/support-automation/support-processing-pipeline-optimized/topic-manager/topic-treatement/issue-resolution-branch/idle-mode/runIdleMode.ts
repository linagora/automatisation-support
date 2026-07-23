import {callLLM} from "../../../../../../infrastructure/llm/llm-client";
import {parseLLMResponse} from "../../../../../../infrastructure/llm/parseLLMResponse";
import {buildIdleModeDecisionPrompt} from "./buildIdleModeDecisionPrompt";
import {idleModeResponseFormat} from "./responseFormat";
import {validateIdleModeDecisionOutput} from "./validateIdleModeDecisionOutput";

import type {LiveMemoryTopicOptimized} from "../../../../../../infrastructure/live-memory/liveMemoryContextOptimized.template";

type RunIdleModeInput = {
  mode: "finalize_after_solution" | "reevaluate_existing_idle";
  currentUserMessage: {
    content: string;
    channel?: string;
  };
  summaryTopic: string | null;
  sourceTopicManager: LiveMemoryTopicOptimized["sourceTopicManager"];
};

type RunIdleModeOutput = {
  say: string | null;
  resolutionStatus: LiveMemoryTopicOptimized["sourceTopicManager"]["resolutionStatus"];
  handover: LiveMemoryTopicOptimized["sourceTopicManager"]["handover"];
  idleMode: LiveMemoryTopicOptimized["sourceTopicManager"]["idleMode"];
};

async function runIdleMode(input: RunIdleModeInput): Promise<RunIdleModeOutput> {
  const fallback = buildFallbackIdleModeOutput(input);
  const {messages} = buildIdleModeDecisionPrompt(input);

  try {
    const result = await callLLM(messages, {
      stage: "issue_idle_mode_decision",
      preset: "standard",
      temperature: 0,
      maxTokens: 500,
      responseFormat: idleModeResponseFormat
    });

    if (!result.success || !result.content) {
      return fallback;
    }

    const parsed = parseLLMResponse(result.content);
    const validated = validateIdleModeDecisionOutput(parsed);

    if (!validated) {
      return fallback;
    }

    return {
      say: validated.say,
      resolutionStatus: validated.resolutionStatus,
      handover: validated.handover,
      idleMode: {
        isActivated: true
      }
    };
  } catch {
    return fallback;
  }
}

function buildFallbackIdleModeOutput(input: RunIdleModeInput): RunIdleModeOutput {
  if (input.mode === "finalize_after_solution") {
    if (input.sourceTopicManager.solution.actionToTakeForSupport) {
      return {
        say: "Thanks. I have enough information for now, and I will pass the relevant internal action to the support team.",
        resolutionStatus: {
          value: "solved_by_human",
          reason: "The automated route reached idle with an internal support action to take."
        },
        handover: {
          isRequested: true,
          reason: "The topic requires a support-side follow-up action."
        },
        idleMode: {
          isActivated: true
        }
      };
    }

    return {
      say: "Thanks. I have enough information for now. If the issue comes back, you can add more details here.",
      resolutionStatus: {
        value: "solved_by_bot",
        reason: "The automated route reached idle without a support-side action to take."
      },
      handover: {
        isRequested: false,
        reason: null
      },
      idleMode: {
        isActivated: true
      }
    };
  }

  return {
    say: "Thanks, I’ll keep that update with the topic and pass it to the support team if needed.",
    resolutionStatus: input.sourceTopicManager.resolutionStatus.value === "solved_by_bot"
      ? input.sourceTopicManager.resolutionStatus
      : {
        value: "solved_by_human",
        reason: "The topic was already idle and the latest message did not produce a validated resolved-by-bot confirmation."
      },
    handover: input.sourceTopicManager.resolutionStatus.value === "solved_by_bot"
      ? input.sourceTopicManager.handover
      : {
        isRequested: true,
        reason: "The topic is idle and should be handled by support after the new information."
      },
    idleMode: {
      isActivated: true
    }
  };
}

export {runIdleMode};

export type {RunIdleModeInput, RunIdleModeOutput};
