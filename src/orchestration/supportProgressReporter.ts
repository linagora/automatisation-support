import type {
  SupportProcessingProgressEvent,
  SupportProcessingStepName
} from "../support-processing-pipeline/v2/typesSupportProcessingPipelineV2.types";

type SupportProgressStage =
  | "buffer_started"
  | "buffer_waiting"
  | "buffer_flushed"
  | "analyzing"
  | "analyzing_surface"
  | "analyzing_support"
  | "updating_topics"
  | "searching"
  | "planning_response"
  | "rendering_response"
  | "building_user_response"
  | "sending_response"
  | "done"
  | "failed";

type ProgressContext = {
  roomId: string;
  userId: string;
  turnId?: string;
  messageCount?: number;
};

type SupportProgressReporter = {
  startBuffer: (context: ProgressContext) => Promise<void>;
  startTurn: (context: ProgressContext) => Promise<void>;
  stage: (
    context: ProgressContext,
    stage: SupportProgressStage
  ) => Promise<void>;
  finishTurn: (context: ProgressContext) => Promise<void>;
  failTurn: (context: ProgressContext, error: unknown) => Promise<void>;
};

const noopSupportProgressReporter: SupportProgressReporter = {
  startBuffer: async () => undefined,
  startTurn: async () => undefined,
  stage: async () => undefined,
  finishTurn: async () => undefined,
  failTurn: async () => undefined
};

const STEP_TO_PROGRESS_STAGE: Partial<
  Record<SupportProcessingStepName, SupportProgressStage>
> = {
  planTurnAnalysis: "analyzing",
  analyzeTextSurface: "analyzing_surface",
  buildStandardResponseFragments: "analyzing_surface",
  analyzeSupportText: "analyzing_support",
  proposeTopicUpdates: "updating_topics",
  buildSupportPatches: "updating_topics",
  planKnowledgeEnrichment: "searching",
  retrieveSupportKnowledge: "searching",
  synthesizeRetrievedKnowledge: "searching",
  planSupportResponse: "planning_response",
  renderSupportResponse: "rendering_response",
  buildUserResponse: "building_user_response"
};

function mapSupportProcessingProgressToStage(
  event: SupportProcessingProgressEvent
): SupportProgressStage | null {
  if (event.status !== "started") {
    return null;
  }

  return STEP_TO_PROGRESS_STAGE[event.step] ?? null;
}

export {
  mapSupportProcessingProgressToStage,
  noopSupportProgressReporter
};

export type {
  ProgressContext,
  SupportProgressReporter,
  SupportProgressStage
};
