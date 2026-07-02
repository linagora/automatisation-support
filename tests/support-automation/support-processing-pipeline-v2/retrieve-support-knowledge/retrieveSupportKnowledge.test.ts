import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createDefaultSupportKnowledgeRetriever,
  retrieveSupportKnowledge
} from "../../../../src/support-automation/support-processing-pipeline-v2/retrieve-support-knowledge/retrieveSupportKnowledge";
import {
  HttpSupportKnowledgeRetriever
} from "../../../../src/infrastructure/rag/httpSupportKnowledgeRetriever";
import {
  JsonFileSupportKnowledgeRetriever
} from "../../../../src/infrastructure/rag/jsonFileSupportKnowledgeRetriever";
import {
  JsonKnowledgeRepository
} from "../../../../src/archive/repositories/json/jsonKnowledgeRepository";

import type {
  KnowledgeChunk,
  KnowledgeEnrichmentPlan,
  RetrieveSupportKnowledgeInput
} from "../../../../src/support-automation/support-processing-pipeline-v2/typesSupportProcessingPipelineV2.types";
import type {
  JsonKnowledgeItem
} from "../../../../src/archive/repositories/json/typesJsonRepositories.types";

const previousEnv = { ...process.env };

function restoreEnv(): void {
  for (const key of [
    "SUPPORT_RAG_API_URL",
    "SUPPORT_RAG_API_KEY",
    "SUPPORT_RAG_MODEL"
  ] as const) {
    if (previousEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = previousEnv[key];
    }
  }
}

function clearRagEnv(): void {
  delete process.env.SUPPORT_RAG_API_URL;
  delete process.env.SUPPORT_RAG_API_KEY;
  delete process.env.SUPPORT_RAG_MODEL;
}

function setRagEnv(): void {
  process.env.SUPPORT_RAG_API_URL = "https://demo.open-rag.ai";
  process.env.SUPPORT_RAG_API_KEY = "test_secret_token";
  process.env.SUPPORT_RAG_MODEL = "openrag-automatisation_support";
}

function buildInput(): RetrieveSupportKnowledgeInput {
  const topicEvidence = {
    proposalId: "proposal_notification",
    topicId: null,
    topicSourceVerbatims: [
      "I do not receive notifications on Android when I get a new email."
    ],
    relatedUnderstandingIds: ["understanding_notification"],
    relatedTextUnderstandings: [
      {
        understandingId: "understanding_notification",
        sourceSegmentIds: ["segment_notification"],
        messageKinds: [],
        caseDetails: [],
        attemptedActions: [],
        supportMetadata: [],
        sourceVerbatims: [
          "I do not receive notifications on Android when I get a new email."
        ],
        summary: "Android push notification is missing after new email.",
        primaryUserExpectation: "wants_solution" as const,
        supportNeeds: ["possible_bug" as const],
        broadCategoryHint: "bug" as const,
        contextDependency: "standalone_complete" as const,
        contextualAnswer: {
          type: "none" as const,
          value: null,
          evidence: null
        },
        facts: [],
        testedActions: [],
        uncertainties: []
      }
    ],
    relatedAttachmentUnderstandings: [],
    relatedSupportResponseCues: []
  };
  const topicKnowledgeEnrichmentPlan: KnowledgeEnrichmentPlan = {
    route: "rag_only" as const,
    retrievalRequests: [
      {
        topicId: 1,
        searchPurpose: "support_answer_and_qualification",
        queryText:
          "Support issue: Android push notification is missing after new email.",
        desiredKnowledge: [
          "known_behavior",
          "troubleshooting_steps",
          "safe_response",
          "fields_to_ask",
          "do_not_claim"
        ],
        context: {
          topicSummary: "Android push notification is missing after new email.",
          knownDetails: [],
          attemptedActions: []
        }
      }
    ],
    reason: "rag_enabled_for_bug_topics"
  };

  return {
    knowledgeEnrichmentPlan: topicKnowledgeEnrichmentPlan,
    topicKnowledgeEnrichmentPlan,
    topicEvidence,
    selectedCatalogKnowledge: {
      selectedFields: [
        {
          fieldName: "platform",
          description: "Platform",
          askableByUser: true
        }
      ],
      selectedGenericKnowledge: [],
      scopeReason: "notification topic",
      rejectedFieldNames: []
    }
  };
}

