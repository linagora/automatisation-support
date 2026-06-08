export type MatrixChannelConfig = {
  homeserverUrl: string;
  accessToken: string;
  defaultRoomId?: string;
  storagePath?: string;
};

export type MatrixDeliveryResult = {
  channel: "matrix";
  roomId: string;
  deliveredMessages: {
    localId: string;
    providerMessageId?: string;
    content: string;
    deliveredAt: string;
  }[];
  failedMessages: {
    localId: string;
    content: string;
    error: string;
  }[];
};

export type MatrixTextEvent = {
  event_id?: string;
  sender?: string;
  type?: string;
  origin_server_ts?: number;
  content?: {
    msgtype?: string;
    body?: unknown;
  };
};

export type MatrixTypingEvent = {
  type?: string;
  content?: {
    user_ids?: unknown;
  };
};

export type MatrixClientLike = {
  getUserId: () => Promise<string>;
  on: {
    (
      eventName: "room.message",
      handler: (roomId: string, event: MatrixTextEvent) => Promise<void> | void
    ): void;
    (
      eventName: "room.event",
      handler: (
        roomId: string,
        event: MatrixTextEvent | MatrixTypingEvent
      ) => Promise<void> | void
    ): void;
  };
  start: () => Promise<void>;
  stop?: () => Promise<void> | void;
  sendText: (roomId: string, content: string) => Promise<string | undefined>;
};
