import type {LiveMemoryTopicOptimized} from "../../../infrastructure/live-memory/liveMemoryContextOptimized.template";
import type {RunSupportProcessingPipelineV3OptimizedIntermOutputs} from "../runSupportProcessingPipelineOptimized";
import type {
  AnalyzeSupportTextAttemptedAction,
  AnalyzeSupportTextCaseDetail,
  AnalyzeSupportTextOther
} from "../analyze-support-text-optimized/runAnalyzeSupportText";

/**
 * Entrées nécessaires pour transformer les sorties du pipeline
 * en instructions de mise à jour de la live memory.
 *
 * Ce fichier ne lit et n'écrit pas la mémoire persistée.
 * Il produit uniquement un patch qui sera ensuite appliqué
 * par applyLiveMemoryPatch.
 */
export type BuildLiveMemoryPatchesInput = {
  latestUserMessage: {
    content: string;
    channel?: string;
  };

  latestUserAttachments: unknown[];

  /**
   * Seule la raison de handover existante est nécessaire ici.
   * Elle sert à fusionner les nouvelles raisons sans perdre
   * celles déjà enregistrées.
   */
  liveMemory: {
    handover: {
      handoverReason: string | null;
    };
  };

  /**
   * Ensemble des sorties intermédiaires produites pendant
   * l'exécution du pipeline courant.
   */
  intermOutputs: RunSupportProcessingPipelineV3OptimizedIntermOutputs;
};

/**
 * Patch global de la live memory.
 *
 * Dans cette structure, null signifie généralement :
 * "aucune modification à appliquer pour cette section".
 *
 * Cette convention doit être distinguée des nulls métier
 * qui peuvent exister à l'intérieur des objets.
 */
export type BuildLiveMemoryPatchesOutput = {
  handover: {
    isHandover: boolean;
    handoverReason: string | null;
  } | null;

  previousConversationTurn: {
    previousUserMessage: string | null;
    previousBotMessage: string | null;
  } | null;

  failedPipelineMessages: Array<{
    concernedUserMessage: string[];
    concernedAttachment: unknown;
    fallbackReason: unknown;
  }> | null;

  securityAlerts: Array<{
    concernedUserMessage: string[];
    concernedAttachment: unknown[];
    flags: string[];
  }> | null;

  userState: {
    status: null;
    flags: string[];
  } | null;

  topics: BuildLiveMemoryTopicPatch[] | null;
};

/**
 * Représentation normalisée d'un échec RAG non bloquant.
 *
 * Ces erreurs sont conservées dans failedPipelineMessages,
 * sans nécessairement faire échouer tout le pipeline.
 */
type RagFailure = {
  source: "rag";
  reason: "rag_failed";
  errorName: string | null;
  errorMessage: string;
};

/**
 * Ensemble des facts atomiques produits par analyzeSupportText.
 *
 * Ils seront ensuite filtrés topic par topic selon les identifiants
 * retournés par proposeTopicUpdates.
 */
type AtomicSupportFacts = {
  caseDetailsExtracted: AnalyzeSupportTextCaseDetail[];
  attemptedActionsExtracted: AnalyzeSupportTextAttemptedAction[];
  otherExtracted: AnalyzeSupportTextOther[];
};

/**
 * Patch d'un topic.
 *
 * topicId peut être null lorsque proposeTopicUpdates demande
 * la création d'un nouveau topic. L'identifiant définitif sera
 * attribué lors de l'application du patch.
 */
export type BuildLiveMemoryTopicPatch = {
  status: LiveMemoryTopicOptimized["status"];

  sourceAnalyzeSupportText: LiveMemoryTopicOptimized["sourceAnalyzeSupportText"];

  sourceProposeTopicUpdates: Omit<
    LiveMemoryTopicOptimized["sourceProposeTopicUpdates"],
    "topicId"
  > & {
    topicId: number | null;
  };

  sourceTopicManager: LiveMemoryTopicOptimized["sourceTopicManager"];
};

