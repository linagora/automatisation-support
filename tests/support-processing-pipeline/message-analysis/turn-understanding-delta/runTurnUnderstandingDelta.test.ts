import { describe, expect, it } from "vitest";

import {
  assembleTurnUnderstandingDelta
} from "../../../../src/support-processing-pipeline/message-analysis/turn-understanding-delta/runTurnUnderstandingDelta";

import type {
  ConversationHistory,
  LatestUserAttachment,
  SupportTopicKnowledge
} from "../../../../src/support-processing-pipeline/typesSupportProcessingPipeline.types";
import type {
  AttachmentAnalysis
} from "../../../../src/support-processing-pipeline/message-analysis/typesMessageAnalysis.types";

const supportTopicKnowledge: SupportTopicKnowledge = {
  segments_topic: []
};

const conversationHistory = [] as ConversationHistory;

function buildAttachment(
  overrides: Partial<LatestUserAttachment>
): LatestUserAttachment {
  return {
    id: "local_attachment_1",
    filename: "image.png",
    sizeInBytes: 1024,
    name: "image.png",
    mimeType: "image/png",
    sizeBytes: 1024,
    accessUrl: "data:image/png;base64,very-large-image-payload",
    path: "/tmp/image.png",
    channel: "email",
    sentAt: "2026-06-03T08:00:00.000Z",
    ...overrides
  };
}

describe("assembleTurnUnderstandingDelta attachments", function () {
  it("adds analyzed image attachments to turnUnderstandingDelta.attachments.images", function () {
    const latestUserAttachments = [
      buildAttachment({
        id: "local_attachment_1",
        mimeType: "image/png"
      })
    ];
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

    const output = assembleTurnUnderstandingDelta({
      securityGateSummary: {
        gateChecked: {},
        gateFailed: {}
      },
      latestUserAttachments,
      attachmentAnalysis,
      supportTopicKnowledge,
      conversationHistory
    });

    expect(output.attachments?.images).toHaveLength(1);
    expect(output.attachments?.images[0]).toMatchObject({
      id: "local_attachment_1",
      kind: "image",
      filename: "image.png",
      mimeType: "image/png",
      sizeInBytes: 1024,
      status: "analyzed",
      analysis: {
        llmDescription: "Screenshot of a folder creation modal."
      }
    });
    expect(output.attachments?.images[0]).not.toHaveProperty("attachment");
    expect(output.attachments?.images[0]).not.toHaveProperty("url");
    expect(output.attachments?.images[0]).not.toHaveProperty("path");
    expect(output.attachments?.images[0]).not.toHaveProperty("accessUrl");
    expect(output.attachments?.videos).toEqual([]);
    expect(output.attachments?.other).toEqual([]);
  });

  it("keeps refused attachments in turnUnderstandingDelta.attachments.other", function () {
    const latestUserAttachments = [
      buildAttachment({
        id: "local_attachment_2",
        filename: "archive.zip",
        name: "archive.zip",
        mimeType: "application/zip"
      })
    ];
    const attachmentAnalysis: AttachmentAnalysis = [
      {
        attachmentIndex: 1,
        filename: "archive.zip",
        mimeType: "application/zip",
        status: "refused",
        reason: "accepted_format",
        readinessDecision: {
          decision: {
            route: "stop"
          },
          history: {
            checked: ["safe_filename"],
            failed: ["accepted_format"],
            detectedFormat: "other"
          }
        }
      }
    ];

    const output = assembleTurnUnderstandingDelta({
      securityGateSummary: {
        gateChecked: {},
        gateFailed: {}
      },
      latestUserAttachments,
      attachmentAnalysis,
      supportTopicKnowledge,
      conversationHistory
    });

    expect(output.attachments?.other).toHaveLength(1);
    expect(output.attachments?.other[0]).toMatchObject({
      id: "local_attachment_2",
      kind: "other",
      filename: "archive.zip",
      mimeType: "application/zip",
      status: "refused",
      reason: "accepted_format"
    });
    expect(output.attachments?.other[0]).not.toHaveProperty("attachment");
    expect(output.attachments?.other[0]).not.toHaveProperty("analysisItem");
    expect(output.attachments?.other[0]).not.toHaveProperty("url");
    expect(output.attachments?.other[0]).not.toHaveProperty("path");
    expect(output.attachments?.images).toEqual([]);
    expect(output.attachments?.videos).toEqual([]);
  });
});
