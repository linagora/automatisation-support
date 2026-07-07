import { describe, expect, it, vi } from "vitest";

import {
  runMessageAnalysis
} from "../../../src/archive/support-processing-pipeline/message-analysis/runMessageAnalysis";

import type {
  AccountTrustStatus,
  ConversationHistory,
  LatestUserAttachment,
  LatestUserMessage,
  SupportTopicKnowledge
} from "../../../src/archive/support-processing-pipeline/typesSupportProcessingPipeline.types";
import type {
  AttachmentAnalysis,
  MessageAnalysisSteps
} from "../../../src/archive/support-processing-pipeline/message-analysis/typesMessageAnalysis.types";

const latestUserMessage: LatestUserMessage = {
  id: "message_1",
  content: "Voici une capture du probleme.",
  channel: "email",
  sentAt: "2026-06-03T08:00:00.000Z"
};

const latestUserAttachments: LatestUserAttachment[] = [
  {
    id: "local_attachment_1",
    filename: "image.png",
    name: "image.png",
    mimeType: "image/png",
    sizeInBytes: 1024,
    sizeBytes: 1024,
    channel: "email",
    sentAt: "2026-06-03T08:00:01.000Z"
  }
];

const accountTrustStatus: AccountTrustStatus = {
  status: "trusted",
  reasons: []
};

const supportTopicKnowledge: SupportTopicKnowledge = {
  segments_topic: []
};

const conversationHistory = [] as ConversationHistory;

describe("runMessageAnalysis", function () {
  it("adds deterministic attachment groups to the returned turnUnderstandingDelta", async function () {
    const attachmentAnalysis: AttachmentAnalysis = [
      {
        attachmentIndex: 1,
        filename: "image.png",
        mimeType: "image/png",
        status: "analyzed",
        analysis: {
          llmDescription: "Screenshot of a folder creation modal."
        }
      }
    ];
    const steps: MessageAnalysisSteps = {
      runLatestUserMessageSecurity: vi.fn(async () => ({
        decision: {
          route: "continue" as const
        },
        history: {
          checked: [],
          failed: []
        }
      })),
      runAttachmentAnalysis: vi.fn(async () => attachmentAnalysis),
      runAttachmentAnalysisSecurity: vi.fn(async () => ({
        decision: {
          route: "continue" as const
        },
        history: {
          checked: [],
          failed: []
        }
      })),
      runFullWeightMessageAnalysis: vi.fn(async () => ({
        decision: {
          route: "continue" as const
        },
        history: {
          checked: [],
          failed: []
        },
        analysis: {
          user_language: "french",
          segments_lack_comprehension: [],
          segments_topic: [],
          segments_signal: [],
          segments_scope_boundary: [],
          segments_suspicious: []
        }
      }))
    };

    const output = await runMessageAnalysis({
      latestUserMessage,
      latestUserAttachments,
      accountTrustStatus,
      supportTopicKnowledge,
      conversationHistory
    }, steps);

    expect(steps.runAttachmentAnalysis).toHaveBeenCalledWith({
      latestUserMessage,
      latestUserAttachments
    });
    expect(steps.runAttachmentAnalysisSecurity).toHaveBeenCalledWith({
      attachmentAnalysis,
      accountTrustStatus,
      latestUserMessageContent: latestUserMessage.content
    });
    expect(steps.runFullWeightMessageAnalysis).toHaveBeenCalledWith({
      latestUserMessage,
      supportTopicKnowledge,
      conversationHistory,
      attachmentAnalysis
    });
    expect(output.attachments?.images).toHaveLength(1);
    expect(output.attachments?.images[0]).toMatchObject({
      id: "local_attachment_1",
      kind: "image",
      status: "analyzed"
    });
    expect(output.attachments?.images[0]).not.toHaveProperty("attachment");
    expect(output.attachments?.images[0]).not.toHaveProperty("url");
    expect(output.attachments?.images[0]).not.toHaveProperty("path");
    expect(output.attachments?.videos).toEqual([]);
    expect(output.attachments?.other).toEqual([]);
  });

  it("does not add attachments when no attachment was received", async function () {
    const steps: MessageAnalysisSteps = {
      runLatestUserMessageSecurity: vi.fn(async () => ({
        decision: {
          route: "continue" as const
        },
        history: {
          checked: [],
          failed: []
        }
      })),
      runAnalysisGate: vi.fn(async () => ({
        decision: {
          route: "light_weight_first" as const
        },
        history: {
          prefer_light_first: [],
          prefer_full_direct: []
        }
      })),
      runLightWeightMessageAnalysis: vi.fn(async () => ({
        shouldRunSupportMessageAnalysis: false,
        segments_signal: [],
        segments_scope_boundary: [],
        segments_suspicious: []
      }))
    };

    const output = await runMessageAnalysis({
      latestUserMessage,
      latestUserAttachments: [],
      accountTrustStatus,
      supportTopicKnowledge,
      conversationHistory
    }, steps);

    expect(output.attachments).toBeUndefined();
    expect(steps.runAttachmentAnalysis).toBeUndefined();
  });
});
