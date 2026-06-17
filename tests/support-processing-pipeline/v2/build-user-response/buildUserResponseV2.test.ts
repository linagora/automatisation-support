import { describe, expect, it, vi } from "vitest";

import {
  buildUserResponseV2
} from "../../../../src/support-processing-pipeline/v2/build-user-response/buildUserResponseV2";

import type {
  RenderedSupportResponse
} from "../../../../src/support-processing-pipeline/v2/response-renderer/typesRenderSupportResponse.types";

describe("buildUserResponseV2", function () {
  it("turns a standard-only Bonjour render into a deliverable response", function () {
    const renderedSupportResponse: RenderedSupportResponse = {
      renderedMessages: [
        {
          messageId: "rendered_standard_1",
          messageOrder: 1,
          purpose: "standard_only",
          relatedPlannedMessageOrders: [],
          content: "Bonjour !"
        }
      ],
      finalResponseText: "Bonjour !",
      internalRenderingNotes: "Standard-only greeting."
    };

    expect(buildUserResponseV2({ renderedSupportResponse })).toEqual({
      messages: [
        {
          type: "signal_response",
          content: "Bonjour !"
        }
      ]
    });
  });

  it("turns a support render into a deliverable response without rewriting it", function () {
    const renderedSupportResponse: RenderedSupportResponse = {
      renderedMessages: [
        {
          messageId: "rendered_support_1",
          messageOrder: 1,
          purpose: "support_response",
          relatedPlannedMessageOrders: [],
          content: "Je vois le souci de facture."
        }
      ],
      finalResponseText: "Je vois le souci de facture.",
      internalRenderingNotes: "Support acknowledgement."
    };

    expect(buildUserResponseV2({ renderedSupportResponse })).toEqual({
      messages: [
        {
          type: "topic_response",
          content: "Je vois le souci de facture."
        }
      ]
    });
  });

  it("uses finalResponseText exactly when it is present", function () {
    const renderedSupportResponse: RenderedSupportResponse = {
      renderedMessages: [
        {
          messageId: "rendered_support_1",
          messageOrder: 1,
          purpose: "support_response",
          relatedPlannedMessageOrders: [],
          content: "Contenu alternatif."
        }
      ],
      finalResponseText: " Texte final exact. ",
      internalRenderingNotes: "Final response has priority."
    };

    expect(buildUserResponseV2({ renderedSupportResponse }).messages[0]).toEqual({
      type: "topic_response",
      content: " Texte final exact. "
    });
  });

  it("concatenates rendered message content when finalResponseText is empty", function () {
    const renderedSupportResponse: RenderedSupportResponse = {
      renderedMessages: [
        {
          messageId: "rendered_support_1",
          messageOrder: 1,
          purpose: "support_response",
          relatedPlannedMessageOrders: [],
          content: "Premier message."
        },
        {
          messageId: "rendered_support_2",
          messageOrder: 2,
          purpose: "support_response",
          relatedPlannedMessageOrders: [],
          content: "Deuxième message."
        }
      ],
      finalResponseText: "   ",
      internalRenderingNotes: "Fallback to rendered messages."
    };

    expect(buildUserResponseV2({ renderedSupportResponse }).messages[0]).toEqual({
      type: "topic_response",
      content: "Premier message.\n\nDeuxième message."
    });
  });

  it("does not invent a message when the render contains no text", function () {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const renderedSupportResponse: RenderedSupportResponse = {
      renderedMessages: [],
      finalResponseText: "",
      internalRenderingNotes: "Empty renderer output."
    };

    expect(buildUserResponseV2({ renderedSupportResponse })).toEqual({
      messages: []
    });
    expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({
      eventName: "support.v2.build_user_response.empty_rendered_response"
    }));

    errorSpy.mockRestore();
  });
});
