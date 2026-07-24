import type {
  RecentInteractionContext,
  ProposeTopicUpdatesOutput,
  SupportTopicContextV2,
  TextUnderstanding,
  TopicUpdateOp,
  TopicUpdateProposalDebugInfo,
  TopicUpdateOpsResponse,
  TopicUpdateProposal
} from "../typesSupportProcessingPipelineV2.types";
import type {
  LLMMessage
} from "../../../infrastructure/llm/llm-client";

export type ProposeTopicUpdatesPrompt = {
  messages: LLMMessage[];
};

export type BuildProposeTopicUpdatesPromptInput = {
  existingTopics: unknown[];
  textUnderstandings: TextUnderstanding[];
  recentInteractionContext: RecentInteractionContext;
  latestUserMessageContent?: string | null;
};

export type RequestProposeTopicUpdatesInput = {
  prompt: ProposeTopicUpdatesPrompt;
};

export type RawProposeTopicUpdates = {
  status: "completed" | "failed";
  parsedResponse?: unknown;
  rawResponse?: string;
  error?: {
    message: string;
  };
};

export type FormatProposeTopicUpdatesOutputInput = {
  existingTopics: unknown[];
  textUnderstandings: TextUnderstanding[];
  rawProposeTopicUpdates: RawProposeTopicUpdates;
};

export type ProposeTopicUpdatesValidationResult =
  | {
      status: "valid";
      topicUpdateOps: TopicUpdateOp[];
      debug: TopicUpdateProposalDebugInfo;
    }
  | {
      status: "invalid";
      reason: string;
      topicUpdateOps: TopicUpdateOp[];
      debug: TopicUpdateProposalDebugInfo;
    };

export type ProposeTopicUpdatesInput = {
  supportTopicKnowledge: SupportTopicContextV2;
  existingTopics?: unknown[];
  textUnderstandings: TextUnderstanding[];
  recentInteractionContext: RecentInteractionContext;
  latestUserMessageContent?: string | null;
};

export type ProposeTopicUpdatesResult = ProposeTopicUpdatesOutput;

export type {
  TopicUpdateOp,
  TopicUpdateOpsResponse,
  TopicUpdateProposal
};
