import type {
  BufferedMessages,
  MessagingEvent,
  MessagingTypingEvent
} from "../typesMessaging.types";
import {
  buildConversationScopeKey,
  serializeConversationScopeKey
} from "../conversationScope";
import type {
  InMemoryMessageBufferOptions,
  MessageBuffer,
  MessageBufferDebugEvent,
  MessageBufferGroupKey
} from "./typesMessageBuffer.types";

type PendingMessageGroup = {
  key: MessageBufferGroupKey;
  messages: MessagingEvent[];
  isTyping: boolean;
  lastMessageAt?: string;
  lastTypingAt?: string;
  firstBufferedAt?: string;
  flushTimer?: ReturnType<typeof setTimeout>;
  maxWaitTimer?: ReturnType<typeof setTimeout>;
};

function hasTextContent(message: MessagingEvent): boolean {
  return typeof message.content === "string" && message.content.trim() !== "";
}

function hasAttachments(message: MessagingEvent): boolean {
  return Array.isArray(message.attachments) && message.attachments.length > 0;
}

function hasBufferedContent(message: MessagingEvent): boolean {
  return hasTextContent(message) || hasAttachments(message);
}

function buildGroupId(groupKey: MessageBufferGroupKey): string {
  return serializeConversationScopeKey(
    buildConversationScopeKey(groupKey)
  );
}

class InMemoryMessageBuffer implements MessageBuffer {
  private readonly inactivityTimeoutMs: number;
  private readonly maxWaitMs: number | undefined;
  private readonly onFlush: InMemoryMessageBufferOptions["onFlush"];
  private readonly canFlush: InMemoryMessageBufferOptions["canFlush"];
  private readonly onDebugEvent: InMemoryMessageBufferOptions["onDebugEvent"];
  private readonly now: () => Date;
  private readonly pendingGroups = new Map<string, PendingMessageGroup>();

  constructor(options: InMemoryMessageBufferOptions) {
    if (!Number.isFinite(options.inactivityTimeoutMs) || options.inactivityTimeoutMs < 0) {
      throw new Error("inactivityTimeoutMs must be a non-negative number");
    }

    if (
      options.maxWaitMs !== undefined &&
      (!Number.isFinite(options.maxWaitMs) || options.maxWaitMs < 0)
    ) {
      throw new Error("maxWaitMs must be a non-negative number");
    }

    this.inactivityTimeoutMs = options.inactivityTimeoutMs;
    this.maxWaitMs = options.maxWaitMs;
    this.onFlush = options.onFlush;
    this.canFlush = options.canFlush;
    this.onDebugEvent = options.onDebugEvent;
    this.now = options.now ?? (() => new Date());
  }

  addMessage(message: MessagingEvent): boolean {
    if (!hasBufferedContent(message)) {
      return false;
    }

    const key = buildConversationScopeKey({
      channel: message.channel,
      roomId: message.roomId,
      threadId: message.threadId,
      userId: message.userId
    });
    const groupId = buildGroupId(key);
    const existingGroup = this.pendingGroups.get(groupId);
    const group = existingGroup ?? {
      key,
      messages: [],
      isTyping: false
    };

    if (!existingGroup) {
      this.pendingGroups.set(groupId, group);
    }

    group.messages.push(message);
    group.firstBufferedAt ??= message.createdAt;
    group.lastMessageAt = message.createdAt;

    this.ensureMaxWaitTimer(group);

    if (group.isTyping) {
      this.clearFlushTimer(group);
      this.emitDebugEvent({
        eventName: "buffer.flush_blocked_typing",
        roomId: key.roomId,
        userId: key.userId,
        isTyping: true,
        messageCount: group.messages.length
      });
      return true;
    }

    this.resetFlushTimer(group);

    return true;
  }

  updateTypingState(typingEvent: MessagingTypingEvent): void {
    const key = buildConversationScopeKey({
      channel: typingEvent.channel,
      roomId: typingEvent.roomId,
      userId: typingEvent.userId
    });
    const groupId = buildGroupId(key);
    const existingGroup = this.pendingGroups.get(groupId);
    const group = existingGroup ?? {
      key,
      messages: [],
      isTyping: false
    };

    group.isTyping = typingEvent.isTyping;
    group.lastTypingAt = typingEvent.updatedAt;

    if (!existingGroup) {
      this.pendingGroups.set(groupId, group);
    }

    if (typingEvent.isTyping) {
      this.clearFlushTimer(group);
    } else if (group.messages.length > 0) {
      this.resetFlushTimer(group);
    } else {
      this.pendingGroups.delete(groupId);
    }

    this.emitDebugEvent({
      eventName: "buffer.typing_updated",
      roomId: key.roomId,
      userId: key.userId,
      isTyping: typingEvent.isTyping,
      messageCount: group.messages.length
    });
  }

  flushGroup(groupKey: MessageBufferGroupKey): BufferedMessages | undefined {
    return this.flushGroupIfAllowed({
      groupKey,
      respectTyping: false
    });
  }

