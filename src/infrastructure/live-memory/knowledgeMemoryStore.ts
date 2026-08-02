import {randomUUID} from "node:crypto";
import * as fs from "fs/promises";
import * as path from "path";

import {getKnowledgeMemoryFilePath} from "./liveMemoryContextStore";

import type {LiveMemoryTopicOptimized} from "./liveMemoryContextOptimized.template";
import type {
  KnowledgeMemory,
  KnowledgeMemoryRetrieval,
  KnowledgeMemoryWorkflow
} from "./knowledgeMemory.template";
import type {RawRagKnowledge} from "../../support-automation/support-processing-pipeline-optimized/topic-manager/topic-treatement/issue-resolution-branch/retrieve-knowledge/ranked-search/runRankedSearch--oneShotStep";
import type {
  SegmentedKnowledgeBySource,
  SegmentedKnowledgePiece
} from "../../support-automation/support-processing-pipeline-optimized/topic-manager/topic-treatement/issue-resolution-branch/retrieve-knowledge/segmentation-knowledge/runSegmentationKnowledge--oneShotStep";

type KnowledgeMemoryPatch = {
  upsertRetrievals: KnowledgeMemoryRetrieval[];
};

function createEmptyKnowledgeMemory(): KnowledgeMemory {
  return {
    retrievals: []
  };
}

async function readKnowledgeMemory(
  conversationKey: string
): Promise<KnowledgeMemory> {
  try {
    const content = await fs.readFile(
      getKnowledgeMemoryFilePath(conversationKey),
      "utf8"
    );

    return normalizeKnowledgeMemory(JSON.parse(content));
  } catch {
    return createEmptyKnowledgeMemory();
  }
}

