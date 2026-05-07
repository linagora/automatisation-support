/**
 * Video Analysis Request
 *
 * Handles video attachment analysis by:
 * 1. Extracting frames dynamically based on video duration using ffmpeg-static
 * 2. Building a video-specific prompt with ordered frames
 * 3. Calling the LLM with the videoAnalysis preset
 * 4. Parsing the structured response
 *
 * Frame extraction strategy:
 * - Short  (< 10s)  : 1 frame/sec,  max FRAMES_SHORT
 * - Medium (10-60s) : 1 frame/2sec, max FRAMES_MEDIUM
 * - Long   (> 60s)  : 1 frame/5sec, max FRAMES_LONG
 * - Hard cap: MAX_FRAMES_TOTAL (LLM provider limit)
 */

import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import ffmpegPath from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import type { Attachment, VisualAttachmentAnalyzerOutput } from "./runAttachmentAnalysis";
import { buildVideoPrompt } from "./buildVisualPrompt";
import { callLLM } from "../../../llm/llm-client";
import { parseLLMResponse } from "../../../llm/parseLLMResponse";

const execFileAsync = promisify(execFile);

// ─── Paramètres ajustables selon les limites de ton provider LLM ─────────────

const MAX_FRAMES_TOTAL = 20;    // plafond absolu (limite provider LLM)
const FRAMES_SHORT     = 10;    // vidéo < 10s  : jusqu'à N frames
const FRAMES_MEDIUM    = 20;    // vidéo 10-60s : jusqu'à N frames
const FRAMES_LONG      = 20;    // vidéo > 60s  : jusqu'à N frames
const FRAME_FORMAT     = "jpg"; // format des frames extraites

// ─── Types ───────────────────────────────────────────────────────────────────

interface RequestVideoAnalysisInput {
  attachments: Attachment[];
  latestUserMessage?: string;
}

interface RequestVideoAnalysisOutput {
  status: "analyzed" | "analysis_not_available";
  analysis: VisualAttachmentAnalyzerOutput | null;
  reason: string | null;
}

interface FrameExtractionConfig {
  intervalSeconds: number;
  maxFrames: number;
}

interface FrameExtractionResult {
  frameAttachments: Attachment[];
  durationSeconds: number;
  frameCount: number;
  intervalSeconds: number;
}

// ─── Logique d'extraction ────────────────────────────────────────────────────

/**
 * Vérifie que ffmpeg-static est disponible
 */
function getFFmpegPath(): string {
  if (!ffmpegPath) {
    throw new Error("ffmpeg_binary_not_found");
  }
  return ffmpegPath;
}

/**
 * Détermine l'intervalle et le nombre max de frames selon la durée de la vidéo
 */
function resolveFrameConfig(durationSeconds: number): FrameExtractionConfig {
  if (durationSeconds < 10) {
    return {
      intervalSeconds: 1,
      maxFrames: Math.min(FRAMES_SHORT, MAX_FRAMES_TOTAL)
    };
  }

  if (durationSeconds <= 60) {
    return {
      intervalSeconds: 2,
      maxFrames: Math.min(FRAMES_MEDIUM, MAX_FRAMES_TOTAL)
    };
  }

  return {
    intervalSeconds: 5,
    maxFrames: Math.min(FRAMES_LONG, MAX_FRAMES_TOTAL)
  };
}

/**
 * Lit la durée d'une vidéo en secondes via ffprobe-static
 */
async function readVideoDuration(videoPath: string): Promise<number> {
  const ffprobePath = ffprobe.path;

  const { stdout } = await execFileAsync(ffprobePath, [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    videoPath
  ]);

  const durationSeconds = Number(stdout.trim());

  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error("could_not_read_video_duration");
  }

  return durationSeconds;
}

/**
 * Extrait les frames d'une vidéo avec ffmpeg-static
 * Retourne les frames sous forme d'attachments avec data URLs
 */
async function extractFramesFromVideo(
  videoPath: string,
  tempDir: string
): Promise<FrameExtractionResult> {
  const ffmpegBinary = getFFmpegPath();

  const durationSeconds = await readVideoDuration(videoPath);

  const { intervalSeconds, maxFrames } = resolveFrameConfig(durationSeconds);

  // Extraction via fps filter : 1 frame toutes les N secondes
  await execFileAsync(ffmpegBinary, [
    "-i", videoPath,
    "-vf", `fps=1/${intervalSeconds},scale=1280:-1`,
    "-frames:v", String(maxFrames),
    "-q:v", "3",
    path.join(tempDir, `frame-%03d.${FRAME_FORMAT}`)
  ]);

  // Lecture des frames extraites depuis le dossier temporaire
  const frameAttachments: Attachment[] = [];
  const files = await fs.readdir(tempDir);
  const frameFiles = files
    .filter(f => f.startsWith("frame-") && f.endsWith(`.${FRAME_FORMAT}`))
    .sort();

  for (const frameFile of frameFiles) {
    const framePath = path.join(tempDir, frameFile);
    const frameBuffer = await fs.readFile(framePath);

    frameAttachments.push({
      name: frameFile,
      mimeType: "image/jpeg",
      path: framePath,
      url: `data:image/jpeg;base64,${frameBuffer.toString("base64")}`,
      sizeBytes: frameBuffer.length
    });
  }

  return {
    frameAttachments,
    durationSeconds,
    frameCount: frameAttachments.length,
    intervalSeconds
  };
}

// ─── Fonction principale ──────────────────────────────────────────────────────

async function requestVideoAnalysis(
  input: RequestVideoAnalysisInput
): Promise<RequestVideoAnalysisOutput> {
  const { attachments, latestUserMessage } = input;

  const videoAttachment = attachments[0];

  if (!videoAttachment?.path) {
    return {
      status: "analysis_not_available",
      analysis: null,
      reason: "no_video_path_available"
    };
  }

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "video-frames-"));

  try {
    const {
      frameAttachments,
      durationSeconds,
      frameCount,
      intervalSeconds
    } = await extractFramesFromVideo(videoAttachment.path, tempDir);

    if (frameAttachments.length === 0) {
      return {
        status: "analysis_not_available",
        analysis: null,
        reason: "no_frames_extracted"
      };
    }

    const videoName = path.basename(
      videoAttachment.name || "video",
      path.extname(videoAttachment.name || "")
    );

    const messages = buildVideoPrompt(
      frameAttachments,
      videoAttachment.name || "video",
      latestUserMessage,
      { durationSeconds, frameCount, intervalSeconds }
    );

    const result = await callLLM(messages, { preset: "videoAnalysis" });

    if (!result.success || !result.content) {
      return {
        status: "analysis_not_available",
        analysis: null,
        reason: result.error || "llm_call_failed"
      };
    }

    const parsedResponse = parseLLMResponse(result.content);

    if (!parsedResponse) {
      return {
        status: "analysis_not_available",
        analysis: null,
        reason: "failed_to_parse_llm_response"
      };
    }

    return {
      status: "analyzed",
      analysis: { extractedInformations: parsedResponse },
      reason: null
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "unknown_error";
    return {
      status: "analysis_not_available",
      analysis: null,
      reason: `video_analysis_error: ${errorMessage}`
    };
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

export { requestVideoAnalysis };

export type {
  RequestVideoAnalysisInput,
  RequestVideoAnalysisOutput
};
