import "dotenv/config";

import * as fs from "fs/promises";
import * as path from "path";

import {
  buildDefaultAccountInteractionTraits,
  buildDefaultAccountProfile
} from "../../src/archive/orchestration/buildSupportProcessingInput";
import {
  buildEmptyRecentInteractionContext,
  buildRecentInteractionContextFromLiveMemoryContext
} from "../../src/support-automation/build-input/buildSupportProcessingInputV2";
import {
  applyLiveMemoryUpdate
} from "../../src/support-automation/patch-live-memory/applyLiveMemoryUpdate";
import {
  convertLiveMemoryContextToSupportTopicContextV2
} from "../../src/support-automation/build-input/convertLiveMemoryContextToSupportTopicContextV2";
import {
  composeSupportResponsePlan
} from "../../src/support-automation/support-processing-pipeline-v2/compose-support-response-plan/composeSupportResponsePlan";
import {
  renderSupportResponse
} from "../../src/support-automation/support-processing-pipeline-v2/response-renderer/renderSupportResponse";
import {
  runSupportProcessingPipelineV2Debug
} from "../../src/support-automation/support-processing-pipeline-v2/runSupportProcessingPipelineV2Debug";

import type {
  LiveMemoryContext
} from "../../src/infrastructure/live-memory/typesLiveMemoryContext.types";
import type {
  ComposeSupportResponsePlanInput,
  RenderSupportResponseInput,
  SupportProcessingPipelineV2Input,
  TextUnderstanding
} from "../../src/support-automation/support-processing-pipeline-v2/typesSupportProcessingPipelineV2.types";

const REPORT_DIR = "/tmp/support-v2-audit";
const REPORT_PATH = path.join(REPORT_DIR, "report.json");
const CONVERSATION_KEY = "multi_topic_followup_audit";
const USER_ID = "multi-topic-followup-audit-user";
const ROOM_ID = "!multi-topic-followup-audit:example.org";

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

type UnknownRecord = Record<string, unknown>;

type CapturedStepInputs = {
  composeInputs: ComposeSupportResponsePlanInput[];
  renderInputs: RenderSupportResponseInput[];
};

