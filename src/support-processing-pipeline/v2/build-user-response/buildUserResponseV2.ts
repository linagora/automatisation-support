import type {
  BuildUserResponseInput,
  UserResponse
} from "../typesSupportProcessingPipelineV2.types";
import type {
  RenderedMessagePurpose
} from "../response-renderer/typesRenderSupportResponse.types";

function mapRenderedPurposeToUserMessageType(
  purpose: RenderedMessagePurpose | undefined
): UserResponse["messages"][number]["type"] {
  if (purpose === "handover") {
    return "handover";
  }

  if (purpose === "standard_only") {
    return "signal_response";
  }

  if (purpose === "safety_or_boundary") {
    return "scope_boundary";
  }

  return "topic_response";
}

function getFinalResponseText(input: BuildUserResponseInput): string {
  const finalResponseText =
    input.renderedSupportResponse.finalResponseText;

  if (finalResponseText.trim() !== "") {
    return finalResponseText;
  }

  return input.renderedSupportResponse.renderedMessages
    .map((message) => {
      return message.content;
    })
    .filter((content) => {
      return content.trim() !== "";
    })
    .join("\n\n");
}

function buildUserResponseV2(input: BuildUserResponseInput): UserResponse {
  const content = getFinalResponseText(input);

  if (content === "") {
    console.error({
      eventName: "support.v2.build_user_response.empty_rendered_response",
      message:
        "No finalResponseText or renderedMessages content available; no delivery message will be produced."
    });

    return {
      messages: []
    };
  }

  return {
    messages: [
      {
        type: mapRenderedPurposeToUserMessageType(
          input.renderedSupportResponse.renderedMessages[0]?.purpose
        ),
        content
      }
    ]
  };
}

export {
  buildUserResponseV2
};
