import { transformPlanToStringPlan } from "./transformPlanToStringPlan";
import { transformStringPlanToMessages } from "./transformStringPlanToMessages";

import type { ResponsePlan } from "../response-plan/typesResponsePlan.types";
import type { UserResponseMessage } from "./transformStringPlanToMessages";

type ResponseProductionInput = {
  responsePlan: ResponsePlan;
};

type UserResponse = {
  messages: UserResponseMessage[];
};

function runResponseProduction(
  responseProductionInput: ResponseProductionInput
): UserResponse {
  const { responsePlan } = responseProductionInput;

  const userResponse: UserResponse = {
    messages: []
  };

  const planToStringPlanInput = {
    responsePlan
  };

  const stringResponsePlan = transformPlanToStringPlan(planToStringPlanInput);

  const stringPlanToMessagesInput = {
    stringResponsePlan
  };

  const messages = transformStringPlanToMessages(stringPlanToMessagesInput);

  userResponse.messages = messages;

  return userResponse;
}

export { runResponseProduction };

export type {
  ResponseProductionInput,
  ResponsePlan,
  UserResponse
};
