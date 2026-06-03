import { describe, expect, it, vi } from "vitest";

import {
  runSupportProcessingPipeline
} from "../../src/support-processing-pipeline/runSupportProcessingPipeline";

import type {
  SupportProcessingPipelineInput,
  SupportProcessingPipelineSteps
} from "../../src/support-processing-pipeline/typesSupportProcessingPipeline.types";

function buildInput(): SupportProcessingPipelineInput {
  return {
    latestUserMessage: {
      id: "msg_1",
      content: "Bonjour, je n'arrive pas à me connecter.",
      channel: "email",
      sentAt: "2026-06-03T08:00:00.000Z"
    },
    latestUserAttachments: [],
    accountTrustStatus: {
      status: "trusted",
      reasons: []
    },
    accountProfile: {
      accountType: "company",
      actualPlan: "paid",
      paymentStatus: "up_to_date",
      planHistory: [],
      createdAt: "2025-01-01T00:00:00.000Z",
      daysSinceCreation: 519
    },
    accountInteractionTraits: {
      labels: [],
      lastUpdatedAt: "2026-06-03T08:00:00.000Z"
    },
    supportTopicKnowledge: {
      segments_topic: []
    },
    conversationHistory: []
  };
}

describe("runSupportProcessingPipeline", function () {
  it("runs current pipeline steps and returns user response plus patches", async function () {
    const input = buildInput();
    const turnUnderstandingDelta = {
      user_language: "french",
      securityGateSummary: {
        gateChecked: {},
        gateFailed: []
      },
      segments_lack_comprehension: [],
      segments_topic: [
        {
          matched_historical_topic: "no" as const,
          id_topic: 1,
          topic_category: "access_security" as const,
          tool_or_product: "Twake",
          topic_action: "connect",
          topic_object: "account",
          topic_details: {
            observed_result: "cannot connect",
            expected_result: "successful login",
            access_action: "login",
            auth_method: "password"
          },
          user_goal: "Connect to Twake account",
          blocking_issue: "yes" as const
        }
      ],
      segments_signal: [],
      segments_scope_boundary: [],
      segments_suspicious: []
    };
    const searchDecision = {
      decision: {
        route: "continue" as const,
        topics: [
          {
            topic_id: 1,
            type: "solution_searching" as const,
            missing_fields: []
          }
        ]
      },
      detected: {
        topicsQualificationResult: "evaluated" as const,
        solutionLikelihoodResult: "rag_relevant" as const
      },
      history: {
        checked: [],
        failed: []
      }
    };
    const possibleSolutions = [
      {
        id: "solution_1",
        solution: "Reset the account password."
      }
    ];
    const responsePlan = {
      responseLanguage: "french" as const,
      messagesPlan: {
        scopeBoundaryPlanMessages: [],
        topicPlanMessages: [],
        signalPlanMessages: [],
        handoverPlanMessages: []
      }
    };
    const userResponse = {
      messages: [
        {
          type: "topic_response" as const,
          content: "Réponse automatique"
        }
      ]
    };
    const patches = {
      analysisPatch: {
        turnUnderstandingDelta
      },
      securityPatch: {
        securityGateSummary: {
          gateChecked: {},
          gateFailed: []
        }
      },
      responsePatch: {
        responsePlan
      },
      metadataPatch: {
        generatedAt: "2026-06-03T08:00:00.000Z",
        source: "support-processing-pipeline" as const
      }
    };
    const steps: SupportProcessingPipelineSteps = {
      runMessageAnalysis: vi.fn(async () => turnUnderstandingDelta),
      runSearchDecision: vi.fn(async () => searchDecision),
      runSolutionRetrieval: vi.fn(async () => possibleSolutions),
      runResponsePlan: vi.fn(async () => responsePlan),
      runResponseProduction: vi.fn(async () => userResponse),
      runPatchesProduction: vi.fn(async () => patches)
    };

    const output = await runSupportProcessingPipeline(input, steps);

    expect(steps.runMessageAnalysis).toHaveBeenCalledWith({
      latestUserMessage: input.latestUserMessage,
      latestUserAttachments: input.latestUserAttachments,
      accountTrustStatus: input.accountTrustStatus,
      supportTopicKnowledge: input.supportTopicKnowledge,
      conversationHistory: input.conversationHistory
    });
    expect(steps.runSearchDecision).toHaveBeenCalledWith({
      supportTopicKnowledge: input.supportTopicKnowledge,
      turnUnderstandingDelta,
      accountTrustStatus: input.accountTrustStatus,
      accountProfile: input.accountProfile,
      accountInteractionTraits: input.accountInteractionTraits,
      conversationHistory: input.conversationHistory
    });
    expect(steps.runSolutionRetrieval).toHaveBeenCalledWith({
      supportTopicKnowledge: input.supportTopicKnowledge,
      turnUnderstandingDelta
    });
    expect(steps.runResponsePlan).toHaveBeenCalledWith({
      securityGateSummary: turnUnderstandingDelta.securityGateSummary,
      accountTrustStatus: input.accountTrustStatus,
      accountProfile: input.accountProfile,
      accountInteractionTraits: input.accountInteractionTraits,
      supportTopicKnowledge: input.supportTopicKnowledge,
      turnUnderstandingDelta,
      possibleSolutions,
      decisionSearchingSolution: {
        topics: searchDecision.decision.topics
      }
    });
    expect(steps.runResponseProduction).toHaveBeenCalledWith({
      responsePlan
    });
    expect(steps.runPatchesProduction).toHaveBeenCalledWith({
      turnUnderstandingDelta,
      responsePlan
    });
    expect(output).toEqual({
      userResponse,
      patches
    });
  });
});
