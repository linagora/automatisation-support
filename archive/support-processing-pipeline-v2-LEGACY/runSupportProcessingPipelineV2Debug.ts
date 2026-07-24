import {
  isSupportProcessingPipelineV2DebugStop,
  runSupportProcessingPipelineV2Internal
} from "./runSupportProcessingPipelineV2";

import type {
  SupportProcessingPipelineV2InternalDebugState
} from "./runSupportProcessingPipelineV2";
import type {
  SupportProcessingPipelineV2Input,
  SupportProcessingPipelineV2Output,
  SupportProcessingPipelineV2Runtime,
  SupportProcessingPipelineV2Steps,
  SupportProcessingProgressEvent,
  SupportProcessingStepName
} from "./typesSupportProcessingPipelineV2.types";

type SupportProcessingPipelineV2DebugOptions = {
  stopAfterStep?: SupportProcessingStepName;
  collectProgressEvents?: boolean;
  runtime?: SupportProcessingPipelineV2Runtime;
};

type SupportProcessingPipelineV2DebugOutput = {
  status: "completed" | "stopped";
  stoppedAfterStep?: SupportProcessingStepName;
  output?: SupportProcessingPipelineV2Output;
  progressEvents: SupportProcessingProgressEvent[];
  partial: Record<string, unknown>;
};

async function runSupportProcessingPipelineV2Debug(
  input: SupportProcessingPipelineV2Input,
  steps: SupportProcessingPipelineV2Steps = {},
  options: SupportProcessingPipelineV2DebugOptions = {}
): Promise<SupportProcessingPipelineV2DebugOutput> {
  const progressEvents: SupportProcessingProgressEvent[] = [];
  const debugState: SupportProcessingPipelineV2InternalDebugState = {
    ...(options.stopAfterStep ? { stopAfterStep: options.stopAfterStep } : {}),
    partial: {}
  };
  const shouldCollectProgressEvents =
    options.collectProgressEvents !== false;
  const runtime: SupportProcessingPipelineV2Runtime = {
    ...options.runtime,
    reportProgress: async (event) => {
      if (shouldCollectProgressEvents) {
        progressEvents.push(event);
      }

      await options.runtime?.reportProgress?.(event);
    }
  };

  try {
    const output = await runSupportProcessingPipelineV2Internal(
      input,
      steps,
      runtime,
      debugState
    );

    return {
      status: "completed",
      output,
      progressEvents,
      partial: debugState.partial
    };
  } catch (error) {
    if (!isSupportProcessingPipelineV2DebugStop(error)) {
      throw error;
    }

    return {
      status: "stopped",
      stoppedAfterStep: error.stepName,
      progressEvents,
      partial: debugState.partial
    };
  }
}

export {
  runSupportProcessingPipelineV2Debug
};

export type {
  SupportProcessingPipelineV2DebugOptions,
  SupportProcessingPipelineV2DebugOutput
};
