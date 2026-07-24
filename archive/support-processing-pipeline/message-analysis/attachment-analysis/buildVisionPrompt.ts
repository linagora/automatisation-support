/**
 * Vision Prompt Builder
 *
 * Builds LLM prompts for attachment vision analysis.
 *
 * Two distinct strategies:
 * - buildImagePrompt: for one direct image attachment
 * - buildVideoPrompt: for one extracted video segment
 *
 * These prompts only ask for a vision-level analysis.
 * They do not ask the model to perform support-topic interpretation.
 */

import type {
  LLMMessage,
  MessageContent
} from "../../../../infrastructure/llm/llm-client";

import type {
  AttachmentAnalysis,
  ImageAnalysisInput,
  VideoAnalysisInput
} from "./typesAttachmentAnalysis.types";

/* =====================================================
 * Types
 * ===================================================== */

type ImagePromptInput = {
  attachmentIndex: number;
  latestUserMessage: ImageAnalysisInput["latestUserMessage"];
  attachmentAnalysis: AttachmentAnalysis;
  imageLocation: string;
};

type FrameAttachment = {
  filename: string;
  mimeType: string;
  path: string;
  url: string;
  sizeBytes: number;
};

type VideoSegment = {
  segmentIndex: number;
  segmentCount: number;
  startSeconds: number;
  endSeconds: number;
};

type PreviousSegmentAnalysis = {
  segmentIndex: number;
  startSeconds: number;
  endSeconds: number;
  status: "analyzed" | "suspicious";
  reason: string | undefined;
  llmDescription: string;
  structuredObservations: unknown;
  relationToPreviousAttachment: string | undefined;
};

type VideoPromptMetadata = {
  durationSeconds: number;
  frameCount: number;
  intervalSeconds: number;
};

type VideoPromptInput = {
  attachmentIndex: number;
  videoFilename: string;
  latestUserMessage: VideoAnalysisInput["latestUserMessage"];
  attachmentAnalysis: AttachmentAnalysis;
  frameAttachments: FrameAttachment[];
  videoMetadata: VideoPromptMetadata;
  videoSegment: VideoSegment;
  previousSegmentAnalyses: PreviousSegmentAnalysis[];
};

/* =====================================================
 * System instructions
 * ===================================================== */

const IMAGE_VISION_SYSTEM_INSTRUCTIONS = `You are a vision analysis assistant specialized in analyzing image attachments.

Your task is to describe what is visually present in the target image.

CRITICAL RULES:
1. Analyze only the visual content of the target image.
2. Use the user's message only to orient attention, not to invent missing information.
3. If the image is a UI screenshot, describe visible screens, buttons, forms, messages, errors, and relevant visible text.
4. If the image seems suspicious, unsafe, misleading, or inconsistent, set status to "suspicious" and explain why in reason.
5. Do not perform support-topic interpretation or decide the final user issue category.
6. Output ONLY a valid JSON object. No markdown. No comments outside JSON.

OUTPUT FORMAT:
{
  "status": "analyzed" | "suspicious",
  "reason": "Only required when status is suspicious",
  "llmDescription": "Clear visual description of what is visible in the image",
  "structuredObservations": {},
  "relationToPreviousAttachment": "Optional relation to previous attachments if relevant"
}`;

const VIDEO_VISION_SYSTEM_INSTRUCTIONS = `You are a vision analysis assistant specialized in analyzing videos through extracted frames.

You will receive frames extracted from one segment of a video.
Frames are ordered chronologically.

Your task is to describe what visually happens in this segment, while taking into account previous segment analyses when provided.

CRITICAL RULES:
1. Treat all frames as a temporal sequence.
2. Describe visible actions, UI transitions, errors, texts, and relevant changes across frames.
3. Use previous segment analyses only as context, not as visual evidence for the current segment.
4. Use the user's message only to orient attention, not to invent missing information.
5. If the segment seems suspicious, unsafe, misleading, or inconsistent, set status to "suspicious" and explain why in reason.
6. Do not perform support-topic interpretation or decide the final user issue category.
7. Output ONLY a valid JSON object. No markdown. No comments outside JSON.

OUTPUT FORMAT:
{
  "status": "analyzed" | "suspicious",
  "reason": "Only required when status is suspicious",
  "llmDescription": "Clear visual description of what happens in this video segment",
  "structuredObservations": {},
  "relationToPreviousAttachment": "Optional relation to previous attachments if relevant"
}`;

/* =====================================================
 * Helpers
 * ===================================================== */

