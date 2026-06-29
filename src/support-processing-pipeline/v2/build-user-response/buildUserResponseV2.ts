import type {
  BuildUserResponseInput,
  UserResponse
} from "../typesSupportProcessingPipelineV2.types";

function getFinalResponseText(input: BuildUserResponseInput): string {
  const finalResponseText =
    input.renderedSupportResponse.finalResponseText;

  if (finalResponseText.trim() !== "") {
    return finalResponseText;
  }

  return "";
}

function buildUserResponseV2(input: BuildUserResponseInput): UserResponse {
  const content = getFinalResponseText(input);

  if (content === "") {
    console.error({
      eventName: "support.v2.build_user_response.empty_rendered_response",
      message:
        "No finalResponseText available; no delivery message will be produced."
    });

    return {
      messages: []
    };
  }

  return {
    messages: [
      {
        type: "topic_response",
        content
      }
    ]
  };
}

export {
  buildUserResponseV2
};
