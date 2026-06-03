/**
 * Turn Understanding Delta Assembly
 *
 * Builds the final TurnUnderstandingDelta returned by runMessageAnalysis.
 *
 * This block receives:
 * - supportTopicKnowledge
 * - fullWeightMessageAnalysisOutput?
 * - lightWeightMessageAnalysis?
 *
 * It returns only the useful information delta:
 * - new topics are kept as-is
 * - matched historical topics are cleaned against supportTopicKnowledge
 * - duplicated fields are removed
 * - lightweight analysis is copied as lightweight delta
 */

import type {
  AttachmentAnalysisItem,
  LatestUserAttachment,
  SupportTopicKnowledge,
  TurnAttachmentKind,
  TurnAttachmentReference,
  TurnAttachments,
  TurnUnderstandingDelta
} from "../../typesSupportProcessingPipeline.types";

import type {
  MessageAnalysisOutput,
  TurnUnderstandingDeltaInput
} from "../typesMessageAnalysis.types";

type AnalysisSource = "full" | "light" | undefined;

type TopicSegment = TurnUnderstandingDelta["segments_topic"][number];
type ExistingTopic = SupportTopicKnowledge["segments_topic"][number];
type TopicDetails = ExistingTopic["topic_details"];
type TestedAction = NonNullable<ExistingTopic["tested_actions"]>[number];

type Counter = {
  value: number;
};

type UnknownRecord = Record<string, unknown>;

function emptyTurnUnderstandingDelta(): TurnUnderstandingDelta {
  return {
    user_language: "Unknown",
    segments_lack_comprehension: [],
    segments_topic: [],
    segments_signal: [],
    segments_scope_boundary: [],
    segments_suspicious: []
  };
}

