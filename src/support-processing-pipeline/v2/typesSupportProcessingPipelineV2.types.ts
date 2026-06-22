import type {
  AccountInteractionTraits,
  AccountProfile,
  AccountTrustStatus,
  ConversationHistory,
  LatestUserAttachment,
  LatestUserMessage,
  Patches,
  SupportTopicKnowledge,
  UserResponse
} from "../typesSupportProcessingPipeline.types";
import type {
  TextSurfaceCategory,
  TextSurfaceStandardSubcategory
} from "./analyze-text-surface/textSurfaceAnalysis.taxonomy";
import type {
  BroadCategoryHint,
  CandidateFactSupport,
  ContextDependency,
  PrimaryUserExpectation,
  SupportNeed,
  TestedActionOutcome,
  TextUncertaintyReason
} from "./analyze-support-text/supportTextAnalysis.taxonomy";
import type {
  ResponsePlanningPolicy,
  SupportResponsePlan
} from "./plan-support-response/typesPlanSupportResponse.types";
import type {
  RenderedSupportResponse
} from "./response-renderer/typesRenderSupportResponse.types";

export type {
  BroadCategoryHint,
  ContextDependency,
  PrimaryUserExpectation,
  SupportNeed,
  TextSurfaceStandardSubcategory
};

type Channel = LatestUserMessage["channel"];

export type SurfaceCategory = TextSurfaceCategory;

type StandardSubcategory = TextSurfaceStandardSubcategory;
type FieldName = string;
type SupportTopic = SupportTopicKnowledge["segments_topic"][number];
type SupportTopicId = SupportTopic["id_topic"];
type TopicCategory = SupportTopic["topic_category"];
type MaybePromise<T> = T | Promise<T>;
type PipelineStep<TInput, TOutput> = (input: TInput) => MaybePromise<TOutput>;

export type SupportProcessingStepName =
  | "detectSuspiciousPromptPatterns"
  | "planTurnAnalysis"
  | "analyzeTextSurface"
  | "analyzeAttachmentSurface"
  | "buildStandardResponseFragments"
  | "analyzeSupportText"
  | "analyzeSupportAttachments"
  | "proposeTopicUpdates"
  | "applyTopicUpdates"
  | "planKnowledgeEnrichment"
  | "selectCatalogKnowledgeForTopic"
  | "retrieveSupportKnowledge"
  | "synthesizeRetrievedKnowledge"
  | "planSupportResponse"
  | "renderSupportResponse"
  | "buildUserResponse"
  | "buildSupportPatches";

export type SupportProcessingProgressEvent = {
  step: SupportProcessingStepName;
  status: "started" | "completed" | "skipped" | "failed";
};

export type SupportProcessingPipelineV2Runtime = {
  reportProgress?: (
    event: SupportProcessingProgressEvent
  ) => void | Promise<void>;
};

export type RecentInteractionContext = {
  previousUserMessageSummary?: string;
  previousBotResponseSummary?: string;
};

export type SupportProcessingPipelineV2Input = {
  latestUserMessage: LatestUserMessage;
  latestUserAttachments: LatestUserAttachment[];
  accountTrustStatus: AccountTrustStatus;
  accountProfile: AccountProfile;
  accountInteractionTraits: AccountInteractionTraits;
  supportTopicKnowledge: SupportTopicKnowledge;
  conversationHistory: ConversationHistory;
  recentInteractionContext: RecentInteractionContext;
  responsePlanningPolicy?: Partial<ResponsePlanningPolicy>;
};

