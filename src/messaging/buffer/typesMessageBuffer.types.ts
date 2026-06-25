import type {
  BufferedMessages,
  MessagingEvent,
  MessagingTypingEvent
} from "../typesMessaging.types";
import type {
  ConversationScopeKey
} from "../conversationScope";

export type MessageBufferGroupKey =
  Omit<ConversationScopeKey, "threadId"> & {
    threadId?: string | null;
  };

export type MessageBufferFlushCallback = (
  bufferedMessages: BufferedMessages
) => void | Promise<void>;

export type MessageBufferDebugEvent =
  | {
      eventName: "buffer.typing_updated";
      roomId: string;
      userId: string;
      isTyping: boolean;
      messageCount: number;
    }
  | {
      eventName: "buffer.flush_blocked_typing";
      roomId: string;
      userId: string;
      isTyping: true;
      messageCount: number;
    }
  | {
      eventName: "buffer.max_wait_reached";
      roomId: string;
      userId: string;
      messageCount: number;
    };

export type InMemoryMessageBufferOptions = {
  inactivityTimeoutMs: number;
  maxWaitMs?: number;
  onFlush: MessageBufferFlushCallback;
  onDebugEvent?: (event: MessageBufferDebugEvent) => void;
  now?: () => Date;
};

export type MessageBuffer = {
  addMessage: (message: MessagingEvent) => boolean;
  updateTypingState: (typingEvent: MessagingTypingEvent) => void;
  flushGroup: (groupKey: MessageBufferGroupKey) => BufferedMessages | undefined;
  flushAll: () => BufferedMessages[];
  dispose: () => void;
};
