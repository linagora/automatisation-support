import type {
  SupportProcessingPipelineV2Runtime,
  SupportProcessingProgressEvent,
  SupportProcessingStepName
} from "../typesSupportProcessingPipelineV2.types";

type MaybePromise<T> = T | Promise<T>;

type PipelineStep<TInput, TOutput> = (
  input: TInput
) => MaybePromise<TOutput>;

type SupportProcessingPipelineV2DebugStop = {
  stepName: SupportProcessingStepName;
};

type SupportProcessingPipelineV2InternalDebugState = {
  stopAfterStep?: SupportProcessingStepName;
  partial: Record<string, unknown>;
};

type SupportProcessingPipelineV2InternalRuntime =
  SupportProcessingPipelineV2Runtime & {
    debugState?: SupportProcessingPipelineV2InternalDebugState;
  };

function appendNamedDebugOutput(params: {
  debugState?: SupportProcessingPipelineV2InternalDebugState;
  name: string;
  output: unknown;
}): void {
  if (!params.debugState) {
    return;
  }

  const currentValue = params.debugState.partial[params.name];

  if (currentValue === undefined) {
    params.debugState.partial[params.name] = params.output;
    return;
  }

  if (Array.isArray(currentValue)) {
    currentValue.push(params.output);
    return;
  }

  params.debugState.partial[params.name] = [
    currentValue,
    params.output
  ];
}

const SUPPORT_PROCESSING_PIPELINE_V2_DEBUG_STOP =
  "SupportProcessingPipelineV2DebugStop";

function isSupportProcessingPipelineV2DebugStop(
  error: unknown
): error is SupportProcessingPipelineV2DebugStop {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: unknown }).name ===
      SUPPORT_PROCESSING_PIPELINE_V2_DEBUG_STOP &&
    typeof (error as { stepName?: unknown }).stepName === "string"
  );
}

function appendPartialDebugOutput(params: {
  debugState?: SupportProcessingPipelineV2InternalDebugState;
  stepName: SupportProcessingStepName;
  output: unknown;
}): void {
  if (!params.debugState) {
    return;
  }

  const currentValue = params.debugState.partial[params.stepName];

  if (currentValue === undefined) {
    params.debugState.partial[params.stepName] = params.output;
    return;
  }

  if (Array.isArray(currentValue)) {
    currentValue.push(params.output);
    return;
  }

  params.debugState.partial[params.stepName] = [
    currentValue,
    params.output
  ];
}

function stopAfterStepIfRequested(params: {
  debugState?: SupportProcessingPipelineV2InternalDebugState;
  stepName: SupportProcessingStepName;
}): void {
  if (params.debugState?.stopAfterStep !== params.stepName) {
    return;
  }

  throw Object.assign(new Error(`Stopped after ${params.stepName}`), {
    name: SUPPORT_PROCESSING_PIPELINE_V2_DEBUG_STOP,
    stepName: params.stepName
  });
}

function createMissingStep<TInput, TOutput>(
  stepName: string
): PipelineStep<TInput, TOutput> {
  return function missingStep(): never {
    throw new Error(`${stepName} is not implemented yet`);
  };
}

function resolveStep<TInput, TOutput>(
  providedStep: PipelineStep<TInput, TOutput> | undefined,
  stepName: string
): PipelineStep<TInput, TOutput> {
  return providedStep || createMissingStep<TInput, TOutput>(stepName);
}

async function reportProgress(
  runtime: SupportProcessingPipelineV2Runtime,
  step: SupportProcessingStepName,
  status: "started" | "completed" | "skipped" | "failed",
  details: Omit<Partial<SupportProcessingProgressEvent>, "step" | "status"> = {}
): Promise<void> {
  try {
    await runtime.reportProgress?.({
      step,
      status,
      ...details
    });
  } catch {
    // Progress reporting is observational and must not affect pipeline execution.
  }
}

async function runStep<TInput, TOutput>(
  runtime: SupportProcessingPipelineV2InternalRuntime,
  stepName: SupportProcessingStepName,
  step: PipelineStep<TInput, TOutput>,
  input: TInput,
  buildCompletedProgressDetails?: (
    output: TOutput
  ) => Omit<Partial<SupportProcessingProgressEvent>, "step" | "status">
): Promise<TOutput> {
  await reportProgress(runtime, stepName, "started");

  try {
    const output = await step(input);
    await reportProgress(
      runtime,
      stepName,
      "completed",
      buildCompletedProgressDetails?.(output)
    );
    appendPartialDebugOutput({
      debugState: runtime.debugState,
      stepName,
      output
    });
    stopAfterStepIfRequested({
      debugState: runtime.debugState,
      stepName
    });

    return output;
  } catch (error) {
    if (isSupportProcessingPipelineV2DebugStop(error)) {
      throw error;
    }

    await reportProgress(runtime, stepName, "failed");
    throw error;
  }
}

async function skipStep(
  runtime: SupportProcessingPipelineV2InternalRuntime,
  stepName: SupportProcessingStepName
): Promise<void> {
  await reportProgress(runtime, stepName, "skipped");
  appendPartialDebugOutput({
    debugState: runtime.debugState,
    stepName,
    output: "SKIPPED"
  });
  stopAfterStepIfRequested({
    debugState: runtime.debugState,
    stepName
  });
}

async function skipSteps(
  runtime: SupportProcessingPipelineV2InternalRuntime,
  stepNames: SupportProcessingStepName[]
): Promise<void> {
  for (const stepName of stepNames) {
    await skipStep(runtime, stepName);
  }
}

export {
  appendNamedDebugOutput,
  appendPartialDebugOutput,
  createMissingStep,
  isSupportProcessingPipelineV2DebugStop,
  reportProgress,
  resolveStep,
  runStep,
  skipStep,
  skipSteps,
  stopAfterStepIfRequested
};

export type {
  MaybePromise,
  PipelineStep,
  SupportProcessingPipelineV2DebugStop,
  SupportProcessingPipelineV2InternalDebugState,
  SupportProcessingPipelineV2InternalRuntime
};
