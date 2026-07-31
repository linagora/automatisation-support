/**
 * Video Analysis Request
 *
 * This file handles the API call to a vision model for analyzing
 * one video attachment.
 *
 * Strategy:
 * - Split the video into segments of max 40 seconds
 * - Extract 20 frames from each segment
 * - Analyze each segment with the previous segment analyses as context
 * - Merge segment analyses into one VideoAnalysisResult
 *
 * It only produces a vision-level analysis.
 * It does not perform support-topic interpretation.
 */

import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

import ffmpegPath from "ffmpeg-static";
import ffprobe from "ffprobe-static";

import {
  buildVideoPrompt
} from "./buildVisionPrompt";

import {
  callLLM
} from "../../../../infrastructure/llm/llm-client";

import {
  parseLLMResponse
} from "../../../../infrastructure/llm/parseLLMResponse";

import type {
  AttachmentAnalysisItem,
  VideoAnalysisInput,
  VideoAnalysisResult
} from "./typesAttachmentAnalysis.types";

const execFileAsync = promisify(execFile);

const FRAMES_PER_SEGMENT = 20;
const MAX_SECONDS_PER_SEGMENT = 40;
const FRAME_FORMAT = "jpg";

type FrameAttachment = {
  filename: string;
  mimeType: string;
  path: string;
  url: string;
  sizeBytes: number;
};

type VideoSegment = {
  segmentIndex: number;
  segmentCount: number;
  startSeconds: number;
  endSeconds: number;
};

type SegmentAnalysis = {
  segmentIndex: number;
  startSeconds: number;
  endSeconds: number;
  status: "analyzed" | "suspicious";
  reason: string | undefined;
  llmDescription: string;
  structuredObservations: unknown;
  relationToPreviousAttachment: string | undefined;
};

type ParsedVideoAnalysisResponse = {
  status?: unknown;
  reason?: unknown;
  llmDescription?: unknown;
  structuredObservations?: unknown;
  relationToPreviousAttachment?: unknown;
};

// Finds the attachmentAnalysis item targeted by attachmentIndex.
function getAttachmentAnalysisItem(
  input: VideoAnalysisInput
): AttachmentAnalysisItem | undefined {
  for (const attachmentAnalysisItem of input.attachmentAnalysis) {
    if (attachmentAnalysisItem.attachmentIndex === input.attachmentIndex) {
      return attachmentAnalysisItem;
    }
  }

  return undefined;
}

// Reads video duration in seconds using ffprobe.
async function readVideoDuration(
  videoLocation: string
): Promise<number> {
  if (!ffprobe.path) {
    throw new Error("ffprobe_binary_not_found");
  }

  const { stdout } = await execFileAsync(ffprobe.path, [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    videoLocation
  ]);

  const durationSeconds = Number(stdout.trim());

  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error("could_not_read_video_duration");
  }

  return durationSeconds;
}

// Splits the video into equal segments of max 40 seconds.
function buildVideoSegments(
  durationSeconds: number
): VideoSegment[] {
  const segmentCount = Math.ceil(
    durationSeconds / MAX_SECONDS_PER_SEGMENT
  );

  const segmentDuration = durationSeconds / segmentCount;
  const segments: VideoSegment[] = [];

  for (let segmentArrayIndex = 0; segmentArrayIndex < segmentCount; segmentArrayIndex++) {
    const segmentIndex = segmentArrayIndex + 1;

    segments.push({
      segmentIndex,
      segmentCount,
      startSeconds: segmentArrayIndex * segmentDuration,
      endSeconds:
        segmentIndex === segmentCount
          ? durationSeconds
          : segmentIndex * segmentDuration
    });
  }

  return segments;
}

