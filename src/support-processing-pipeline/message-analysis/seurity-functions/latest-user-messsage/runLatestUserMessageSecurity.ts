/**
 * Temporary Latest User Message Security
 *
 * Mock implementation used while testing the message analysis pipeline.
 *
 * Always validates the latest user message and lets the pipeline continue.
 */

import type {
  LatestUserMessageSecurityDecision,
  LatestUserMessageSecurityInput
} from "../../typesMessageAnalysis.types";

async function runLatestUserMessageSecurity(
  input: LatestUserMessageSecurityInput
): Promise<LatestUserMessageSecurityDecision> {
  void input;

  return {
    decision: {
      route: "continue"
    },
    history: {
      checked: ["account_trust_status"],
      failed: [],
      contextAccountDecision: "continue"
    }
  };
}

export {
  runLatestUserMessageSecurity
};