function openRagResponse(params: {
  content?: string;
  extra?: unknown;
  ok?: boolean;
  status?: number;
  statusText?: string;
} = {}) {
  return {
    ok: params.ok ?? true,
    status: params.status ?? 200,
    statusText: params.statusText ?? "OK",
    json: async () => ({
      choices: [
        {
          message: {
            content: params.content ??
              "Android notification permission can block push notifications."
          }
        }
      ],
      extra: params.extra ?? {
        sources: [
          {
            source_type: "document",
            partition: "automatisation_support",
            original_filename: "Notification not received.pdf",
            page: 1,
            relevance_score: 0.9653811454772949
          }
        ]
      }
    })
  };
}

function getFetchBody(fetchMock: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const fetchCall = fetchMock.mock.calls[0] as unknown as [
    string,
    { body: string }
  ];

  return JSON.parse(fetchCall[1].body) as Record<string, unknown>;
}

async function writeKnowledgeFixture(
  items: JsonKnowledgeItem[]
): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(
    os.tmpdir(),
    "retrieve-support-knowledge-test-"
  ));
  const filePath = path.join(tempDir, "knowledge.json");

  await fs.writeFile(filePath, `${JSON.stringify(items, null, 2)}\n`, "utf8");

  return filePath;
}

describe("retrieveSupportKnowledge", function () {
  beforeEach(function () {
    clearRagEnv();
  });

  afterEach(function () {
    restoreEnv();
    vi.unstubAllGlobals();
  });

  it("calls the injected retriever with the canonical queryText", async function () {
    const chunks: KnowledgeChunk[] = [
      {
        topicId: 1,
        sourceId: "rag_doc_1",
        content: "RAG text chunk",
        score: 0.8
      }
    ];
    const retriever = {
      retrieve: vi.fn(async () => chunks)
    };
    const input = buildInput();

    const result = await retrieveSupportKnowledge(input, retriever);

    expect(result).toBe(chunks);
    expect(retriever.retrieve).toHaveBeenCalledWith(
      expect.objectContaining({
        knowledgeEnrichmentPlan: expect.objectContaining({
          retrievalRequests: [
            expect.objectContaining({
              queryText: expect.stringContaining("Android push notification")
            })
          ]
        })
      })
    );
  });

  it("uses OpenRAG as the default retriever when env variables are present", async function () {
    setRagEnv();
    const fetchMock = vi.fn(async () => openRagResponse());
    vi.stubGlobal("fetch", fetchMock);

    const chunks = await retrieveSupportKnowledge(buildInput());
    const fetchCall = fetchMock.mock.calls[0] as unknown as [string, unknown];
    const body = getFetchBody(fetchMock);
    const messages = body.messages as Array<{ content: string }>;
    const metadata = body.metadata as Record<string, unknown>;

    expect(createDefaultSupportKnowledgeRetriever())
      .toBeInstanceOf(HttpSupportKnowledgeRetriever);
    expect(fetchCall[0]).toBe(
      "https://demo.open-rag.ai/v1/chat/completions"
    );
    expect(body.model).toBe("openrag-automatisation_support");
    expect(messages[0]?.content).toContain("Android push notification");
    expect(metadata.websearch).toBe(false);
    expect(JSON.stringify(body)).not.toContain("selectedCatalogKnowledge");
    expect(JSON.stringify(body)).not.toContain("selectedFields");
    expect(JSON.stringify(body)).not.toContain("selectedFieldNames");
    expect(JSON.stringify(body)).not.toContain("partition");
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({
      topicId: 1,
      sourceId: "openrag_0",
      content: "Android notification permission can block push notifications.",
      score: 0.9653811454772949,
      metadata: {
        retriever: "openrag",
        model: "openrag-automatisation_support",
        sourceCount: 1
      }
    });
  });

  it("parses OpenRAG extra.sources when extra is a JSON string", async function () {
    const fetchMock = vi.fn(async () => openRagResponse({
      extra: JSON.stringify({
        sources: [
          {
            source_type: "document",
            partition: "automatisation_support",
            original_filename: "Notification not received.pdf",
            relevance_score: 0.42
          }
        ]
      })
    }));
    vi.stubGlobal("fetch", fetchMock);

    const retriever = new HttpSupportKnowledgeRetriever({
      baseUrl: "https://demo.open-rag.ai/",
      apiKey: "test_secret_token",
      model: "openrag-automatisation_support"
    });
    const chunks = await retrieveSupportKnowledge(buildInput(), retriever);

    expect(chunks[0]?.score).toBe(0.42);
    expect(chunks[0]?.metadata?.sources).toEqual([
      expect.objectContaining({
        partition: "automatisation_support",
        original_filename: "Notification not received.pdf"
      })
    ]);
  });

  it("returns no chunk when OpenRAG content is empty", async function () {
    const fetchMock = vi.fn(async () => openRagResponse({
      content: "   "
    }));
    vi.stubGlobal("fetch", fetchMock);

    const retriever = new HttpSupportKnowledgeRetriever({
      baseUrl: "https://demo.open-rag.ai",
      apiKey: "test_secret_token",
      model: "openrag-automatisation_support"
    });

    await expect(retrieveSupportKnowledge(buildInput(), retriever))
      .resolves.toEqual([]);
  });

  it("does not include the token in OpenRAG auth errors", async function () {
    const fetchMock = vi.fn(async () => openRagResponse({
      ok: false,
      status: 401,
      statusText: "Unauthorized"
    }));
    vi.stubGlobal("fetch", fetchMock);

    const retriever = new HttpSupportKnowledgeRetriever({
      baseUrl: "https://demo.open-rag.ai",
      apiKey: "test_secret_token",
      model: "openrag-automatisation_support"
    });

    await expect(retrieveSupportKnowledge(buildInput(), retriever))
      .rejects.toThrow("support_knowledge_retriever_openrag_auth_401");
    await expect(retrieveSupportKnowledge(buildInput(), retriever))
      .rejects.not.toThrow("test_secret_token");
  });

  it("keeps the json knowledge retriever as a local fake fallback without env", async function () {
    expect(createDefaultSupportKnowledgeRetriever())
      .toBeInstanceOf(JsonFileSupportKnowledgeRetriever);

    const fixturePath = await writeKnowledgeFixture([
      {
        knowledgeId: "android_push_notification_not_received",
        title: "Android push notification not received after new email",
        status: "active",
        source: {
          type: "manual"
        },
        scope: {
          productOrService: ["Android"],
          broadCategoryHints: ["bug"],
          supportNeeds: ["possible_bug"],
          topicKeywords: [
            "push notification",
            "new email",
            "notification"
          ],
          relatedFieldNames: ["platform"]
        },
        knownBehavior: [
          "Android push notification not received after new email"
        ],
        expectedBehavior: [
          "A notification should appear when a new email arrives."
        ],
        acceptanceCriteria: [],
        safeResponseStrategy: [
          "Ask the user to verify Android notification permissions."
        ],
        questionsToAskFirst: ["Which Android version is affected?"],
        doNotClaim: []
      }
    ]);
    const retriever = new JsonFileSupportKnowledgeRetriever(
      new JsonKnowledgeRepository(fixturePath)
    );
    const chunks = await retrieveSupportKnowledge(buildInput(), retriever);

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({
      topicId: 1,
      sourceId: "android_push_notification_not_received"
    });
    expect(chunks[0]?.content).toContain(
      "Android push notification not received after new email"
    );
  });
});
