import type { StringResponsePlan } from "./transformPlanToStringPlan";

type UserResponseMessageType =
  | "security_gate"
  | "suspicious"
  | "lack_comprehension"
  | "scope_boundary"
  | "topic_response"
  | "signal_response"
  | "handover";

type UserResponse = {
  messages: {
    type: UserResponseMessageType;
    content: string;
  }[];
};

function transformStringPlanToMessages(
  stringResponsePlan: StringResponsePlan
): UserResponse {
  return {
    messages: [
      ...stringResponsePlan.securityGate.map((content) => {
        return { type: "security_gate" as const, content };
      }),
      ...stringResponsePlan.suspicious.map((content) => {
        return { type: "suspicious" as const, content };
      }),
      ...stringResponsePlan.lackComprehension.map((content) => {
        return { type: "lack_comprehension" as const, content };
      }),
      ...stringResponsePlan.scopeBoundary.map((content) => {
        return { type: "scope_boundary" as const, content };
      }),
      ...stringResponsePlan.topic.map((content) => {
        return { type: "topic_response" as const, content };
      }),
      ...stringResponsePlan.signal.map((content) => {
        return { type: "signal_response" as const, content };
      }),
      ...stringResponsePlan.handover.map((content) => {
        return { type: "handover" as const, content };
      })
    ]
  };
}

export { transformStringPlanToMessages };
export type { UserResponse, UserResponseMessageType };