/**
 * Point d'entrée principal.
 *
 * Étapes :
 * 1. Initialiser un patch vide.
 * 2. Construire les mises à jour globales.
 * 3. Construire les mises à jour de topics si proposeTopicUpdates
 *    a effectivement été exécuté.
 */
export function buildLiveMemoryPatches(
  input: BuildLiveMemoryPatchesInput
): BuildLiveMemoryPatchesOutput {
  const patch: BuildLiveMemoryPatchesOutput = {
    handover: null,
    previousConversationTurn: null,
    failedPipelineMessages: null,
    securityAlerts: null,
    userState: null,
    topics: null
  };

  buildGlobalLiveMemoryPatch(input, patch);

  /**
   * Les topics ne peuvent être construits que si le pipeline
   * possède une sortie de proposeTopicUpdates.
   *
   * Le contrôle du statut "analyzed" est effectué plus bas
   * dans buildTopicLiveMemoryPatch.
   */
  if (
    input.intermOutputs.proposeTopicUpdatesOutput !== null &&
    input.intermOutputs.proposeTopicUpdatesOutput !== undefined
  ) {
    buildTopicLiveMemoryPatch(input, patch);
  }

  return patch;
}

/**
 * Construit les parties globales du patch :
 * - previousConversationTurn ;
 * - handover demandé directement par l'utilisateur ;
 * - alertes de sécurité ;
 * - userState ;
 * - échecs RAG non bloquants.
 *
 * Cette fonction modifie l'objet patch reçu en paramètre.
 */
function buildGlobalLiveMemoryPatch(
  input: BuildLiveMemoryPatchesInput,
  patch: BuildLiveMemoryPatchesOutput
): BuildLiveMemoryPatchesOutput {
  const flags: string[] = [];

  /**
   * Première source de flags :
   * les patterns suspects détectés avant l'analyse de surface.
   */
  if (input.intermOutputs.detectSuspiciousPromptPatternsOutput) {
    flags.push(
      ...input.intermOutputs.detectSuspiciousPromptPatternsOutput.matchedPatternIds
    );
  }

  /**
   * Deuxième source de flags :
   * les segments classés safety_sensitive par analyzeTextSurface.
   */
  if (input.intermOutputs.analyzeTextSurfaceOutput?.status === "analyzed") {
    for (const segment of input.intermOutputs.analyzeTextSurfaceOutput.segments) {
      if (
        segment.category === "safety_sensitive" &&
        typeof segment.standardSubcategory === "string"
      ) {
        flags.push(segment.standardSubcategory);
      }
    }
  }

  /**
   * Un même signal peut être produit par plusieurs briques.
   * On ne conserve donc chaque flag qu'une seule fois.
   */
  const dedupedFlags = [...new Set(flags)];

  /**
   * Le tour précédent n'est enregistré que lorsqu'un message final
   * a été traité par translateMessage.
   *
   * Le message réellement livré pourra ensuite remplacer
   * previousBotMessage dans applyLiveMemoryPatch.
   */
  if (input.intermOutputs.translateMessageOutput?.status === "processed") {
    patch.previousConversationTurn = {
      previousUserMessage: input.latestUserMessage.content,
      previousBotMessage: input.intermOutputs.translateMessageOutput.message
    };
  }

  /**
   * Un handover demandé explicitement dans le message utilisateur
   * est enregistré au niveau global.
   */
  if (hasHandoverRequestedSurface(input.intermOutputs.analyzeTextSurfaceOutput)) {
    patch.handover = {
      isHandover: true,
      handoverReason: buildMergedHandoverReason({
        existingReason: input.liveMemory.handover.handoverReason,
        newReasons: ["asked_by_user"]
      })
    };
  }

  /**
   * Les signaux de sécurité mettent à jour :
   * - l'état utilisateur ;
   * - l'historique des alertes de sécurité.
   */
  if (dedupedFlags.length > 0) {
    patch.userState = {
      status: null,
      flags: dedupedFlags
    };

    patch.securityAlerts = [
      {
        concernedUserMessage: [input.latestUserMessage.content],
        concernedAttachment: input.latestUserAttachments,
        flags: dedupedFlags
      }
    ];
  }

  /**
   * Certains échecs techniques, notamment RAG, sont enregistrés
   * sans nécessairement interrompre l'ensemble du traitement.
   */
  patch.failedPipelineMessages = buildNonBlockingFailedPipelineMessages(input);

  return patch;
}