function normalizeSecurityGateSummary(
  securityGateSummary: TurnUnderstandingDeltaInput["securityGateSummary"]
): NonNullable<TurnUnderstandingDelta["securityGateSummary"]> {
  return {
    gateChecked: securityGateSummary.gateChecked,
    gateFailed: Object.values(securityGateSummary.gateFailed)
  };
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isYesNo(value: unknown): value is "yes" | "no" {
  return value === "yes" || value === "no";
}

function normalizeAttachmentFormatValue(
  value: string | undefined
): string | undefined {
  return typeof value === "string" ? value.trim().toLowerCase() : undefined;
}

function startsWithFormat(
  value: string | undefined,
  format: "image" | "video"
): boolean {
  const normalizedValue = normalizeAttachmentFormatValue(value);

  return (
    normalizedValue === format ||
    normalizedValue?.startsWith(`${format}/`) === true
  );
}

function hasKeys(value: object): boolean {
  return Object.keys(value).length > 0;
}

function findAttachmentAnalysisItem(
  attachmentAnalysis: AttachmentAnalysisItem[],
  attachmentIndex: number
): AttachmentAnalysisItem | undefined {
  return (
    attachmentAnalysis.find((analysisItem) => {
      return analysisItem.attachmentIndex === attachmentIndex;
    }) ?? attachmentAnalysis[attachmentIndex - 1]
  );
}

function classifyAttachmentWithAnalysis(
  attachment: LatestUserAttachment,
  analysis: AttachmentAnalysisItem
): TurnAttachmentKind {
  const detectedFormat = analysis.readinessDecision?.history.detectedFormat;

  if (
    detectedFormat === "image" ||
    startsWithFormat(attachment.mimeType, "image") ||
    startsWithFormat(attachment.type, "image") ||
    startsWithFormat(analysis.mimeType, "image") ||
    startsWithFormat(analysis.type, "image")
  ) {
    return "image";
  }

  if (
    detectedFormat === "video" ||
    startsWithFormat(attachment.mimeType, "video") ||
    startsWithFormat(attachment.type, "video") ||
    startsWithFormat(analysis.mimeType, "video") ||
    startsWithFormat(analysis.type, "video")
  ) {
    return "video";
  }

  return "other";
}

function getAttachmentBucket(kind: TurnAttachmentKind): keyof TurnAttachments {
  if (kind === "image") {
    return "images";
  }

  if (kind === "video") {
    return "videos";
  }

  return "other";
}

function isSafeShortAccessUrl(value: string | undefined): value is string {
  if (!isNonEmptyString(value)) {
    return false;
  }

  const trimmedValue = value.trim();

  return !trimmedValue.startsWith("data:") && trimmedValue.length <= 2048;
}

function buildTurnAttachmentReference(
  attachment: LatestUserAttachment,
  analysis: AttachmentAnalysisItem,
  kind: TurnAttachmentKind
): TurnAttachmentReference {
  const reference: TurnAttachmentReference = {
    id: attachment.id,
    kind,
    filename: attachment.filename ?? analysis.filename,
    mimeType: attachment.mimeType ?? attachment.type ?? analysis.mimeType ??
      analysis.type,
    sizeInBytes: attachment.sizeInBytes ?? attachment.sizeBytes ??
      analysis.sizeBytes,
    status: analysis.status,
    reason: analysis.reason
  };

  if (isSafeShortAccessUrl(attachment.accessUrl)) {
    reference.accessUrl = attachment.accessUrl.trim();
  }

  if (analysis.analysis) {
    reference.analysis = {
      llmDescription: analysis.analysis.llmDescription,
      structuredObservations: analysis.analysis.structuredObservations
    };
  }

  return reference;
}

function buildTurnAttachments(
  latestUserAttachments: LatestUserAttachment[] | undefined,
  attachmentAnalysis: AttachmentAnalysisItem[] | undefined
): TurnAttachments | undefined {
  if (
    latestUserAttachments === undefined ||
    latestUserAttachments.length === 0 ||
    attachmentAnalysis === undefined ||
    attachmentAnalysis.length === 0
  ) {
    return undefined;
  }

  const attachments: TurnAttachments = {
    images: [],
    videos: [],
    other: []
  };

  latestUserAttachments.forEach((attachment, arrayIndex) => {
    const analysis = findAttachmentAnalysisItem(
      attachmentAnalysis,
      arrayIndex + 1
    );

    if (analysis === undefined) {
      return;
    }

    const kind = classifyAttachmentWithAnalysis(attachment, analysis);
    const category = getAttachmentBucket(kind);

    attachments[category].push(
      buildTurnAttachmentReference(attachment, analysis, kind)
    );
  });

  if (
    attachments.images.length === 0 &&
    attachments.videos.length === 0 &&
    attachments.other.length === 0
  ) {
    return undefined;
  }

  return attachments;
}

function getFullWeightAnalysis(
  input: TurnUnderstandingDeltaInput
): Partial<TurnUnderstandingDelta> | undefined {
  if (!("fullWeightMessageAnalysisOutput" in input)) {
    return undefined;
  }

  const output = input.fullWeightMessageAnalysisOutput;

  if (
    !output ||
    output.decision.route !== "continue" ||
    !output.analysis
  ) {
    return undefined;
  }

  return output.analysis;
}

function getLightWeightAnalysis(
  input: TurnUnderstandingDeltaInput
): Partial<TurnUnderstandingDelta> | undefined {
  if (!("lightWeightMessageAnalysis" in input)) {
    return undefined;
  }

  return input.lightWeightMessageAnalysis;
}

function setUserLanguage(
  output: TurnUnderstandingDelta,
  analysis: Partial<TurnUnderstandingDelta>
): void {
  if (isNonEmptyString(analysis.user_language)) {
    output.user_language = analysis.user_language;
  }
}

function copyLightWeightSegments(
  output: TurnUnderstandingDelta,
  analysis: Partial<TurnUnderstandingDelta>
): void {
  if (
    Array.isArray(analysis.segments_signal) &&
    analysis.segments_signal.length > 0
  ) {
    output.segments_signal = analysis.segments_signal;
  }

  if (
    Array.isArray(analysis.segments_scope_boundary) &&
    analysis.segments_scope_boundary.length > 0
  ) {
    output.segments_scope_boundary = analysis.segments_scope_boundary;
  }

  if (
    Array.isArray(analysis.segments_suspicious) &&
    analysis.segments_suspicious.length > 0
  ) {
    output.segments_suspicious = analysis.segments_suspicious;
  }
}

function copyFullWeightNonTopicSegments(
  output: TurnUnderstandingDelta,
  analysis: Partial<TurnUnderstandingDelta>
): void {
  if (
    Array.isArray(analysis.segments_lack_comprehension) &&
    analysis.segments_lack_comprehension.length > 0
  ) {
    output.segments_lack_comprehension =
      analysis.segments_lack_comprehension;
  }

  if (
    Array.isArray(analysis.segments_signal) &&
    analysis.segments_signal.length > 0
  ) {
    output.segments_signal = analysis.segments_signal;
  }

  if (
    Array.isArray(analysis.segments_scope_boundary) &&
    analysis.segments_scope_boundary.length > 0
  ) {
    output.segments_scope_boundary =
      analysis.segments_scope_boundary;
  }

  if (
    Array.isArray(analysis.segments_suspicious) &&
    analysis.segments_suspicious.length > 0
  ) {
    output.segments_suspicious =
      analysis.segments_suspicious;
  }
}

function findExistingTopic(
  supportTopicKnowledge: SupportTopicKnowledge,
  idTopic: number
): ExistingTopic | undefined {
  return supportTopicKnowledge.segments_topic.find((topic) => {
    return topic.id_topic === idTopic;
  });
}

function valuesAreExactlyEqual(
  firstValue: unknown,
  secondValue: unknown
): boolean {
  if (firstValue === secondValue) {
    return true;
  }

  if (
    typeof firstValue === "string" &&
    typeof secondValue === "string"
  ) {
    return firstValue === secondValue;
  }

  try {
    return JSON.stringify(firstValue) === JSON.stringify(secondValue);
  } catch {
    return false;
  }
}

function cleanTopicDetailsDelta(
  returnedTopicDetails: unknown,
  existingTopicDetails: TopicDetails,
  numberOfCleanedFields: Counter
): Partial<TopicDetails> {
  if (!isRecord(returnedTopicDetails)) {
    return {};
  }

  const cleanedTopicDetails: Partial<TopicDetails> = {};

  for (const [fieldName, returnedValue] of Object.entries(returnedTopicDetails)) {
    if (
      returnedValue === undefined ||
      returnedValue === null ||
      returnedValue === ""
    ) {
      continue;
    }

    const existingValue =
      existingTopicDetails[fieldName as keyof TopicDetails];

    if (existingValue === undefined || existingValue === "") {
      (cleanedTopicDetails as UnknownRecord)[fieldName] = returnedValue;
      continue;
    }

    if (valuesAreExactlyEqual(returnedValue, existingValue)) {
      numberOfCleanedFields.value += 1;
      continue;
    }

    (cleanedTopicDetails as UnknownRecord)[fieldName] = returnedValue;
  }

  return cleanedTopicDetails;
}

function isSameTestedAction(
  firstAction: TestedAction,
  secondAction: TestedAction
): boolean {
  return (
    firstAction.tested_action === secondAction.tested_action &&
    firstAction.outcome_tested_action === secondAction.outcome_tested_action
  );
}

function cleanTestedActionsDelta(
  returnedTestedActions: unknown,
  existingTestedActions: TestedAction[] | undefined,
  numberOfCleanedFields: Counter
): TestedAction[] {
  if (!Array.isArray(returnedTestedActions)) {
    return [];
  }

  const cleanedTestedActions: TestedAction[] = [];
  const existingActions = existingTestedActions ?? [];

  for (const returnedAction of returnedTestedActions) {
    if (!isRecord(returnedAction)) {
      continue;
    }

    if (
      !isNonEmptyString(returnedAction.tested_action) ||
      !isNonEmptyString(returnedAction.outcome_tested_action)
    ) {
      continue;
    }

    const candidate = {
      tested_action: returnedAction.tested_action,
      outcome_tested_action: returnedAction.outcome_tested_action
    } as TestedAction;

    const alreadyExists = existingActions.some((existingAction) => {
      return isSameTestedAction(candidate, existingAction);
    });

    if (alreadyExists) {
      numberOfCleanedFields.value += 1;
      continue;
    }

    cleanedTestedActions.push(candidate);
  }

  return cleanedTestedActions;
}

function shouldKeepUserGoal(
  returnedUserGoal: unknown,
  existingUserGoal: string | undefined,
  numberOfCleanedFields: Counter
): returnedUserGoal is string {
  if (!isNonEmptyString(returnedUserGoal)) {
    return false;
  }

  if (!existingUserGoal) {
    return true;
  }

  const minimumExpectedLength = Math.floor(existingUserGoal.length * 0.8);

  if (returnedUserGoal.length >= minimumExpectedLength) {
    return true;
  }

  numberOfCleanedFields.value += 1;
  return false;
}

function buildMinimalMatchedTopicForReview(
  topicSegment: TopicSegment
): TopicSegment {
  const topicRecord = topicSegment as UnknownRecord;

  const cleanedTopic: UnknownRecord = {
    matched_historical_topic: "yes",
    id_topic: topicSegment.id_topic
  };

  if (isRecord(topicRecord.topic_details)) {
    cleanedTopic.topic_details = topicRecord.topic_details;
  }

  if (Array.isArray(topicRecord.tested_actions)) {
    cleanedTopic.tested_actions = topicRecord.tested_actions;
  }

  if (isNonEmptyString(topicRecord.user_goal)) {
    cleanedTopic.user_goal = topicRecord.user_goal;
  }

  if (isYesNo(topicRecord.blocking_issue)) {
    cleanedTopic.blocking_issue = topicRecord.blocking_issue;
  }

  return cleanedTopic as TopicSegment;
}

function cleanedMatchedTopicHasUsefulDelta(
  cleanedTopicDelta: UnknownRecord
): boolean {
  if (
    isRecord(cleanedTopicDelta.topic_details) &&
    hasKeys(cleanedTopicDelta.topic_details)
  ) {
    return true;
  }

  if (
    Array.isArray(cleanedTopicDelta.tested_actions) &&
    cleanedTopicDelta.tested_actions.length > 0
  ) {
    return true;
  }

  if (isNonEmptyString(cleanedTopicDelta.user_goal)) {
    return true;
  }

  if (isYesNo(cleanedTopicDelta.blocking_issue)) {
    return true;
  }

  return false;
}

function cleanMatchedHistoricalTopic(
  topicSegment: TopicSegment,
  existingTopic: ExistingTopic,
  numberOfCleanedFields: Counter
): TopicSegment | null {
  const topicRecord = topicSegment as UnknownRecord;

  const cleanedTopicDelta: UnknownRecord = {
    matched_historical_topic: "yes",
    id_topic: topicSegment.id_topic
  };

  const cleanedTopicDetails = cleanTopicDetailsDelta(
    topicRecord.topic_details,
    existingTopic.topic_details,
    numberOfCleanedFields
  );

  if (hasKeys(cleanedTopicDetails)) {
    cleanedTopicDelta.topic_details = cleanedTopicDetails;
  }

  const cleanedTestedActions = cleanTestedActionsDelta(
    topicRecord.tested_actions,
    existingTopic.tested_actions,
    numberOfCleanedFields
  );

  if (cleanedTestedActions.length > 0) {
    cleanedTopicDelta.tested_actions = cleanedTestedActions;
  }

  if (
    shouldKeepUserGoal(
      topicRecord.user_goal,
      existingTopic.user_goal,
      numberOfCleanedFields
    )
  ) {
    cleanedTopicDelta.user_goal = topicRecord.user_goal;
  }

  if (isYesNo(topicRecord.blocking_issue)) {
    cleanedTopicDelta.blocking_issue = topicRecord.blocking_issue;
  }

  if (!cleanedMatchedTopicHasUsefulDelta(cleanedTopicDelta)) {
    numberOfCleanedFields.value += 1;
    return null;
  }

  return cleanedTopicDelta as TopicSegment;
}

function processFullWeightTopicSegments(
  output: TurnUnderstandingDelta,
  analysis: Partial<TurnUnderstandingDelta>,
  supportTopicKnowledge: SupportTopicKnowledge,
  numberOfCleanedFields: Counter
): void {
  if (
    !Array.isArray(analysis.segments_topic) ||
    analysis.segments_topic.length === 0
  ) {
    return;
  }

  for (const topicSegment of analysis.segments_topic) {
    if (topicSegment.matched_historical_topic === "no") {
      output.segments_topic.push(topicSegment);
      continue;
    }

    const existingTopic = findExistingTopic(
      supportTopicKnowledge,
      topicSegment.id_topic
    );

    if (!existingTopic) {
      output.segments_topic.push(
        buildMinimalMatchedTopicForReview(topicSegment)
      );
      continue;
    }

    const cleanedTopicDelta = cleanMatchedHistoricalTopic(
      topicSegment,
      existingTopic,
      numberOfCleanedFields
    );

    if (cleanedTopicDelta) {
      output.segments_topic.push(cleanedTopicDelta);
    }
  }
}

function finalizeOutput(
  output: TurnUnderstandingDelta,
  numberOfCleanedFields: Counter
): MessageAnalysisOutput {
  void numberOfCleanedFields;
  return output;
}

function assembleTurnUnderstandingDelta(
  input: TurnUnderstandingDeltaInput
): MessageAnalysisOutput {
  const turnUnderstandingDelta = emptyTurnUnderstandingDelta();
  turnUnderstandingDelta.securityGateSummary = normalizeSecurityGateSummary(
    input.securityGateSummary
  );

  const attachments = buildTurnAttachments(
    input.latestUserAttachments,
    input.attachmentAnalysis
  );

  if (attachments !== undefined) {
    turnUnderstandingDelta.attachments = attachments;
  }

  let analysisSource: AnalysisSource = undefined;

  const fullWeightAnalysis = getFullWeightAnalysis(input);
  const lightWeightAnalysis = getLightWeightAnalysis(input);

  const numberOfCleanedFields: Counter = {
    value: 0
  };

  if (!fullWeightAnalysis && !lightWeightAnalysis) {
    return finalizeOutput(
      turnUnderstandingDelta,
      numberOfCleanedFields
    );
  }

  if (fullWeightAnalysis) {
    analysisSource = "full";
  } else {
    analysisSource = "light";
  }

  if (analysisSource === "full" && fullWeightAnalysis) {
    setUserLanguage(turnUnderstandingDelta, fullWeightAnalysis);
    copyFullWeightNonTopicSegments(turnUnderstandingDelta, fullWeightAnalysis);
    processFullWeightTopicSegments(
      turnUnderstandingDelta,
      fullWeightAnalysis,
      input.supportTopicKnowledge,
      numberOfCleanedFields
    );

    return finalizeOutput(
      turnUnderstandingDelta,
      numberOfCleanedFields
    );
  }

  if (analysisSource === "light" && lightWeightAnalysis) {
    setUserLanguage(turnUnderstandingDelta, lightWeightAnalysis);
    copyLightWeightSegments(turnUnderstandingDelta, lightWeightAnalysis);

    return finalizeOutput(
      turnUnderstandingDelta,
      numberOfCleanedFields
    );
  }

  return finalizeOutput(
    turnUnderstandingDelta,
    numberOfCleanedFields
  );
}

export {
  assembleTurnUnderstandingDelta
};
