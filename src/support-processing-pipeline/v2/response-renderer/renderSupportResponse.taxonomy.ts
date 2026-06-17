import type {
  RenderedMessagePurpose
} from "./typesRenderSupportResponse.types";

const RENDERED_MESSAGE_PURPOSE_VALUES = [
  "support_response",
  "clarification_request",
  "standard_only",
  "handover",
  "mixed",
  "safety_or_boundary",
  "fallback"
] as const satisfies readonly RenderedMessagePurpose[];

export {
  RENDERED_MESSAGE_PURPOSE_VALUES
};