/**
 * Transforme les échecs RAG trouvés dans les outputs de topics
 * en entrées failedPipelineMessages.
 */
function buildNonBlockingFailedPipelineMessages(
  input: BuildLiveMemoryPatchesInput
): Array<{
  concernedUserMessage: string[];
  concernedAttachment: unknown;
  fallbackReason: unknown;
}> | null {
  const ragFailures = collectRagFailures(input);

  if (ragFailures.length === 0) {
    return null;
  }

  return ragFailures.map((ragFailure) => {
    return {
      concernedUserMessage: [input.latestUserMessage.content],
      concernedAttachment: input.latestUserAttachments,
      fallbackReason: ragFailure
    };
  });
}

/**
 * Parcourt tous les outputs des topic managers et récupère
 * les éventuels échecs RAG de la branche issue-resolution.
 */
function collectRagFailures(
  input: BuildLiveMemoryPatchesInput
): RagFailure[] {
  const topicManagerOutputs = input.intermOutputs.topicManagerOutputs ?? [];

  return topicManagerOutputs.flatMap((topicManagerOutput) => {
    const retrieveKnowledgeOutput =
      extractRetrieveKnowledgeOutput(topicManagerOutput);

    const ragFailure = retrieveKnowledgeOutput?.ragFailure;

    return ragFailure ? [ragFailure] : [];
  });
}

/**
 * Accès défensif à un sous-objet profond du topic manager.
 *
 * Le paramètre est unknown afin de ne pas dépendre directement
 * de l'ensemble du type interne du topic manager.
 */
function extractRetrieveKnowledgeOutput(
  topicManagerOutput: unknown
): {
  ragFailure?: RagFailure;
} | null {
  if (!topicManagerOutput || typeof topicManagerOutput !== "object") {
    return null;
  }

  const candidate = topicManagerOutput as {
    intermediateOutputs?: {
      issueResolutionBranchOutput?: {
        internalOutputs?: {
          retrieveKnowledgeOutput?: {
            ragFailure?: RagFailure;
          };
        };
      };
    };
  };

  return candidate.intermediateOutputs
    ?.issueResolutionBranchOutput
    ?.internalOutputs
    ?.retrieveKnowledgeOutput ?? null;
}

/**
 * Construit les patches de topics.
 *
 * Étapes :
 * 1. Vérifier que proposeTopicUpdates a réussi.
 * 2. Collecter les facts atomiques du message.
 * 3. Pour chaque plan de topic :
 *    - retrouver le topicManagerOutput correspondant ;
 *    - sélectionner les facts associés ;
 *    - reprendre le statut produit par le topic manager ;
 *    - construire le patch final.
 * 4. Propager les demandes temporaires de handover au niveau global.
 */
