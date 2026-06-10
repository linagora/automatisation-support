import { addTopicMainResponse } from "./addTopicMainResponse";

import type {
  ResponseQuestion,
  ResponsePlanTopicAction,
  TopicMainResponse,
  TopicNextStep,
  TopicPlanInput,
  TopicPlanMessage,
  TopicSegment
} from "./typesResponsePlan.types";

type TopicIdentity = {
  id_topic: number;
  topic_label?: string;
  tool_or_product?: string;
  topic_action?: string;
  topic_object?: string;
};

const FIELD_QUESTION_WORDING: Record<string, string> = {
  platform: "la plateforme utilisée",
  browser: "le navigateur utilisé",
  os: "le système d’exploitation",
  trigger_action:
    "si cela arrive après une action précise ou de manière aléatoire",
  frequency: "si cela arrive à chaque fois ou seulement parfois",
  error_message: "le message d’erreur affiché",
  observed_result: "ce qui se produit réellement",
  expected_result: "ce que vous attendiez",
  affected_scope: "le périmètre concerné",
  account_context: "le compte ou profil concerné"
};

const ENGLISH_FIELD_QUESTION_WORDING: Record<string, string> = {
  platform: "the platform used",
  browser: "the browser used",
  os: "the operating system",
  trigger_action: "whether it happens after a specific action or randomly",
  frequency: "whether the issue happens every time or only sometimes",
  error_message: "the displayed error message",
  observed_result: "what actually happens",
  expected_result: "what you expected",
  affected_scope: "the affected scope",
  account_context: "the account or profile concerned"
};

function resolveNextStep(mainResponse: TopicMainResponse): TopicNextStep {
  if (mainResponse.type === "ask_fields") {
    return "wait_more_info";
  }

  if (mainResponse.type === "propose_solution") {
    return "wait_apply_solution";
  }

  return "wait_for_support";
}

function findHistoricalTopic(
  topicPlanInput: TopicPlanInput,
  idTopic: number
): TopicPlanInput["supportTopicKnowledge"]["segments_topic"][number] | undefined {
  return topicPlanInput.supportTopicKnowledge.segments_topic.find((topic) => {
    return topic.id_topic === idTopic;
  });
}

function getStringValue(
  source: Record<string, unknown> | undefined,
  key: string
): string | undefined {
  const value = source?.[key];

  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : undefined;
}

function getTopicLabel(topic: TopicIdentity): string {
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

  return parts.length > 0 ? parts.join(" ") : "demande support";
}

function containsAny(value: string, words: string[]): boolean {
  const normalizedValue = value.toLowerCase();

  return words.some((word) => normalizedValue.includes(word));
}

function quoteKnownNames(value: string): string {
  return value.replace(/\bMy Vault\b/g, "\"My Vault\"");
}

function normalizeDisplayPart(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .trim();
}

function truncateFallback(value: string): string {
  const normalizedValue = normalizeDisplayPart(value);

  if (normalizedValue.length <= 80) {
    return quoteKnownNames(normalizedValue);
  }

  const truncated = normalizedValue.slice(0, 77);
  const lastSpaceIndex = truncated.lastIndexOf(" ");
  const cleanTruncated = lastSpaceIndex > 40
    ? truncated.slice(0, lastSpaceIndex)
    : truncated;

  return `${quoteKnownNames(cleanTruncated)}...`;
}

function translateFrenchAction(value: string): string {
  const normalizedValue = value.toLowerCase();
  const translations: Record<string, string> = {
    receive: "recevoir",
    send: "envoyer",
    display: "afficher",
    show: "afficher",
    create: "créer",
    access: "accéder",
    use: "utiliser",
    open: "ouvrir"
  };

  return translations[normalizedValue] ?? value;
}

function translateFrenchObject(value: string): string {
  const normalizedValue = value.toLowerCase();
  const translations: Record<string, string> = {
    attachment: "pièce jointe",
    attachments: "pièces jointes",
    notifications: "notifications",
    events: "événements",
    calendar: "agenda",
    "dark theme": "thème sombre",
    "save button": "bouton Enregistrer",
    "save buttons": "boutons Enregistrer",
    application: "application",
    "my vault shortcut": "raccourci My Vault"
  };

  return translations[normalizedValue] ?? value;
}

function translateFrenchProduct(value: string): string {
  const normalizedValue = value.toLowerCase();

  if (normalizedValue === "calendar") {
    return "agenda";
  }

  return value;
}

function buildSearchableTopicText(
  topicSegment: TopicSegment,
  details: Record<string, unknown> | undefined
): string {
  return [
    topicSegment.tool_or_product,
    topicSegment.topic_action,
    topicSegment.topic_object,
    getStringValue(details, "feature_or_page"),
    getStringValue(details, "observed_result"),
    getStringValue(details, "additional_context"),
    ...(topicSegment.segment_verbatims ?? [])
  ].filter((value): value is string => {
    return typeof value === "string" && value.trim() !== "";
  }).join(" ");
}

