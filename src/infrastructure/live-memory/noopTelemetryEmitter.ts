import type {
  MockedOpenTelemetryPayload
} from "../../support-automation/support-processing-pipeline-v2-LEGACY/typesSupportProcessingPipelineV2.types";

type TelemetryEmitter = {
  emit: (payload: MockedOpenTelemetryPayload) => Promise<void>;
};

const noopTelemetryEmitter: TelemetryEmitter = {
  async emit(payload) {
    void payload;
  }
};

export {
  noopTelemetryEmitter
};

export type {
  TelemetryEmitter
};
