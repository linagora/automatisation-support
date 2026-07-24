/**
 * Parse LLM Response
 *
 * This file provides utility functions for parsing LLM response content
 * into structured objects.
 */

/**
 * Parse the LLM response content into a structured object
 * @param content - The raw content from the LLM
 * @returns Parsed object or null if parsing failed
 */
function parseLLMResponse(content: string): Record<string, unknown> | null {
  try {
    const cleaned = content
      .replace(/^```json\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export {
  parseLLMResponse
};
