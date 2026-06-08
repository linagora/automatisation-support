import { describe, expect, it } from "vitest";

import {
  mapMatrixEventToMessagingEvent
} from "../../../src/channels/matrix/mapMatrixEvent";

describe("mapMatrixEventToMessagingEvent", function () {
  it("maps a valid Matrix text message to MessagingEvent", function () {
    const event = {
      event_id: "$event_1",
      sender: "@user:example.org",
      type: "m.room.message",
      origin_server_ts: 1780653600000,
      content: {
        msgtype: "m.text",
        body: " Bonjour Drive "
      }
    };

    expect(mapMatrixEventToMessagingEvent({
      roomId: "!room:example.org",
      event
    })).toEqual({
      channel: "matrix",
      roomId: "!room:example.org",
      userId: "@user:example.org",
      messageId: "$event_1",
      content: "Bonjour Drive",
      createdAt: "2026-06-05T10:00:00.000Z",
      rawEvent: event
    });
  });

  it("ignores non text Matrix messages", function () {
    expect(mapMatrixEventToMessagingEvent({
      roomId: "!room:example.org",
      event: {
        event_id: "$event_1",
        sender: "@user:example.org",
        type: "m.room.message",
        content: {
          msgtype: "m.image",
          body: "image"
        }
      }
    })).toBeUndefined();

    expect(mapMatrixEventToMessagingEvent({
      roomId: "!room:example.org",
      event: {
        event_id: "$event_2",
        sender: "@user:example.org",
        type: "m.room.member",
        content: {
          msgtype: "m.text",
          body: "hello"
        }
      }
    })).toBeUndefined();
  });

  it("ignores empty text bodies", function () {
    expect(mapMatrixEventToMessagingEvent({
      roomId: "!room:example.org",
      event: {
        event_id: "$event_1",
        sender: "@user:example.org",
        type: "m.room.message",
        content: {
          msgtype: "m.text",
          body: "   "
        }
      }
    })).toBeUndefined();
  });
});