function buildTopicLiveMemoryPatch(
  input: BuildLiveMemoryPatchesInput,
  patch: BuildLiveMemoryPatchesOutput
): BuildLiveMemoryPatchesOutput {
  const proposeTopicUpdatesOutput = input.intermOutputs.proposeTopicUpdatesOutput;

  if (!proposeTopicUpdatesOutput || proposeTopicUpdatesOutput.status !== "analyzed") {
    return patch;
  }

  const topicManagerOutputs = input.intermOutputs.topicManagerOutputs ?? [];

  const supportTextFacts = collectAnalyzeSupportTextFacts(
    input.intermOutputs.analyzeSupportTextOutput
  );

  const surfaceHandoverRequested = hasHandoverRequestedSurface(
    input.intermOutputs.analyzeTextSurfaceOutput
  );

  const topicPatches: BuildLiveMemoryTopicPatch[] = [];
  const topicHandoverRequests: Array<{
    isRequested: boolean;
    reason: string | null;
  }> = [];

  /**
   * Invariant important :
   * topicUpdatePlans et topicManagerOutputs doivent avoir
   * le même ordre et la même cardinalité.
   */
  for (
    const [topicIndex, topicUpdatePlan]
    of proposeTopicUpdatesOutput.topicUpdatePlans.entries()
  ) {
    const topicManagerOutput = topicManagerOutputs[topicIndex];

    if (!topicManagerOutput || topicManagerOutput.status !== "processed") {
      throw new Error("Missing processed topicManagerOutput for topic patch");
    }

    /**
     * Ne conserve dans ce topic que les facts explicitement
     * référencés par le plan de routing.
     */
    const relatedFacts = selectSourceFacts({
      facts: supportTextFacts,
      topicUpdatePlan
    });

    const sourceTopicManager = topicManagerOutput.sourceTopicManager;
    topicHandoverRequests.push(topicManagerOutput.topicHandoverRequest);

    topicPatches.push({
      status: topicManagerOutput.topicStatus,

      /**
       * Les identifiants techniques des facts sont retirés avant
       * leur stockage dans la live memory.
       */
      sourceAnalyzeSupportText: {
        caseDetailsExtracted: relatedFacts.caseDetailsExtracted.map(
          (caseDetail) => {
            return {
              key: caseDetail.key,
              value: caseDetail.value,
              evidence: caseDetail.evidence,
              status: caseDetail.status
            };
          }
        ),

        attemptedActionsExtracted: relatedFacts.attemptedActionsExtracted.map(
          (attemptedAction) => {
            return {
              action: attemptedAction.action,
              outcome: attemptedAction.outcome,
              evidence: attemptedAction.evidence,
              status: attemptedAction.status
            };
          }
        )
      },

      /**
       * topicId reste null pour un nouveau topic.
       * Il sera attribué lors de l'application du patch.
       */
      sourceProposeTopicUpdates: {
        topicId: topicUpdatePlan.topicId,
        title: topicUpdatePlan.title,
        summaryTopic: topicUpdatePlan.summaryTopic,
        supportDomain: {
          value: topicUpdatePlan.supportDomain.value,
          reason: topicUpdatePlan.supportDomain.reason
        }
      },

      /**
       * L'état complet du topic manager est enregistré tel quel.
       */
      sourceTopicManager
    });
  }

  patch.topics = topicPatches.length > 0 ? topicPatches : null;

  /**
   * Si au moins un topic demande un handover, le handover global
   * est également activé et toutes les raisons sont fusionnées.
   */
  if (
    topicHandoverRequests.some((handoverRequest) => handoverRequest.isRequested)
  ) {
    const newHandoverReasons = [
      ...collectTopicHandoverReasons(topicHandoverRequests),
      ...(surfaceHandoverRequested ? ["asked_by_user"] : [])
    ];

    patch.handover = {
      isHandover: true,
      handoverReason: buildMergedHandoverReason({
        existingReason: input.liveMemory.handover.handoverReason,
        newReasons: newHandoverReasons
      })
    };
  }

  return patch;
}

/**
 * Récupère les raisons de handover non vides
 * dans les patches de topics.
 */
function collectTopicHandoverReasons(
  topicHandoverRequests: Array<{
    isRequested: boolean;
    reason: string | null;
  }>
): string[] {
  return topicHandoverRequests
    .filter((handover) => handover.isRequested)
    .map((handover) => handover.reason)
    .filter((reason): reason is string => {
      return typeof reason === "string" && reason.trim() !== "";
    })
    .map((reason) => reason.trim());
}

/**
 * Fusionne les anciennes et nouvelles raisons de handover.
 *
 * Une raison par défaut est utilisée si aucune raison exploitable
 * n'est disponible.
 */
