import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  sendMatrixDeliveryMessages
} from "../../../src/infrastructure/matrix/sendMatrixMessages";
import {
  createMatrixClient
} from "../../../src/infrastructure/matrix/matrixClient";

import type {
  DeliveryMessage
} from "../../../src/archive/orchestration/typesOrchestration.types";

vi.mock("../../../src/infrastructure/matrix/matrixClient", function () {
  return {
    createMatrixClient: vi.fn()
  };
});

const createMatrixClientMock = vi.mocked(createMatrixClient);

function buildDeliveryMessage(
  overrides: Partial<DeliveryMessage> = {}
): DeliveryMessage {
  return {
    localId: "delivery_1",
    channel: "matrix",
    roomId: "!message-room:example.org",
    userId: "@user:example.org",
    content: "Bonjour",
    ...overrides
  };
}

describe("sendMatrixDeliveryMessages", function () {
  beforeEach(function () {
    vi.clearAllMocks();
  });

  it("sends to the delivery message room instead of only the default room", async function () {
    const sendText = vi.fn(async function () {
      return "$provider_1";
    });

    createMatrixClientMock.mockReturnValue({
      getUserId: vi.fn(async () => "@bot:example.org"),
      on: vi.fn(),
      start: vi.fn(async () => undefined),
      sendText
    });

    await expect(sendMatrixDeliveryMessages({
      config: {
        homeserverUrl: "https://matrix.example.org",
        accessToken: "token",
        defaultRoomId: "!default-room:example.org"
      },
      messages: [
        buildDeliveryMessage({
          roomId: "!message-room:example.org",
          content: "Message room wins"
        })
      ]
    })).resolves.toEqual([
      {
        channel: "matrix",
        roomId: "!message-room:example.org",
        deliveredMessages: [
          {
            localId: "delivery_1",
            providerMessageId: "$provider_1",
            content: "Message room wins",
            deliveredAt: expect.any(String)
          }
        ],
        failedMessages: []
      }
    ]);

    expect(sendText).toHaveBeenCalledWith(
      "!message-room:example.org",
      "Message room wins"
    );
  });

  it("returns delivered and failed messages without throwing for one failed send", async function () {
    const sendText = vi.fn(async function (roomId: string, content: string) {
      void roomId;

      if (content === "fail") {
        throw new Error("rate limited");
      }

      return "$provider_ok";
    });

    createMatrixClientMock.mockReturnValue({
      getUserId: vi.fn(async () => "@bot:example.org"),
      on: vi.fn(),
      start: vi.fn(async () => undefined),
      sendText
    });

    const result = await sendMatrixDeliveryMessages({
      config: {
        homeserverUrl: "https://matrix.example.org",
        accessToken: "token",
        defaultRoomId: "!default-room:example.org"
      },
      messages: [
        buildDeliveryMessage({
          localId: "delivery_ok",
          roomId: "",
          content: "ok"
        }),
        buildDeliveryMessage({
          localId: "delivery_failed",
          roomId: "",
          content: "fail"
        }),
        buildDeliveryMessage({
          localId: "delivery_blank",
          roomId: "",
          content: "   "
        })
      ]
    });

    expect(result).toEqual([
      {
        channel: "matrix",
        roomId: "!default-room:example.org",
        deliveredMessages: [
          {
            localId: "delivery_ok",
            providerMessageId: "$provider_ok",
            content: "ok",
            deliveredAt: expect.any(String)
          }
        ],
        failedMessages: [
          {
            localId: "delivery_failed",
            content: "fail",
            error: "rate limited"
          }
        ]
      }
    ]);
    expect(sendText).toHaveBeenCalledTimes(2);
  });
});
