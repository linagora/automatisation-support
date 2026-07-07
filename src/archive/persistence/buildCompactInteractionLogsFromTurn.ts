import type {
  CompactInteractionLog,
  ResponsePlan,
  TurnUnderstandingDelta
} from "../support-processing-pipeline/typesSupportProcessingPipeline.types";

type TopicDelta = TurnUnderstandingDelta["segments_topic"][number];
type TopicDetails = NonNullable<TopicDelta["topic_details"]>;
type TopicResponse =
  NonNullable<ResponsePlan["messagesPlan"]["topicPlanMessages"][number]["topicActions"]>[number];

function sanitizeLogIdPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function formatList(values: string[]): string {
  return values.join(", ");
}

function getTopicLabel(topic: {
  topic_label?: string;
  tool_or_product?: string;
  topic_action?: string;
  topic_object?: string;
}): string {
  if (topic.topic_label && topic.topic_label.trim() !== "") {
    return topic.topic_label.trim();
  }

  const parts = [
    topic.tool_or_product,
    topic.topic_action,
    topic.topic_object
  ].filter((part): part is string => {
    return typeof part === "string" && part.trim() !== "";
  });

  return parts.length > 0 ? parts.join(" : ") : "Sujet support";
}

function getTopicDetailsFields(topicDetails: TopicDetails | undefined): string[] {
  if (typeof topicDetails !== "object" || topicDetails === null) {
    return [];
  }

  return Object.keys(topicDetails).filter((fieldName) => {
    const value = topicDetails[fieldName as keyof TopicDetails];

    if (value === undefined || value === null || value === "") {
      return false;
    }

    return true;
  });
}

function makeLogFactory(params: {
  generatedAt: string;
  sourceEventIds?: string[];
}): (line: string) => CompactInteractionLog {
  let index = 0;

  return (line: string): CompactInteractionLog => {
    index += 1;

    return {
      id: [
        "compact",
        sanitizeLogIdPart(params.generatedAt),
        String(index)
      ].join("_"),
      created_at: params.generatedAt,
      line,
      ...(params.sourceEventIds && params.sourceEventIds.length > 0
        ? { source_event_ids: params.sourceEventIds }
        : {})
    };
  };
}

function buildUserTopicLogs(topic: TopicDelta): string[] {
  const logs: string[] = [];
  const topicLabel = getTopicLabel(topic);
  const detailsFields = getTopicDetailsFields(topic.topic_details);

  if (topic.matched_historical_topic === "no") {
    logs.push(
      `User(topic): add_topic topic_id=${topic.id_topic} label="${topicLabel}" category=${topic.topic_category}`
    );
  }

  if (detailsFields.length > 0) {
    logs.push(
      `User(topic): update_topic topic_id=${topic.id_topic} fields=[${formatList(detailsFields)}]`
    );
  }

  for (const testedAction of topic.tested_actions ?? []) {
    logs.push(
      `User(topic): tested_solution topic_id=${topic.id_topic} action="${testedAction.tested_action}" outcome=${testedAction.outcome_tested_action}`
    );
  }

  if (topic.blocking_issue === "yes") {
    logs.push(`User(topic): mark_blocking topic_id=${topic.id_topic}`);
  } else if (topic.blocking_issue === "no") {
    logs.push(`User(topic): mark_non_blocking topic_id=${topic.id_topic}`);
  }

  return logs;
}

function buildUserSignalLogs(
  turnUnderstandingDelta: TurnUnderstandingDelta
): string[] {
  const logs: string[] = [];

  for (const signal of turnUnderstandingDelta.segments_signal) {
    logs.push(
      `User(signal): signal types=[${formatList(signal.signal_types)}]`
    );
  }

  for (const scopeBoundary of turnUnderstandingDelta.segments_scope_boundary) {
    logs.push(
      `User(scope_boundary): scope_boundary type=${scopeBoundary.scope_boundary_type}`
    );
  }

  for (const suspicious of turnUnderstandingDelta.segments_suspicious) {
    logs.push(
      `User(suspicious): suspicious_segment check=${suspicious.checkName ?? "unknown"}`
    );
  }

  for (const _lackComprehension of
    turnUnderstandingDelta.segments_lack_comprehension) {
    logs.push("User(lack_comprehension): lack_comprehension");
  }

  return logs;
}

function getSolutionIds(topicResponse: TopicResponse): string[] {
  if (topicResponse.main_response.type !== "propose_solution") {
    return [];
  }

  return topicResponse.main_response.details.solutions.map((solution) => {
    return solution.id;
  });
}

function buildBotTopicResponseLogs(topicResponse: TopicResponse): string[] {
  const topicId = topicResponse.topic_id;
  const topicLabel = topicResponse.topic_label;
  const mainResponse = topicResponse.main_response;
  const logs: string[] = [];

  if (mainResponse.type === "ask_fields") {
    logs.push(
      `Bot(topic): ask_more_info topic_id=${topicId} label="${topicLabel}" fields=[${formatList(mainResponse.details.fields_requested)}]`
    );
  } else if (mainResponse.type === "propose_solution") {
    logs.push(
      `Bot(topic): propose_solution topic_id=${topicId} solution_ids=[${formatList(getSolutionIds(topicResponse))}]`
    );
  } else {
    logs.push(
      `Bot(topic): acknowledge topic_id=${topicId} next_step=${topicResponse.next_step}`
    );
  }

  logs.push(`Bot(topic): ${topicResponse.next_step} topic_id=${topicId}`);

  return logs;
}

function buildBotLogs(responsePlan: ResponsePlan): string[] {
  const logs: string[] = [];

  for (const topicPlanMessage of responsePlan.messagesPlan.topicPlanMessages) {
    for (const topicAction of topicPlanMessage.topicActions ?? []) {
      logs.push(...buildBotTopicResponseLogs(topicAction));
    }

    for (const topicResponseWrapper of topicPlanMessage.topics_responses ?? []) {
      const topicResponse = topicResponseWrapper.topic_response;
      logs.push(...buildBotTopicResponseLogs({
        topic_id: topicResponse.title.topic_id,
        topic_label: getTopicLabel(topicResponse.title),
        main_response: topicResponse.main_response,
        next_step: topicResponse.next_step
      }));
    }
  }

  if (responsePlan.messagesPlan.handoverPlanMessages.length > 0) {
    logs.push("Bot(handover): handover_announced reason=handover_plan");
  }

  return logs;
}

function buildCompactInteractionLogsFromTurn(params: {
  turnUnderstandingDelta: TurnUnderstandingDelta;
  responsePlan: ResponsePlan;
  generatedAt: string;
  sourceEventIds?: string[];
}): CompactInteractionLog[] {
  const makeLog = makeLogFactory({
    generatedAt: params.generatedAt,
    sourceEventIds: params.sourceEventIds
  });
  const lines = [
    ...params.turnUnderstandingDelta.segments_topic.flatMap(buildUserTopicLogs),
    ...buildUserSignalLogs(params.turnUnderstandingDelta),
    ...buildBotLogs(params.responsePlan)
  ];

  return lines.map(makeLog);
}

export {
  buildCompactInteractionLogsFromTurn
};