export type SupportProcessingPipelineV2Output = {
  userResponse: UserResponse;
  patches: Patches;
  textUnderstandings?: TextUnderstanding[];
  supportResponseCues?: SupportResponseCue[];
  topicUpdateProposals?: TopicUpdateProposal[];
  knowledgeEnrichmentPlan?: KnowledgeEnrichmentPlan;
  retrievedSupportKnowledge?: KnowledgeChunk[];
  synthesizedRetrievedKnowledge?: RetrievedKnowledgeSynthesis | null;
  topicKnowledgeEnrichmentPlans?: TopicKnowledgeEnrichmentPlanResult[];
  topicRetrievedSupportKnowledge?: TopicRetrievedSupportKnowledgeResult[];
  topicRetrievedKnowledgeSyntheses?: TopicRetrievedKnowledgeSynthesisResult[];
  topicResponsePlans?: ResponsePlanV2[];
  /** @deprecated Use topicResponsePlans. */
  responsePlan?: ResponsePlanV2;
};

export type PromptSecuritySignals = {
  matchedPatternIds: string[];
};

export type TurnAnalysisPlan = {
  analyzeText: boolean;
  analyzeAttachments: boolean;
  matchedPatternIds: string[];
};

export type TextSurfaceAnalysis = {
  userLanguage: string;
  segments: {
    segmentId: string;
    verbatim: string;
    category: SurfaceCategory;
    standardSubcategory?: StandardSubcategory;
  }[];
};

export type AttachmentSurfaceAnalysis = {
  attachmentIndex: number;
  category: SurfaceCategory;
  standardSubcategory?: StandardSubcategory;
  shouldRunDeepAnalysis: boolean;
  reason?: string;
}[];

export type StandardResponseFragment = {
  category: SurfaceCategory;
  standardSubcategory?: StandardSubcategory;
  sourceSegmentId?: string;
  sourceVerbatim?: string;
  content: string;
};

export type ExtractableFieldDefinition = {
  fieldName: string;
  description: string;
  askableByUser?: boolean;
};

export type TestedAction = {
  label: string;
  outcome: TestedActionOutcome;
  evidence: string;
};

export type SupportResponseCue = {
  cueId: string;
  sourceSegmentIds: string[];
  relatedUnderstandingIds: string[];
  verbatim: string;
  cueNote: string;
};

export type SupportFact =
  | {
      type: "catalogued_field";
      fieldName: string;
      value: string | number | boolean;
      evidence: string;
    }
  | {
      type: "open_fact";
      kind: string;
      value?: string | number | boolean;
      evidence: string;
      support: CandidateFactSupport;
    };

export type ContextualAnswer = {
  type: "none";
  value: null;
  evidence: null;
} | {
  type: "affirmative" | "negative" | "value" | "reference";
  value?: string | number | boolean | null;
  evidence: string;
};

export type TextUncertainty = {
  reason:
    | TextUncertaintyReason
    | "deep_analysis_failed";
  detail: string;
  evidence?: string;
};

export type TextUnderstanding = {
  understandingId: string;
  sourceSegmentIds: string[];
  sourceVerbatims: string[];
  summary: string;
  primaryUserExpectation: PrimaryUserExpectation;
  explicitUserRequest?: {
    request: string;
    evidence: string;
  };
  supportNeeds: SupportNeed[];
  broadCategoryHint?: BroadCategoryHint;
  contextDependency: ContextDependency;
  contextualAnswer: ContextualAnswer;
  facts: SupportFact[];
  testedActions: TestedAction[];
  uncertainties: TextUncertainty[];
};

export type AttachmentUnderstanding = {
  attachmentIndex: number;
  status: "analyzed" | "failed";
  summary?: string;
  extractedFields?: Record<FieldName, string>;
  candidateFacts?: string[];
  limitations?: string[];
};

export type TopicUpdateAction =
  | "update_existing_topic"
  | "create_new_topic"
  | "no_topic_update"
  | "needs_review";

export type TopicUpdateRelationship =
  | "continues_existing_issue"
  | "adds_new_information"
  | "answers_requested_field"
  | "reports_test_result"
  | "reports_resolution"
  | "reports_partial_resolution"
  | "corrects_previous_information"
  | "reopens_or_persists_issue"
  | "creates_distinct_topic"
  | "unclear";

export type TopicStatusHint =
  | "open"
  | "resolved"
  | "partially_resolved"
  | "unclear";

