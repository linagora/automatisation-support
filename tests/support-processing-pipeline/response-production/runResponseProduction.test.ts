import {
  runResponseProduction
} from "../../../src/support-processing-pipeline/response-production/runResponseProduction";

import type {
  ResponseProductionInput
} from "../../../src/support-processing-pipeline/response-production/runResponseProduction";
import type {
  TurnAttachments
} from "../../../src/support-processing-pipeline/typesSupportProcessingPipeline.types";

function buildTopicResponseInput(
  attachments?: TurnAttachments,
  title: ResponseProductionInput["responsePlan"]["messagesPlan"]["topicPlanMessages"][number]["topics_responses"][number]["topic_response"]["title"] = {
    topic_id: 1,
    topic_category: "bug",
    tool_or_product: "Twake",
    topic_action: "connect",
    topic_object: "account",
    matched_historical_topic: false
  }
): ResponseProductionInput {
  return {
    responsePlan: {
      responseLanguage: "french",
      messagesPlan: {
        securityGatePlanMessage: undefined,
        suspiciousPlanMessage: undefined,
        lackComprehensionPlanMessage: undefined,
        scopeBoundaryPlanMessages: [],
        topicPlanMessages: [
          {
            politeness_opening: "salutation_and_understanding_1",
            topic_relation_acknowledgement: {
              no_matched_historical_topic_count: 1,
              matched_historical_topic_count: 0
            },
            ...(attachments ? { attachments } : {}),
            topics_responses: [
              {
                topic_response: {
                  title,
                  updated_fields_acknowledgement: {},
                  main_response: {
                    type: "acknowledgement"
                  },
                  next_step: "wait_more_info"
                }
              }
            ],
            politeness_closure: "thanks_for_cooperation1"
          }
        ],
        signalPlanMessages: [],
        handoverPlanMessages: []
      }
    }
  };
}

function buildAttachments(
  statuses: ("analyzed" | "failed" | "refused" | "suspicious")[],
  category: keyof TurnAttachments = "images"
): TurnAttachments {
  const attachments: TurnAttachments = {
    images: [],
    videos: [],
    other: []
  };

  statuses.forEach((status, index) => {
    attachments[category].push({
      id: `attachment_${index + 1}`,
      kind: category === "videos"
        ? "video"
        : category === "images"
          ? "image"
          : "other",
      filename: category === "videos" ? "video.mp4" : "image.png",
      sizeInBytes: 1024,
      mimeType: category === "videos" ? "video/mp4" : "image/png",
      status,
      ...(status === "failed" || status === "refused"
        ? { reason: "analysis_failed" }
        : {}),
      analysis: {
        llmDescription: "Attachment description."
      }
    });
  });

  return attachments;
}

describe("runResponseProduction", function () {
  it("transforms the response plan into final user messages", function () {
    const input = buildTopicResponseInput();

    const output = runResponseProduction(input);

    expect(output.messages[0].type).toBe("topic_response");
    expect(output.messages[0].content).toContain(
      "J’ai identifié un nouveau sujet."
    );
    expect(output.messages[0].content).not.toContain(
      "J’ai aussi bien reçu"
    );
  });

  it("adds a global acknowledgement for one analyzed image", function () {
    const output = runResponseProduction(
      buildTopicResponseInput(buildAttachments(["analyzed"], "images"))
    );

    expect(output.messages[0].content).toContain(
      "J’ai identifié un nouveau sujet. J’ai aussi bien reçu et analysé une capture d’écran."
    );
  });

  it("adds a global acknowledgement for one image that could not be analyzed", function () {
    const output = runResponseProduction(
      buildTopicResponseInput(buildAttachments(["failed"], "images"))
    );

    expect(output.messages[0].content).toContain(
      "J’ai aussi bien reçu une capture d’écran, mais je n’ai pas pu l’analyser automatiquement."
    );
  });

  it("adds a global acknowledgement for multiple attachments with mixed statuses", function () {
    const output = runResponseProduction(
      buildTopicResponseInput(buildAttachments(["analyzed", "refused"], "images"))
    );

    expect(output.messages[0].content).toContain(
      "J’ai aussi bien reçu les pièces jointes, mais certaines n’ont pas pu être analysées automatiquement."
    );
  });

  it("builds topic title label from structured topic fields", function () {
    const output = runResponseProduction(
      buildTopicResponseInput(undefined, {
        topic_id: 1,
        topic_category: "bug",
        tool_or_product: "Twake Drive",
        topic_action: "create",
        topic_object: "folder",
        matched_historical_topic: true
      })
    );

    expect(output.messages[0].content).toContain(
      "Sujet 1 - Bug - Twake Drive : create : folder - (En cours)"
    );
    expect(output.messages[0].content).not.toContain("Legacy label");
  });

  it("keeps security and handover messages in pipeline order", function () {
    const input: ResponseProductionInput = {
      responsePlan: {
        responseLanguage: "english",
        messagesPlan: {
          securityGatePlanMessage: {
            gateFailed: ["latestUserMessageSecurityDecision"]
          },
          suspiciousPlanMessage: undefined,
          lackComprehensionPlanMessage: undefined,
          scopeBoundaryPlanMessages: [],
          topicPlanMessages: [],
          signalPlanMessages: [],
          handoverPlanMessages: [{}]
        }
      }
    };

    const output = runResponseProduction(input);

    expect(output).toEqual({
      messages: [
        {
          type: "security_gate",
          content:
            "Our security system identified your message as potentially problematic and automatic analysis was stopped. Support will take over to confirm or dismiss this decision."
        },
        {
          type: "handover",
          content: "Support will soon review and respond to your request."
        }
      ]
    });
  });
});