async function writeKnowledgeMemory(
  conversationKey: string,
  knowledgeMemory: KnowledgeMemory
): Promise<void> {
  const filePath = getKnowledgeMemoryFilePath(conversationKey);
  const directory = path.dirname(filePath);
  const temporaryFilePath = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`
  );

  await fs.mkdir(directory, {recursive: true});
  await fs.writeFile(
    temporaryFilePath,
    `${JSON.stringify(normalizeKnowledgeMemory(knowledgeMemory), null, 2)}\n`,
    "utf8"
  );
  await fs.rename(temporaryFilePath, filePath);
}

function getKnowledgeRetrievalById(
  knowledgeMemory: KnowledgeMemory,
  retrievalId: string
): KnowledgeMemoryRetrieval | null {
  return knowledgeMemory.retrievals.find((retrieval) => {
    return retrieval.retrievalId === retrievalId;
  }) ?? null;
}

function upsertKnowledgeRetrieval(
  knowledgeMemory: KnowledgeMemory,
  retrieval: KnowledgeMemoryRetrieval
): KnowledgeMemory {
  // Contract: producers emit complete retrieval snapshots, not partial patches.
  const retrievals = [...knowledgeMemory.retrievals];
  const existingIndex = retrievals.findIndex((candidate) => {
    return candidate.retrievalId === retrieval.retrievalId;
  });

  if (existingIndex === -1) {
    return {
      retrievals: [...retrievals, retrieval]
    };
  }

  retrievals[existingIndex] = retrieval;

  return {retrievals};
}

function applyKnowledgeMemoryPatch(
  knowledgeMemory: KnowledgeMemory,
  patch: KnowledgeMemoryPatch | null | undefined
): KnowledgeMemory {
  return (patch?.upsertRetrievals ?? []).reduce(
    (current, retrieval) => upsertKnowledgeRetrieval(current, retrieval),
    knowledgeMemory
  );
}

function createKnowledgeRetrieval(input: {
  topicId: number | null;
  workflow: KnowledgeMemoryWorkflow;
  rawRagKnowledge?: RawRagKnowledge | null;
  segmentedKnowledge?: SegmentedKnowledgeBySource[];
}): KnowledgeMemoryRetrieval {
  return {
    retrievalId: `retrieval_${randomUUID()}`,
    topicId: input.topicId,
    workflow: input.workflow,
    rawRagKnowledge: input.rawRagKnowledge ?? null,
    segmentedKnowledge: input.segmentedKnowledge ?? []
  };
}

function attachKnowledgeRetrievalTopicIds(input: {
  knowledgeMemory: KnowledgeMemory;
  topics: LiveMemoryTopicOptimized[] | null;
}): KnowledgeMemory {
  const topicIdByRetrievalId = new Map<string, number>();

  for (const topic of input.topics ?? []) {
    for (const retrievalId of topic.sourceTopicManager.workflows.issueResolution.retrieveKnowledge.retrievalIds) {
      const existingTopicId = topicIdByRetrievalId.get(retrievalId);
      const topicId = topic.sourceProposeTopicUpdates.topicId;

      if (existingTopicId !== undefined && existingTopicId !== topicId) {
        throw new Error(
          `Ambiguous knowledge retrieval topic attachment for retrievalId: ${retrievalId}`
        );
      }

      topicIdByRetrievalId.set(
        retrievalId,
        topicId
      );
    }
  }

  return {
    retrievals: input.knowledgeMemory.retrievals.map((retrieval) => {
      if (retrieval.topicId !== null) {
        return retrieval;
      }

      const topicId = topicIdByRetrievalId.get(retrieval.retrievalId);

      return topicId === undefined
        ? retrieval
        : {
          ...retrieval,
          topicId
        };
    })
  };
}

function normalizeKnowledgeMemory(value: unknown): KnowledgeMemory {
  if (!isRecord(value) || !Array.isArray(value.retrievals)) {
    return createEmptyKnowledgeMemory();
  }

  return {
    retrievals: value.retrievals.flatMap((retrieval) => {
      const normalized = normalizeKnowledgeRetrieval(retrieval);
      return normalized ? [normalized] : [];
    })
  };
}

function normalizeKnowledgeRetrieval(
  value: unknown
): KnowledgeMemoryRetrieval | null {
  if (!isRecord(value)) {
    return null;
  }

  const retrievalId =
    typeof value.retrievalId === "string" && value.retrievalId.trim() !== ""
      ? value.retrievalId
      : null;

  const workflow = normalizeWorkflow(value.workflow);

  if (!retrievalId || !workflow) {
    return null;
  }

  return {
    retrievalId,
    topicId: normalizeTopicId(value.topicId),
    workflow,
    rawRagKnowledge: normalizeRawRagKnowledge(value.rawRagKnowledge),
    segmentedKnowledge: normalizeSegmentedKnowledge(value.segmentedKnowledge)
  };
}

function normalizeWorkflow(value: unknown): KnowledgeMemoryWorkflow | null {
  return value === "issueResolution" ||
    value === "knowledgeAnswer" ||
    value === "supportAction" ||
    value === "featureRequest"
    ? value
    : null;
}

function normalizeTopicId(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 1
    ? value
    : null;
}

function normalizeRawRagKnowledge(value: unknown): RawRagKnowledge | null {
  if (!isRecord(value)) {
    return null;
  }

  const query = nonEmptyString(value.query);
  const content = nonEmptyString(value.content);
  const candidates = normalizeRawKnowledgeCandidates(value.candidates);
  const metadata = isRecord(value.metadata) &&
    value.metadata.retriever === "openrag"
      ? {retriever: "openrag" as const}
      : null;

  if (!query || !content || !metadata) {
    return null;
  }

  return {
    query,
    content,
    candidates,
    sources: Array.isArray(value.sources) ? value.sources : [],
    metadata
  };
}

function normalizeRawKnowledgeCandidates(
  value: unknown
): RawRagKnowledge["candidates"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((candidate) => {
    if (!isRecord(candidate)) {
      return [];
    }

    const rawKnowledgeId = nonEmptyString(candidate.rawKnowledgeId);
    const rawKnowledge = nonEmptyString(candidate.rawKnowledge);

    if (!rawKnowledgeId || !rawKnowledge) {
      return [];
    }

    return [{
      rawKnowledgeId,
      rawKnowledge,
      whyPotentiallyRelevant: nullableString(candidate.whyPotentiallyRelevant),
      sourceHint: nullableString(candidate.sourceHint)
    }];
  });
}

function normalizeSegmentedKnowledge(
  value: unknown
): SegmentedKnowledgeBySource[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((source) => {
    if (!isRecord(source)) {
      return [];
    }

    const rawKnowledgeId = nonEmptyString(source.rawKnowledgeId);

    if (!rawKnowledgeId) {
      return [];
    }

    const userFacingKnowledge = normalizeSegmentedKnowledgePieces(
      source.userFacingKnowledge
    );
    const supportFacingKnowledge = normalizeSegmentedKnowledgePieces(
      source.supportFacingKnowledge
    );

    if (userFacingKnowledge.length === 0 && supportFacingKnowledge.length === 0) {
      return [];
    }

    return [{
      rawKnowledgeId,
      userFacingKnowledge,
      supportFacingKnowledge
    }];
  });
}

function normalizeSegmentedKnowledgePieces(
  value: unknown
): SegmentedKnowledgePiece[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((piece) => {
    if (!isRecord(piece)) {
      return [];
    }

    const text = nonEmptyString(piece.text);

    if (!text) {
      return [];
    }

    return [{
      text,
      sourceHint: nullableString(piece.sourceHint),
      sourceSpan: nullableString(piece.sourceSpan)
    }];
  });
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== ""
    ? value
    : null;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export {
  applyKnowledgeMemoryPatch,
  attachKnowledgeRetrievalTopicIds,
  createEmptyKnowledgeMemory,
  createKnowledgeRetrieval,
  getKnowledgeRetrievalById,
  normalizeKnowledgeMemory,
  readKnowledgeMemory,
  upsertKnowledgeRetrieval,
  writeKnowledgeMemory
};

export type {KnowledgeMemoryPatch};
