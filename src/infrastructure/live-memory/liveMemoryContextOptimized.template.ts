/**
 * NOTE POUR REVIEW FUTURE
 *
 * Ce template a été restructuré pour la nouvelle pipeline support optimized.
 *
 * Points déjà décidés :
 * - pas de `issueProgressState` opaque dans la live memory
 * - pas de `supportNeedResolution` séparé
 * - pas de `similarTopicKnowledge` au niveau racine du topic
 * - pas de `lastPipelineRun`
 * - pas de `lastComposerRun`
 * - pas de `unansweredRequestedFieldNames`
 * - pas de `lastTopicBranchRun`
 *
 * Le haut du topic garde :
 * - supportNeed
 * - supportDomain
 * - summary
 * - caseDetails
 * - attemptedActions
 * - topicBranch
 *
 * À REVIEW demain :
 * - détails précis de `LiveMemoryTopicBranchOptimized`
 * - statuts de qualification basic/deep
 * - statuts attemptedActions
 * - structure issue / feature / knowledge / support action / unclear topic
 * - noms exacts des champs `source`, `status`, `askCount`
 */

type LiveMemoryContextOptimized = {
  topics: LiveMemoryTopicOptimized[];

  previousConversationTurn: {
    previousUserVerbatim: string | null;
    previousBotVerbatim: string | null;
  };

  userState: {
    status: "normal" | "watch" | "blocked" | string;
    flags: string[];
  };

  securityAlerts: Array<{
    userMessage: string | null;
    attachments: LiveMemoryAttachmentReference[];
    flags: string[];
  }>;

  failedPipelineMessages: Array<{
    userMessage: string | null;
    attachments: LiveMemoryAttachmentReference[];
    fallbackReason: unknown;
  }>;
};

type LiveMemoryAttachmentReference = {
  attachmentId: string | null;
  filename: string | null;
  mimeType: string | null;
};

type LiveMemoryFieldStatus =
  | "missing"
  | "asked_once"
  | "asked_again"
  | "obtained"
  | "user_declared_unavailable";

type LiveMemoryFieldSource =
  | "user_spontaneous"
  | "previous_memory"
  | "basic_qualification_ask"
  | "deep_qualification_ask"
  | "similar_topic_disambiguation_ask"
  | "solution_followup_ask"
  | "catalog_guided"
  | "rag_inferred"
  | "support_agent";

type LiveMemoryCaseDetailOptimized = {
  key: string;
  value: string | number | boolean | null;
  evidence: string | null;
  status: LiveMemoryFieldStatus;
  source: LiveMemoryFieldSource | null;
  askCount: number;
};

type LiveMemoryAttemptedActionOptimized = {
  action: string | null;
  outcome: string | null;
  evidence: string | null;
  status: LiveMemoryFieldStatus;
  source: LiveMemoryFieldSource | null;
  askCount: number;
};

type LiveMemoryTopicOptimized = {
  topicId: number;

  title: string | null;

  supportNeed: {
    value:
      | "issue_resolution"
      | "knowledge_answer"
      | "support_action"
      | "feature_request"
      | "unclear"
      | string
      | null;
    isClear: boolean;
    evidence: string | null;
  };

  supportDomain: {
    value: string | null;
    isClear: boolean;
    evidence: string | null;
  };

  summary: string | null;

  caseDetails: LiveMemoryCaseDetailOptimized[];

  attemptedActions: LiveMemoryAttemptedActionOptimized[];

  topicBranch: LiveMemoryTopicBranchOptimized | null;

  supportKnowledgeSummary?: {
    summary: string | null;
    customerFacing: string | null;
    supportFacing: string | null;
  };
};

type LiveMemoryTopicBranchOptimized =
  | LiveMemoryIssueResolutionTopicBranch
  | LiveMemoryFeatureRequestTopicBranch
  | LiveMemoryKnowledgeAnswerTopicBranch
  | LiveMemorySupportActionTopicBranch
  | LiveMemoryUnclearTopicBranch;

type LiveMemoryIssueResolutionTopicBranch = {
  kind: "issue_resolution";

  currentStep:
    | "basic_qualification"
    | "similar_topic"
    | "deep_qualification"
    | "solution"
    | "completed"
    | "fallback";

  basicQualification: {
    status: "not_started" | "complete" | "waiting_user" | "fallback";
    missingRequiredFieldKeys: string[];
    missingRecommendedFieldKeys: string[];
    nextAskFieldKeys: string[];
    lastAsk: string | null;
  };

  similarTopic: {
    searchStatus: "not_searched" | "searched" | "failed" | string;

    analysisStatus:
      | "not_analyzed"
      | "identified"
      | "unclear"
      | "absent"
      | "fallback"
      | string;

    candidateSummaries: Array<{
      id: string | number | null;
      title: string | null;
      summary: string | null;
      score: number | null;
      source: string | null;
    }>;

    selectedTopic: {
      id: string | number | null;
      title: string | null;
      summary: string | null;
      evidence: string | null;
    } | null;

    disambiguationQuestion: string | null;
    lastAsk: string | null;
  };

  deepQualification: {
    status: "not_started" | "complete" | "waiting_user" | "fallback";
    mode: "similar_topic_guided" | "domain_generic" | string | null;
    missingRequiredFieldKeys: string[];
    missingRecommendedFieldKeys: string[];
    nextAskFieldKeys: string[];
    lastAsk: string | null;
  };

  solution: {
    status:
      | "not_started"
      | "available"
      | "not_found"
      | "not_relevant"
      | "provided"
      | "fallback"
      | string;
    customerFacing: string | null;
    supportFacing: string | null;
    confidence: number | null;
    evidence: string | null;
  };
};

type LiveMemoryFeatureRequestTopicBranch = {
  kind: "feature_request";

  status: "captured" | "needs_clarification" | "fallback" | string;

  requestSummary: string | null;

  requestedCapability: string | null;

  businessReason: string | null;

  lastAsk: string | null;
};

type LiveMemoryKnowledgeAnswerTopicBranch = {
  kind: "knowledge_answer";

  status: "answered" | "needs_clarification" | "not_found" | "fallback" | string;

  questionSummary: string | null;

  answerSummary: string | null;

  customerFacingAnswer: string | null;

  supportFacingNotes: string | null;

  lastAsk: string | null;
};

type LiveMemorySupportActionTopicBranch = {
  kind: "support_action";

  status:
    | "requested"
    | "needs_clarification"
    | "ready_for_handoff"
    | "completed"
    | "fallback"
    | string;

  requestedAction: string | null;

  requiredInfoKeys: string[];

  missingInfoKeys: string[];

  lastAsk: string | null;
};

type LiveMemoryUnclearTopicBranch = {
  kind: "unclear_topic";

  unclearReason: string | null;

  fragmentKeys: string[];

  lastAsk: string | null;
};

export type {
  LiveMemoryAttachmentReference,
  LiveMemoryAttemptedActionOptimized,
  LiveMemoryCaseDetailOptimized,
  LiveMemoryContextOptimized,
  LiveMemoryFeatureRequestTopicBranch,
  LiveMemoryFieldSource,
  LiveMemoryFieldStatus,
  LiveMemoryIssueResolutionTopicBranch,
  LiveMemoryKnowledgeAnswerTopicBranch,
  LiveMemorySupportActionTopicBranch,
  LiveMemoryTopicBranchOptimized,
  LiveMemoryTopicOptimized,
  LiveMemoryUnclearTopicBranch
};