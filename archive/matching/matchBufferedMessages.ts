import type {
  BufferedMessages
} from "../../support-automation/buffer/typesMessaging.types";
import type {
  JsonTicketRepository
} from "../repositories/json/jsonTicketRepository";
import type {
  JsonUserRepository
} from "../repositories/json/jsonUserRepository";
import type {
  MatchingResult
} from "./typesMatching.types";
import {
  getBufferedMessagesConversationScope
} from "../../support-automation/buffer/conversationScope";

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
  const conversationScope =
    getBufferedMessagesConversationScope(params.bufferedMessages);
  const [ticket, user] = await Promise.all([
    params.ticketRepository.findActiveByConversationScope(conversationScope),
    params.userRepository.findById(userId)
  ]);

  return {
    channel,
    roomId,
    threadId: conversationScope.threadId,
    userId,
    messages,
    ...(ticket ? { ticket } : {}),
    ...(user ? { user } : {})
  };
}

export {
  matchBufferedMessages
};
