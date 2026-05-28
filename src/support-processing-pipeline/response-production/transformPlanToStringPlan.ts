import { transformPlanMessagesToStringMessages } from "./transformPlanMessagesToString";

import type { ResponsePlan } from "../response-plan/typesResponsePlan.types";
import type { ResponseLanguage } from "./dataBaseResponse";
import type { StringMessagesPlan } from "./transformPlanMessagesToString";

type PlanToStringPlanInput = {
  responsePlan: ResponsePlan;
};

type StringResponsePlan = {
  responseLanguage: string;
  messagesPlan: StringMessagesPlan;
};

function resolveTemplateLanguage(responseLanguage: string): ResponseLanguage {
  if (responseLanguage === "french" || responseLanguage === "english") {
    return responseLanguage;
  }

  return "english";
}

function transformPlanToStringPlan(
  planToStringPlanInput: PlanToStringPlanInput
): StringResponsePlan {
  const { responsePlan } = planToStringPlanInput;
  const userLanguage = resolveTemplateLanguage(responsePlan.responseLanguage);

  const stringResponsePlan: StringResponsePlan = {
    responseLanguage: responsePlan.responseLanguage,
    messagesPlan: transformPlanMessagesToStringMessages(
      userLanguage,
      responsePlan.messagesPlan
    )
  };

  return stringResponsePlan;
}

export { transformPlanToStringPlan };
export type { PlanToStringPlanInput, StringResponsePlan };
