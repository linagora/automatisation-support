import type {
  MatchingResult
} from "../matching/typesMatching.types";
import type {
  MessagingChannel
} from "../messaging/typesMessaging.types";
import type {
  PersistenceResult
} from "../persistence/typesPersistence.types";
import type {
  SupportProcessingPipelineInput,
  SupportProcessingPipelineOutput
} from "../support-processing-pipeline/typesSupportProcessingPipeline.types";

export type DeliveryMessage = {
  localId: string;
  channel: MessagingChannel;
  roomId: string;
  threadId?: string | null;
  userId: string;
  content: string;
  metadata?: Record<string, unknown>;
};

export type SupportAutomationTurnResult = {
  matchingResult: MatchingResult;
  supportProcessingInput: SupportProcessingPipelineInput;
  supportProcessingOutput: SupportProcessingPipelineOutput;
  deliveryMessages: DeliveryMessage[];
  persistenceResult: PersistenceResult;
};
