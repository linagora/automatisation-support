import type {
  MatchingResult
} from "../matching/typesMatching.types";
import type {
  UserResponse
} from "../support-processing-pipeline/typesSupportProcessingPipeline.types";
import type {
  DeliveryMessage
} from "./typesOrchestration.types";

function buildDeliveryLocalId(params: {
  matchingResult: MatchingResult;
  index: number;
}): string {
  const latestMessageId =
    params.matchingResult.messages.at(-1)?.messageId ?? "no-message";

  return [
    "delivery",
    params.matchingResult.channel,
    params.matchingResult.roomId,
    params.matchingResult.userId,
    latestMessageId,
    String(params.index)
  ].join(":");
}

function mapUserResponseToDelivery(params: {
  userResponse: UserResponse;
  matchingResult: MatchingResult;
}): DeliveryMessage[] {
  const messages = params.userResponse.messages ?? [];

  return messages.flatMap((message, index) => {
    if (message.content.trim() === "") {
      return [];
    }

    return [
      {
        localId: buildDeliveryLocalId({
          matchingResult: params.matchingResult,
          index
        }),
        channel: params.matchingResult.channel,
        roomId: params.matchingResult.roomId,
        ...(params.matchingResult.threadId
          ? { threadId: params.matchingResult.threadId }
          : {}),
        userId: params.matchingResult.userId,
        content: message.content,
        metadata: {
          userResponseMessageType: message.type
        }
      }
    ];
  });
}

export {
  mapUserResponseToDelivery
};
