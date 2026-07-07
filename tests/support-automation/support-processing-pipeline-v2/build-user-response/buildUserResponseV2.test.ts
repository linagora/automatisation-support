import { describe, expect, it, vi } from "vitest";

import {
  buildUserResponseV2
} from "../../../../src/support-automation/support-processing-pipeline-v2/build-user-response/buildUserResponseV2";

import type {
  RenderedSupportResponse
} from "../../../../src/support-automation/support-processing-pipeline-v2/response-renderer/typesRenderSupportResponse.types";

describe("buildUserResponseV2", function () {
  it("uses trimmed finalResponseText when it is present", function () {
    const renderedSupportResponse: RenderedSupportResponse = {
      finalResponseText: " Texte final exact. "
    };

    expect(buildUserResponseV2({ renderedSupportResponse }).messages[0]).toEqual({
      type: "topic_response",
      content: "Texte final exact."
    });
  });

  it("uses a technical fallback when finalResponseText is empty", function () {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const renderedSupportResponse: RenderedSupportResponse = {
      finalResponseText: ""
    };

    expect(buildUserResponseV2({ renderedSupportResponse })).toEqual({
      messages: [
        {
          type: "warning_comprehension",
          content: expect.stringContaining(
            "Désolé, je n’ai pas pu générer une réponse exploitable"
          )
        }
      ]
    });
    expect(errorSpy).toHaveBeenCalledWith(expect.objectContaining({
      eventName: "support.v2.build_user_response.empty_rendered_response"
    }));

    errorSpy.mockRestore();
  });
});
