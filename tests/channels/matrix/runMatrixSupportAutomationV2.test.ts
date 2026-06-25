import { describe, expect, it, vi } from "vitest";
import { join } from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

import {
  runMatrixSupportAutomationV2
} from "../../../src/channels/matrix/runMatrixSupportAutomationV2";
import type {
  SupportAutomationTurnV2Result
} from "../../../src/orchestration/runSupportAutomationTurnV2";
import { JsonMessageRepository } from "../../../src/repositories/json/jsonMessageRepository";
import { JsonTicketRepository } from "../../../src/repositories/json/jsonTicketRepository";
import { JsonUserRepository } from "../../../src/repositories/json/jsonUserRepository";

import type {
  MessagingEvent
} from "../../../src/messaging/typesMessaging.types";
import type {
  SupportProgressReporter
} from "../../../src/orchestration/supportProgressReporter";

function buildTempRepositories(): {
  ticketRepository: JsonTicketRepository;
  userRepository: JsonUserRepository;
  messageRepository: JsonMessageRepository;
} {
  const dir = mkdtempSync(join(tmpdir(), "matrix-v2-test-"));

  return {
    ticketRepository: new JsonTicketRepository(join(dir, "tickets.json")),
    userRepository: new JsonUserRepository(join(dir, "users.json")),
    messageRepository: new JsonMessageRepository(join(dir, "messages.json"))
  };
}