export type BlockingIssueValue =
  | "yes"
  | "no"
  | "unknown";

export type TopicUpdateIntent = {
  relationship: TopicUpdateRelationship;
  blockingIssue: BlockingIssueValue;
  statusHint: TopicStatusHint;
  userGoal: string | null;
  correctionNote: string | null;
};

export type NewTopicDraft = {
  title: string;
  broadCategoryHint: string | null;
  userGoal: string | null;
  blockingIssue: BlockingIssueValue;
};

export type TopicUpdateProposal = {
  proposalId: string;
  action: TopicUpdateAction;
  fromUnderstandingIds: string[];
  relatedAttachmentIndexes?: number[];
  topicId: string | null;
  selectedSourceVerbatims: string[];
  updateIntent: TopicUpdateIntent | null;
  newTopic: NewTopicDraft | null;
  reason: string;
};

export type SupportUnderstandingV2 = {
  topics: Record<string, unknown>[];
  unresolvedItems: string[];
  appliedTopicUpdates: TopicUpdateProposal[];
};

export type KnowledgeEnrichmentPlan = {
  route: "no_retrieval" | "retrieve_knowledge" | "use_generic_fields";
  retrievalRequests: {
    topicId: SupportTopicId;
    query: string;
    filters?: Record<string, string | number | boolean | string[]>;
  }[];
  reason?: string;
};

export type KnowledgeChunk = {
  topicId: SupportTopicId;
  sourceId: string;
  content: string;
  score: number;
  metadata?: Record<string, string | number | boolean>;
};

export type GenericFieldKnowledge = Record<string, never>;

export type RetrievedKnowledgeSynthesis = {
  topics: {
    topicId: SupportTopicId;
    relevantFacts: string[];
    applicableInstructions?: string[];
    possibleFields?: FieldName[];
    unresolvedPoints?: string[];
    sourceReferences: string[];
  }[];
};

export type ResponsePlanV2 = SupportResponsePlan;

export type DetectSuspiciousPromptPatternsInput = {
  latestUserMessage: LatestUserMessage;
};

export type PlanTurnAnalysisInput = {
  latestUserMessage: LatestUserMessage;
  latestUserAttachments: LatestUserAttachment[];
  promptSecuritySignals: PromptSecuritySignals;
  accountTrustStatus: AccountTrustStatus;
};

export type AnalyzeTextSurfaceInput = {
  latestUserMessage: LatestUserMessage;
  turnAnalysisPlan: TurnAnalysisPlan;
  recentInteractionContext: RecentInteractionContext;
};

export type AnalyzeAttachmentSurfaceInput = {
  latestUserMessage: LatestUserMessage;
  latestUserAttachments: LatestUserAttachment[];
  turnAnalysisPlan: TurnAnalysisPlan;
};

export type BuildStandardResponseFragmentsInput = {
  turnAnalysisPlan: TurnAnalysisPlan;
  latestUserMessage?: LatestUserMessage;
  accountProfile?: AccountProfile;
  recentInteractionContext?: RecentInteractionContext;
  textSurfaceAnalysis?: TextSurfaceAnalysis;
  attachmentSurfaceAnalysis?: AttachmentSurfaceAnalysis;
};

export type AnalyzeSupportTextInput = {
  turnAnalysisPlan: TurnAnalysisPlan;
  textSurfaceAnalysis: TextSurfaceAnalysis;
  recentInteractionContext: RecentInteractionContext;
  extractableFieldCatalog: ExtractableFieldDefinition[];
};

export type AnalyzeSupportTextOutput = {
  textUnderstandings: TextUnderstanding[];
  supportResponseCues: SupportResponseCue[];
};

export type AnalyzeSupportAttachmentsInput = {
  turnAnalysisPlan: TurnAnalysisPlan;
  attachmentSurfaceAnalysis: AttachmentSurfaceAnalysis;
  latestUserAttachments: LatestUserAttachment[];
  latestUserMessage: LatestUserMessage;
  recentInteractionContext: RecentInteractionContext;
  extractableFieldCatalog: ExtractableFieldDefinition[];
};

