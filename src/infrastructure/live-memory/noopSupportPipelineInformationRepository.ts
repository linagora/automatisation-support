import type {
  OtherSupportPipelineInformation
} from "../../support-automation/support-processing-pipeline-v2/typesSupportProcessingPipelineV2.types";

type SupportPipelineInformationRepository = {
  persist: (value: OtherSupportPipelineInformation) => Promise<void>;
};

const noopSupportPipelineInformationRepository:
  SupportPipelineInformationRepository = {
    async persist(value) {
      void value;
    }
  };

export {
  noopSupportPipelineInformationRepository
};

export type {
  SupportPipelineInformationRepository
};