// Extracts 20 ordered frames from one video segment.
async function extractFramesFromSegment(
  videoLocation: string,
  segment: VideoSegment,
  tempDir: string
): Promise<FrameAttachment[]> {
  if (!ffmpegPath) {
    throw new Error("ffmpeg_binary_not_found");
  }

  const segmentDuration = segment.endSeconds - segment.startSeconds;
  const segmentDir = path.join(tempDir, `segment-${segment.segmentIndex}`);

  await fs.mkdir(segmentDir, {
    recursive: true
  });

  await execFileAsync(ffmpegPath, [
    "-ss",
    String(segment.startSeconds),
    "-t",
    String(segmentDuration),
    "-i",
    videoLocation,
    "-vf",
    `fps=${FRAMES_PER_SEGMENT}/${segmentDuration},scale=1280:-1`,
    "-frames:v",
    String(FRAMES_PER_SEGMENT),
    "-q:v",
    "3",
    path.join(segmentDir, `frame-%03d.${FRAME_FORMAT}`)
  ]);

  const files = await fs.readdir(segmentDir);

  const frameFiles = files
    .filter(function (file) {
      return file.startsWith("frame-") && file.endsWith(`.${FRAME_FORMAT}`);
    })
    .sort();

  const frameAttachments: FrameAttachment[] = [];

  for (const frameFile of frameFiles) {
    const framePath = path.join(segmentDir, frameFile);
    const frameBuffer = await fs.readFile(framePath);

    frameAttachments.push({
      filename: frameFile,
      mimeType: "image/jpeg",
      path: framePath,
      url: `data:image/jpeg;base64,${frameBuffer.toString("base64")}`,
      sizeBytes: frameBuffer.length
    });
  }

  return frameAttachments;
}

// Converts the parsed LLM response into the VideoAnalysisResult contract.
function buildVideoAnalysisResultFromParsedResponse(
  parsedResponse: unknown
): VideoAnalysisResult {
  if (
    typeof parsedResponse !== "object" ||
    parsedResponse === null
  ) {
    return {
      status: "failed",
      reason: "invalid_llm_response_format",
      analysis: undefined
    };
  }

  const response = parsedResponse as ParsedVideoAnalysisResponse;

  if (
    response.status !== undefined &&
    response.status !== "analyzed" &&
    response.status !== "suspicious"
  ) {
    return {
      status: "failed",
      reason: "invalid_video_analysis_status",
      analysis: undefined
    };
  }

  if (
    typeof response.llmDescription !== "string" ||
    response.llmDescription.trim().length === 0
  ) {
    return {
      status: "failed",
      reason: "missing_llm_description",
      analysis: undefined
    };
  }

  const analysis = {
    llmDescription: response.llmDescription,
    structuredObservations: response.structuredObservations,
    relationToPreviousAttachment:
      typeof response.relationToPreviousAttachment === "string"
        ? response.relationToPreviousAttachment
        : undefined
  };

  if (response.status === "suspicious") {
    return {
      status: "suspicious",
      reason:
        typeof response.reason === "string" &&
        response.reason.trim().length > 0
          ? response.reason
          : "suspicious_video_analysis",
      analysis
    };
  }

  return {
    status: "analyzed",
    reason: undefined,
    analysis
  };
}

// Converts one segment result into compact context for the next segment.
function buildSegmentAnalysis(
  segment: VideoSegment,
  result: VideoAnalysisResult
): SegmentAnalysis | undefined {
  if (result.status === "failed") {
    return undefined;
  }

  return {
    segmentIndex: segment.segmentIndex,
    startSeconds: segment.startSeconds,
    endSeconds: segment.endSeconds,
    status: result.status,
    reason: result.reason,
    llmDescription: result.analysis.llmDescription,
    structuredObservations: result.analysis.structuredObservations,
    relationToPreviousAttachment:
      result.analysis.relationToPreviousAttachment
  };
}

