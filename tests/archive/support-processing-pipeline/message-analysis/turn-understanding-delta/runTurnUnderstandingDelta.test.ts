import { describe, expect, it } from "vitest";

import {
  assembleTurnUnderstandingDelta
} from "../../../../src/archive/support-processing-pipeline/message-analysis/turn-understanding-delta/runTurnUnderstandingDelta";

import type {
  ConversationHistory,
  LatestUserAttachment,
  SupportTopicKnowledge
} from "../../../../src/archive/support-processing-pipeline/typesSupportProcessingPipeline.types";
import type {
  AttachmentAnalysis
} from "../../../../src/archive/support-processing-pipeline/message-analysis/typesMessageAnalysis.types";

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

describe("assembleTurnUnderstandingDelta topic segment verbatims", function () {
  it("keeps segment_verbatims on new topics", function () {
    const output = assembleTurnUnderstandingDelta({
      securityGateSummary: {
        gateChecked: {},
        gateFailed: {}
      },
      latestUserAttachments: [],
      supportTopicKnowledge,
      conversationHistory,
      fullWeightMessageAnalysisOutput: {
        decision: {
          route: "continue"
        },
        history: {
          checked: [],
          failed: []
        },
        analysis: {
          user_language: "French",
          segments_lack_comprehension: [],
          segments_topic: [
            {
              matched_historical_topic: "no",
              id_topic: 1,
              topic_category: "question_faq",
              tool_or_product: "Drive",
              topic_action: "share",
              topic_object: "folder",
              segment_verbatims: [
                "Comment partager un dossier avec un collègue dans Drive ?"
              ],
              topic_details: {
                question_intent: "how_to"
              },
              user_goal: "Share a folder in Drive",
              blocking_issue: "no"
            }
          ],
          segments_signal: [],
          segments_scope_boundary: [],
          segments_suspicious: []
        }
      }
    });

    expect(output.topics[0]).toMatchObject({
      matched_historical_topic: "no",
      segment_verbatims: [
        "Comment partager un dossier avec un collègue dans Drive ?"
      ]
    });
  });

  it("keeps segment_verbatims on matched topics even when other fields are duplicates", function () {
    const output = assembleTurnUnderstandingDelta({
      securityGateSummary: {
        gateChecked: {},
        gateFailed: {}
      },
      latestUserAttachments: [],
      supportTopicKnowledge: {
        segments_topic: [
          {
            id_topic: 1,
            topic_category: "bug",
            tool_or_product: "Drive",
            topic_action: "create",
            topic_object: "folder",
            topic_details: {
              observed_result: "button stays disabled"
            },
            user_goal: "Create a folder in Drive",
            blocking_issue: "yes"
          }
        ]
      },
      conversationHistory,
      fullWeightMessageAnalysisOutput: {
        decision: {
          route: "continue"
        },
        history: {
          checked: [],
          failed: []
        },
        analysis: {
          user_language: "French",
          segments_lack_comprehension: [],
          segments_topic: [
            {
              matched_historical_topic: "yes",
              id_topic: 1,
              segment_verbatims: [
                "Le bouton reste grisé."
              ],
              topic_details: {
                observed_result: "button stays disabled"
              }
            }
          ],
          segments_signal: [],
          segments_scope_boundary: [],
          segments_suspicious: []
        }
      }
    });

    expect(output.topics).toEqual([
      {
        matched_historical_topic: "yes",
        id_topic: 1,
        segment_verbatims: [
          "Le bouton reste grisé."
        ]
      }
    ]);
  });
});
