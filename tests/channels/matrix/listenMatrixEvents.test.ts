import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  listenMatrixEvents
} from "../../../src/channels/matrix/listenMatrixEvents";
import {
  createMatrixClient
} from "../../../src/channels/matrix/matrixClient";

import type {
  MatrixTypingEvent,
  MatrixTextEvent
} from "../../../src/channels/matrix/typesMatrixChannel.types";

vi.mock("../../../src/channels/matrix/matrixClient", function () {
  return {
    createMatrixClient: vi.fn()
  };
});

const createMatrixClientMock = vi.mocked(createMatrixClient);

describe("listenMatrixEvents", function () {
  beforeEach(function () {
    vi.clearAllMocks();
  });

  it("maps Matrix text events and passes them to onMessage", async function () {
    let roomMessageHandler:
      | ((roomId: string, event: MatrixTextEvent) => Promise<void> | void)
      | undefined;
    const stop = vi.fn(async () => undefined);
    const onMessage = vi.fn(async () => undefined);

    createMatrixClientMock.mockReturnValue({
      getUserId: vi.fn(async () => "@bot:example.org"),
      on: vi.fn(function (eventName, handler) {
        if (eventName === "room.message") {
          roomMessageHandler = handler as typeof roomMessageHandler;
        }
      }),
      start: vi.fn(async () => undefined),
      stop,
      sendText: vi.fn(async () => "$provider")
    });

    const handle = await listenMatrixEvents({
      config: {
        homeserverUrl: "https://matrix.example.org",
        accessToken: "token",
        defaultRoomId: "!room:example.org"
      },
      onMessage
    });

    await roomMessageHandler?.("!room:example.org", {
      event_id: "$event_1",
      sender: "@user:example.org",
      type: "m.room.message",
      origin_server_ts: 1780653600000,
      content: {
        msgtype: "m.text",
        body: "Bonjour"
      }
    });

    expect(onMessage).toHaveBeenCalledWith({
      channel: "matrix",
      roomId: "!room:example.org",
      userId: "@user:example.org",
      messageId: "$event_1",
      content: "Bonjour",
      createdAt: "2026-06-05T10:00:00.000Z",
      rawEvent: {
        event_id: "$event_1",
        sender: "@user:example.org",
        type: "m.room.message",
        origin_server_ts: 1780653600000,
        content: {
          msgtype: "m.text",
          body: "Bonjour"
        }
      }
    });

    await handle.stop();
    expect(stop).toHaveBeenCalled();
  });

  it("ignores bot messages and events outside the configured default room", async function () {
    let roomMessageHandler:
      | ((roomId: string, event: MatrixTextEvent) => Promise<void> | void)
      | undefined;
    const onMessage = vi.fn(async () => undefined);

    createMatrixClientMock.mockReturnValue({
      getUserId: vi.fn(async () => "@bot:example.org"),
      on: vi.fn(function (eventName, handler) {
        if (eventName === "room.message") {
          roomMessageHandler = handler as typeof roomMessageHandler;
        }
      }),
      start: vi.fn(async () => undefined),
      sendText: vi.fn(async () => "$provider")
    });

    await listenMatrixEvents({
      config: {
        homeserverUrl: "https://matrix.example.org",
        accessToken: "token",
        defaultRoomId: "!room:example.org"
      },
      onMessage
    });

    await roomMessageHandler?.("!other-room:example.org", {
      event_id: "$event_other_room",
      sender: "@user:example.org",
      type: "m.room.message",
      content: {
        msgtype: "m.text",
        body: "Bonjour"
      }
    });
    await roomMessageHandler?.("!room:example.org", {
      event_id: "$event_bot",
      sender: "@bot:example.org",
      type: "m.room.message",
      content: {
        msgtype: "m.text",
        body: "Bonjour"
      }
    });

    expect(onMessage).not.toHaveBeenCalled();
  });

  it("maps Matrix typing users to typing true events", async function () {
    let roomEventHandler:
      | ((roomId: string, event: MatrixTypingEvent) => Promise<void> | void)
      | undefined;
    const onTyping = vi.fn(async () => undefined);

    createMatrixClientMock.mockReturnValue({
      getUserId: vi.fn(async () => "@bot:example.org"),
      on: vi.fn(function (eventName, handler) {
        if (eventName === "room.event") {
          roomEventHandler = handler as typeof roomEventHandler;
        }
      }),
      start: vi.fn(async () => undefined),
      sendText: vi.fn(async () => "$provider")
    });

    await listenMatrixEvents({
      config: {
        homeserverUrl: "https://matrix.example.org",
        accessToken: "token",
        defaultRoomId: "!room:example.org"
      },
      onMessage: vi.fn(),
      onTyping
    });

    const rawEvent = {
      type: "m.typing",
      content: {
        user_ids: ["@user:example.org"]
      }
    };

    await roomEventHandler?.("!room:example.org", rawEvent);

    expect(onTyping).toHaveBeenCalledWith(expect.objectContaining({
      channel: "matrix",
      roomId: "!room:example.org",
      userId: "@user:example.org",
      isTyping: true,
      rawEvent
    }));
  });

  it("emits typing false when a previously typing user disappears", async function () {
    let roomEventHandler:
      | ((roomId: string, event: MatrixTypingEvent) => Promise<void> | void)
      | undefined;
    const onTyping = vi.fn(async () => undefined);

    createMatrixClientMock.mockReturnValue({
      getUserId: vi.fn(async () => "@bot:example.org"),
      on: vi.fn(function (eventName, handler) {
        if (eventName === "room.event") {
          roomEventHandler = handler as typeof roomEventHandler;
        }
      }),
      start: vi.fn(async () => undefined),
      sendText: vi.fn(async () => "$provider")
    });

    await listenMatrixEvents({
      config: {
        homeserverUrl: "https://matrix.example.org",
        accessToken: "token",
        defaultRoomId: "!room:example.org"
      },
      onMessage: vi.fn(),
      onTyping
    });

    await roomEventHandler?.("!room:example.org", {
      type: "m.typing",
      content: {
        user_ids: ["@user:example.org"]
      }
    });
    await roomEventHandler?.("!room:example.org", {
      type: "m.typing",
      content: {
        user_ids: []
      }
    });

    expect(onTyping).toHaveBeenLastCalledWith(expect.objectContaining({
      channel: "matrix",
      roomId: "!room:example.org",
      userId: "@user:example.org",
      isTyping: false
    }));
  });

  it("ignores bot typing and typing events outside the configured room", async function () {
    let roomEventHandler:
      | ((roomId: string, event: MatrixTypingEvent) => Promise<void> | void)
      | undefined;
    const onTyping = vi.fn(async () => undefined);

    createMatrixClientMock.mockReturnValue({
      getUserId: vi.fn(async () => "@bot:example.org"),
      on: vi.fn(function (eventName, handler) {
        if (eventName === "room.event") {
          roomEventHandler = handler as typeof roomEventHandler;
        }
      }),
      start: vi.fn(async () => undefined),
      sendText: vi.fn(async () => "$provider")
    });

    await listenMatrixEvents({
      config: {
        homeserverUrl: "https://matrix.example.org",
        accessToken: "token",
        defaultRoomId: "!room:example.org"
      },
      onMessage: vi.fn(),
      onTyping
    });

    await roomEventHandler?.("!room:example.org", {
      type: "m.typing",
      content: {
        user_ids: ["@bot:example.org"]
      }
    });
    await roomEventHandler?.("!other-room:example.org", {
      type: "m.typing",
      content: {
        user_ids: ["@user:example.org"]
      }
    });

    expect(onTyping).not.toHaveBeenCalled();
  });

  it("does not fail when onTyping is absent", async function () {
    let roomEventHandler:
      | ((roomId: string, event: MatrixTypingEvent) => Promise<void> | void)
      | undefined;

    createMatrixClientMock.mockReturnValue({
      getUserId: vi.fn(async () => "@bot:example.org"),
      on: vi.fn(function (eventName, handler) {
        if (eventName === "room.event") {
          roomEventHandler = handler as typeof roomEventHandler;
        }
      }),
      start: vi.fn(async () => undefined),
      sendText: vi.fn(async () => "$provider")
    });

    await listenMatrixEvents({
      config: {
        homeserverUrl: "https://matrix.example.org",
        accessToken: "token"
      },
      onMessage: vi.fn()
    });

    await expect(Promise.resolve(roomEventHandler?.("!room:example.org", {
      type: "m.typing",
      content: {
        user_ids: ["@user:example.org"]
      }
    }))).resolves.toBeUndefined();
  });

  it("extracts typing events from Matrix sync ephemeral events when available", async function () {
    const onTyping = vi.fn(async () => undefined);
    const client = {
      getUserId: vi.fn(async () => "@bot:example.org"),
      on: vi.fn(),
      start: vi.fn(async () => undefined),
      sendText: vi.fn(async () => "$provider"),
      processSync: vi.fn(async (_raw: unknown) => undefined)
    };

    createMatrixClientMock.mockReturnValue(client);

    await listenMatrixEvents({
      config: {
        homeserverUrl: "https://matrix.example.org",
        accessToken: "token",
        defaultRoomId: "!room:example.org"
      },
      onMessage: vi.fn(),
      onTyping
    });

    await client.processSync({
      rooms: {
        join: {
          "!room:example.org": {
            ephemeral: {
              events: [
                {
                  type: "m.typing",
                  content: {
                    user_ids: ["@user:example.org"]
                  }
                }
              ]
            }
          }
        }
      }
    });

    expect(onTyping).toHaveBeenCalledWith(expect.objectContaining({
      channel: "matrix",
      roomId: "!room:example.org",
      userId: "@user:example.org",
      isTyping: true
    }));
  });
});