function buildFrenchNaturalTopicLabel(
  topicSegment: TopicSegment,
  details: Record<string, unknown> | undefined
): string | undefined {
  const searchableText = buildSearchableTopicText(topicSegment, details);

  if (
    containsAny(searchableText, ["notification"]) &&
    containsAny(searchableText, ["late", "delay", "retard"])
  ) {
    return "notifications Twake en retard";
  }

  if (
    containsAny(searchableText, ["attachment", "pièce jointe"]) &&
    containsAny(searchableText, ["send", "upload", "blocked", "bloqué", "stuck"])
  ) {
    return "envoi de pièce jointe bloqué";
  }

  if (
    containsAny(searchableText, ["calendar", "agenda", "event", "événement"]) &&
    containsAny(searchableText, ["duplicate", "twice", "double"])
  ) {
    return "événements d’agenda affichés en double";
  }

  if (
    containsAny(searchableText, ["my vault", "shortcut", "raccourci"]) &&
    containsAny(searchableText, ["close", "crash", "ferme", "fermeture"]) &&
    containsAny(searchableText, ["does not work", "fonctionne plus", "not work"])
  ) {
    return "le raccourci \"My Vault\", qui ne fonctionne plus et peut provoquer une fermeture";
  }

  if (
    containsAny(searchableText, ["dark theme", "thème sombre"]) &&
    containsAny(searchableText, ["save", "enregistrer", "unreadable", "illisible", "difficult", "difficile"])
  ) {
    return "le thème sombre, avec un bouton \"Enregistrer\" difficile à lire";
  }

  if (
    containsAny(searchableText, ["application", "app"]) &&
    containsAny(searchableText, ["close", "crash", "ferme", "fermeture"])
  ) {
    return "des fermetures inattendues de l’application";
  }

  return undefined;
}

function buildTopicDisplayLabelForUser(
  topicSegment: TopicSegment,
  responseLanguage: string
): string {
  const details = topicSegment.topic_details;

  if (responseLanguage === "french") {
    const naturalFrenchLabel = buildFrenchNaturalTopicLabel(
      topicSegment,
      details
    );

    if (naturalFrenchLabel) {
      return naturalFrenchLabel;
    }
  }

  const product = topicSegment.tool_or_product;
  const action = topicSegment.topic_action;
  const object = topicSegment.topic_object;
  const parts = [
    product
      ? responseLanguage === "french"
        ? translateFrenchProduct(product)
        : product
      : undefined,
    action
      ? responseLanguage === "french"
        ? translateFrenchAction(action)
        : action
      : undefined,
    object
      ? responseLanguage === "french"
        ? translateFrenchObject(object)
        : object
      : undefined
  ].flatMap((part) => {
    if (typeof part !== "string" || part.trim() === "") {
      return [];
    }

    return [normalizeDisplayPart(part)];
  });

  if (parts.length > 0) {
    return quoteKnownNames(parts.join(" "));
  }

  const observedResult = getStringValue(details, "observed_result");

  if (observedResult) {
    return truncateFallback(observedResult);
  }

  const firstSegmentVerbatim = topicSegment.segment_verbatims?.find(
    (segmentVerbatim) => segmentVerbatim.trim() !== ""
  );

  if (firstSegmentVerbatim) {
    return truncateFallback(firstSegmentVerbatim);
  }

  return quoteKnownNames(getTopicLabel(topicSegment));
}

function describeTopic(
  topicSegment: TopicSegment,
  responseLanguage: string
): string {
  return buildTopicDisplayLabelForUser(topicSegment, responseLanguage);
}

function hasInferableField(topicSegment: TopicSegment, field: string): boolean {
  const details = topicSegment.topic_details;

  if (!details || typeof details !== "object") {
    return false;
  }

  const directValue = details[field as keyof typeof details];

  if (typeof directValue === "string" && directValue.trim() !== "") {
    return true;
  }

  if (field !== "expected_result") {
    return false;
  }

  const userGoal = topicSegment.user_goal;
  const featureOrPage = getStringValue(details, "feature_or_page");
  const additionalContext = getStringValue(details, "additional_context");
  const searchableText = [
    userGoal,
    featureOrPage,
    additionalContext,
    ...(topicSegment.segment_verbatims ?? [])
  ].filter((value): value is string => {
    return typeof value === "string" && value.trim() !== "";
  }).join(" ").toLowerCase();

  return (
    searchableText.includes("accéder") ||
    searchableText.includes("access") ||
    searchableText.includes("rapidement") ||
    searchableText.includes("quickly")
  );
}

