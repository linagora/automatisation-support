import type {
  MessagingChannel,
  MessagingEvent
} from "../../support-automation/buffer/typesMessaging.types";
import type {
  JsonTicket,
  JsonUser
} from "../repositories/json/typesJsonRepositories.types";

export type MatchingResult = {
  channel: MessagingChannel;
  roomId: string;
  threadId?: string | null;
  userId: string;
  messages: MessagingEvent[];
  ticket?: JsonTicket;
  user?: JsonUser;
};
