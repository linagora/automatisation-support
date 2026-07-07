import type {
  BuildUserResponseInput,
  UserResponse
} from "../typesSupportProcessingPipelineV2.types";

const TECHNICAL_FALLBACK_RESPONSE =
  "Désolé, je n’ai pas pu générer une réponse exploitable. Pouvez-vous reformuler votre demande ou réessayer dans quelques instants ?";

function getFinalResponseText(input: BuildUserResponseInput): string {
  return input.renderedSupportResponse.finalResponseText.trim();
}

function buildUserResponseV2(input: BuildUserResponseInput): UserResponse {
  const content = getFinalResponseText(input);

  if (content !== "") {
    return {
      messages: [
        {
          type: "topic_response",
          content
        }
      ]
    };
  }

  console.error({
    eventName: "support.v2.build_user_response.empty_rendered_response",
    message:
      "No finalResponseText available; technical fallback delivery message will be produced."
  });

  return {
    messages: [
      {
        type: "warning_comprehension",
        content: TECHNICAL_FALLBACK_RESPONSE
      }
    ]
  };
}

export {
  buildUserResponseV2
};