function buildMergedHandoverReason(input: {
  existingReason: string | null | undefined;
  newReasons: string[];
}): string {
  return mergeHandoverReasons(input) ?? "detected_by_system";
}

/**
 * Déduplique les raisons de handover et les concatène
 * dans une chaîne séparée par des points-virgules.
 */
function mergeHandoverReasons(input: {
  existingReason: string | null | undefined;
  newReasons: string[];
}): string | null {
  const mergedReasons: string[] = [];

  for (const reason of [
    ...splitHandoverReason(input.existingReason),
    ...input.newReasons.flatMap((reason) => splitHandoverReason(reason))
  ]) {
    const trimmedReason = reason.trim();

    if (trimmedReason.length === 0) {
      continue;
    }

    if (!mergedReasons.includes(trimmedReason)) {
      mergedReasons.push(trimmedReason);
    }
  }

  return mergedReasons.length > 0 ? mergedReasons.join("; ") : null;
}

/**
 * Une chaîne de raisons peut déjà contenir plusieurs raisons
 * séparées par des points-virgules.
 */
function splitHandoverReason(
  reason: string | null | undefined
): string[] {
  if (typeof reason !== "string") {
    return [];
  }

  return reason
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/**
 * Détecte une demande de transfert au support humain
 * dans la sortie de l'analyse de surface.
 *
 * Le code accepte deux propriétés pour compatibilité :
 * standardSubcategory ou standardAction.
 */
function hasHandoverRequestedSurface(
  output: RunSupportProcessingPipelineV3OptimizedIntermOutputs["analyzeTextSurfaceOutput"]
): boolean {
  return output?.status === "analyzed" &&
    output.segments.some((segment) => {
      const candidate = segment as {
        standardSubcategory?: unknown;
        standardAction?: unknown;
      };

      return candidate.standardSubcategory === "handover_request" ||
        candidate.standardAction === "handover_request";
    });
}

/**
 * Normalise la sortie analyzeSupportText.
 *
 * En cas d'absence ou de fallback, aucun fact n'est disponible.
 */
function collectAnalyzeSupportTextFacts(
  output: RunSupportProcessingPipelineV3OptimizedIntermOutputs["analyzeSupportTextOutput"]
): AtomicSupportFacts {
  if (output?.status !== "analyzed") {
    return {
      caseDetailsExtracted: [],
      attemptedActionsExtracted: [],
      otherExtracted: []
    };
  }

  return {
    caseDetailsExtracted: output.caseDetailsExtracted,
    attemptedActionsExtracted: output.attemptedActionsExtracted,
    otherExtracted: output.otherExtracted
  };
}

/**
 * Sélectionne les facts attribués à un topic donné.
 *
 * proposeTopicUpdates ne renvoie pas les facts complets :
 * il renvoie leurs identifiants. Cette fonction effectue
 * le rapprochement avec les facts produits par analyzeSupportText.
 */
function selectSourceFacts(params: {
  facts: AtomicSupportFacts;
  topicUpdatePlan: {
    sourceCaseDetailIds: string[];
    sourceAttemptedActionIds: string[];
    sourceOtherIds: string[];
  };
}): AtomicSupportFacts {
  const caseDetailIdSet = new Set(
    params.topicUpdatePlan.sourceCaseDetailIds
  );

  const attemptedActionIdSet = new Set(
    params.topicUpdatePlan.sourceAttemptedActionIds
  );

  const otherIdSet = new Set(
    params.topicUpdatePlan.sourceOtherIds
  );

  return {
    caseDetailsExtracted: params.facts.caseDetailsExtracted.filter((fact) => {
      return caseDetailIdSet.has(fact.caseDetailId);
    }),

    attemptedActionsExtracted:
      params.facts.attemptedActionsExtracted.filter((fact) => {
        return attemptedActionIdSet.has(fact.attemptedActionId);
      }),

    otherExtracted: params.facts.otherExtracted.filter((fact) => {
      return otherIdSet.has(fact.otherId);
    })
  };
}
