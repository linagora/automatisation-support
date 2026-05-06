import {
  runAttachmentDescriptionLLM,
  hasAttachments,
  isVisualAttachment,
  hasUsableLocation,
  isAttachmentSizeAcceptable,
  isAnalyzableAttachment,
  splitAttachmentsByAnalyzability
} from "../../../../src/support-processing-pipeline/message-analysis/attachement-description-llm/runAttachmentDescriptionLLM";

describe("hasAttachments", function () {
  it("returns false when attachments is undefined", function () {
    const result = hasAttachments(undefined);
    expect(result).toBe(false);
  });

  it("returns false when attachments is empty array", function () {
    const result = hasAttachments([]);
    expect(result).toBe(false);
  });

  it("returns true when attachments has items", function () {
    const result = hasAttachments([{}]);
    expect(result).toBe(true);
  });
});

describe("isVisualAttachment", function () {
  it("returns true for image mime type", function () {
    const result = isVisualAttachment({ mimeType: "image/png" });
    expect(result).toBe(true);
  });

  it("returns true for video mime type", function () {
    const result = isVisualAttachment({ mimeType: "video/mp4" });
    expect(result).toBe(true);
  });

  it("returns true for image file extension", function () {
    const result = isVisualAttachment({ name: "photo.jpg" });
    expect(result).toBe(true);
  });

  it("returns true for video file extension", function () {
    const result = isVisualAttachment({ name: "movie.mp4" });
    expect(result).toBe(true);
  });

  it("returns true for various image extensions", function () {
    expect(isVisualAttachment({ name: "file.png" })).toBe(true);
    expect(isVisualAttachment({ name: "file.jpeg" })).toBe(true);
    expect(isVisualAttachment({ name: "file.webp" })).toBe(true);
    expect(isVisualAttachment({ name: "file.gif" })).toBe(true);
  });

  it("returns true for various video extensions", function () {
    expect(isVisualAttachment({ name: "file.mov" })).toBe(true);
    expect(isVisualAttachment({ name: "file.avi" })).toBe(true);
  });

  it("returns false for non-visual attachments", function () {
    const result = isVisualAttachment({ mimeType: "application/pdf", name: "doc.pdf" });
    expect(result).toBe(false);
  });

  it("returns false for text files", function () {
    const result = isVisualAttachment({ name: "readme.txt" });
    expect(result).toBe(false);
  });

  it("is case insensitive for file extensions", function () {
    expect(isVisualAttachment({ name: "photo.JPG" })).toBe(true);
    expect(isVisualAttachment({ name: "photo.PNG" })).toBe(true);
  });
});

describe("hasUsableLocation", function () {
  it("returns true when url is present", function () {
    const result = hasUsableLocation({ url: "https://example.com/image.png" });
    expect(result).toBe(true);
  });

  it("returns true when path is present", function () {
    const result = hasUsableLocation({ path: "/tmp/image.png" });
    expect(result).toBe(true);
  });

  it("returns true when both url and path are present", function () {
    const result = hasUsableLocation({
      url: "https://example.com/image.png",
      path: "/tmp/image.png"
    });
    expect(result).toBe(true);
  });

  it("returns false when neither url nor path is present", function () {
    const result = hasUsableLocation({ name: "image.png" });
    expect(result).toBe(false);
  });
});

describe("isAttachmentSizeAcceptable", function () {
  it("returns true when sizeBytes is not defined", function () {
    const result = isAttachmentSizeAcceptable({ name: "image.png" });
    expect(result).toBe(true);
  });

  it("returns true for small files", function () {
    const result = isAttachmentSizeAcceptable({ sizeBytes: 1024 });
    expect(result).toBe(true);
  });

  it("returns true for files at exactly 25MB limit", function () {
    const maxSizeBytes = 25 * 1024 * 1024;
    const result = isAttachmentSizeAcceptable({ sizeBytes: maxSizeBytes });
    expect(result).toBe(true);
  });

  it("returns false for files exceeding 25MB limit", function () {
    const maxSizeBytes = 25 * 1024 * 1024;
    const result = isAttachmentSizeAcceptable({ sizeBytes: maxSizeBytes + 1 });
    expect(result).toBe(false);
  });
});

