import type {
  SupportKnowledgeSummary
} from "../../../src/support-automation/support-processing-pipeline-v2/typesSupportProcessingPipelineV2.types";

export type GlobalPipelineCase = {
  id: string;
  name: string;
  tags: string[];
  actor: {
    userId: string;
    roomId: string;
    displayName?: string;
    threadId?: string;
  };
  seedLiveMemory: {
    topics: Array<{
      topicId: number;
      title: string | null;
      broadCategoryHint: string | null;
      summary: string | null;
      caseDetails: Array<Record<string, unknown>>;
      attemptedActions: Array<Record<string, unknown>>;
      supportKnowledgeSummary?: SupportKnowledgeSummary | string | null;
    }>;
    lastUserVerbatim?: string | null;
    lastBotVerbatim?: string | null;
    userState?: {
      status: string;
      flags: string[];
    };
  };
  receivedMessages: Array<{
    name: string;
    content: string;
    delayMs?: number;
    typingBeforeMs?: number;
  }>;
  expected?: {
    sentShouldMention?: string[];
    sentShouldNotMention?: string[];
    liveMemoryLastBotShouldEqualSent?: boolean;
    ragUsage?: Array<{
      topicId: number;
      status: string;
    }>;
  };
  metadata?: {
    origin?: "hand-authored" | "raw-text-analysis";
    rawExpectedTextSurface?: unknown;
    accountTrustStatus?: unknown;
    notes?: string[];
  };
};

export type GlobalPipelineGroup = {
  id: string;
  label: string;
  tags?: string[];
  cases?: string[];
};