  reevaluateGroup(groupKey: MessageBufferGroupKey): boolean {
    const groupId = buildGroupId(groupKey);
    const group = this.pendingGroups.get(groupId);

    if (!group) {
      return false;
    }

    if (group.isTyping) {
      return false;
    }

    const remainingInactivityMs = this.getRemainingInactivityMs(group);

    if (remainingInactivityMs > 0) {
      this.resetFlushTimer(group, remainingInactivityMs);
      return false;
    }

    return this.flushAndNotify({
      groupKey,
      respectTyping: true
    });
  }

  flushAll(): BufferedMessages[] {
    return [...this.pendingGroups.values()].flatMap((group) => {
      const flushedGroup = this.flushGroup(group.key);

      return flushedGroup ? [flushedGroup] : [];
    });
  }

  dispose(): void {
    for (const group of this.pendingGroups.values()) {
      this.clearFlushTimer(group);
      this.clearMaxWaitTimer(group);
    }

    this.pendingGroups.clear();
  }

  private flushGroupIfAllowed(params: {
    groupKey: MessageBufferGroupKey;
    respectTyping: boolean;
  }): BufferedMessages | undefined {
    const groupId = buildGroupId(params.groupKey);
    const group = this.pendingGroups.get(groupId);

    if (!group) {
      return undefined;
    }

    if (params.respectTyping && group.isTyping) {
      return undefined;
    }

    if (this.canFlush?.(group.key) === false) {
      this.emitDebugEvent({
        eventName: "buffer.flush_blocked_processing",
        roomId: group.key.roomId,
        userId: group.key.userId,
        scopeKey: buildGroupId(group.key),
        messageIds: group.messages.map((message) => message.messageId),
        messageCount: group.messages.length
      });
      this.resetFlushTimer(group);
      return undefined;
    }

    this.clearFlushTimer(group);
    this.clearMaxWaitTimer(group);
    this.pendingGroups.delete(groupId);

    if (group.messages.length === 0 || !group.firstBufferedAt || !group.lastMessageAt) {
      return undefined;
    }

    return {
      channel: group.key.channel,
      roomId: group.key.roomId,
      threadId: group.key.threadId,
      userId: group.key.userId,
      messages: [...group.messages],
      firstMessageAt: group.firstBufferedAt,
      lastMessageAt: group.lastMessageAt,
      flushedAt: this.now().toISOString()
    };
  }

  private flushAndNotify(params: {
    groupKey: MessageBufferGroupKey;
    respectTyping: boolean;
  }): boolean {
    const bufferedMessages = this.flushGroupIfAllowed(params);

    if (!bufferedMessages) {
      return false;
    }

    void Promise.resolve(this.onFlush(bufferedMessages));
    return true;
  }

  private resetFlushTimer(
    group: PendingMessageGroup,
    delayMs = this.inactivityTimeoutMs
  ): void {
    this.clearFlushTimer(group);
    const groupKey = group.key;

    group.flushTimer = setTimeout(() => {
      group.flushTimer = undefined;
      this.flushAndNotify({
        groupKey,
        respectTyping: true
      });
    }, delayMs);
  }

  private ensureMaxWaitTimer(group: PendingMessageGroup): void {
    if (this.maxWaitMs === undefined || group.maxWaitTimer !== undefined) {
      return;
    }

    const groupKey = group.key;

    group.maxWaitTimer = setTimeout(() => {
      group.maxWaitTimer = undefined;
      const messageCount = this.pendingGroups.get(buildGroupId(groupKey))
        ?.messages.length ?? 0;

      this.emitDebugEvent({
        eventName: "buffer.max_wait_reached",
        roomId: groupKey.roomId,
        userId: groupKey.userId,
        messageCount
      });

      this.flushAndNotify({
        groupKey,
        respectTyping: false
      });
    }, this.maxWaitMs);
  }

  private getRemainingInactivityMs(group: PendingMessageGroup): number {
    if (!group.lastMessageAt) {
      return this.inactivityTimeoutMs;
    }

    const lastMessageAt = new Date(group.lastMessageAt).getTime();

    if (!Number.isFinite(lastMessageAt)) {
      return this.inactivityTimeoutMs;
    }

    const elapsedMs = this.now().getTime() - lastMessageAt;

    return Math.max(0, this.inactivityTimeoutMs - elapsedMs);
  }

  private clearFlushTimer(group: PendingMessageGroup): void {
    if (group.flushTimer !== undefined) {
      clearTimeout(group.flushTimer);
      group.flushTimer = undefined;
    }
  }

  private clearMaxWaitTimer(group: PendingMessageGroup): void {
    if (group.maxWaitTimer !== undefined) {
      clearTimeout(group.maxWaitTimer);
      group.maxWaitTimer = undefined;
    }
  }

  private emitDebugEvent(event: MessageBufferDebugEvent): void {
    this.onDebugEvent?.(event);
  }
}

export {
  InMemoryMessageBuffer
};
