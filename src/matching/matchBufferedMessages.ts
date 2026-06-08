import type {
  BufferedMessages
} from "../messaging/typesMessaging.types";
import type {
  JsonTicketRepository
} from "../repositories/json/jsonTicketRepository";
import type {
  JsonUserRepository
} from "../repositories/json/jsonUserRepository";
import type {
  MatchingResult
} from "./typesMatching.types";

async function matchBufferedMessages(params: {
  bufferedMessages: BufferedMessages;
  ticketRepository: JsonTicketRepository;
  userRepository: JsonUserRepository;
}): Promise<MatchingResult> {
  const {
    channel,
    roomId,
    userId,
    messages
  } = params.bufferedMessages;
  const [ticket, user] = await Promise.all([
    params.ticketRepository.findActiveByRoomAndUser(roomId, userId),
    params.userRepository.findById(userId)
  ]);

  return {
    channel,
    roomId,
    userId,
    messages,
    ...(ticket ? { ticket } : {}),
    ...(user ? { user } : {})
  };
}

export {
  matchBufferedMessages
};
