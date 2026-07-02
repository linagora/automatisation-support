import "dotenv/config";

import * as fs from "fs/promises";
import * as path from "path";

import {
  buildDefaultAccountInteractionTraits,
  buildDefaultAccountProfile
} from "../../../src/archive/orchestration/buildSupportProcessingInput";
import {
  buildEmptyRecentInteractionContext,
  buildRecentInteractionContextFromLiveMemoryContext
} from "../../../src/support-automation/build-input/buildSupportProcessingInputV2";
import {
  applyLiveMemoryUpdate
} from "../../../src/support-automation/patch-live-memory/applyLiveMemoryUpdate";
import {
  convertLiveMemoryContextToSupportTopicContextV2
} from "../../../src/support-automation/build-input/convertLiveMemoryContextToSupportTopicContextV2";
import {
  composeSupportResponsePlan
} from "../../../src/support-automation/support-processing-pipeline-v2/compose-support-response-plan/composeSupportResponsePlan";
import {
  planKnowledgeEnrichment
} from "../../../src/support-automation/support-processing-pipeline-v2/plan-knowledge-enrichment/planKnowledgeEnrichment";
import {
  renderSupportResponse
} from "../../../src/support-automation/support-processing-pipeline-v2/response-renderer/renderSupportResponse";
import {
  retrieveSupportKnowledge
} from "../../../src/support-automation/support-processing-pipeline-v2/retrieve-support-knowledge/retrieveSupportKnowledge";
import {
  runSupportProcessingPipelineV2Debug
} from "../../../src/support-automation/support-processing-pipeline-v2/runSupportProcessingPipelineV2Debug";
import {
  synthesizeRetrievedKnowledge
} from "../../../src/support-automation/support-processing-pipeline-v2/synthesize-retrieved-knowledge/synthesizeRetrievedKnowledge";

import type {
  LiveMemoryContext
} from "../../../src/infrastructure/live-memory/typesLiveMemoryContext.types";
import type {
  KnowledgeChunk,
  KnowledgeEnrichmentPlan,
  MergedTopicSnapshot,
  RagUsage,
  RetrievedKnowledgeSynthesis,
  RetrieveSupportKnowledgeInput,
  SynthesizeRetrievedKnowledgeInput,
  PlanKnowledgeEnrichmentInput,
  SupportProcessingPipelineV2Input,
  SupportProcessingPipelineV2Steps
} from "../../../src/support-automation/support-processing-pipeline-v2/typesSupportProcessingPipelineV2.types";

const REPORT_DIR = path.join(process.cwd(), "tmp", "global-pipeline-audits");
const REPORT_PATH = path.join(REPORT_DIR, "synthesis-coverage.json");
const CONVERSATION_KEY = "synthesis_coverage_audit";
const USER_ID = "synthesis-coverage-audit-user";
const ROOM_ID = "!synthesis-coverage-audit:example.org";

const turnInputs = [
  {
    turnId: "turn_1",
    userInput: [
      "Salut, j'ai besoin d'aide",
      "J'ai reçu 2 factures au lieu d'1 seul le mois dernier pour abonnement twake à 9,99€/mois",
      "J'ai pas de notifications sur mon tél"
    ].join("\n")
  },
  {
    turnId: "turn_2",
    userInput: [
      "Concernant : Est-ce que ce doublon concerne uniquement le document ou aussi le paiement ? oui ça concerne le paiement aussi j'ai été prélevé par cozy et par twake, sans doute un probleme de migration",
      "",
      "Concernant : j'ai bien mis toutes les autorisations nécessaires de notifications. evidemment l'appli est bien installé. Plateforme android sur mon tel 9.0"
    ].join("\n")
  }
];

const emptyLiveMemory: LiveMemoryContext = {
  topics: [],
  lastUserVerbatim: null,
  lastBotVerbatim: null,
  userState: {
    status: "normal",
    flags: []
  }
};

type TopicAuditRecord = {
  topicId: number | null;
  title: string | null;
  knowledgeRoute: string;
  ragStatus: string;
  ragResponseChars: number;
  synthesizeCalled: boolean;
  snapshotSupportKnowledgeSummary: string | null;
  persistedSupportKnowledgeSummary: string | null;
  finalSupportKnowledgeSummary: string | null;
  alerts: string[];
};

type TurnAuditReport = {
  turnId: string;
  userInput: string;
  topics: TopicAuditRecord[];
};

