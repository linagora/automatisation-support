import {
  buildComposeSupportResponsePlanPrompt
} from "./buildComposeSupportResponsePlanPrompt";
import {
  formatComposeSupportResponsePlanOutput
} from "./formatComposeSupportResponsePlanOutput";
import {
  requestComposeSupportResponsePlan
} from "./requestComposeSupportResponsePlan";

import type {
  ComposeSupportResponsePlanInput,
  FormatComposeSupportResponsePlanOutput
} from "./typesComposeSupportResponsePlan.types";

async function composeSupportResponsePlan(
  input: ComposeSupportResponsePlanInput
): Promise<FormatComposeSupportResponsePlanOutput> {
  const prompt = buildComposeSupportResponsePlanPrompt(input);
  const rawComposeSupportResponsePlan = await requestComposeSupportResponsePlan({
    prompt
  });

  return formatComposeSupportResponsePlanOutput({
    input,
    rawComposeSupportResponsePlan
  });
}

export {
  composeSupportResponsePlan
};
