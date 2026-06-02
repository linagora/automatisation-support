import {
  decideTextSecurityWithAccountTrust
} from "../shared/decideTextSecurityWithAccountTrust";
import {
  runLlmTrusterReview
} from "../shared/runLlmTrusterReview";
import {
  runTextSecurityChecks
} from "../shared/runTextSecurityChecks";

import type {
  LatestUserMessageSecurityCheckName,
  LatestUserMessageSecurityDecision,
  LatestUserMessageSecurityInput
} from "../../typesMessageAnalysis.types";

async function runLatestUserMessageSecurity(
  input: LatestUserMessageSecurityInput
): Promise<LatestUserMessageSecurityDecision> {
  const textSecurityChecks = runTextSecurityChecks({
    text: input.latestUserMessage.content
  });
  const trustDecision = decideTextSecurityWithAccountTrust({
    textSecurityChecks,
    accountTrustStatus: input.accountTrustStatus
  });

  if (trustDecision.route === "continue") {
    return {
      decision: {
        route: "continue"
      },
      history: {
        checked: textSecurityChecks.checked as LatestUserMessageSecurityCheckName[],
        failed: textSecurityChecks.failed as LatestUserMessageSecurityCheckName[]
      }
    };
  }

  if (trustDecision.route === "stop") {
    return {
      decision: {
        route: "stop"
      },
      history: {
        checked: textSecurityChecks.checked as LatestUserMessageSecurityCheckName[],
        failed: textSecurityChecks.failed as LatestUserMessageSecurityCheckName[]
      }
    };
  }

  const llmReview = await runLlmTrusterReview({
    reviewKind: "latest_user_message_text_security_checks",
    latestUserMessageContent: input.latestUserMessage.content,
    textSecurityChecks,
    trustDecision: {
      route: "review_with_llm_truster",
      ...(trustDecision.reason ? { reason: trustDecision.reason } : {})
    },
    accountTrustStatus: input.accountTrustStatus
  });

  return {
    decision: {
      route: llmReview.route === "continue" ? "continue" : "stop"
    },
    history: {
      checked: textSecurityChecks.checked as LatestUserMessageSecurityCheckName[],
      failed: textSecurityChecks.failed as LatestUserMessageSecurityCheckName[],
      llmReview
    }
  };
}

export {
  runLatestUserMessageSecurity
};
