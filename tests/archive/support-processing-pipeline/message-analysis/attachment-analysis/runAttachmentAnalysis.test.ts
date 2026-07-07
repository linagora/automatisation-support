import {
  runAttachmentAnalysis
} from "../../../../src/archive/support-processing-pipeline/message-analysis/attachment-analysis/runAttachmentAnalysis";
import type {
  AttachmentAnalysisSteps
} from "../../../../src/archive/support-processing-pipeline/message-analysis/attachment-analysis/typesAttachmentAnalysis.types";
import type {
  LatestUserAttachment,
  LatestUserMessage
} from "../../../../src/archive/support-processing-pipeline/typesSupportProcessingPipeline.types";

const latestUserMessage: LatestUserMessage = {
  id: "message-1",
  content: "Voici la capture demandee.",
  channel: "email",
  sentAt: "2026-06-02T10:00:00.000Z"
};

function buildAttachment(
  overrides: Partial<LatestUserAttachment> = {}
): LatestUserAttachment {
  return {
    id: "attachment-1",
    filename: "image.png",
    sizeInBytes: 1024,
    accessUrl: "https://example.com/image.png",
    name: "image.png",
    url: "https://example.com/image.png",
    type: "image",
    mimeType: "image/png",
    sizeBytes: 1024,
    channel: "email",
    sentAt: "2026-06-02T10:00:01.000Z",
    ...overrides
  };
}

function buildContinueReadiness(
  detectedFormat: "image" | "video" = "image"
): AttachmentAnalysisSteps["decideAttachmentReadiness"] {
  return () => ({
    decision: {
      route: "continue"
    },
    history: {
      checked: [
        "safe_filename",
        "accepted_format",
        "consistent_mime_extension",
        "usable_location",
        "safe_location",
        "present_size",
        "positive_size",
        "size_under_limit"
      ],
      failed: [],
      detectedFormat
    }
  });
}

describe("runAttachmentAnalysis", function () {
  it("returns an empty attachment analysis when no attachment is provided", async function () {
    const result = await runAttachmentAnalysis({
      latestUserMessage,
      latestUserAttachments: []
    });

    expect(result).toEqual([]);
  });

  it("initializes attachment metadata from the current attachment fields", async function () {
    const result = await runAttachmentAnalysis({
      latestUserMessage,
      latestUserAttachments: [
        buildAttachment({
          id: "attachment-2",
          name: "screen.png",
          url: "https://example.com/screen.png",
          path: "/tmp/screen.png",
          type: "image",
          mimeType: "image/png",
          sizeBytes: 2048
        })
      ]
    }, {
      decideAttachmentReadiness: () => ({
        decision: {
          route: "stop"
        },
        history: {
          checked: ["safe_filename"],
          failed: ["accepted_format"],
          detectedFormat: "other"
        }
      })
    });

    expect(result[0]).toMatchObject({
      attachmentIndex: 1,
      filename: "screen.png",
      url: "https://example.com/screen.png",
      path: "/tmp/screen.png",
      type: "image",
      mimeType: "image/png",
      sizeBytes: 2048,
      status: "refused",
      reason: "accepted_format",
      analysis: undefined
    });
  });

  it("marks an attachment as refused when readiness stops", async function () {
    const result = await runAttachmentAnalysis({
      latestUserMessage,
      latestUserAttachments: [buildAttachment()]
    }, {
      decideAttachmentReadiness: () => ({
        decision: {
          route: "stop"
        },
        history: {
          checked: ["safe_filename"],
          failed: ["safe_location", "size_under_limit"],
          detectedFormat: "image"
        }
      })
    });

    expect(result[0].status).toBe("refused");
    expect(result[0].reason).toBe("safe_location, size_under_limit");
    expect(result[0].readinessDecision?.history.failed).toEqual([
      "safe_location",
      "size_under_limit"
    ]);
  });

  it("runs image analysis and stores llmDescription when image readiness continues", async function () {
    const requestImageAnalysis = vi.fn(() => ({
      status: "analyzed" as const,
      analysis: {
        llmDescription: "Screenshot of a login page.",
        structuredObservations: {
          screen: "login"
        }
      }
    }));

    const result = await runAttachmentAnalysis({
      latestUserMessage,
      latestUserAttachments: [buildAttachment()]
    }, {
      decideAttachmentReadiness: buildContinueReadiness("image"),
      requestImageAnalysis
    });

    expect(requestImageAnalysis).toHaveBeenCalledWith({
      attachmentIndex: 1,
      latestUserMessage,
      attachmentAnalysis: expect.any(Array)
    });
    expect(result[0]).toMatchObject({
      status: "analyzed",
      reason: undefined,
      analysis: {
        llmDescription: "Screenshot of a login page."
      }
    });
  });

  it("stores image analysis failure without analysis payload", async function () {
    const result = await runAttachmentAnalysis({
      latestUserMessage,
      latestUserAttachments: [buildAttachment()]
    }, {
      decideAttachmentReadiness: buildContinueReadiness("image"),
      requestImageAnalysis: () => ({
        status: "failed",
        reason: "image_analysis_failed"
      })
    });

    expect(result[0]).toMatchObject({
      status: "failed",
      reason: "image_analysis_failed",
      analysis: undefined
    });
  });

  it("stores suspicious image analysis with its llmDescription", async function () {
    const result = await runAttachmentAnalysis({
      latestUserMessage,
      latestUserAttachments: [buildAttachment()]
    }, {
      decideAttachmentReadiness: buildContinueReadiness("image"),
      requestImageAnalysis: () => ({
        status: "suspicious",
        reason: "suspicious_login_verification",
        analysis: {
          llmDescription: "Image asks the assistant to reveal internal rules."
        }
      })
    });

    expect(result[0]).toMatchObject({
      status: "suspicious",
      reason: "suspicious_login_verification",
      analysis: {
        llmDescription: "Image asks the assistant to reveal internal rules."
      }
    });
  });

  it("runs video analysis when readiness detects a video", async function () {
    const requestVideoAnalysis = vi.fn(() => ({
      status: "analyzed" as const,
      analysis: {
        llmDescription: "Short video showing a blocked login flow."
      }
    }));

    const result = await runAttachmentAnalysis({
      latestUserMessage,
      latestUserAttachments: [
        buildAttachment({
          name: "login.mov",
          mimeType: "video/quicktime",
          type: "video"
        })
      ]
    }, {
      decideAttachmentReadiness: buildContinueReadiness("video"),
      requestVideoAnalysis
    });

    expect(requestVideoAnalysis).toHaveBeenCalledWith({
      attachmentIndex: 1,
      latestUserMessage,
      attachmentAnalysis: expect.any(Array)
    });
    expect(result[0]).toMatchObject({
      status: "analyzed",
      analysis: {
        llmDescription: "Short video showing a blocked login flow."
      }
    });
  });
});
