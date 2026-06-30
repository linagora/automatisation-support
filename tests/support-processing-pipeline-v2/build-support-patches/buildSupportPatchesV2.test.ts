import { describe, expect, it } from "vitest";

import {
  buildSupportPatchesV2
} from "../../../src/support-processing-pipeline-v2/build-support-patches/buildSupportPatchesV2";

import type {
  BuildSupportPatchesInput
} from "../../../src/support-processing-pipeline-v2/typesSupportProcessingPipelineV2.types";

function buildInput(
  overrides: Partial<BuildSupportPatchesInput> = {}
): BuildSupportPatchesInput {
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
      segments_topic: []
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

describe("buildSupportPatchesV2", function () {
  it("builds V2 persistence effects instead of legacy ticket patches", function () {
    const effects = buildSupportPatchesV2(buildInput({
      latestUserMessageContent: "Je ne reçois plus les notifications.",
      mergedTopicSnapshots: [
        {
          snapshotId: "snapshot_1",
          temporaryTopicId: "topic_1",
          topicId: "topic_4",
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
          topic_details: {
            platform: "Android"
          },
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
          topicId: "topic_4",
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
    const effects = buildSupportPatchesV2(buildInput({
      promptSecuritySignals: {
        matchedPatternIds: ["ignore_previous_instructions"]
      }
    }));

    expect(effects.liveMemoryUpdate.userState).toEqual({
      status: "watch",
      flags: ["matched_prompt_pattern:ignore_previous_instructions"]
    });
  });
});
