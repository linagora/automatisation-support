export type SupportRagMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type SupportRagCallInput = {
  messages: SupportRagMessage[];
  temperature?: number;
  maxTokens?: number;
  metadata?: Record<string, unknown>;
};

export type SupportRagCallOutput = {
  content: string;
  sources: unknown[];
  rawPayload: unknown;
};

export type SupportRagClient = {
  call(input: SupportRagCallInput): Promise<SupportRagCallOutput>;
};