describe("isAnalyzableAttachment", function () {
  it("returns true for visual attachment with url and acceptable size", function () {
    const result = isAnalyzableAttachment({
      name: "image.png",
      mimeType: "image/png",
      url: "https://example.com/image.png",
      sizeBytes: 1024
    });
    expect(result).toBe(true);
  });

  it("returns false for non-visual attachment", function () {
    const result = isAnalyzableAttachment({
      name: "doc.pdf",
      mimeType: "application/pdf",
      url: "https://example.com/doc.pdf"
    });
    expect(result).toBe(false);
  });

  it("returns false for visual attachment without usable location", function () {
    const result = isAnalyzableAttachment({
      name: "image.png",
      mimeType: "image/png"
    });
    expect(result).toBe(false);
  });

  it("returns false for visual attachment exceeding size limit", function () {
    const maxSizeBytes = 25 * 1024 * 1024;
    const result = isAnalyzableAttachment({
      name: "large.jpg",
      mimeType: "image/jpeg",
      url: "https://example.com/large.jpg",
      sizeBytes: maxSizeBytes + 1
    });
    expect(result).toBe(false);
  });
});

describe("splitAttachmentsByAnalyzability", function () {
  it("correctly splits analyzable and non-analyzable attachments", function () {
    const analyzableAttachment = {
      name: "image.png",
      mimeType: "image/png",
      url: "https://example.com/image.png"
    };
    const nonAnalyzableAttachment = {
      name: "doc.pdf",
      mimeType: "application/pdf",
      url: "https://example.com/doc.pdf"
    };

    const result = splitAttachmentsByAnalyzability([analyzableAttachment, nonAnalyzableAttachment]);

    expect(result.analyzableAttachments).toHaveLength(1);
    expect(result.analyzableAttachments[0]).toBe(analyzableAttachment);
    expect(result.ignoredAttachments).toHaveLength(1);
    expect(result.ignoredAttachments[0]).toBe(nonAnalyzableAttachment);
  });

  it("handles empty array", function () {
    const result = splitAttachmentsByAnalyzability([]);
    expect(result.analyzableAttachments).toHaveLength(0);
    expect(result.ignoredAttachments).toHaveLength(0);
  });

  it("puts all in analyzable when all are analyzable", function () {
    const attachments = [
      { name: "img1.png", mimeType: "image/png", url: "url1" },
      { name: "img2.jpg", mimeType: "image/jpeg", url: "url2" }
    ];

    const result = splitAttachmentsByAnalyzability(attachments);
    expect(result.analyzableAttachments).toHaveLength(2);
    expect(result.ignoredAttachments).toHaveLength(0);
  });

  it("puts all in ignored when none are analyzable", function () {
    const attachments = [
      { name: "doc.pdf", mimeType: "application/pdf", url: "url1" },
      { name: "spreadsheet.xlsx", mimeType: "application/excel", url: "url2" }
    ];

    const result = splitAttachmentsByAnalyzability(attachments);
    expect(result.analyzableAttachments).toHaveLength(0);
    expect(result.ignoredAttachments).toHaveLength(2);
  });
});

