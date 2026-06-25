import { matchBufferedMessages } from "../matching/matchBufferedMessages";
import { applySupportPatches } from "../persistence/applySupportPatches";
import { JsonMessageRepository } from "../repositories/json/jsonMessageRepository";
import { JsonTicketRepository } from "../repositories/json/jsonTicketRepository";
import { JsonUserRepository } from "../repositories/json/jsonUserRepository";
import { runSupportProcessingPipelineV2 } from "../support-processing-pipeline/v2/runSupportProcessingPipelineV2";
import { buildSupportProcessingInputV2 } from "./buildSupportProcessingInputV2";
import { mapUserResponseToDelivery } from "./mapUserResponseToDelivery";
import {
  mapSupportProcessingProgressToStage,
  noopSupportProgressReporter
} from "./supportProgressReporter";

import type {
  BufferedMessages
} from "../messaging/typesMessaging.types";
import type {
  SupportProcessingPipelineV2Output,
  SupportProcessingPipelineV2Input,
  SupportProcessingPipelineV2Steps
} from "../support-processing-pipeline/v2/typesSupportProcessingPipelineV2.types";
import type {
  DeliveryMessage
} from "./typesOrchestration.types";
import type {
  ProgressContext,
  SupportProgressReporter
} from "./supportProgressReporter";
import type {
  MatchingResult
} from "../matching/typesMatching.types";
import type {
  PersistenceResult
} from "../persistence/typesPersistence.types";

export type SupportAutomationTurnV2Result = {
  matchingResult: MatchingResult;
  supportProcessingInput: SupportProcessingPipelineV2Input;
  supportProcessingOutput: SupportProcessingPipelineV2Output;
  deliveryMessages: DeliveryMessage[];
  persistenceResult: PersistenceResult;
};

async function runSupportAutomationTurnV2(params: {
  bufferedMessages: BufferedMessages;
  ticketRepository: JsonTicketRepository;
  userRepository: JsonUserRepository;
  messageRepository: JsonMessageRepository;
  persist?: boolean;
  steps?: SupportProcessingPipelineV2Steps;
  progressReporter?: SupportProgressReporter;
  progressContext?: ProgressContext;
}): Promise<SupportAutomationTurnV2Result> {
  const progressReporter =
    params.progressReporter ?? noopSupportProgressReporter;
  const progressContext: ProgressContext = params.progressContext ?? {
    roomId: params.bufferedMessages.roomId,
    userId: params.bufferedMessages.userId,
    turnId: params.bufferedMessages.messages[0]?.messageId,
    messageCount: params.bufferedMessages.messages.length
  };
  const matchingResult = await matchBufferedMessages({
    bufferedMessages: params.bufferedMessages,
    ticketRepository: params.ticketRepository,
    userRepository: params.userRepository
  });
  const supportProcessingInput = buildSupportProcessingInputV2(matchingResult);
  const supportProcessingOutput = await runSupportProcessingPipelineV2(
    supportProcessingInput,
    params.steps,
    {
      reportProgress: async (event) => {
        const stage = mapSupportProcessingProgressToStage(event);

        if (stage === null) {
          return;
        }

        await progressReporter.stage(progressContext, stage);
      }
    }
  );
  await progressReporter.stage(progressContext, "sending_response");
  const deliveryMessages = mapUserResponseToDelivery({
    userResponse: supportProcessingOutput.userResponse,
    matchingResult
  });
  const persistenceResult = params.persist === false
    ? {
        storedIncomingMessageIds: [],
        storedOutgoingMessageIds: [],
        patchStatus: "skipped" as const,
        warnings: ["persistence disabled for dry-run"]
      }
    : await applySupportPatches({
        matchingResult,
        supportProcessingOutput,
        deliveryMessages,
        ticketRepository: params.ticketRepository,
        userRepository: params.userRepository,
        messageRepository: params.messageRepository
      });

  return {
    matchingResult,
    supportProcessingInput,
    supportProcessingOutput,
    deliveryMessages,
    persistenceResult
  };
}

export {
  runSupportAutomationTurnV2
};
