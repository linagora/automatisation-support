import { describe, expect, it } from "vitest";

import {
  buildFullWeightPrompt
} from "../../../../src/support-processing-pipeline/message-analysis/fullweight-message-analysis/buildFullWeightPrompt";
import {
  fullWeightMessageAnalysisResponseFormat
} from "../../../../src/support-processing-pipeline/message-analysis/fullweight-message-analysis/fullWeightMessageAnalysis.schema";

import type {
  AttachmentAnalysis
} from "../../../../src/support-processing-pipeline/message-analysis/typesMessageAnalysis.types";
import type {
  ConversationHistory,
  LatestUserMessage,
  SupportTopicKnowledge
} from "../../../../src/support-processing-pipeline/typesSupportProcessingPipeline.types";

const forbiddenAttachmentFlagFields = [
  "screenshot_available",
  "image_available",
  "video_available",
  "attachment_available"
];

const latestUserMessage: LatestUserMessage = {
  id: "message_1",
  content: "Voici la capture avec l'erreur affichée.",
  channel: "email",
  sentAt: "2026-06-03T08:00:00.000Z"
};

const supportTopicKnowledge: SupportTopicKnowledge = {
  segments_topic: []
};

const conversationHistory = [] as ConversationHistory;

const attachmentAnalysis: AttachmentAnalysis = [
  {
    attachmentIndex: 1,
    filename: "image.png",
    mimeType: "image/png",
    status: "analyzed",
    analysis: {
      llmDescription:
        "Screenshot of a folder creation modal showing the error message Validation button disabled."
    }
  }
];

describe("fullweight attachment flags contract", function () {
  it("does not ask the LLM to produce attachment presence flags in topic_details", function () {
    const prompt = buildFullWeightPrompt({
      latestUserMessage,
      supportTopicKnowledge,
      conversationHistory,
      attachmentAnalysis
    });

    for (const forbiddenField of forbiddenAttachmentFlagFields) {
      expect(prompt.systemPrompt).not.toContain(forbiddenField);
    }

    expect(prompt.systemPrompt).toContain(
      "Do not create topic_details fields to indicate whether an attachment, screenshot, image, or video is present."
    );
    expect(prompt.systemPrompt).toContain(
      "Attachment presence and analysis status are handled by the backend outside topic_details."
    );
  });

  it("keeps attachment analysis available to extract useful business facts", function () {
    const prompt = buildFullWeightPrompt({
      latestUserMessage,
      supportTopicKnowledge,
      conversationHistory,
      attachmentAnalysis
    });

    expect(prompt.userPrompt).toContain("# Attachment analysis");
    expect(prompt.userPrompt).toContain("image.png");
    expect(prompt.userPrompt).toContain("Validation button disabled");
  });

  it("does not allow attachment presence flags in the response schema", function () {
    const serializedSchema = JSON.stringify(
      fullWeightMessageAnalysisResponseFormat
    );

    for (const forbiddenField of forbiddenAttachmentFlagFields) {
      expect(serializedSchema).not.toContain(forbiddenField);
    }
  });

  it("does not ask the LLM to output topic_label", function () {
    const prompt = buildFullWeightPrompt({
      latestUserMessage,
      supportTopicKnowledge,
      conversationHistory,
      attachmentAnalysis
    });

    expect(prompt.systemPrompt).toContain("Do not output topic_label.");
    expect(prompt.systemPrompt).toContain(
      "The backend builds display labels from tool_or_product, topic_action, and topic_object."
    );
    expect(prompt.systemPrompt).not.toContain(
      "topic_label = tool_or_product"
    );
    expect(prompt.userPrompt).not.toContain("topic_label");
  });

  it("does not allow topic_label in the response schema", function () {
    const serializedSchema = JSON.stringify(
      fullWeightMessageAnalysisResponseFormat
    );

    expect(serializedSchema).not.toContain("topic_label");
  });
});
