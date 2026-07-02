import type {
  MatchingResult
} from "../matching/typesMatching.types";
import type {
  PersistenceResult
} from "../persistence/typesPersistence.types";
import type {
  SupportProcessingPipelineInput,
  SupportProcessingPipelineOutput
} from "../support-processing-pipeline/typesSupportProcessingPipeline.types";
import type {
  DeliveryMessage
} from "../../support-automation/delivery/typesDelivery.types";

export type {
  DeliveryMessage
};

export type SupportAutomationTurnResult = {
  matchingResult: MatchingResult;
  supportProcessingInput: SupportProcessingPipelineInput;
  supportProcessingOutput: SupportProcessingPipelineOutput;
  deliveryMessages: DeliveryMessage[];
  persistenceResult: PersistenceResult;
};
