/**
 * Visual Analysis Prompts
 *
 * This file builds the prompts for visual attachment analysis.
 * It creates system and user messages for the LLM vision model.
 * Supports both text-only and vision (image URL) formats.
 */

import type { Attachment } from "./runAttachmentDescriptionLLM";
import type { LLMMessage, MessageContent } from "./llm-client";

/**
 * System instructions for the visual analysis assistant
 */
const VISUAL_ANALYSIS_SYSTEM_INSTRUCTIONS = `You are a visual analysis assistant specialized in analyzing images and videos.
Your task is to analyze visual attachments and extract relevant information from them.

CRITICAL RULES (must be followed strictly):
1. Analyze the visual content objectively and accurately
2. Describe what you see in detail including objects, text, people, scenes, and context
3. If the image contains UI elements, describe the interface and any error messages
4. If the image shows a problem, explain what appears to be wrong
5. Extract any visible text from the image
6. Output ONLY a JSON object with the extracted information
7. Do NOT add explanations, comments, or markdown formatting outside the JSON
8. If you cannot analyze the image, explain why in the error field

OUTPUT FORMAT (strict JSON):
{
  "description": "Detailed description of what is visible in the image/video",
  "extractedText": "Any text visible in the image (or empty string if none)",
  "objects": ["list", "of", "main", "objects", "identified"],
  "context": "Context or scene type (e.g., 'screenshot of error message', 'photo of office', etc.)",
  "issues": ["list", "of", "potential", "issues", "or", "problems", "detected"],
  "confidence": "high|medium|low"
}`;

/**
 * Build the text prompt for visual analysis
 * @param attachments - The visual attachments to analyze
 * @param latestUserMessage - Optional user message for context
 * @returns The user prompt text
 */
function buildVisualAnalysisUserPrompt(
  attachments: Attachment[],
  latestUserMessage?: string
): string {
  const attachmentList = attachments
    .map(function (attachment, index) {
      const name = attachment.name || `attachment-${index + 1}`;
      const type = attachment.mimeType || "unknown";
      return `- ${name} (${type})`;
    })
    .join("\n");

  let prompt = `Please analyze the following visual attachments:\n\n`;
  prompt += `ATTACHMENTS:\n${attachmentList}\n\n`;

  if (latestUserMessage) {
    prompt += `USER MESSAGE:\n"${latestUserMessage}"\n\n`;
    prompt += `Consider the user's message when analyzing these images. The user may be asking about or showing a specific issue.\n\n`;
  }

  prompt += `Provide a detailed analysis of each attachment following the JSON format specified in your instructions.`;

  return prompt;
}

/**
 * Extract image URLs from attachments
 * @param attachments - The attachments to extract URLs from
 * @returns Array of image URLs
 */
function extractImageUrls(attachments: Attachment[]): string[] {
  return attachments
    .map(function (attachment) {
      return attachment.url || "";
    })
    .filter(function (url) {
      return url.length > 0;
    });
}

/**
 * Build vision messages with text and image URLs for LLM vision models
 * @param attachments - The visual attachments to analyze
 * @param latestUserMessage - Optional user message for context
 * @returns Array of messages compatible with vision models (GPT-4V, etc.)
 */
function buildVisionMessages(
  attachments: Attachment[],
  latestUserMessage?: string
): LLMMessage[] {
  const imageUrls = extractImageUrls(attachments);
  const textPrompt = buildVisualAnalysisUserPrompt(attachments, latestUserMessage);

  const userContent: MessageContent[] = [
    { type: "text", text: textPrompt }
  ];

  // Add image URLs to the content
  for (const url of imageUrls) {
    userContent.push({
      type: "image_url",
      image_url: {
        url: url,
        detail: "auto"
      }
    });
  }

  return [
    {
      role: "system",
      content: VISUAL_ANALYSIS_SYSTEM_INSTRUCTIONS
    },
    {
      role: "user",
      content: userContent
    }
  ];
}

/**
 * Build the complete messages array for the LLM API (text-only fallback)
 * @param attachments - The visual attachments to analyze
 * @param latestUserMessage - Optional user message for context
 * @returns Array of messages for text-only LLM API
 * @deprecated Use buildVisionMessages for vision models
 */
function buildVisualAnalysisMessages(
  attachments: Attachment[],
  latestUserMessage?: string
): Array<{ role: "system" | "user"; content: string }> {
  return [
    {
      role: "system",
      content: VISUAL_ANALYSIS_SYSTEM_INSTRUCTIONS
    },
    {
      role: "user",
      content: buildVisualAnalysisUserPrompt(attachments, latestUserMessage)
    }
  ];
}

export {
  VISUAL_ANALYSIS_SYSTEM_INSTRUCTIONS,
  buildVisualAnalysisUserPrompt,
  buildVisualAnalysisMessages,
  buildVisionMessages,
  extractImageUrls
};
