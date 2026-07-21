import {runAssessSupportNeed} from "./runAssessSupportNeed";

import type {SupportNeedResolution, TopicBranchContext} from "../runTopicBranch";
import type {AssessSupportNeedOutput} from "./runAssessSupportNeed";

type SupportNeedResolutionBranchOutput =
  | {
      status: "processed";
      fallbackReason: null;
      supportNeedResolution: SupportNeedResolution;
      assessSupportNeedOutput: AssessSupportNeedOutput;
    }
  | {
      status: "fallback";
      fallbackReason: unknown;
      supportNeedResolution: null;
      assessSupportNeedOutput: AssessSupportNeedOutput | null;
    };

async function runSupportNeedResolutionBranch(input: {
  topicBranchContext: TopicBranchContext;
}): Promise<SupportNeedResolutionBranchOutput> {
  const supportDomain = resolveSupportDomain(input.topicBranchContext);

  const assessSupportNeedOutput = await runAssessSupportNeed({
    topic: {
      title: resolveTopicTitle(input.topicBranchContext),
      supportDomain,
      summary: resolveTopicSummary(input.topicBranchContext),
      previousSupportNeedAssessment: null,
      previousSupportKnowledgeSummary: null,
      sourceUnderstandings: input.topicBranchContext.sourceUnderstandings
    },
    recentInteractionContext: input.topicBranchContext.previousConversationTurn as never
  });

  if (assessSupportNeedOutput.status === "fallback") {
    return {
      status: "fallback",
      fallbackReason: assessSupportNeedOutput,
      supportNeedResolution: null,
      assessSupportNeedOutput
    };
  }

  return {
    status: "processed",
    fallbackReason: null,
    assessSupportNeedOutput,
    supportNeedResolution: {
      supportNeed: assessSupportNeedOutput.supportNeedAssessment.supportNeed,
      unclearReason: assessSupportNeedOutput.supportNeedAssessment.unclearReason,
      supportDomain,
      supportNeedIsClear: assessSupportNeedOutput.supportNeedAssessment.supportNeed !== "unclear",
      supportDomainIsClear: supportDomain !== null && supportDomain !== "other" && supportDomain !== "unknown",
      reason: assessSupportNeedOutput.supportNeedAssessment.reason
    }
  };
}

function resolveSupportDomain(context: TopicBranchContext): string | null {
  return context.topicUpdatePlan.topicIdentity.supportDomain ??
    context.sourceUnderstandings.find((understanding) => understanding.supportDomain)?.supportDomain ??
    null;
}

function resolveTopicTitle(context: TopicBranchContext): string | null {
  return context.topicUpdatePlan.topicIdentity.title;
}

function resolveTopicSummary(context: TopicBranchContext): string {
  return (
    context.topicUpdatePlan.topicIdentity.summary ??
    context.sourceUnderstandings.map((understanding) => understanding.summary).filter(Boolean).join(" ")
  ) || "Support topic";
}

export {runSupportNeedResolutionBranch};
export type {SupportNeedResolutionBranchOutput};