function getFieldsRequested(mainResponse: TopicMainResponse): string[] {
  if (mainResponse.type !== "ask_fields") {
    return [];
  }

  return mainResponse.details.fields_requested;
}

function formatQuestionWording(params: {
  field: string;
  topicSegment?: TopicSegment;
  topicCount: number;
  responseLanguage: string;
}): string {
  const {
    field,
    topicSegment,
    topicCount,
    responseLanguage
  } = params;
  const wordingByField = responseLanguage === "french"
    ? FIELD_QUESTION_WORDING
    : ENGLISH_FIELD_QUESTION_WORDING;
  const base = wordingByField[field] ?? field.replaceAll("_", " ");
  const searchableTopicText = [
    topicSegment?.tool_or_product,
    topicSegment?.topic_action,
    topicSegment?.topic_object,
    getStringValue(topicSegment?.topic_details, "feature_or_page"),
    getStringValue(topicSegment?.topic_details, "observed_result"),
    getStringValue(topicSegment?.topic_details, "additional_context"),
    ...(topicSegment?.segment_verbatims ?? [])
  ].filter((value): value is string => {
    return typeof value === "string" && value.trim() !== "";
  }).join(" ");

  if (field === "platform" && topicCount > 1 && responseLanguage === "french") {
    return `${base} pour ces problèmes`;
  }

  if (field === "platform" && topicCount > 1) {
    return `${base} for these issues`;
  }

  if (field === "trigger_action" && responseLanguage === "french") {
    if (containsAny(searchableTopicText, ["close", "crash", "ferme", "fermeture"])) {
      return "si les fermetures arrivent après une action précise ou de manière aléatoire";
    }

    return "si cela arrive après une action précise ou de manière aléatoire";
  }

  if (field === "frequency" && responseLanguage === "french") {
    if (containsAny(searchableTopicText, ["my vault", "shortcut", "raccourci"])) {
      return "si le raccourci \"My Vault\" ferme l’application à chaque appui";
    }

    return "si le problème se produit à chaque fois ou seulement parfois";
  }

  return base;
}

function buildQuestions(
  topicSegments: TopicSegment[],
  topicActions: ResponsePlanTopicAction[],
  responseLanguage: string
): {
  common: ResponseQuestion[];
  specific: ResponseQuestion[];
} {
  const fieldToTopicIds = new Map<string, number[]>();

  for (const topicAction of topicActions) {
    const topicSegment = topicSegments.find((segment) => {
      return segment.id_topic === topicAction.topic_id;
    });

    for (const field of getFieldsRequested(topicAction.main_response)) {
      if (topicSegment && hasInferableField(topicSegment, field)) {
        continue;
      }

      const topicIds = fieldToTopicIds.get(field) ?? [];
      topicIds.push(topicAction.topic_id);
      fieldToTopicIds.set(field, topicIds);
    }
  }

  const common: ResponseQuestion[] = [];
  const specific: ResponseQuestion[] = [];

  for (const [field, topicIds] of fieldToTopicIds.entries()) {
    const firstTopicSegment = topicSegments.find((topicSegment) => {
      return topicSegment.id_topic === topicIds[0];
    });
    const question: ResponseQuestion = {
      wording: formatQuestionWording({
        field,
        topicSegment: firstTopicSegment,
        topicCount: topicIds.length,
        responseLanguage
      }),
      fields: [field],
      ...(topicIds.length > 1
        ? { appliesToTopicIds: topicIds }
        : { topicIds })
    };

    if (topicIds.length > 1) {
      common.push(question);
    } else {
      specific.push(question);
    }
  }

  return {
    common,
    specific
  };
}

function addTopicPlanMessage(
  topicPlanInput: TopicPlanInput
): TopicPlanMessage[] {
  const {
    turnUnderstandingDelta,
    possibleSolutions,
    decisionSearchingSolution
  } = topicPlanInput;
  const topicSegments = turnUnderstandingDelta.segments_topic;

  if (topicSegments.length === 0) {
    return [];
  }

  const topicActions = topicSegments.map((topicSegment) => {
    const historicalTopic =
      topicSegment.matched_historical_topic === "yes"
        ? findHistoricalTopic(topicPlanInput, topicSegment.id_topic)
        : undefined;
    const topicIdentity = {
      ...historicalTopic,
      ...topicSegment
    };
    const mainResponse = addTopicMainResponse({
      topicSegment,
      possibleSolutions,
      decisionSearchingSolution
    });

    return {
      topic_id: topicSegment.id_topic,
      topic_label: getTopicLabel(topicIdentity),
      main_response: mainResponse,
      next_step: resolveNextStep(mainResponse)
    };
  });

  return [{
    topicActions,
    topics_responses: []
  }];
}

export {
  addTopicPlanMessage,
  buildTopicDisplayLabelForUser,
  buildQuestions,
  describeTopic,
  getTopicLabel
};