export type ProposeTopicUpdatesInput = {
  existingTopics?: unknown[];
  textUnderstandings: TextUnderstanding[];
  supportTopicKnowledge: SupportTopicKnowledge;
  recentInteractionContext: RecentInteractionContext;
  latestUserMessageContent?: string | null;
};

export type ApplyTopicUpdatesInput = {
  supportTopicKnowledge: SupportTopicKnowledge;
  topicUpdateProposals: TopicUpdateProposal[];
  textUnderstandings: TextUnderstanding[];
  attachmentUnderstandings: AttachmentUnderstanding[];
};

export type PlanKnowledgeEnrichmentInput = {
  topicEvidence: TopicEvidence;
  extractableFieldCatalog: ExtractableFieldDefinition[];
  recentInteractionContext?: RecentInteractionContext;
  targetLanguage?: string;
};

export type TopicEvidence = {
  proposalId: string;
  topicId: string | null;
  topicSourceVerbatims: string[];
  relatedUnderstandingIds: string[];
  relatedTextUnderstandings: TextUnderstanding[];
  relatedAttachmentUnderstandings: AttachmentUnderstanding[];
  relatedSupportResponseCues: SupportResponseCue[];
  existingTopic?: unknown;
};

export type SelectCatalogKnowledgeForTopicInput = {
  topicUserMessageContent: string;
  topicEvidence: TopicEvidence;
  extractableFieldCatalog: ExtractableFieldDefinition[];
  recentInteractionContext?: unknown;
  targetLanguage?: string;
};

export type SelectedCatalogKnowledgeForTopic = {
  selectedFields: ExtractableFieldDefinition[];
  selectedGenericKnowledge: unknown[];
  scopeReason: string;
  rejectedFieldNames: string[];
  warnings?: string[];
};

export type TopicKnowledgeBranchContext = {
  topicEvidence: TopicEvidence;
  selectedCatalogKnowledge: SelectedCatalogKnowledgeForTopic;
  topicKnowledgeEnrichmentPlan: KnowledgeEnrichmentPlan;
};

export type RetrieveSupportKnowledgeInput = TopicKnowledgeBranchContext & {
  knowledgeEnrichmentPlan: KnowledgeEnrichmentPlan;
};

export type SynthesizeRetrievedKnowledgeInput = TopicKnowledgeBranchContext & {
  knowledgeEnrichmentPlan: KnowledgeEnrichmentPlan;
  knowledgeChunks: KnowledgeChunk[];
};

export type TopicKnowledgeEnrichmentPlanResult = {
  proposalId: string;
  topicId: string | null;
  plan: KnowledgeEnrichmentPlan;
};

export type TopicRetrievedSupportKnowledgeResult = {
  proposalId: string;
  topicId: string | null;
  knowledgeChunks: KnowledgeChunk[];
};

export type TopicRetrievedKnowledgeSynthesisResult = {
  proposalId: string;
  topicId: string | null;
  synthesis: RetrievedKnowledgeSynthesis | null;
};

export type PlanSupportResponseInput = {
  topicUserMessageContent: string;
  topicEvidence: TopicEvidence;
  targetLanguage?: string;
  selectedCatalogKnowledge: unknown;
  topicKnowledgeEnrichmentPlan: unknown;
  topicRetrievedKnowledgeSynthesis?: unknown | null;
  responsePlanningPolicy?: Partial<ResponsePlanningPolicy>;
  channel?: Channel;
};

export type RenderSupportResponseInput = {
  latestUserMessageContent: string;
  targetLanguage?: string;
  standardResponseFragments: StandardResponseFragment[];
  topicResponsePlans: ResponsePlanV2[];
  channel: Channel;
};

export type BuildUserResponseInput = {
  renderedSupportResponse: RenderedSupportResponse;
};

