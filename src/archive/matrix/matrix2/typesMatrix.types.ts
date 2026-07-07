import type {
  LatestUserMessage,
  UserResponse
} from "../../support-processing-pipeline/typesSupportProcessingPipeline.types";

export type MatrixConfig = {
  homeserverUrl: string;
  accessToken: string;
  roomId: string;
};

export type MatrixMessageToSend = {
  type: string;
  content: string;
};

export type SendMatrixMessagesInput = {
  config: MatrixConfig;
  messages: MatrixMessageToSend[];
};

export type MatrixIncomingMessage = {
  roomId: string;
  eventId: string;
  sender: string;
  body: string;
  timestamp?: number;
};

export type MatrixUserResponse = Pick<UserResponse, "messages">;

export type MatrixLatestUserMessage = LatestUserMessage;
