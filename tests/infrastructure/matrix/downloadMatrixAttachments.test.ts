import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";

import { describe, expect, it, vi } from "vitest";

import {
  downloadMatrixEventAttachments
} from "../../../src/infrastructure/matrix/downloadMatrixAttachments";

import type {
  MatrixClientLike
} from "../../../src/infrastructure/matrix/typesMatrixChannel.types";
import type {
  MessagingEvent
} from "../../../src/support-automation/buffer/typesMessaging.types";

function buildMessagingEvent(): MessagingEvent {
  return {
    channel: "matrix",
    roomId: "!room:example.org",
    userId: "@user:example.org",
    messageId: "$image",
    createdAt: "2026-06-05T10:00:00.000Z",
    attachments: [
      {
        id: "$image:attachment",
        filename: "capture.png",
        mimeType: "image/png",
        sizeInBytes: 1234,
        matrixMxcUrl: "mxc://matrix.example.org/media",
        kind: "image"
      }
    ]
  };
}

describe("downloadMatrixEventAttachments", function () {
  it("downloads Matrix mxc attachments to a local file", async function () {
    const directoryPath = await fs.mkdtemp(
      path.join(os.tmpdir(), "matrix-attachments-")
    );
    const client: MatrixClientLike = {
      getUserId: vi.fn(async () => "@bot:example.org"),
      on: vi.fn(),
      start: vi.fn(async () => undefined),
      sendText: vi.fn(async () => "$provider"),
      mxcToHttp: vi.fn(() => "https://matrix.example.org/_matrix/media"),
      downloadContent: vi.fn(async () => {
        return {
          data: Buffer.from("image-bytes"),
          contentType: "image/png"
        };
      })
    };

    const result = await downloadMatrixEventAttachments({
      client,
      messagingEvent: buildMessagingEvent(),
      directoryPath
    });

    expect(client.downloadContent).toHaveBeenCalledWith(
      "mxc://matrix.example.org/media",
      true
    );
    expect(result.attachments?.[0]).toMatchObject({
      path: expect.stringContaining(directoryPath),
      accessUrl: "https://matrix.example.org/_matrix/media",
      url: "https://matrix.example.org/_matrix/media",
      sizeInBytes: 1234,
      sizeBytes: 1234
    });
    await expect(fs.readFile(result.attachments?.[0].path ?? "", "utf8"))
      .resolves.toBe("image-bytes");
  });

  it("keeps attachment metadata when Matrix download is unavailable", async function () {
    const messagingEvent = buildMessagingEvent();
    const client: MatrixClientLike = {
      getUserId: vi.fn(async () => "@bot:example.org"),
      on: vi.fn(),
      start: vi.fn(async () => undefined),
      sendText: vi.fn(async () => "$provider")
    };

    await expect(downloadMatrixEventAttachments({
      client,
      messagingEvent
    })).resolves.toEqual(messagingEvent);
  });
});
