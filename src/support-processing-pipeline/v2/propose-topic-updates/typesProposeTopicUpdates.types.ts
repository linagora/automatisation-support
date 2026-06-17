import type {
  RecentInteractionContext,
  SupportTopicKnowledge,
  TextUnderstanding,
  TopicUpdateProposal
} from "../typesSupportProcessingPipelineV2.types";
import type {
  LLMMessage
} from "../../../llm/llm-client";

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
      topicUpdateProposals: TopicUpdateProposal[];
    }
  | {
      status: "invalid";
      reason: string;
      topicUpdateProposals: TopicUpdateProposal[];
    };

export type ProposeTopicUpdatesInput = {
  supportTopicKnowledge: SupportTopicKnowledge;
  existingTopics?: unknown[];
  textUnderstandings: TextUnderstanding[];
  recentInteractionContext: RecentInteractionContext;
  latestUserMessageContent?: string | null;
};

export type ProposeTopicUpdatesResult = {
  topicUpdateProposals: TopicUpdateProposal[];
};

export type {
  TopicUpdateProposal
};
