/**
 * Test LLM token budget guard.
 *
 * This test must never send a real LLM request.
 *
 * It replaces globalThis.fetch with a fake function that fails immediately
 * if the LLM client ever tries to send an API call.
 *
 * Usage:
 *   npx tsx scripts/test-llm-safety/test-token-budget-guard.ts
 */

import {
  callLLM
} from "../../src/llm/llm-client";

import type {
  LLMMessage
} from "../../src/llm/types.llm-types";

async function main(): Promise<void> {
  console.log("\n============================================================");
  console.log("Testing LLM Token Budget Guard");
  console.log("============================================================\n");

  let fetchWasCalled = false;

  const originalFetch = globalThis.fetch;

  globalThis.fetch = async function (): Promise<Response> {
    fetchWasCalled = true;

    throw new Error(
      "TEST_FAILURE_FETCH_WAS_CALLED: the token guard did not block the request"
    );
  };

  try {
    const oversizedText = "This is a large prompt. ".repeat(5000);

    const messages: LLMMessage[] = [
      {
        role: "system",
        content: "You are a test assistant."
      },
      {
        role: "user",
        content: oversizedText
      }
    ];

    const result = await callLLM(messages, {
      config: {
        provider: "custom",
        model: "fake-test-model",
        apiBaseUrl: "https://example.invalid",
        apiKey: "fake-api-key",
        maxRetries: 1,
        timeoutMs: 1000,
        maxEstimatedTotalTokens: 1000
      },
      maxTokens: 100,
      logUsage: true
    });

    console.log("Result:");
    console.log(JSON.stringify(result, null, 2));

    if (fetchWasCalled) {
      throw new Error(
        "❌ FAILED: fetch was called. A real LLM request could have been sent."
      );
    }

    if (result.success) {
      throw new Error(
        "❌ FAILED: callLLM succeeded, but it should have been blocked."
      );
    }

    if (!result.error?.startsWith("estimated_total_tokens_exceeded")) {
      throw new Error(
        `❌ FAILED: expected estimated_total_tokens_exceeded, got: ${result.error}`
      );
    }

    console.log("\n✅ SUCCESS: oversized prompt was blocked before any API call.");
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log("\n============================================================");
}

main().catch(function (error) {
  console.error("\nUnexpected error:");
  console.error(error);
  process.exit(1);
});