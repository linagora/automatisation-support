/**
 * Visual Prompt Builder
 *
 * Builds LLM prompts for visual attachment analysis.
 * Two distinct strategies:
 * - buildImagePrompt   : for direct image attachments (1 or more)
 * - buildVideoPrompt   : for video frames extracted from a video file
 */

import type { Attachment } from "./runAttachmentAnalysis";
import type { LLMMessage, MessageContent } from "../../../llm/llm-client";

/**
 * Metadata for video prompt generation
 */
interface VideoPromptMetadata {
  durationSeconds: number;
  frameCount: number;
  intervalSeconds: number;
}

const IMAGE_ANALYSIS_SYSTEM_INSTRUCTIONS = `You are a visual analysis assistant specialized in analyzing images.
Your task is to analyze image attachments and extract relevant information.

CRITICAL RULES:
1. Analyze the visual content objectively and accurately
2. Describe what you see in detail: objects, text, people, scenes, context
3. If the image contains UI elements, describe the interface and any error messages
4. If the image shows a problem, explain what appears to be wrong
5. Extract any visible text from the image
6. Output ONLY a JSON object — no markdown, no comments outside JSON

OUTPUT FORMAT (strict JSON):
{
  "description": "Detailed description of what is visible",
  "extractedText": "Any text visible in the image, or empty string",
  "objects": ["list", "of", "main", "objects"],
  "context": "Scene type (e.g. 'screenshot of error message', 'office photo')",
  "issues": ["list", "of", "detected", "problems"],
  "confidence": "high|medium|low"
}`;

const VIDEO_ANALYSIS_SYSTEM_INSTRUCTIONS = `You are a visual analysis assistant specialized in analyzing videos through extracted frames.
You will receive a sequence of frames extracted from a single video file.
Your task is to reconstruct what happens in the video and extract relevant information.

CRITICAL RULES:
1. Treat all frames as a temporal sequence — the first frame is the beginning, the last is the end
2. Identify what changes between frames to understand actions, transitions, or events
3. Describe the overall video content, not just individual frames
4. If frames show a UI or screen recording, describe the user's actions and any errors
5. Extract any visible text that appears across frames
6. Output ONLY a JSON object — no markdown, no comments outside JSON

OUTPUT FORMAT (strict JSON):
{
  "description": "Overall description of what happens in the video",
  "extractedText": "Any text visible across frames, or empty string",
  "objects": ["list", "of", "main", "objects", "or", "actors"],
  "context": "Scene type (e.g. 'screen recording of bug', 'office meeting')",
  "timeline": "Brief description of the sequence of events across frames",
  "issues": ["list", "of", "detected", "problems"],
  "confidence": "high|medium|low"
}`;

function extractImageUrls(attachments: Attachment[]): string[] {
  return attachments
    .map(attachment => attachment.url || "")
    .filter(url => url.length > 0);
}

function buildAttachmentList(attachments: Attachment[]): string {
  return attachments
    .map((attachment, index) => {
      const name = attachment.name || `attachment-${index + 1}`;
      const type = attachment.mimeType || "unknown";
      return `- ${name} (${type})`;
    })
    .join("\n");
}

/**
 * Build prompt for direct image analysis (1 or more images)
 */
function buildImagePrompt(
  attachments: Attachment[],
  latestUserMessage?: string
): LLMMessage[] {
  const attachmentList = buildAttachmentList(attachments);
  const imageUrls = extractImageUrls(attachments);

  let userText = `Please analyze the following image attachment(s):\n\nATTACHMENTS:\n${attachmentList}\n\n`;

  if (latestUserMessage) {
    userText += `USER MESSAGE:\n"${latestUserMessage}"\n\nConsider the user's message when analyzing — they may be reporting or showing a specific issue.\n\n`;
  }

  userText += `Provide a detailed analysis following the JSON format specified in your instructions.`;

  const userContent: MessageContent[] = [{ type: "text", text: userText }];

  for (const url of imageUrls) {
    userContent.push({ type: "image_url", image_url: { url, detail: "auto" } });
  }

  return [
    { role: "system", content: IMAGE_ANALYSIS_SYSTEM_INSTRUCTIONS },
    { role: "user", content: userContent }
  ];
}

/**
 * Build prompt for video analysis via extracted frames.
 * Frames are passed as image attachments ordered chronologically.
 * @param frameAttachments - Ordered list of extracted frame attachments
 * @param originalVideoName - Original video filename for context
 * @param latestUserMessage - Optional user message
 */
function buildVideoPrompt(
  frameAttachments: Attachment[],
  originalVideoName: string,
  latestUserMessage?: string,
  metadata?: VideoPromptMetadata
): LLMMessage[] {
  const frameUrls = extractImageUrls(frameAttachments);
  const frameCount = metadata?.frameCount ?? frameAttachments.length;

  let userText = `You are receiving ${frameCount} frames extracted from the video file: "${originalVideoName}".\n`;
  userText += `Frames are ordered chronologically from first to last.\n`;

  if (metadata) {
    userText += `The original video duration is approximately ${metadata.durationSeconds.toFixed(1)} seconds.\n`;

    if (metadata.intervalSeconds) {
      userText += `Frames were extracted approximately every ${metadata.intervalSeconds} seconds.\n`;
    }
  }

  userText += `\n`;

  if (latestUserMessage) {
    userText += `USER MESSAGE:\n"${latestUserMessage}"\n\nConsider the user's message when analyzing the video.\n\n`;
  }

  userText += `Analyze the full sequence and describe what happens in the video following the JSON format in your instructions.`;

  const userContent: MessageContent[] = [{ type: "text", text: userText }];

  for (const url of frameUrls) {
    userContent.push({
      type: "image_url",
      image_url: {
        url,
        detail: "auto"
      }
    });
  }

  return [
    { role: "system", content: VIDEO_ANALYSIS_SYSTEM_INSTRUCTIONS },
    { role: "user", content: userContent }
  ];
}

export {
  buildImagePrompt,
  buildVideoPrompt
};

export type {
  VideoPromptMetadata
};