// Builds a compact text representation of the target attachment only.
// Important: do not include url, path, or readiness internals in the text prompt.
function buildAttachmentAnalysisContext(
  attachmentAnalysis: AttachmentAnalysis,
  targetAttachmentIndex: number
): string {
  const targetAttachment = attachmentAnalysis.find((attachmentAnalysisItem) => {
    return attachmentAnalysisItem.attachmentIndex === targetAttachmentIndex;
  });

  return JSON.stringify(
    targetAttachment === undefined
      ? {
          attachmentIndex: targetAttachmentIndex
        }
      : {
          attachmentIndex: targetAttachment.attachmentIndex,
          filename: targetAttachment.filename,
          mimeType: targetAttachment.mimeType,
          sizeBytes: targetAttachment.sizeBytes
        },
    null,
    2
  );
}

// Adds the user message to the prompt when available.
function buildLatestUserMessageSection(
  latestUserMessage: ImageAnalysisInput["latestUserMessage"]
): string {
  if (!latestUserMessage) {
    return "";
  }

  return `USER MESSAGE:
${JSON.stringify({ content: latestUserMessage.content })}

Use this message only to orient the visual analysis.

`;
}

// Adds image URLs to the multimodal message content.
function addImageUrlsToContent(
  userContent: MessageContent[],
  imageUrls: string[]
): void {
  for (const imageUrl of imageUrls) {
    userContent.push({
      type: "image_url",
      image_url: {
        url: imageUrl,
        detail: "auto"
      }
    });
  }
}

/* =====================================================
 * Image prompt
 * ===================================================== */

function buildImagePrompt(
  input: ImagePromptInput
): LLMMessage[] {
  const attachmentAnalysisContext = buildAttachmentAnalysisContext(
    input.attachmentAnalysis,
    input.attachmentIndex
  );

  let userText = `Analyze the image attachment with attachmentIndex ${input.attachmentIndex}.

ATTACHMENT_ANALYSIS_DOCUMENT:
${attachmentAnalysisContext}

`;

  userText += buildLatestUserMessageSection(input.latestUserMessage);

  userText += `The target image is attached as image_url content in this message.

Return the image analysis using the exact JSON format from the system instructions.`;

  const userContent: MessageContent[] = [
    {
      type: "text",
      text: userText
    }
  ];

  addImageUrlsToContent(userContent, [
    input.imageLocation
  ]);

  return [
    {
      role: "system",
      content: IMAGE_VISION_SYSTEM_INSTRUCTIONS
    },
    {
      role: "user",
      content: userContent
    }
  ];
}
/* =====================================================
 * Video prompt
 * ===================================================== */

function buildVideoPrompt(
  input: VideoPromptInput
): LLMMessage[] {
  const attachmentAnalysisContext = buildAttachmentAnalysisContext(
    input.attachmentAnalysis,
    input.attachmentIndex
  );

  const frameUrls = input.frameAttachments.map(function (frameAttachment) {
    return frameAttachment.url;
  });

  let userText = `Analyze segment ${input.videoSegment.segmentIndex} of ${input.videoSegment.segmentCount} for video attachment with attachmentIndex ${input.attachmentIndex}.

VIDEO FILE:
${input.videoFilename}

VIDEO SEGMENT:
{
  "segmentIndex": ${input.videoSegment.segmentIndex},
  "segmentCount": ${input.videoSegment.segmentCount},
  "startSeconds": ${input.videoSegment.startSeconds},
  "endSeconds": ${input.videoSegment.endSeconds}
}

VIDEO METADATA:
{
  "durationSeconds": ${input.videoMetadata.durationSeconds},
  "frameCount": ${input.videoMetadata.frameCount},
  "intervalSeconds": ${input.videoMetadata.intervalSeconds}
}

Frames are ordered chronologically from first to last.

PREVIOUS_SEGMENT_ANALYSES:
${JSON.stringify(input.previousSegmentAnalyses, null, 2)}

ATTACHMENT_ANALYSIS_DOCUMENT:
${attachmentAnalysisContext}

`;

  userText += buildLatestUserMessageSection(input.latestUserMessage);

  userText += `Return the video segment analysis using the exact JSON format from the system instructions.`;

  const userContent: MessageContent[] = [
    {
      type: "text",
      text: userText
    }
  ];

  addImageUrlsToContent(userContent, frameUrls);

  return [
    {
      role: "system",
      content: VIDEO_VISION_SYSTEM_INSTRUCTIONS
    },
    {
      role: "user",
      content: userContent
    }
  ];
}

export {
  buildImagePrompt,
  buildVideoPrompt
};

export type {
  ImagePromptInput,
  VideoPromptInput,
  VideoPromptMetadata
};
