import type {
  AccountTrustStatus
} from "../../../typesSupportProcessingPipeline.types";

type RefusedAttachmentRouteInput = {
  accountTrustStatus: AccountTrustStatus;
};

type RefusedAttachmentRouteDecision = {
  route: "continue" | "stop";
  reason?: string;
};

function decideRefusedAttachmentRoute(
  input: RefusedAttachmentRouteInput
): RefusedAttachmentRouteDecision {
  if (
    input.accountTrustStatus.status === "trusted" ||
    input.accountTrustStatus.status === "neutral"
  ) {
    return {
      route: "continue",
      reason: "trusted_or_neutral_account_with_refused_attachment"
    };
  }

  return {
    route: "stop",
    reason: "suspicious_account_with_refused_attachment"
  };
}

export {
  decideRefusedAttachmentRoute
};
export type {
  RefusedAttachmentRouteInput,
  RefusedAttachmentRouteDecision
};
