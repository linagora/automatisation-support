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
};

export type SupportProcessingPipelineV2Output = {
  userResponse: UserResponse;
  patches: Patches;
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
  content: string;
};

export type ExtractableFieldDefinition = {
  fieldName: string;
  description: string;
};

export type TestedAction = {
  label: string;
  outcome: TestedActionOutcome;
  evidence: string;
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
  type: "affirmative" | "negative" | "value" | "reference";
  value?: string | number | boolean;
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
  sourceSegmentId: string;
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
  contextualAnswer?: ContextualAnswer;
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
  | "create"
  | "attach"
  | "update"
  | "merge";

export type ProposedTopicChanges = {
  topicDraft?: {
    topicCategory: TopicCategory;
    summary: string;
  };
  summaryPatch?: string;
  facts?: SupportFact[];
  testedActions?: TestedAction[];
  explicitUserRequestPatch?: string;
  mergeRationale?: string;
};

export type TopicUpdateItem = {
  action: TopicUpdateAction;
  targetTopicIds?: SupportTopicId[];
  sourceSegmentIds: string[];
  sourceAttachmentIndexes: number[];
  proposedChanges?: ProposedTopicChanges;
};

export type DeferredTopicItem = {
  sourceSegmentIds: string[];
  sourceAttachmentIndexes: number[];
  reason:
    | "ambiguous_topic"
    | "missing_context"
    | "conflicting_information"
    | "insufficient_evidence"
    | "proposal_failed";
  detail: string;
};

export type TopicUpdateProposal = {
  topicUpdates: TopicUpdateItem[];
  deferredItems: DeferredTopicItem[];
};

export type SupportUnderstandingV2 = {
  topics: Record<string, unknown>[];
  unresolvedItems: string[];
  appliedTopicUpdates: TopicUpdateProposal["topicUpdates"];
};

export type KnowledgeEnrichmentPlan = {
  route: "retrieve_knowledge" | "use_generic_fields";
  retrievalRequests?: {
    topicId: SupportTopicId;
    query: string;
    filters?: Record<string, string | number | boolean | string[]>;
  }[];
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

export type ResponsePlanV2 = {
  topicPlans: Record<string, unknown>[];
  informationRequests?: string[];
  evidenceRequests?: string[];
  handover?: boolean;
};

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

export type AnalyzeSupportAttachmentsInput = {
  turnAnalysisPlan: TurnAnalysisPlan;
  attachmentSurfaceAnalysis: AttachmentSurfaceAnalysis;
  latestUserAttachments: LatestUserAttachment[];
  latestUserMessage: LatestUserMessage;
  recentInteractionContext: RecentInteractionContext;
  extractableFieldCatalog: ExtractableFieldDefinition[];
};

export type ProposeTopicUpdatesInput = {
  textUnderstandings: TextUnderstanding[];
  attachmentUnderstandings: AttachmentUnderstanding[];
  supportTopicKnowledge: SupportTopicKnowledge;
  conversationHistory: ConversationHistory;
};

export type ApplyTopicUpdatesInput = {
  supportTopicKnowledge: SupportTopicKnowledge;
  topicUpdateProposal: TopicUpdateProposal;
  textUnderstandings: TextUnderstanding[];
  attachmentUnderstandings: AttachmentUnderstanding[];
};

export type PlanKnowledgeEnrichmentInput = {
  supportUnderstanding: SupportUnderstandingV2;
  supportTopicKnowledge: SupportTopicKnowledge;
};

export type RetrieveSupportKnowledgeInput = {
  knowledgeEnrichmentPlan: KnowledgeEnrichmentPlan;
};

export type SynthesizeRetrievedKnowledgeInput = {
  supportUnderstanding: SupportUnderstandingV2;
  knowledgeEnrichmentPlan: KnowledgeEnrichmentPlan;
  knowledgeChunks: KnowledgeChunk[];
};

export type PlanSupportResponseInput = {
  supportUnderstanding: SupportUnderstandingV2;
  retrievedKnowledgeSynthesis?: RetrievedKnowledgeSynthesis;
  genericFieldKnowledge?: GenericFieldKnowledge;
  recentInteractionContext: RecentInteractionContext;
  channel: Channel;
};

export type RenderSupportResponseInput = {
  responsePlan?: ResponsePlanV2;
  standardResponseFragments: StandardResponseFragment[];
  textSurfaceAnalysis?: TextSurfaceAnalysis;
  accountProfile: AccountProfile;
  channel: Channel;
};

export type BuildUserResponseInput = {
  supportResponse: UserResponse["messages"];
};

export type BuildSupportPatchesInput = {
  promptSecuritySignals: PromptSecuritySignals;
  turnAnalysisPlan: TurnAnalysisPlan;
  supportUnderstanding?: SupportUnderstandingV2;
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
    TextUnderstanding[]
  >;
  analyzeSupportAttachments?: PipelineStep<
    AnalyzeSupportAttachmentsInput,
    AttachmentUnderstanding[]
  >;
  proposeTopicUpdates?: PipelineStep<
    ProposeTopicUpdatesInput,
    TopicUpdateProposal
  >;
  applyTopicUpdates?: PipelineStep<
    ApplyTopicUpdatesInput,
    SupportUnderstandingV2
  >;
  planKnowledgeEnrichment?: PipelineStep<
    PlanKnowledgeEnrichmentInput,
    KnowledgeEnrichmentPlan
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
    UserResponse["messages"]
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
