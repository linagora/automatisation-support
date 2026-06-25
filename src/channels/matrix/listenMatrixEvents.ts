import { createMatrixClient } from "./matrixClient";
import { downloadMatrixEventAttachments } from "./downloadMatrixAttachments";
import { mapMatrixEventToMessagingEvent } from "./mapMatrixEvent";

import type {
  MessagingEvent,
  MessagingTypingEvent
} from "../../messaging/typesMessaging.types";
import type {
  MatrixChannelConfig,
  MatrixTypingEvent,
  MatrixTextEvent
} from "./typesMatrixChannel.types";

async function listenMatrixEvents(params: {
  config: MatrixChannelConfig;
  downloadAttachments?: boolean;
  onMessage: (event: MessagingEvent) => void | Promise<void>;
  onTyping?: (event: MessagingTypingEvent) => void | Promise<void>;
}): Promise<{ stop: () => Promise<void> | void }> {
  const client = createMatrixClient(params.config);
  const botUserId = await client.getUserId();
  const previousTypingUsersByRoomId = new Map<string, Set<string>>();

  function shouldIgnoreRoom(roomId: string): boolean {
    return (
      params.config.defaultRoomId !== undefined &&
      roomId !== params.config.defaultRoomId
    );
  }

  function getTypingUserIds(event: MatrixTypingEvent): Set<string> | undefined {
    if (event.type !== "m.typing" || !Array.isArray(event.content?.user_ids)) {
      return undefined;
    }

    return new Set(
      event.content.user_ids.filter((userId): userId is string => {
        return typeof userId === "string" && userId !== botUserId;
      })
    );
  }

  async function emitTypingEvent(paramsToEmit: {
    roomId: string;
    userId: string;
    isTyping: boolean;
    rawEvent: MatrixTypingEvent;
  }): Promise<void> {
    if (!params.onTyping) {
      return;
    }

    await params.onTyping({
      channel: "matrix",
      roomId: paramsToEmit.roomId,
      userId: paramsToEmit.userId,
      isTyping: paramsToEmit.isTyping,
      updatedAt: new Date().toISOString(),
      rawEvent: paramsToEmit.rawEvent
    });
  }

  async function handleTypingEvent(
    roomId: string,
    event: MatrixTypingEvent
  ): Promise<void> {
    if (shouldIgnoreRoom(roomId)) {
      return;
    }

    const typingUsers = getTypingUserIds(event);

    if (typingUsers === undefined) {
      return;
    }

    const previousTypingUsers =
      previousTypingUsersByRoomId.get(roomId) ?? new Set<string>();

    for (const userId of typingUsers) {
      await emitTypingEvent({
        roomId,
        userId,
        isTyping: true,
        rawEvent: event
      });
    }

    for (const userId of previousTypingUsers) {
      if (typingUsers.has(userId)) {
        continue;
      }

      await emitTypingEvent({
        roomId,
        userId,
        isTyping: false,
        rawEvent: event
      });
    }

    previousTypingUsersByRoomId.set(roomId, typingUsers);
  }

  function installTypingSyncBridge(): void {
    const clientWithProcessSync = client as unknown as {
      processSync?: (
        raw: unknown,
        emitFn?: (
          emitEventType: string,
          ...payload: unknown[]
        ) => Promise<unknown>
      ) => Promise<unknown>;
    };

    if (
      !params.onTyping ||
      typeof clientWithProcessSync.processSync !== "function"
    ) {
      return;
    }

    const originalProcessSync = clientWithProcessSync.processSync.bind(client);

    clientWithProcessSync.processSync = async (
      raw: unknown,
      emitFn?: (emitEventType: string, ...payload: unknown[]) => Promise<unknown>
    ): Promise<unknown> => {
      if (typeof raw === "object" && raw !== null) {
        const rooms = (raw as Record<string, unknown>).rooms;
        const joinedRooms =
          typeof rooms === "object" && rooms !== null
            ? (rooms as Record<string, unknown>).join
            : undefined;

        if (typeof joinedRooms === "object" && joinedRooms !== null) {
          for (const [roomId, roomValue] of Object.entries(joinedRooms)) {
            const room = typeof roomValue === "object" && roomValue !== null
              ? roomValue as Record<string, unknown>
              : undefined;
            const ephemeral = typeof room?.ephemeral === "object" &&
              room.ephemeral !== null
              ? room.ephemeral as Record<string, unknown>
              : undefined;
            const events = Array.isArray(ephemeral?.events)
              ? ephemeral.events
              : [];

            for (const event of events) {
              await handleTypingEvent(roomId, event as MatrixTypingEvent);
            }
          }
        }
      }

      return originalProcessSync(raw, emitFn);
    };
  }

  installTypingSyncBridge();

  client.on(
    "room.message",
    async (roomId: string, event: MatrixTextEvent) => {
      if (shouldIgnoreRoom(roomId)) {
        return;
      }

      if (event.sender === botUserId) {
        return;
      }

      const messagingEvent = mapMatrixEventToMessagingEvent({
        roomId,
        event
      });

      if (messagingEvent === undefined) {
        return;
      }

      if ((messagingEvent.attachments ?? []).length > 0) {
        console.log({
          eventName: "matrix.attachment.received",
          roomId,
          messageId: messagingEvent.messageId,
          attachmentCount: messagingEvent.attachments?.length ?? 0
        });
      }

      const messagingEventWithDownloadedAttachments =
        params.downloadAttachments === false
          ? messagingEvent
          : await downloadMatrixEventAttachments({
              client,
              messagingEvent
            });

      await params.onMessage(messagingEventWithDownloadedAttachments);
    }
  );

  client.on(
    "room.event",
    async (roomId: string, event: MatrixTextEvent | MatrixTypingEvent) => {
      await handleTypingEvent(roomId, event as MatrixTypingEvent);
    }
  );

  await client.start();

  return {
    stop: async () => {
      await client.stop?.();
    }
  };
}

export {
  listenMatrixEvents
};
