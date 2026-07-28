import type {
  MessagingChannel
} from "../buffer/typesMessaging.types";

export type DeliveryMessage = {
  localId: string;
  channel: MessagingChannel;
  roomId: string;
  threadId?: string | null;
  userId: string;
  content: string;
  metadata?: Record<string, unknown>;
};
