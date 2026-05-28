import type { StringResponsePlan } from "./transformPlanToStringPlan";
import type { StringTopicPlanMessage } from "./transformPlanMessagesToString";

type StringPlanToMessagesInput = {
  stringResponsePlan: StringResponsePlan;
};

type UserResponseMessageType =
  | "security_gate"
  | "suspicious"
  | "lack_comprehension"
  | "scope_boundary"
  | "topic_response"
  | "signal_response"
  | "handover";

type UserResponseMessage = {
  type: UserResponseMessageType;
  content: string;
};

function addTextMessages(
  messages: UserResponseMessage[],
  type: UserResponseMessageType,
  texts: (string | undefined)[]
): void {
  for (const text of texts) {
    if (text !== undefined && text.trim() !== "") {
      messages.push({ type, content: text });
    }
  }
}

function addTopicMessages(
  messages: UserResponseMessage[],
  topicPlanMessages: StringTopicPlanMessage[]
): void {
  for (const topicPlanMessage of topicPlanMessages) {
    const lastTopicIndex = topicPlanMessage.topicsResponses.length - 1;

    topicPlanMessage.topicsResponses.forEach((topicResponse, topicIndex) => {
      const messageParts: string[] = [];

      if (topicIndex === 0) {
        messageParts.push(
          topicPlanMessage.politenessOpening,
          topicPlanMessage.topicRelationAcknowledgement,
          ""
        );
      }

      messageParts.push(topicResponse);

      if (topicIndex === lastTopicIndex) {
        messageParts.push(topicPlanMessage.politenessClosure);
      }

      const filteredMessageParts = messageParts.filter((messagePart) => {
        return messagePart === "" || messagePart.trim() !== "";
      });

      if (filteredMessageParts.length > 0) {
        messages.push({
          type: "topic_response",
          content: filteredMessageParts.join("\n")
        });
      }
    });
  }
}

function transformStringPlanToMessages(
  stringPlanToMessagesInput: StringPlanToMessagesInput
): UserResponseMessage[] {
  const { stringResponsePlan } = stringPlanToMessagesInput;
  const { messagesPlan } = stringResponsePlan;
  const messages: UserResponseMessage[] = [];

  addTextMessages(messages, "security_gate", [
    messagesPlan.securityGatePlanMessage
  ]);
  addTextMessages(messages, "suspicious", [messagesPlan.suspiciousPlanMessage]);
  addTextMessages(messages, "lack_comprehension", [
    messagesPlan.lackComprehensionPlanMessage
  ]);
  addTextMessages(
    messages,
    "scope_boundary",
    messagesPlan.scopeBoundaryPlanMessages
  );
  addTopicMessages(messages, messagesPlan.topicPlanMessages);
  addTextMessages(messages, "signal_response", messagesPlan.signalPlanMessages);
  addTextMessages(messages, "handover", messagesPlan.handoverPlanMessages);

  return messages;
}

export { transformStringPlanToMessages };
export type {
  StringPlanToMessagesInput,
  UserResponseMessage,
  UserResponseMessageType
};
