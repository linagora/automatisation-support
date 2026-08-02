import type {RawRagKnowledge} from "../../support-automation/support-processing-pipeline-optimized/topic-manager/topic-treatement/issue-resolution-branch/retrieve-knowledge/ranked-search/runRankedSearch--oneShotStep";
import type {SegmentedKnowledgeBySource} from "../../support-automation/support-processing-pipeline-optimized/topic-manager/topic-treatement/issue-resolution-branch/retrieve-knowledge/segmentation-knowledge/runSegmentationKnowledge--oneShotStep";

export type KnowledgeMemoryWorkflow =
  | "issueResolution"
  | "knowledgeAnswer"
  | "supportAction"
  | "featureRequest";

export type KnowledgeMemoryRetrieval = {
  retrievalId: string;
  topicId: number | null;
  workflow: KnowledgeMemoryWorkflow;
  rawRagKnowledge: RawRagKnowledge | null;
  segmentedKnowledge: SegmentedKnowledgeBySource[];
};

export type KnowledgeMemory = {
  retrievals: KnowledgeMemoryRetrieval[];
};
