import {
  buildRenderSupportResponsePrompt
} from "./buildRenderSupportResponsePrompt";
import {
  formatRenderSupportResponseOutput
} from "./formatRenderSupportResponseOutput";
import {
  requestRenderSupportResponse
} from "./requestRenderSupportResponse";

import type {
  FormatRenderSupportResponseOutput,
  RenderSupportResponseInput
} from "./typesRenderSupportResponse.types";

async function renderSupportResponse(
  input: RenderSupportResponseInput
): Promise<FormatRenderSupportResponseOutput> {
  const prompt = buildRenderSupportResponsePrompt(input);
  const rawRenderSupportResponse = await requestRenderSupportResponse({
    prompt
  });

  return formatRenderSupportResponseOutput({
    input,
    rawRenderSupportResponse
  });
}

export {
  renderSupportResponse
};