type PlanCall = {
  topicId: number | null;
  plan: KnowledgeEnrichmentPlan;
};

type RetrieveCall = {
  topicId: number | null;
  chunks: KnowledgeChunk[];
};

type SynthesisCall = {
  topicId: number | null;
  synthesis: RetrievedKnowledgeSynthesis;
};

type CapturedKnowledgeCalls = {
  planCalls: PlanCall[];
  retrieveCalls: RetrieveCall[];
  synthesisCalls: SynthesisCall[];
};

function stringify(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function compactText(value: string | null | undefined): string | null {
  const compacted = value?.replace(/\s+/g, " ").trim();

  return compacted && compacted.length > 0 ? compacted : null;
}

function topicIdFromBranchInput(
  input: PlanKnowledgeEnrichmentInput | RetrieveSupportKnowledgeInput | SynthesizeRetrievedKnowledgeInput
): number | null {
  return input.topicSnapshot?.topicId ??
    input.topicEvidence.topicSnapshot?.topicId ??
    input.topicEvidence.topicId ??
    null;
}

function titleFromSnapshot(snapshot: MergedTopicSnapshot | undefined): string | null {
  return compactText(snapshot?.title);
}

function buildInput(params: {
  userInput: string;
  liveMemoryContext: LiveMemoryContext | null;
}): SupportProcessingPipelineV2Input {
  return {
    conversationScope: {
      channel: "matrix",
      roomId: ROOM_ID,
      threadId: null,
      userId: USER_ID
    },
    latestUserMessage: {
      id: `synthesis_audit_${Date.now()}`,
      channel: "twake_chat",
      content: params.userInput,
      sentAt: new Date().toISOString()
    },
    latestUserAttachments: [],
    accountTrustStatus: {
      status: "trusted",
      reasons: ["local_replay"]
    },
    accountProfile: buildDefaultAccountProfile(USER_ID),
    accountInteractionTraits: buildDefaultAccountInteractionTraits(),
    supportTopicKnowledge: params.liveMemoryContext
      ? convertLiveMemoryContextToSupportTopicContextV2(params.liveMemoryContext)
      : { topics: [] },
    conversationHistory: [],
    recentInteractionContext: params.liveMemoryContext
      ? buildRecentInteractionContextFromLiveMemoryContext(params.liveMemoryContext)
      : buildEmptyRecentInteractionContext()
  };
}

function buildObservedSteps(
  captured: CapturedKnowledgeCalls
): SupportProcessingPipelineV2Steps {
  return {
    planKnowledgeEnrichment: async (input) => {
      const plan = await planKnowledgeEnrichment(input);
      captured.planCalls.push({
        topicId: topicIdFromBranchInput(input),
        plan
      });

      return plan;
    },
    retrieveSupportKnowledge: async (input) => {
      const chunks = await retrieveSupportKnowledge(input);
      captured.retrieveCalls.push({
        topicId: topicIdFromBranchInput(input),
        chunks
      });

      return chunks;
    },
    synthesizeRetrievedKnowledge: async (input) => {
      const synthesis = await synthesizeRetrievedKnowledge(input);
      captured.synthesisCalls.push({
        topicId: topicIdFromBranchInput(input),
        synthesis
      });

      return synthesis;
    },
    composeSupportResponsePlan: async (input) => {
      const result = await composeSupportResponsePlan(input);

      return result.composedSupportResponsePlan;
    },
    renderSupportResponse: async (input) => {
      const result = await renderSupportResponse(input);

      return result.renderedResponse;
    }
  };
}

function routeByTopic(calls: PlanCall[], topicId: number | null): string {
  return calls.find((call) => call.topicId === topicId)?.plan.route ?? "none";
}

function ragUsageByTopic(ragUsage: RagUsage[], topicId: number | null): RagUsage | undefined {
  return ragUsage.find((usage) => usage.topicId === topicId);
}

function hasSynthesisCall(calls: SynthesisCall[], topicId: number | null): boolean {
  return calls.some((call) => call.topicId === topicId);
}

function summaryMentionsUsefulness(summary: string | null): boolean {
  if (!summary) {
    return false;
  }

  return /\b(useful|usable|relevant|not useful|no usable|no relevant|inutile|utile|pertinente?|aucune connaissance)\b/iu
    .test(summary);
}

function buildAlerts(record: Omit<TopicAuditRecord, "alerts">): string[] {
  const alerts: string[] = [];

  if (record.knowledgeRoute !== "none" && !record.synthesizeCalled) {
    alerts.push("route_requires_attention_but_synthesis_not_called");
  }

  if (!compactText(record.snapshotSupportKnowledgeSummary)) {
    alerts.push("missing_snapshot_supportKnowledgeSummary");
  }

  if (!compactText(record.persistedSupportKnowledgeSummary)) {
    alerts.push("missing_persisted_supportKnowledgeSummary");
  }

  if (!compactText(record.finalSupportKnowledgeSummary)) {
    alerts.push("missing_final_supportKnowledgeSummary");
  }

  if (
    record.ragStatus === "success" &&
    !summaryMentionsUsefulness(record.finalSupportKnowledgeSummary)
  ) {
    alerts.push("rag_success_summary_does_not_qualify_usefulness");
  }

  return alerts;
}

function uniqueTopicIds(params: {
  snapshots: MergedTopicSnapshot[];
  ragUsage: RagUsage[];
  planCalls: PlanCall[];
  synthesisCalls: SynthesisCall[];
}): (number | null)[] {
  const ids = [
    ...params.snapshots.map((snapshot) => snapshot.topicId),
    ...params.ragUsage.map((usage) => usage.topicId),
    ...params.planCalls.map((call) => call.topicId),
    ...params.synthesisCalls.map((call) => call.topicId)
  ];

  return Array.from(new Set(ids));
}

function buildTurnAudit(params: {
  turnId: string;
  userInput: string;
  output: NonNullable<Awaited<ReturnType<typeof runSupportProcessingPipelineV2Debug>>["output"]>;
  liveMemoryFinale: LiveMemoryContext | null;
  captured: CapturedKnowledgeCalls;
}): TurnAuditReport {
  const snapshots = params.output.mergedTopicSnapshots ?? [];
  const ragUsage = params.output.ragUsage ?? [];
  const persistedTopics =
    params.output.persistenceEffects.liveMemoryUpdate.topics ?? [];
  const finalTopics = params.liveMemoryFinale?.topics ?? [];
  const topicIds = uniqueTopicIds({
    snapshots,
    ragUsage,
    planCalls: params.captured.planCalls,
    synthesisCalls: params.captured.synthesisCalls
  });

  const topics = topicIds.map((topicId): TopicAuditRecord => {
    const snapshot = snapshots.find((item) => item.topicId === topicId);
    const persistedTopic = persistedTopics.find((item) => item.topicId === topicId);
    const finalTopic = finalTopics.find((item) => item.topicId === topicId);
    const usage = ragUsageByTopic(ragUsage, topicId);
    const record = {
      topicId,
      title: titleFromSnapshot(snapshot) ??
        compactText(persistedTopic?.title) ??
        compactText(finalTopic?.title),
      knowledgeRoute: routeByTopic(params.captured.planCalls, topicId),
      ragStatus: usage?.status ?? "not_recorded",
      ragResponseChars: usage?.responseChars ?? 0,
      synthesizeCalled: hasSynthesisCall(params.captured.synthesisCalls, topicId),
      snapshotSupportKnowledgeSummary:
        compactText(snapshot?.supportKnowledgeSummary),
      persistedSupportKnowledgeSummary:
        compactText(persistedTopic?.supportKnowledgeSummary),
      finalSupportKnowledgeSummary:
        compactText(finalTopic?.supportKnowledgeSummary)
    };

    return {
      ...record,
      alerts: buildAlerts(record)
    };
  });

  return {
    turnId: params.turnId,
    userInput: params.userInput,
    topics: topics.sort((left, right) => {
      return (left.topicId ?? 0) - (right.topicId ?? 0);
    })
  };
}

function summaryStatus(record: TopicAuditRecord): string {
  return compactText(record.finalSupportKnowledgeSummary) ? "present" : "missing";
}

function printTurnTable(turn: TurnAuditReport): void {
  console.log("");
  console.log(`Turn ${turn.turnId}`);
  console.log("topicId | route           | ragStatus | ragChars | synthCalled | summaryStatus");

  for (const topic of turn.topics) {
    const values = [
      String(topic.topicId ?? "null").padEnd(7),
      topic.knowledgeRoute.padEnd(15),
      topic.ragStatus.padEnd(9),
      String(topic.ragResponseChars).padEnd(8),
      String(topic.synthesizeCalled).padEnd(11),
      summaryStatus(topic)
    ];

    console.log(values.join(" | "));
  }
}

function printFinalSummary(turns: TurnAuditReport[]): void {
  const topics = turns.flatMap((turn) => turn.topics.map((topic) => ({
    turnId: turn.turnId,
    ...topic
  })));
  const ragSuccessCount = topics.filter((topic) => topic.ragStatus === "success").length;
  const synthesisCallCount = topics.filter((topic) => topic.synthesizeCalled).length;
  const missingSummaryCount = topics.filter((topic) => {
    return !compactText(topic.finalSupportKnowledgeSummary);
  }).length;
  const suspects = topics.filter((topic) => topic.alerts.length > 0);

  console.log("");
  console.log(`Topics traités: ${topics.length}`);
  console.log(`Topics avec RAG success: ${ragSuccessCount}`);
  console.log(`synthesizeRetrievedKnowledge calls: ${synthesisCallCount}`);
  console.log(`Topics sans supportKnowledgeSummary final: ${missingSummaryCount}`);
  console.log("Topics suspects:");

  if (suspects.length === 0) {
    console.log("  none");
    return;
  }

  for (const suspect of suspects) {
    console.log(
      `  ${suspect.turnId} topicId=${suspect.topicId ?? "null"} alerts=${suspect.alerts.join(",")}`
    );
  }
}

async function writeInitialLiveMemory(): Promise<void> {
  process.env.LIVE_MEMORY_CONTEXT_DIR = REPORT_DIR;
  await fs.mkdir(REPORT_DIR, { recursive: true });
  await fs.writeFile(
    path.join(REPORT_DIR, `${CONVERSATION_KEY}.json`),
    `${stringify(emptyLiveMemory)}\n`,
    "utf8"
  );
}

async function runTurn(params: {
  turnId: string;
  userInput: string;
  liveMemoryContext: LiveMemoryContext | null;
}): Promise<{
  turnReport: TurnAuditReport;
  liveMemoryFinale: LiveMemoryContext | null;
}> {
  const input = buildInput({
    userInput: params.userInput,
    liveMemoryContext: params.liveMemoryContext
  });
  const captured: CapturedKnowledgeCalls = {
    planCalls: [],
    retrieveCalls: [],
    synthesisCalls: []
  };
  const debugOutput = await runSupportProcessingPipelineV2Debug(
    input,
    buildObservedSteps(captured),
    {
      collectProgressEvents: true
    }
  );

  if (!debugOutput.output) {
    throw new Error(`Pipeline stopped before completion for ${params.turnId}`);
  }

  const liveMemoryFinale = await applyLiveMemoryUpdate({
    turnIdentity: {
      channel: "matrix",
      conversationKey: CONVERSATION_KEY,
      roomId: ROOM_ID,
      threadId: null,
      userId: USER_ID
    },
    liveMemoryUpdate: debugOutput.output.persistenceEffects.liveMemoryUpdate,
    // Local replay only: no Matrix send, just provide the delivered text that
    // persistence would store after a successful delivery.
    deliveryResult: {
      status: "sent",
      deliveredMessages: debugOutput.output.userResponse.messages.map((message) => ({
        content: message.content
      }))
    }
  });

  return {
    liveMemoryFinale,
    turnReport: buildTurnAudit({
      turnId: params.turnId,
      userInput: params.userInput,
      output: debugOutput.output,
      liveMemoryFinale,
      captured
    })
  };
}

async function main(): Promise<void> {
  await writeInitialLiveMemory();

  const turns: TurnAuditReport[] = [];
  let liveMemoryContext: LiveMemoryContext | null = null;

  for (const turnInput of turnInputs) {
    const result = await runTurn({
      ...turnInput,
      liveMemoryContext
    });

    turns.push(result.turnReport);
    liveMemoryContext = result.liveMemoryFinale;
  }

  const report = {
    reportPath: REPORT_PATH,
    deliveryMode: "no_external_delivery_applyLiveMemoryUpdate_only",
    turns
  };

  await fs.writeFile(REPORT_PATH, `${stringify(report)}\n`, "utf8");

  for (const turn of turns) {
    printTurnTable(turn);
  }

  printFinalSummary(turns);
  console.log("");
  console.log(`Wrote ${REPORT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