function stringify(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asTextUnderstandings(value: unknown): TextUnderstanding[] {
  if (!isRecord(value)) {
    return [];
  }

  return Array.isArray(value.textUnderstandings)
    ? value.textUnderstandings as TextUnderstanding[]
    : [];
}

function getTopicUpdateDebug(value: unknown): UnknownRecord | undefined {
  if (!isRecord(value) || !isRecord(value.topicUpdateProposalDebug)) {
    return undefined;
  }

  return value.topicUpdateProposalDebug;
}

function isPersistableUnderstanding(understanding: TextUnderstanding): boolean {
  if (understanding.caseDetails.length > 0 ||
    understanding.attemptedActions.length > 0) {
    return true;
  }

  return understanding.messageKinds.some((messageKind) => {
    return messageKind.kind !== "support_context";
  });
}

function evidenceFromUnderstanding(understanding: TextUnderstanding): string[] {
  const sourceVerbatims = Array.isArray(understanding.sourceVerbatims)
    ? understanding.sourceVerbatims.flatMap((value) => {
        return typeof value === "string" && value.trim() !== ""
          ? [value.trim()]
          : [];
      })
    : [];
  const caseDetailEvidence = understanding.caseDetails.flatMap((detail) => {
    return typeof detail.evidence === "string" && detail.evidence.trim() !== ""
      ? [detail.evidence.trim()]
      : [];
  });
  const attemptedActionEvidence = understanding.attemptedActions.flatMap((action) => {
    return typeof action.evidence === "string" && action.evidence.trim() !== ""
      ? [action.evidence.trim()]
      : [];
  });

  return Array.from(new Set([
    ...sourceVerbatims,
    ...caseDetailEvidence,
    ...attemptedActionEvidence
  ]));
}

function summarizeUnderstandings(value: unknown): unknown[] {
  return asTextUnderstandings(value).map((understanding, index) => ({
    index,
    understandingId: understanding.understandingId,
    isPersistable: isPersistableUnderstanding(understanding),
    topicishCategory: typeof understanding.broadCategoryHint === "string"
      ? understanding.broadCategoryHint
      : null,
    summary: understanding.summary,
    messageKinds: understanding.messageKinds,
    caseDetails: understanding.caseDetails,
    attemptedActions: understanding.attemptedActions,
    supportMetadata: understanding.supportMetadata,
    verbatimOrEvidence: evidenceFromUnderstanding(understanding)
  }));
}

function summarizeTextSurface(value: unknown): unknown {
  if (!isRecord(value)) {
    return null;
  }

  return {
    userLanguage: value.userLanguage ?? null,
    classification: asArray(value.segments).map((segment) => {
      if (!isRecord(segment)) {
        return segment;
      }

      return {
        segmentId: segment.segmentId,
        category: segment.category,
        standardSubcategory: segment.standardSubcategory,
        verbatim: segment.verbatim
      };
    })
  };
}

function detectResponseLanguage(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") {
    return "unknown";
  }

  if (/\b(bonjour|merci|vous|votre|vos|pouvez|je|j['’]|comprends|probl[eè]me)\b/iu
    .test(value)) {
    return "fr";
  }

  if (/^(hello|hi|thanks|thank you|i see|i understand|could you)\b/iu
    .test(value.trim())) {
    return "en";
  }

  return "unknown";
}

function finalResponseFromOutput(output: unknown): string | null {
  if (!isRecord(output) || !isRecord(output.userResponse)) {
    return null;
  }

  const messages = asArray(output.userResponse.messages);
  const content = messages.flatMap((message) => {
    return isRecord(message) && typeof message.content === "string"
      ? [message.content]
      : [];
  });

  return content.length > 0 ? content.join("\n\n") : null;
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
      id: `audit_${Date.now()}`,
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
      : { segments_topic: [] },
    conversationHistory: [],
    recentInteractionContext: params.liveMemoryContext
      ? buildRecentInteractionContextFromLiveMemoryContext(params.liveMemoryContext)
      : buildEmptyRecentInteractionContext()
  };
}

function buildTurnReport(params: {
  turnId: string;
  userInput: string;
  input: SupportProcessingPipelineV2Input;
  debugOutput: Awaited<ReturnType<typeof runSupportProcessingPipelineV2Debug>>;
  capturedStepInputs: CapturedStepInputs;
  liveMemoryFinale: LiveMemoryContext | null;
}): UnknownRecord {
  const partial = params.debugOutput.partial;
  const output = params.debugOutput.output;
  const topicUpdateDebug = getTopicUpdateDebug(partial.proposeTopicUpdates);
  const finalBotResponse = finalResponseFromOutput(output);

  return {
    turnId: params.turnId,
    userInput: params.userInput,
    inputSupportTopicKnowledge: params.input.supportTopicKnowledge,
    textSurfaceAnalysis: summarizeTextSurface(partial.analyzeTextSurface),
    supportTextAnalysis: {
      raw: partial.analyzeSupportText,
      textUnderstandings: summarizeUnderstandings(partial.analyzeSupportText)
    },
    proposeTopicUpdates: {
      rawText: topicUpdateDebug?.rawResponse ?? null,
      rawParsedResponse: topicUpdateDebug?.rawParsedResponse ?? null,
      rawOpsCount: topicUpdateDebug?.rawOpsCount ?? null,
      topicUpdateOps: output?.topicUpdateOps ?? [],
      rejectedOps: topicUpdateDebug?.rejectedOps ?? [],
      uncoveredPersistableItemIndexes:
        topicUpdateDebug?.uncoveredPersistableItemIndexes ?? [],
      debug: topicUpdateDebug ?? null
    },
    topicPatches: output?.topicPatches ?? [],
    mergedTopicSnapshots: output?.mergedTopicSnapshots ?? [],
    persistenceEffects: {
      liveMemoryUpdate: output?.persistenceEffects.liveMemoryUpdate ?? null
    },
    liveMemoryFinale: params.liveMemoryFinale,
    topicResponsePlansReceivedByCompose:
      params.capturedStepInputs.composeInputs.at(-1)?.topicResponsePlans ?? [],
    composeSupportResponsePlan: {
      input: params.capturedStepInputs.composeInputs.at(-1) ?? null,
      output: partial.composeSupportResponsePlan ?? null
    },
    renderSupportResponse: {
      input: params.capturedStepInputs.renderInputs.at(-1) ?? null,
      inputTargetLanguage:
        params.capturedStepInputs.renderInputs.at(-1)?.targetLanguage ?? null,
      output: partial.renderSupportResponse ?? null
    },
    finalBotResponse,
    finalResponseLanguage: detectResponseLanguage(finalBotResponse)
  };
}

function buildSummary(turnReport: UnknownRecord): UnknownRecord {
  const understandings = isRecord(turnReport.supportTextAnalysis)
    ? asArray(turnReport.supportTextAnalysis.textUnderstandings)
    : [];
  const proposeTopicUpdates = isRecord(turnReport.proposeTopicUpdates)
    ? turnReport.proposeTopicUpdates
    : {};
  const liveMemoryFinale = isRecord(turnReport.liveMemoryFinale)
    ? turnReport.liveMemoryFinale
    : {};
  const finalTopics = asArray(liveMemoryFinale.topics);

  return {
    turnId: turnReport.turnId,
    understandingsCount: understandings.length,
    persistableUnderstandingsCount: understandings.filter((understanding) => {
      return isRecord(understanding) && understanding.isPersistable === true;
    }).length,
    rawOpsCount: isRecord(proposeTopicUpdates)
      ? proposeTopicUpdates.rawOpsCount ?? null
      : null,
    validOpsCount: isRecord(proposeTopicUpdates)
      ? asArray(proposeTopicUpdates.topicUpdateOps).length
      : 0,
    rejectedOpsCount: isRecord(proposeTopicUpdates)
      ? asArray(proposeTopicUpdates.rejectedOps).length
      : 0,
    uncoveredPersistableItemIndexes: isRecord(proposeTopicUpdates)
      ? proposeTopicUpdates.uncoveredPersistableItemIndexes ?? []
      : [],
    finalTopicIds: finalTopics.flatMap((topic) => {
      return isRecord(topic) ? [topic.topicId] : [];
    }),
    finalResponseLanguage: turnReport.finalResponseLanguage
  };
}

async function writeInitialLiveMemory(): Promise<void> {
  process.env.LIVE_MEMORY_CONTEXT_DIR = REPORT_DIR;
  await fs.rm(REPORT_DIR, { recursive: true, force: true });
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
  report: UnknownRecord;
  liveMemoryFinale: LiveMemoryContext | null;
}> {
  const input = buildInput({
    userInput: params.userInput,
    liveMemoryContext: params.liveMemoryContext
  });
  const capturedStepInputs: CapturedStepInputs = {
    composeInputs: [],
    renderInputs: []
  };
  const debugOutput = await runSupportProcessingPipelineV2Debug(
    input,
    {
      composeSupportResponsePlan: async (composeInput) => {
        capturedStepInputs.composeInputs.push(composeInput);
        const result = await composeSupportResponsePlan(composeInput);

        return result.composedSupportResponsePlan;
      },
      renderSupportResponse: async (renderInput) => {
        capturedStepInputs.renderInputs.push(renderInput);
        const result = await renderSupportResponse(renderInput);

        return result.renderedResponse;
      }
    },
    {
      collectProgressEvents: true
    }
  );
  const output = debugOutput.output;
  let liveMemoryFinale: LiveMemoryContext | null = null;

  if (output?.persistenceEffects.liveMemoryUpdate) {
    liveMemoryFinale = await applyLiveMemoryUpdate({
      turnIdentity: {
        channel: "matrix",
        conversationKey: CONVERSATION_KEY,
        roomId: ROOM_ID,
        threadId: null,
        userId: USER_ID
      },
      liveMemoryUpdate: output.persistenceEffects.liveMemoryUpdate,
      // No external delivery: this only tells persistence which generated text
      // would have been delivered if a channel adapter had sent it.
      deliveryResult: {
        status: "sent",
        deliveredMessages: output.userResponse.messages.map((message) => ({
          content: message.content
        }))
      }
    });
  }

  return {
    liveMemoryFinale,
    report: buildTurnReport({
      turnId: params.turnId,
      userInput: params.userInput,
      input,
      debugOutput,
      capturedStepInputs,
      liveMemoryFinale
    })
  };
}

async function main(): Promise<void> {
  await writeInitialLiveMemory();

  const reports: UnknownRecord[] = [];
  let liveMemoryContext: LiveMemoryContext | null = null;

  for (const turnInput of turnInputs) {
    const result = await runTurn({
      ...turnInput,
      liveMemoryContext
    });

    reports.push(result.report);
    liveMemoryContext = result.liveMemoryFinale;
  }

  const report = {
    reportPath: REPORT_PATH,
    liveMemoryContextDir: REPORT_DIR,
    deliveryMode: "no_external_delivery_applyLiveMemoryUpdate_only",
    turns: reports,
    consoleSummary: reports.map(buildSummary)
  };

  await fs.writeFile(REPORT_PATH, `${stringify(report)}\n`, "utf8");

  console.log(`Wrote ${REPORT_PATH}`);
  console.log(stringify(report.consoleSummary));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