describe("runMatrixSupportAutomationV2", function () {
  it("buffers Matrix messages, runs the V2 turn once, and skips delivery in dry-run", async function () {
    const repositories = buildTempRepositories();
    await repositories.ticketRepository.list();
    await repositories.userRepository.list();
    await repositories.messageRepository.list();
    const repositoriesBefore = {
      tickets: await repositories.ticketRepository.list(),
      users: await repositories.userRepository.list(),
      messages: await repositories.messageRepository.list()
    };
    let onMessage!: (event: MessagingEvent) => Promise<void> | void;
    const listenMatrixEvents = vi.fn(async (params) => {
      onMessage = params.onMessage;

      return {
        stop: vi.fn()
      };
    });
    const sendMatrixDeliveryMessages = vi.fn();
    const runSupportAutomationTurnV2 = vi.fn(async (params) => {
      const result: SupportAutomationTurnV2Result = {
        matchingResult: {
          channel: "matrix",
          roomId: params.bufferedMessages.roomId,
          userId: params.bufferedMessages.userId,
          messages: params.bufferedMessages.messages
        },
        supportProcessingInput: {} as never,
        supportProcessingOutput: {
          userResponse: {
            messages: [
              {
                type: "topic_response",
                content: "Réponse V2."
              }
            ]
          },
          patches: {} as never
        },
        deliveryMessages: [
          {
            localId: "delivery_1",
            channel: "matrix",
            roomId: params.bufferedMessages.roomId,
            userId: params.bufferedMessages.userId,
            content: "Réponse V2."
          }
        ],
        persistenceResult: {
          patchStatus: "applied",
          storedIncomingMessageIds: [],
          storedOutgoingMessageIds: [],
          warnings: []
        }
      };

      return result;
    });
    const handle = await runMatrixSupportAutomationV2({
      config: {
        homeserverUrl: "https://matrix.local",
        accessToken: "token",
        defaultRoomId: "!room"
      },
      dryRun: true,
      inactivityTimeoutMs: 10_000,
      ticketRepository: repositories.ticketRepository,
      userRepository: repositories.userRepository,
      messageRepository: repositories.messageRepository,
      dependencies: {
        listenMatrixEvents,
        sendMatrixDeliveryMessages,
        runSupportAutomationTurnV2
      }
    });

    await onMessage({
      channel: "matrix",
      roomId: "!room",
      userId: "@user",
      messageId: "$event",
      content: "Bonjour",
      createdAt: new Date().toISOString()
    });

    const records = await handle.flushPending();

    expect(runSupportAutomationTurnV2).toHaveBeenCalledTimes(1);
    expect(runSupportAutomationTurnV2).toHaveBeenCalledWith(
      expect.objectContaining({
        persist: false
      })
    );
    expect(listenMatrixEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        downloadAttachments: false
      })
    );
    expect(records).toHaveLength(1);
    expect(records[0].supportAutomationTurnResult.deliveryMessages).toHaveLength(1);
    expect(records[0].matrixDeliveryResults).toEqual([]);
    expect(sendMatrixDeliveryMessages).not.toHaveBeenCalled();
    expect(await repositories.ticketRepository.list())
      .toEqual(repositoriesBefore.tickets);
    expect(await repositories.userRepository.list())
      .toEqual(repositoriesBefore.users);
    expect(await repositories.messageRepository.list())
      .toEqual(repositoriesBefore.messages);

    await handle.stop();
  });

  it("starts progress after buffer activity and passes the reporter to the V2 turn", async function () {
    const repositories = buildTempRepositories();
    let onMessage!: (event: MessagingEvent) => Promise<void> | void;
    const listenMatrixEvents = vi.fn(async (params) => {
      onMessage = params.onMessage;

      return {
        stop: vi.fn()
      };
    });
    const progressReporter: SupportProgressReporter = {
      startBuffer: vi.fn(async () => undefined),
      startTurn: vi.fn(async () => undefined),
      stage: vi.fn(async () => undefined),
      finishTurn: vi.fn(async () => undefined),
      failTurn: vi.fn(async () => undefined)
    };
    const runSupportAutomationTurnV2 = vi.fn(async (params) => {
      await params.progressReporter?.stage({
        roomId: params.bufferedMessages.roomId,
        userId: params.bufferedMessages.userId,
        turnId: params.progressContext?.turnId,
        messageCount: params.bufferedMessages.messages.length
      }, "analyzing_support");

      const result: SupportAutomationTurnV2Result = {
        matchingResult: {
          channel: "matrix",
          roomId: params.bufferedMessages.roomId,
          userId: params.bufferedMessages.userId,
          messages: params.bufferedMessages.messages
        },
        supportProcessingInput: {} as never,
        supportProcessingOutput: {
          userResponse: {
            messages: [
              {
                type: "topic_response",
                content: "Réponse V2."
              }
            ]
          },
          patches: {} as never
        },
        deliveryMessages: [
          {
            localId: "delivery_1",
            channel: "matrix",
            roomId: params.bufferedMessages.roomId,
            userId: params.bufferedMessages.userId,
            content: "Réponse V2."
          }
        ],
        persistenceResult: {
          patchStatus: "applied",
          storedIncomingMessageIds: [],
          storedOutgoingMessageIds: [],
          warnings: []
        }
      };

      return result;
    });
    const handle = await runMatrixSupportAutomationV2({
      config: {
        homeserverUrl: "https://matrix.local",
        accessToken: "token",
        defaultRoomId: "!room"
      },
      dryRun: true,
      inactivityTimeoutMs: 10_000,
      ticketRepository: repositories.ticketRepository,
      userRepository: repositories.userRepository,
      messageRepository: repositories.messageRepository,
      progressReporter,
      dependencies: {
        listenMatrixEvents,
        runSupportAutomationTurnV2
      }
    });

    await onMessage({
      channel: "matrix",
      roomId: "!room",
      userId: "@user",
      messageId: "$event-progress",
      content: "J'ai un probleme avec mes mails",
      createdAt: new Date().toISOString()
    });

    await handle.flushPending();

    expect(progressReporter.startBuffer).toHaveBeenCalledWith({
      roomId: "!room",
      userId: "@user",
      turnId: "$event-progress",
      messageCount: 1
    });
    expect(progressReporter.startTurn).toHaveBeenCalledWith({
      roomId: "!room",
      userId: "@user",
      turnId: "$event-progress",
      messageCount: 1
    });
    expect(runSupportAutomationTurnV2).toHaveBeenCalledWith(
      expect.objectContaining({
        progressReporter,
        progressContext: {
          roomId: "!room",
          userId: "@user",
          turnId: "$event-progress",
          messageCount: 1
        }
      })
    );
    expect(progressReporter.stage).toHaveBeenCalledWith({
      roomId: "!room",
      userId: "@user",
      turnId: "$event-progress",
      messageCount: 1
    }, "analyzing_support");
    expect(progressReporter.finishTurn).toHaveBeenCalledWith({
      roomId: "!room",
      userId: "@user",
      turnId: "$event-progress",
      messageCount: 1
    });
    expect(progressReporter.failTurn).not.toHaveBeenCalled();

    await handle.stop();
  });
});
