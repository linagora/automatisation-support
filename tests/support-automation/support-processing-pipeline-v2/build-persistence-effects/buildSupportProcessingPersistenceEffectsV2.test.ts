import { describe, expect, it } from "vitest";

import {
  buildSupportProcessingPersistenceEffectsV2
} from "../../../../src/support-automation/support-processing-pipeline-v2/build-persistence-effects/buildSupportProcessingPersistenceEffectsV2";

import type {
  BuildSupportPersistenceEffectsInput
} from "../../../../src/support-automation/support-processing-pipeline-v2/typesSupportProcessingPipelineV2.types";

function buildInput(
  overrides: Partial<BuildSupportPersistenceEffectsInput> = {}
): BuildSupportPersistenceEffectsInput {
  return {
    promptSecuritySignals: {
      matchedPatternIds: []
    },
    turnAnalysisPlan: {
      analyzeText: true,
      analyzeAttachments: false,
      matchedPatternIds: []
    },
    supportTopicKnowledge: {
      topics: []
    },
    userResponse: {
      messages: [
        {
          type: "topic_response",
          content: "Message final."
        }
      ]
    },
    ...overrides
  };
}

describe("buildSupportProcessingPersistenceEffectsV2", function () {
  it("builds V2 persistence effects instead of legacy ticket writes", function () {
    const effects = buildSupportProcessingPersistenceEffectsV2(buildInput({
      latestUserMessageContent: "Je ne reçois plus les notifications.",
      mergedTopicSnapshots: [
        {
          snapshotId: "snapshot_1",
          temporaryTopicId: null,
          topicId: 4,
          isNewTopic: false,
          title: "Notifications Android",
          broadCategoryHint: "bug",
          summary: "Les notifications Android ne sont pas reçues.",
          caseDetails: [
            {
              key: "platform",
              value: "Android",
              evidence: "Android"
            }
          ],
          attemptedActions: [
            {
              action: "Réinstaller l'application",
              outcome: "failed",
              evidence: "déjà réinstallé"
            }
          ],
          sourceUnderstandingIds: [],
          sourceVerbatims: [],
          sourceOpIndex: 0,
          baseTopic: null
        }
      ]
    }));

    expect(effects.liveMemoryUpdate).toEqual({
      mode: "merge",
      topics: [
        {
          topicId: 4,
          title: "Notifications Android",
          broadCategoryHint: "bug",
          summary: "Les notifications Android ne sont pas reçues.",
          caseDetails: [
            {
              key: "platform",
              value: "Android",
              evidence: "Android"
            }
          ],
          attemptedActions: [
            {
              action: "Réinstaller l'application",
              outcome: "failed",
              evidence: "déjà réinstallé"
            }
          ]
        }
      ],
      lastUserVerbatim: "Je ne reçois plus les notifications.",
      lastBotVerbatim: "Message final.",
      userState: {
        status: "normal",
        flags: []
      }
    });
    expect(effects.openTelemetry).toEqual({
      status: "mocked_empty",
      spans: [],
      metrics: [],
      events: [],
      resourceAttributes: {}
    });
    expect(effects.otherSupportPipelineInformation).toEqual({});
    expect(effects).not.toHaveProperty("analysisPatch");
  });

  it("marks user state as watch when prompt security signals matched", function () {
    const effects = buildSupportProcessingPersistenceEffectsV2(buildInput({
      promptSecuritySignals: {
        matchedPatternIds: ["ignore_previous_instructions"]
      }
    }));

    expect(effects.liveMemoryUpdate.userState).toEqual({
      status: "watch",
      flags: ["matched_prompt_pattern:ignore_previous_instructions"]
    });
  });

  it("copies unansweredRequestedFieldNames from topic snapshots into live memory updates", function () {
    const effects = buildSupportProcessingPersistenceEffectsV2(buildInput({
      mergedTopicSnapshots: [
        {
          snapshotId: "topic_4",
          temporaryTopicId: null,
          topicId: 4,
          isNewTopic: false,
          title: "Notifications Android",
          broadCategoryHint: "bug",
          summary: "Les notifications Android ne sont pas reçues.",
          caseDetails: [
            {
              key: "platform",
              value: "Android",
              evidence: "Android"
            }
          ],
          attemptedActions: [],
          unansweredRequestedFieldNames: ["error_message", "amount"],
          sourceUnderstandingIds: [],
          sourceVerbatims: [],
          sourceOpIndex: 0,
          baseTopic: null
        }
      ]
    }));

    expect(
      effects.liveMemoryUpdate.topics[0]?.unansweredRequestedFieldNames
    ).toEqual(["error_message", "amount"]);
    expect(effects.liveMemoryUpdate.topics[0]).not.toHaveProperty(
      "qualificationSummary"
    );
  });
});
