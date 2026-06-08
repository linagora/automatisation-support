import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  applyDeliveryResult
} from "../../src/persistence/applyDeliveryResult";
import { JsonMessageRepository } from "../../src/repositories/json/jsonMessageRepository";

describe("applyDeliveryResult", function () {
  let tempDir: string;
  let messageRepository: JsonMessageRepository;

  beforeEach(async function () {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "delivery-result-test-"));
    messageRepository = new JsonMessageRepository(
      path.join(tempDir, "messages.json")
    );
  });

  afterEach(async function () {
    await fs.rm(tempDir, {
      recursive: true,
      force: true
    });
  });

  it("is a documented no-op for now", async function () {
    const storedMessage = {
      messageId: "delivery_1",
      channel: "matrix" as const,
      roomId: "!room:example.org",
      userId: "@user:example.org",
      direction: "outgoing" as const,
      content: "Réponse",
      createdAt: "2026-06-05T10:00:00.000Z"
    };

    await messageRepository.append(storedMessage);

    await expect(applyDeliveryResult({
      messageRepository,
      matrixDeliveryResults: [
        {
          channel: "matrix",
          roomId: "!room:example.org",
          deliveredMessages: [
            {
              localId: "delivery_1",
              providerMessageId: "$matrix_event",
              content: "Réponse",
              deliveredAt: "2026-06-05T10:00:02.000Z"
            }
          ],
          failedMessages: []
        }
      ]
    })).resolves.toEqual({
      status: "skipped",
      warnings: [
        "delivery result persistence not implemented yet; stored outgoing messages are not enriched with providerMessageId"
      ]
    });

    await expect(messageRepository.list()).resolves.toEqual([storedMessage]);
  });
});
