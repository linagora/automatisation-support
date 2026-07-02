import { runSupportProcessingPipelineV2 } from "./support-processing-pipeline-v2/runSupportProcessingPipelineV2";
import { buildSupportProcessingInputV2 } from "./build-input/buildSupportProcessingInputV2";
import {
  readLiveMemoryContext
} from "../infrastructure/live-memory/liveMemoryContextStore";
import { mapUserResponseToDeliveryV2 } from "./delivery/mapUserResponseToDelivery";
import {
  buildSupportTurnIdentityV2
} from "./build-input/buildSupportTurnIdentityV2";
import {
  mapSupportProcessingProgressToStage,
  noopSupportProgressReporter
} from "./progress/supportProgressReporter";
import {
  normalizeUserLanguageForProgress
} from "./progress/normalizeProgressLanguage";

import type {
  BufferedMessages
} from "./buffer/typesMessaging.types";
import type {
  SupportProcessingPipelineV2Output,
  SupportProcessingPipelineV2Input,
  SupportProcessingPipelineV2Steps,
  SupportProcessingPersistenceEffectsV2
} from "./support-processing-pipeline-v2/typesSupportProcessingPipelineV2.types";
import type {
  DeliveryMessage
} from "./delivery/typesDelivery.types";
import type {
  ProgressContext,
  SupportProgressReporter
} from "./progress/supportProgressReporter";
import type {
  SupportTurnIdentityV2
} from "./build-input/buildSupportTurnIdentityV2";

export type SupportAutomationTurnV2Result = {
  turnIdentity: SupportTurnIdentityV2;
  supportProcessingInput: SupportProcessingPipelineV2Input;
  supportProcessingOutput: SupportProcessingPipelineV2Output;
  persistenceEffects: SupportProcessingPersistenceEffectsV2;
  deliveryMessages: DeliveryMessage[];
};

async function runSupportAutomationTurnV2(params: {
  bufferedMessages: BufferedMessages;
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
  const turnIdentity = buildSupportTurnIdentityV2(params.bufferedMessages);
  const liveMemoryContext =
    await readLiveMemoryContext(turnIdentity.conversationKey);
  const supportProcessingInput = buildSupportProcessingInputV2({
    bufferedMessages: params.bufferedMessages,
    turnIdentity,
    liveMemoryContext
  });
  const supportProcessingOutput = await runSupportProcessingPipelineV2(
    supportProcessingInput,
    params.steps,
    {
      reportProgress: async (event) => {
        const stage = mapSupportProcessingProgressToStage(event);

        if (stage === null) {
          if (
            event.step === "analyzeTextSurface" &&
            (event.status === "completed" || event.status === "skipped")
          ) {
            progressContext.userLanguage =
              normalizeUserLanguageForProgress(event.userLanguage);

            progressContext.progressLanguageReady = true;

            if (event.status === "completed") {
              await progressReporter.stage(progressContext, "analyzing_surface");
            }
          }

          return;
        }

        await progressReporter.stage(progressContext, stage);
      }
    }
  );
  await progressReporter.stage(progressContext, "sending_response");
  const deliveryMessages = mapUserResponseToDeliveryV2({
    userResponse: supportProcessingOutput.userResponse,
    turnIdentity,
    latestMessageId: params.bufferedMessages.messages.at(-1)?.messageId
  });

  return {
    turnIdentity,
    supportProcessingInput,
    supportProcessingOutput,
    persistenceEffects: supportProcessingOutput.persistenceEffects,
    deliveryMessages
  };
}

export {
  runSupportAutomationTurnV2
};