// Merges all segment analyses into one final VideoAnalysisResult.
function mergeSegmentAnalyses(
  segmentAnalyses: SegmentAnalysis[]
): VideoAnalysisResult {
  if (segmentAnalyses.length === 0) {
    return {
      status: "failed",
      reason: "no_segment_analysis_available",
      analysis: undefined
    };
  }

  const hasSuspiciousSegment = segmentAnalyses.some(function (segmentAnalysis) {
    return segmentAnalysis.status === "suspicious";
  });

  const llmDescription = segmentAnalyses
    .map(function (segmentAnalysis) {
      return `Segment ${segmentAnalysis.segmentIndex} (${segmentAnalysis.startSeconds.toFixed(1)}s-${segmentAnalysis.endSeconds.toFixed(1)}s): ${segmentAnalysis.llmDescription}`;
    })
    .join("\n\n");

  const analysis = {
    llmDescription,
    structuredObservations: {
      segments: segmentAnalyses
    },
    relationToPreviousAttachment:
      segmentAnalyses[segmentAnalyses.length - 1]
        .relationToPreviousAttachment
  };

  if (hasSuspiciousSegment) {
    return {
      status: "suspicious",
      reason:
        segmentAnalyses
          .map(function (segmentAnalysis) {
            return segmentAnalysis.reason;
          })
          .filter(function (reason): reason is string {
            return typeof reason === "string" && reason.length > 0;
          })
          .join(", ") || "suspicious_video_analysis",
      analysis
    };
  }

  return {
    status: "analyzed",
    analysis
  };
}

async function requestVideoAnalysis(
  input: VideoAnalysisInput
): Promise<VideoAnalysisResult> {
  const attachmentAnalysisItem = getAttachmentAnalysisItem(input);

  if (!attachmentAnalysisItem) {
    return {
      status: "failed",
      reason: `attachment_not_found:${input.attachmentIndex}`,
      analysis: undefined
    };
  }

  const videoLocation =
    attachmentAnalysisItem.path ||
    attachmentAnalysisItem.url;

  if (!videoLocation) {
    return {
      status: "failed",
      reason: `missing_video_location:${input.attachmentIndex}`,
      analysis: undefined
    };
  }

  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "video-frames-")
  );

  try {
    const durationSeconds = await readVideoDuration(videoLocation);
    const segments = buildVideoSegments(durationSeconds);
    const segmentAnalyses: SegmentAnalysis[] = [];

    for (const segment of segments) {
      const frameAttachments = await extractFramesFromSegment(
        videoLocation,
        segment,
        tempDir
      );

      if (frameAttachments.length === 0) {
        return {
          status: "failed",
          reason: `no_frames_extracted:segment_${segment.segmentIndex}`,
          analysis: undefined
        };
      }

      const videoPromptInput = {
        attachmentIndex: input.attachmentIndex,
        videoFilename:
          attachmentAnalysisItem.filename ||
          `video-${input.attachmentIndex}`,
        latestUserMessage: input.latestUserMessage,
        attachmentAnalysis: input.attachmentAnalysis,
        frameAttachments,
        videoMetadata: {
          durationSeconds,
          frameCount: frameAttachments.length,
          intervalSeconds:
            (segment.endSeconds - segment.startSeconds) /
            FRAMES_PER_SEGMENT
        },
        videoSegment: segment,
        previousSegmentAnalyses: segmentAnalyses
      };

      const messages = buildVideoPrompt(videoPromptInput);

      const result = await callLLM(messages, {
        preset: "videoAnalysis"
      });

      if (!result.success || !result.content) {
        return {
          status: "failed",
          reason: result.error || `llm_call_failed:segment_${segment.segmentIndex}`,
          analysis: undefined
        };
      }

      const segmentResult = buildVideoAnalysisResultFromParsedResponse(
        parseLLMResponse(result.content)
      );

      if (segmentResult.status === "failed") {
        return segmentResult;
      }

      const segmentAnalysis = buildSegmentAnalysis(
        segment,
        segmentResult
      );

      if (segmentAnalysis) {
        segmentAnalyses.push(segmentAnalysis);
      }
    }

    return mergeSegmentAnalyses(segmentAnalyses);
  } catch (error) {
    return {
      status: "failed",
      reason:
        error instanceof Error
          ? `video_analysis_error:${error.message}`
          : "video_analysis_error:unknown_error",
      analysis: undefined
    };
  } finally {
    await fs.rm(tempDir, {
      recursive: true,
      force: true
    });
  }
}

export {
  requestVideoAnalysis
};
