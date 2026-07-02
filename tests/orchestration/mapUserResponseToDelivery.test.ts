import { describe, expect, it } from "vitest";

import {
  mapUserResponseToDelivery
} from "../../src/support-automation/delivery/mapUserResponseToDelivery";

import type {
  MatchingResult
} from "../../src/archive/matching/typesMatching.types";
import type {
  UserResponse
} from "../../src/archive/support-processing-pipeline/typesSupportProcessingPipeline.types";

function buildMatchingResult(): MatchingResult {
  return {
    channel: "matrix",
    roomId: "!room:example.org",
    userId: "@user:example.org",
    messages: [
      {
        channel: "matrix",
        roomId: "!room:example.org",
        userId: "@user:example.org",
        messageId: "$message_1",
        content: "Bonjour",
        createdAt: "2026-06-05T10:00:00.000Z"
      }
    ]
  };
}

describe("mapUserResponseToDelivery", function () {
  it("maps user response messages to delivery messages", function () {
    const userResponse: UserResponse = {
      messages: [
        {
          type: "topic_response",
          content: "Je regarde cela."
        },
        {
          type: "handover",
          content: "Le support peut reprendre la main."
        }
      ]
    };

    expect(mapUserResponseToDelivery({
      userResponse,
      matchingResult: buildMatchingResult()
    })).toEqual([
      {
        localId:
          "delivery:matrix:!room:example.org:@user:example.org:$message_1:0",
        channel: "matrix",
        roomId: "!room:example.org",
        userId: "@user:example.org",
        content: "Je regarde cela.",
        metadata: {
          userResponseMessageType: "topic_response"
        }
      },
      {
        localId:
          "delivery:matrix:!room:example.org:@user:example.org:$message_1:1",
        channel: "matrix",
        roomId: "!room:example.org",
        userId: "@user:example.org",
        content: "Le support peut reprendre la main.",
        metadata: {
          userResponseMessageType: "handover"
        }
      }
    ]);
  });

  it("returns an empty list for empty or blank response messages", function () {
    const userResponse = {
      messages: [
        {
          type: "topic_response",
          content: "   "
        }
      ]
    } as UserResponse;

    expect(mapUserResponseToDelivery({
      userResponse,
      matchingResult: buildMatchingResult()
    })).toEqual([]);
    expect(mapUserResponseToDelivery({
      userResponse: { messages: [] },
      matchingResult: buildMatchingResult()
    })).toEqual([]);
  });
});
