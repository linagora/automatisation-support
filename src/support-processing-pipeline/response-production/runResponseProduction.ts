import { dataBaseResponse } from "./dataBaseResponse";
import { transformPlanToStringPlan } from "./transformPlanToStringPlan";
import { transformStringPlanToMessages } from "./transformStringPlanToMessages";

import type { ResponsePlan } from "../response-plan/typesResponsePlan.types";
import type { UserResponse } from "./transformStringPlanToMessages";

type ResponseProductionInput = {
  responsePlan: ResponsePlan;
};

function runResponseProduction(
  responseProductionInput: ResponseProductionInput
): UserResponse {
  const { responsePlan } = responseProductionInput;

  const stringResponsePlan = transformPlanToStringPlan(
    responsePlan,
    dataBaseResponse
  );

  return transformStringPlanToMessages(stringResponsePlan);
}

export { runResponseProduction };

export type {
  ResponseProductionInput,
  ResponsePlan,
  UserResponse
};
