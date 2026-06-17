import {
  RENDERED_MESSAGE_PURPOSE_VALUES
} from "./renderSupportResponse.taxonomy";

function objectOf(
  properties: Record<string, unknown>,
  required: string[]
): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    properties,
    required
  };
}

function arrayOf(items: Record<string, unknown>): Record<string, unknown> {
  return {
    type: "array",
    items
  };
}

const stringSchema = {
  type: "string"
} as const;

const numberSchema = {
  type: "number"
} as const;

const stringArraySchema = arrayOf(stringSchema);
const numberArraySchema = arrayOf(numberSchema);

const renderedMessageSchema = objectOf(
  {
    messageId: stringSchema,
    messageOrder: numberSchema,
    purpose: {
      enum: RENDERED_MESSAGE_PURPOSE_VALUES
    },
    relatedPlannedMessageOrders: numberArraySchema,
    content: stringSchema
  },
  [
    "messageId",
    "messageOrder",
    "purpose",
    "relatedPlannedMessageOrders",
    "content"
  ]
);

const renderedSupportResponseSchema = objectOf(
  {
    renderedMessages: arrayOf(renderedMessageSchema),
    finalResponseText: stringSchema,
    internalRenderingNotes: stringSchema
  },
  [
    "renderedMessages",
    "finalResponseText",
    "internalRenderingNotes"
  ]
);

const renderSupportResponseResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "render_support_response",
    strict: true,
    schema: renderedSupportResponseSchema
  }
} as const;

export {
  renderSupportResponseResponseFormat,
  renderedSupportResponseSchema
};
