import { describe, expect, it } from "vitest";

import {
  mapMatrixEventToMessagingEvent
} from "../../../src/infrastructure/matrix/mapMatrixEvent";

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

  it("maps Matrix thread and reply relations to the conversation scope metadata", function () {
    const event = {
      event_id: "$event_thread_reply",
      sender: "@user:example.org",
      type: "m.room.message",
      origin_server_ts: 1780653600000,
      content: {
        msgtype: "m.text",
        body: "Oui",
        "m.relates_to": {
          rel_type: "m.thread",
          event_id: "$thread_root",
          "m.in_reply_to": {
            event_id: "$previous_message"
          }
        }
      }
    };

    expect(mapMatrixEventToMessagingEvent({
      roomId: "!room:example.org",
      event
    })).toMatchObject({
      channel: "matrix",
      roomId: "!room:example.org",
      threadId: "$thread_root",
      replyToMessageId: "$previous_message",
      userId: "@user:example.org",
      messageId: "$event_thread_reply",
      content: "Oui"
    });
  });

  it("maps a Matrix image message to MessagingEvent attachments", function () {
    const event = {
      event_id: "$image_1",
      sender: "@user:example.org",
      type: "m.room.message",
      origin_server_ts: 1780653600000,
      content: {
        msgtype: "m.image",
        body: "capture.png",
        url: "mxc://matrix.example.org/media_1",
        info: {
          mimetype: "image/png",
          size: 1234,
          w: 800,
          h: 600
        }
      }
    };

    expect(mapMatrixEventToMessagingEvent({
      roomId: "!room:example.org",
      event
    })).toEqual({
      channel: "matrix",
      roomId: "!room:example.org",
      userId: "@user:example.org",
      messageId: "$image_1",
      attachments: [
        {
          id: "$image_1:attachment",
          filename: "capture.png",
          mimeType: "image/png",
          sizeInBytes: 1234,
          sizeBytes: 1234,
          matrixMxcUrl: "mxc://matrix.example.org/media_1",
          url: "mxc://matrix.example.org/media_1",
          kind: "image",
          width: 800,
          height: 600,
          rawAttachment: event.content,
          rawEvent: event
        }
      ],
      createdAt: "2026-06-05T10:00:00.000Z",
      rawEvent: event
    });
  });

  it("maps a Matrix file message to MessagingEvent attachments", function () {
    const event = {
      event_id: "$file_1",
      sender: "@user:example.org",
      type: "m.room.message",
      origin_server_ts: 1780653600000,
      content: {
        msgtype: "m.file",
        body: "rapport.pdf",
        filename: "rapport-final.pdf",
        url: "mxc://matrix.example.org/file_1",
        info: {
          mimetype: "application/pdf",
          size: 4567
        }
      }
    };

    expect(mapMatrixEventToMessagingEvent({
      roomId: "!room:example.org",
      event
    })).toMatchObject({
      channel: "matrix",
      messageId: "$file_1",
      attachments: [
        {
          id: "$file_1:attachment",
          filename: "rapport-final.pdf",
          mimeType: "application/pdf",
          sizeInBytes: 4567,
          matrixMxcUrl: "mxc://matrix.example.org/file_1",
          kind: "other"
        }
      ]
    });
  });

  it("ignores unsupported Matrix messages", function () {
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
