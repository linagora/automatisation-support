type TopicDisplayLabelInput = {
  topic_label?: string;
  tool_or_product?: string;
  topic_action?: string;
  topic_object?: string;
};

function nonEmpty(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function buildTopicDisplayLabel(topic: TopicDisplayLabelInput): string {
  const structuredParts = [
    topic.tool_or_product,
    topic.topic_action,
    topic.topic_object
  ];

  if (structuredParts.every(nonEmpty)) {
    return structuredParts.map((part) => {
      return part.trim();
    }).join(" : ");
  }

  if (nonEmpty(topic.topic_label)) {
    return topic.topic_label.trim();
  }

  return "Sujet support";
}

export {
  buildTopicDisplayLabel
};

export type {
  TopicDisplayLabelInput
};
