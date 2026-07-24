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
  if (looksSolvedByUser(input.currentUserMessage.content)) {
    return buildSolvedOutput();
  }

  return buildUnsolvedOutput({
    say: input.mode === "finalize_after_solution"
      ? "Thanks. I’ve kept the information collected so far. A support team member can take over if more help is needed."
      : "Thanks. I’ll keep that update with the topic and pass it to the support team if needed.",
    reason: input.mode === "finalize_after_solution"
      ? "Idle-mode fallback did not receive a validated explicit resolution confirmation."
      : "The topic was already idle and the latest message did not provide a validated resolved confirmation.",
    handoverReason: shouldRequestHandover(input)
      ? "The topic is idle and remains unresolved."
      : null,
    isHandoverRequested: shouldRequestHandover(input)
  });
}

function looksSolvedByUser(message: string): boolean {
  const normalized = message.toLowerCase();

  return [
    "it works",
    "it's working",
    "its working",
    "fixed",
    "resolved",
    "solved",
    "ça marche",
    "ca marche",
    "c'est bon",
    "cest bon",
    "résolu",
    "resolu",
    "réglé",
    "reglé",
    "merci ça marche",
    "merci ca marche"
  ].some((pattern) => normalized.includes(pattern));
}

function shouldRequestHandover(input: RunIdleModeInput): boolean {
  return input.sourceTopicManager.solution.actionToTakeForSupport !== null ||
    input.mode === "reevaluate_existing_idle" ||
    looksLikeHumanRequest(input.currentUserMessage.content);
}

function looksLikeHumanRequest(message: string): boolean {
  const normalized = message.toLowerCase();

  return [
    "human",
    "support team",
    "agent",
    "someone",
    "humain",
    "support",
    "conseiller",
    "quelqu'un",
    "quelqu’un"
  ].some((pattern) => normalized.includes(pattern));
}

function buildSolvedOutput(): RunIdleModeOutput {
  return {
    say: "Great, I’m glad this is working now. I’ll keep the topic marked as resolved.",
    resolutionStatus: buildResolutionStatus(
      "solved_by_bot",
      "The user explicitly indicated that the issue is now resolved."
    ),
    handover: {
      isRequested: false,
      reason: null
    },
    idleMode: {
      isActivated: true
    }
  };
}

function buildUnsolvedOutput(input: {
  say: string;
  reason: string;
  isHandoverRequested: boolean;
  handoverReason: string | null;
}): RunIdleModeOutput {
  return {
    say: input.say,
    resolutionStatus: buildResolutionStatus("unsolved", input.reason),
    handover: {
      isRequested: input.isHandoverRequested,
      reason: input.handoverReason
    },
    idleMode: {
      isActivated: true
    }
  };
}

function buildResolutionStatus(
  value: "solved_by_bot" | "unsolved",
  reason: string | null
): LiveMemoryTopicOptimized["sourceTopicManager"]["resolutionStatus"] {
  return {
    value,
    reason
  } as LiveMemoryTopicOptimized["sourceTopicManager"]["resolutionStatus"];
}

export {runIdleMode};

export type {RunIdleModeInput, RunIdleModeOutput};
