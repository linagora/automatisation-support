import {formatCatalogSelection} from "./catalogSelection";

const outputContractForPrompt = buildOutputContractForPrompt();

const responseFormat = {
  type: "json_schema",
  json_schema: {
    name: "support_need_assessment",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["supportNeedAssessment"],
      properties: {
        supportNeedAssessment: {
          type: "object",
          additionalProperties: false,
          required: ["supportNeed", "unclearReason", "reason"],
          properties: {
            supportNeed: {
              enum: formatCatalogSelection.supportNeeds
            },
            unclearReason: {
              anyOf: [
                {
                  enum: formatCatalogSelection.supportNeedUnclearReasons
                },
                {
                  type: "null"
                }
              ]
            },
            reason: {
              type: "string"
            }
          }
        }
      }
    }
  }
} as const;

function buildOutputContractForPrompt(): string {
  return `
Return only valid JSON with this exact top-level shape:

{
  "supportNeedAssessment": {
    "supportNeed": "<accepted_support_need>",
    "unclearReason": null,
    "reason": "<short_grounded_reason>"
  }
}

Accepted supportNeed values:
${formatCatalogSelection.supportNeeds.map((value) => `- "${value}"`).join("\n")}

Accepted unclearReason values:
${formatCatalogSelection.supportNeedUnclearReasons.map((value) => `- "${value}"`).join("\n")}
`.trim();
}

export {
  outputContractForPrompt,
  responseFormat
};