describe("runAttachmentDescriptionLLM", function () {
  it("returns not_present status when no attachments provided", function () {
    const result = runAttachmentDescriptionLLM({});

    expect(result).toEqual({
      status: "not_present",
      reason: "no_attachment_provided",
      analyzableAttachments: [],
      ignoredAttachments: [],
      analysis: null
    });
  });

  it("returns not_present status when attachments is empty array", function () {
    const result = runAttachmentDescriptionLLM({ attachments: [] });

    expect(result.status).toBe("not_present");
    expect(result.reason).toBe("no_attachment_provided");
    expect(result.analyzableAttachments).toEqual([]);
    expect(result.ignoredAttachments).toEqual([]);
    expect(result.analysis).toBeNull();
  });

  it("returns not_analyzable status when no visual attachments", function () {
    const result = runAttachmentDescriptionLLM({
      attachments: [{ name: "doc.pdf", mimeType: "application/pdf", url: "https://example.com/doc.pdf" }]
    });

    expect(result.status).toBe("not_analyzable");
    expect(result.reason).toBe("no_analyzable_visual_attachment");
    expect(result.analyzableAttachments).toEqual([]);
    expect(result.ignoredAttachments).toHaveLength(1);
  });

  it("returns not_analyzable when visual attachments lack usable location", function () {
    const result = runAttachmentDescriptionLLM({
      attachments: [{ name: "image.png", mimeType: "image/png" }]
    });

    expect(result.status).toBe("not_analyzable");
    expect(result.reason).toBe("no_analyzable_visual_attachment");
  });

  it("returns analysis_not_available when there are analyzable attachments", function () {
    const result = runAttachmentDescriptionLLM({
      attachments: [{ name: "image.png", mimeType: "image/png", url: "https://example.com/image.png" }]
    });

    expect(result.status).toBe("analysis_not_available");
    expect(result.analyzableAttachments).toHaveLength(1);
    expect(result.ignoredAttachments).toHaveLength(0);
    expect(result.analysis).toBeNull();
  });

  it("correctly splits attachments into analyzable and ignored", function () {
    const result = runAttachmentDescriptionLLM({
      attachments: [
        { name: "image.png", mimeType: "image/png", url: "https://example.com/image.png" },
        { name: "doc.pdf", mimeType: "application/pdf", url: "https://example.com/doc.pdf" },
        { name: "video.mp4", mimeType: "video/mp4", path: "/tmp/video.mp4" }
      ]
    });

    expect(result.analyzableAttachments).toHaveLength(2);
    expect(result.ignoredAttachments).toHaveLength(1);
    expect(result.ignoredAttachments[0].name).toBe("doc.pdf");
  });

  it("includes latestUserMessage in the analysis request", function () {
    const result = runAttachmentDescriptionLLM({
      attachments: [{ name: "image.png", mimeType: "image/png", url: "https://example.com/image.png" }],
      latestUserMessage: "What do you see in this image?"
    });

    expect(result.status).toBe("analysis_not_available");
  });

  it("filters out oversized attachments", function () {
    const maxSizeBytes = 25 * 1024 * 1024;
    const result = runAttachmentDescriptionLLM({
      attachments: [
        { name: "small.png", mimeType: "image/png", url: "https://example.com/small.png", sizeBytes: 1024 },
        { name: "large.jpg", mimeType: "image/jpeg", url: "https://example.com/large.jpg", sizeBytes: maxSizeBytes + 1 }
      ]
    });

    expect(result.analyzableAttachments).toHaveLength(1);
    expect(result.analyzableAttachments[0].name).toBe("small.png");
    expect(result.ignoredAttachments).toHaveLength(1);
    expect(result.ignoredAttachments[0].name).toBe("large.jpg");
  });

  it("handles mixed case file extensions", function () {
    const result = runAttachmentDescriptionLLM({
      attachments: [
        { name: "image.PNG", url: "https://example.com/image.PNG" },
        { name: "photo.JPG", url: "https://example.com/photo.JPG" }
      ]
    });

    expect(result.status).toBe("analysis_not_available");
    expect(result.analyzableAttachments).toHaveLength(2);
  });

  it("handles attachments with only mime type", function () {
    const result = runAttachmentDescriptionLLM({
      attachments: [{ mimeType: "image/webp", url: "https://example.com/image" }]
    });

    expect(result.status).toBe("analysis_not_available");
  });

  it("handles attachments with only file extension", function () {
    const result = runAttachmentDescriptionLLM({
      attachments: [{ name: "animation.gif", path: "/uploads/animation.gif" }]
    });

    expect(result.status).toBe("analysis_not_available");
  });

  it("handles video files correctly", function () {
    const result = runAttachmentDescriptionLLM({
      attachments: [{ name: "movie.mov", mimeType: "video/quicktime", url: "https://example.com/movie.mov" }]
    });

    expect(result.status).toBe("analysis_not_available");
    expect(result.analyzableAttachments).toHaveLength(1);
  });
});