export type BuildSupportPatchesInput = {
  promptSecuritySignals: PromptSecuritySignals;
  turnAnalysisPlan: TurnAnalysisPlan;
  supportTopicKnowledge: SupportTopicKnowledge;
  textUnderstandings?: TextUnderstanding[];
  supportResponseCues?: SupportResponseCue[];
  topicUpdateProposals?: TopicUpdateProposal[];
  knowledgeEnrichmentPlan?: KnowledgeEnrichmentPlan;
  retrievedSupportKnowledge?: KnowledgeChunk[];
  synthesizedRetrievedKnowledge?: RetrievedKnowledgeSynthesis | null;
  topicKnowledgeEnrichmentPlans?: TopicKnowledgeEnrichmentPlanResult[];
  topicRetrievedSupportKnowledge?: TopicRetrievedSupportKnowledgeResult[];
  topicRetrievedKnowledgeSyntheses?: TopicRetrievedKnowledgeSynthesisResult[];
  topicResponsePlans?: ResponsePlanV2[];
  /** @deprecated Use topicResponsePlans. */
  responsePlan?: ResponsePlanV2;
  userResponse: UserResponse;
};

export type SupportProcessingPipelineV2Steps = {
  detectSuspiciousPromptPatterns?: PipelineStep<
    DetectSuspiciousPromptPatternsInput,
    PromptSecuritySignals
  >;
  planTurnAnalysis?: PipelineStep<PlanTurnAnalysisInput, TurnAnalysisPlan>;
  analyzeTextSurface?: PipelineStep<
    AnalyzeTextSurfaceInput,
    TextSurfaceAnalysis
  >;
  analyzeAttachmentSurface?: PipelineStep<
    AnalyzeAttachmentSurfaceInput,
    AttachmentSurfaceAnalysis
  >;
  buildStandardResponseFragments?: PipelineStep<
    BuildStandardResponseFragmentsInput,
    StandardResponseFragment[]
  >;
  analyzeSupportText?: PipelineStep<
    AnalyzeSupportTextInput,
    AnalyzeSupportTextOutput
  >;
  analyzeSupportAttachments?: PipelineStep<
    AnalyzeSupportAttachmentsInput,
    AttachmentUnderstanding[]
  >;
  proposeTopicUpdates?: PipelineStep<
    ProposeTopicUpdatesInput,
    TopicUpdateProposal[]
  >;
  applyTopicUpdates?: PipelineStep<
    ApplyTopicUpdatesInput,
    SupportUnderstandingV2
  >;
  planKnowledgeEnrichment?: PipelineStep<
    PlanKnowledgeEnrichmentInput,
    KnowledgeEnrichmentPlan
  >;
  selectCatalogKnowledgeForTopic?: PipelineStep<
    SelectCatalogKnowledgeForTopicInput,
    SelectedCatalogKnowledgeForTopic
  >;
  retrieveSupportKnowledge?: PipelineStep<
    RetrieveSupportKnowledgeInput,
    KnowledgeChunk[]
  >;
  synthesizeRetrievedKnowledge?: PipelineStep<
    SynthesizeRetrievedKnowledgeInput,
    RetrievedKnowledgeSynthesis
  >;
  planSupportResponse?: PipelineStep<PlanSupportResponseInput, ResponsePlanV2>;
  renderSupportResponse?: PipelineStep<
    RenderSupportResponseInput,
    RenderedSupportResponse
  >;
  buildUserResponse?: PipelineStep<BuildUserResponseInput, UserResponse>;
  buildSupportPatches?: PipelineStep<BuildSupportPatchesInput, Patches>;
};

export type {
  AccountInteractionTraits,
  AccountProfile,
  AccountTrustStatus,
  Channel,
  ConversationHistory,
  LatestUserAttachment,
  LatestUserMessage,
  Patches,
  SupportTopicKnowledge,
  SupportTopicId,
  TopicCategory,
  UserResponse
};
