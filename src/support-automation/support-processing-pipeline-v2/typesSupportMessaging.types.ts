export type LatestUserMessage = {
  id: string;
  content: string;
  channel: "email" | "twake_chat" | "other";
  sentAt: string;
};

export type LatestUserAttachment = {
  id: string;
  filename: string;
  sizeInBytes: number;
  accessUrl?: string;
  name?: string;
  url?: string;
  path?: string;
  type?: string;
  mimeType?: string;
  sizeBytes?: number;
  channel: LatestUserMessage["channel"];
  sentAt: string;
};

export type UserResponseMessage = {
  type:
    | "global_response"
    | "security_gate"
    | "suspicious"
    | "lack_comprehension"
    | "warning_comprehension"
    | "input_cleaning"
    | "scope_boundary"
    | "topic_response"
    | "signal_response"
    | "handover";
  content: string;
};

export type UserResponse = {
  messages: UserResponseMessage[];
};
