import {
  buildPlanSupportResponsePrompt
} from "./buildPlanSupportResponsePrompt";
import {
  formatPlanSupportResponseOutput
} from "./formatPlanSupportResponseOutput";
import {
  requestPlanSupportResponse
} from "./requestPlanSupportResponse";

import type {
  FormatPlanSupportResponseOutput,
  PlanSupportResponseInput
} from "./typesPlanSupportResponse.types";

async function planSupportResponse(
  input: PlanSupportResponseInput
): Promise<FormatPlanSupportResponseOutput> {
  const prompt = buildPlanSupportResponsePrompt(input);
  const rawPlanSupportResponse = await requestPlanSupportResponse({
    prompt
  });

  return formatPlanSupportResponseOutput({
    input,
    rawPlanSupportResponse
  });
}

export {
  planSupportResponse
};
