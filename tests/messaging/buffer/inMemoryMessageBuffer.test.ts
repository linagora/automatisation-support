import {
  InMemoryMessageBuffer
} from "../../../src/messaging/buffer/inMemoryMessageBuffer";

import type {
  BufferedMessages,
  MessagingEvent,
  MessagingTypingEvent
} from "../../../src/messaging/typesMessaging.types";

function buildMessage(
  overrides: Partial<MessagingEvent> = {}
): MessagingEvent {
  return {
    channel: "matrix",
    roomId: "!room:example.org",
    userId: "@user:example.org",
    messageId: "$message",
    content: "Hello",
    createdAt: "2026-06-05T10:00:00.000Z",
    ...overrides
  };
}

function buildTypingEvent(
  overrides: Partial<MessagingTypingEvent> = {}
): MessagingTypingEvent {
  return {
    channel: "matrix",
    roomId: "!room:example.org",
    userId: "@user:example.org",
    isTyping: true,
    updatedAt: "2026-06-05T10:00:00.000Z",
    ...overrides
  };
}

describe("InMemoryMessageBuffer", function () {
  beforeEach(function () {
    vi.useFakeTimers();
  });

  afterEach(function () {
    vi.useRealTimers();
  });

  it("flushes text messages after the inactivity timeout", async function () {
    const flushedMessages: BufferedMessages[] = [];
    const buffer = new InMemoryMessageBuffer({
      inactivityTimeoutMs: 1000,
      onFlush: (bufferedMessages) => {
        flushedMessages.push(bufferedMessages);
      },
      now: () => new Date("2026-06-05T10:00:01.000Z")
    });

    expect(buffer.addMessage(buildMessage())).toBe(true);

    await vi.advanceTimersByTimeAsync(999);
    expect(flushedMessages).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1);

    expect(flushedMessages).toEqual([
      {
        channel: "matrix",
        roomId: "!room:example.org",
        userId: "@user:example.org",
        messages: [buildMessage()],
        firstMessageAt: "2026-06-05T10:00:00.000Z",
        lastMessageAt: "2026-06-05T10:00:00.000Z",
        flushedAt: "2026-06-05T10:00:01.000Z"
      }
    ]);

    buffer.dispose();
  });

  it("groups messages by channel, roomId, and userId", async function () {
    const flushedMessages: BufferedMessages[] = [];
    const buffer = new InMemoryMessageBuffer({
      inactivityTimeoutMs: 1000,
      onFlush: (bufferedMessages) => {
        flushedMessages.push(bufferedMessages);
      },
      now: () => new Date("2026-06-05T10:00:02.000Z")
    });

    buffer.addMessage(buildMessage({
      messageId: "$message-1",
      content: "First"
    }));
    buffer.addMessage(buildMessage({
      messageId: "$message-2",
      content: "Second",
      createdAt: "2026-06-05T10:00:01.000Z"
    }));
    buffer.addMessage(buildMessage({
      messageId: "$message-3",
      content: "Other user",
      userId: "@other:example.org"
    }));

    await vi.advanceTimersByTimeAsync(1000);

    expect(flushedMessages).toHaveLength(2);
    expect(flushedMessages[0].messages.map((message) => message.messageId))
      .toEqual(["$message-1", "$message-2"]);
    expect(flushedMessages[0].lastMessageAt).toBe("2026-06-05T10:00:01.000Z");
    expect(flushedMessages[1].messages.map((message) => message.messageId))
      .toEqual(["$message-3"]);

    buffer.dispose();
  });

  it("resets the inactivity timeout when another message is added to the same group", async function () {
    const flushedMessages: BufferedMessages[] = [];
    const buffer = new InMemoryMessageBuffer({
      inactivityTimeoutMs: 1000,
      onFlush: (bufferedMessages) => {
        flushedMessages.push(bufferedMessages);
      }
    });

    buffer.addMessage(buildMessage({
      messageId: "$message-1"
    }));

    await vi.advanceTimersByTimeAsync(900);

    buffer.addMessage(buildMessage({
      messageId: "$message-2",
      createdAt: "2026-06-05T10:00:01.000Z"
    }));

    await vi.advanceTimersByTimeAsync(999);
    expect(flushedMessages).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1);
    expect(flushedMessages).toHaveLength(1);
    expect(flushedMessages[0].messages.map((message) => message.messageId))
      .toEqual(["$message-1", "$message-2"]);

    buffer.dispose();
  });

  it("ignores events without non-empty text content", async function () {
    const flushedMessages: BufferedMessages[] = [];
    const buffer = new InMemoryMessageBuffer({
      inactivityTimeoutMs: 1000,
      onFlush: (bufferedMessages) => {
        flushedMessages.push(bufferedMessages);
      }
    });

    expect(buffer.addMessage(buildMessage({
      messageId: "$empty",
      content: "   "
    }))).toBe(false);
    expect(buffer.addMessage(buildMessage({
      messageId: "$missing",
      content: undefined
    }))).toBe(false);

    await vi.advanceTimersByTimeAsync(1000);
    expect(flushedMessages).toHaveLength(0);

    buffer.dispose();
  });

  it("can flush a group manually", function () {
    const flushedMessages: BufferedMessages[] = [];
    const buffer = new InMemoryMessageBuffer({
      inactivityTimeoutMs: 1000,
      onFlush: (bufferedMessages) => {
        flushedMessages.push(bufferedMessages);
      },
      now: () => new Date("2026-06-05T10:00:03.000Z")
    });

    buffer.addMessage(buildMessage({
      messageId: "$manual"
    }));

    const flushedGroup = buffer.flushGroup({
      channel: "matrix",
      roomId: "!room:example.org",
      userId: "@user:example.org"
    });

    expect(flushedGroup?.messages.map((message) => message.messageId))
      .toEqual(["$manual"]);
    expect(flushedGroup?.flushedAt).toBe("2026-06-05T10:00:03.000Z");
    expect(flushedMessages).toHaveLength(0);

    buffer.dispose();
  });

  it("clears pending messages on dispose", async function () {
    const flushedMessages: BufferedMessages[] = [];
    const buffer = new InMemoryMessageBuffer({
      inactivityTimeoutMs: 1000,
      onFlush: (bufferedMessages) => {
        flushedMessages.push(bufferedMessages);
      }
    });

    buffer.addMessage(buildMessage());
    buffer.dispose();

    await vi.advanceTimersByTimeAsync(1000);
    expect(flushedMessages).toHaveLength(0);
  });

  it("blocks inactivity flush while the user is typing", async function () {
    const flushedMessages: BufferedMessages[] = [];
    const debugEvents: unknown[] = [];
    const buffer = new InMemoryMessageBuffer({
      inactivityTimeoutMs: 1000,
      onFlush: (bufferedMessages) => {
        flushedMessages.push(bufferedMessages);
      },
      onDebugEvent: (event) => {
        debugEvents.push(event);
      }
    });

    buffer.updateTypingState(buildTypingEvent({
      isTyping: true
    }));
    buffer.addMessage(buildMessage({
      messageId: "$typing-blocked"
    }));

    await vi.advanceTimersByTimeAsync(5000);

    expect(flushedMessages).toHaveLength(0);
    expect(debugEvents).toContainEqual({
      eventName: "buffer.flush_blocked_typing",
      roomId: "!room:example.org",
      userId: "@user:example.org",
      isTyping: true,
      messageCount: 1
    });

    buffer.dispose();
  });

  it("flushes after inactivity once typing stops", async function () {
    const flushedMessages: BufferedMessages[] = [];
    const buffer = new InMemoryMessageBuffer({
      inactivityTimeoutMs: 1000,
      onFlush: (bufferedMessages) => {
        flushedMessages.push(bufferedMessages);
      }
    });

    buffer.updateTypingState(buildTypingEvent({
      isTyping: true
    }));
    buffer.addMessage(buildMessage({
      messageId: "$message-while-typing"
    }));
    await vi.advanceTimersByTimeAsync(1000);
    expect(flushedMessages).toHaveLength(0);

    buffer.updateTypingState(buildTypingEvent({
      isTyping: false,
      updatedAt: "2026-06-05T10:00:02.000Z"
    }));
    await vi.advanceTimersByTimeAsync(999);
    expect(flushedMessages).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1);
    expect(flushedMessages).toHaveLength(1);
    expect(flushedMessages[0].messages.map((message) => message.messageId))
      .toEqual(["$message-while-typing"]);

    buffer.dispose();
  });

  it("forces flush at maxWaitMs even if typing remains true", async function () {
    const flushedMessages: BufferedMessages[] = [];
    const debugEvents: unknown[] = [];
    const buffer = new InMemoryMessageBuffer({
      inactivityTimeoutMs: 1000,
      maxWaitMs: 3000,
      onFlush: (bufferedMessages) => {
        flushedMessages.push(bufferedMessages);
      },
      onDebugEvent: (event) => {
        debugEvents.push(event);
      }
    });

    buffer.updateTypingState(buildTypingEvent({
      isTyping: true
    }));
    buffer.addMessage(buildMessage({
      messageId: "$max-wait"
    }));

    await vi.advanceTimersByTimeAsync(2999);
    expect(flushedMessages).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1);
    expect(flushedMessages).toHaveLength(1);
    expect(flushedMessages[0].messages.map((message) => message.messageId))
      .toEqual(["$max-wait"]);
    expect(debugEvents).toContainEqual({
      eventName: "buffer.max_wait_reached",
      roomId: "!room:example.org",
      userId: "@user:example.org",
      messageCount: 1
    });

    buffer.dispose();
  });

  it("manual flush clears inactivity and max-wait timers", async function () {
    const flushedMessages: BufferedMessages[] = [];
    const buffer = new InMemoryMessageBuffer({
      inactivityTimeoutMs: 1000,
      maxWaitMs: 3000,
      onFlush: (bufferedMessages) => {
        flushedMessages.push(bufferedMessages);
      }
    });

    buffer.addMessage(buildMessage({
      messageId: "$manual-clears-timers"
    }));

    expect(buffer.flushGroup({
      channel: "matrix",
      roomId: "!room:example.org",
      userId: "@user:example.org"
    })?.messages.map((message) => message.messageId))
      .toEqual(["$manual-clears-timers"]);

    await vi.advanceTimersByTimeAsync(3000);
    expect(flushedMessages).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("dispose clears inactivity and max-wait timers", async function () {
    const flushedMessages: BufferedMessages[] = [];
    const buffer = new InMemoryMessageBuffer({
      inactivityTimeoutMs: 1000,
      maxWaitMs: 3000,
      onFlush: (bufferedMessages) => {
        flushedMessages.push(bufferedMessages);
      }
    });

    buffer.addMessage(buildMessage({
      messageId: "$disposed"
    }));
    buffer.dispose();

    await vi.advanceTimersByTimeAsync(3000);
    expect(flushedMessages).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("keeps typing state isolated for multiple users in the same room", async function () {
    const flushedMessages: BufferedMessages[] = [];
    const buffer = new InMemoryMessageBuffer({
      inactivityTimeoutMs: 1000,
      onFlush: (bufferedMessages) => {
        flushedMessages.push(bufferedMessages);
      }
    });

    buffer.updateTypingState(buildTypingEvent({
      userId: "@typing:example.org",
      isTyping: true
    }));
    buffer.addMessage(buildMessage({
      userId: "@typing:example.org",
      messageId: "$typing-user"
    }));
    buffer.addMessage(buildMessage({
      userId: "@not-typing:example.org",
      messageId: "$not-typing-user"
    }));

    await vi.advanceTimersByTimeAsync(1000);

    expect(flushedMessages).toHaveLength(1);
    expect(flushedMessages[0].userId).toBe("@not-typing:example.org");
    expect(flushedMessages[0].messages.map((message) => message.messageId))
      .toEqual(["$not-typing-user"]);

    buffer.dispose();
  });
});
