import {
  readLiveMemoryContext,
  writeLiveMemoryContext
} from "../../infrastructure/live-memory/liveMemoryContextStore";

import {
  createEmptyLiveMemoryContextOptimized,
  createEmptyLiveMemoryTopicOptimized
} from "../../infrastructure/live-memory/liveMemoryDefaults";

import {
  getNextLiveMemoryTopicId,
  parseLiveMemoryTopicId
} from "../../infrastructure/live-memory/normalizeLiveMemoryTopicId";

import type {
  LiveMemoryContextOptimized,
  LiveMemoryTopicOptimized
} from "../../infrastructure/live-memory/liveMemoryContextOptimized.template";

/**
 * Résultat réel de livraison du message.
 *
 * Le message effectivement envoyé peut différer du message préparé
 * par le pipeline. La live memory doit privilégier le contenu livré.
 */
type ApplyLiveMemoryPatchDeliveryResult = {
  status: "sent" | "failed" | "partial";

  deliveredMessages?: Array<{
    content: string;
  }>;
};

/**
 * Entrée principale de l'application des patches.
 *
 * Plusieurs patches peuvent être appliqués séquentiellement
 * à la même live memory avant sa persistance.
 */
type ApplyLiveMemoryPatchInput = {
  conversationKey: string;
  patches: unknown[];
  deliveryResult?: ApplyLiveMemoryPatchDeliveryResult;
};

/**
 * Patch partiel du contexte global.
 *
 * Un champ absent ou null signifie généralement :
 * ne pas modifier la section correspondante.
 */
type LiveMemoryContextPatch = {
  handover?: LiveMemoryContextOptimized["handover"] | null;

  previousConversationTurn?:
    LiveMemoryContextOptimized["previousConversationTurn"] | null;

  failedPipelineMessages?:
    LiveMemoryContextOptimized["failedPipelineMessages"] | null;

  securityAlerts?:
    LiveMemoryContextOptimized["securityAlerts"] | null;

  userState?: {
    status: null | string;
    flags: string[];
  } | null;

  topics?: LiveMemoryTopicPatch[] | null;
};

/**
 * Patch d'un topic.
 *
 * topicId peut être null pour signaler la création
 * d'un nouveau topic.
 */
type LiveMemoryTopicPatch = {
  status: LiveMemoryTopicOptimized["status"];

  sourceAnalyzeSupportText:
    LiveMemoryTopicOptimized["sourceAnalyzeSupportText"];

  sourceProposeTopicUpdates: Omit<
    LiveMemoryTopicOptimized["sourceProposeTopicUpdates"],
    "topicId"
  > & {
    topicId: number | null;
  };

  sourceTopicManager:
    LiveMemoryTopicOptimized["sourceTopicManager"];
};

/**
 * Guard générique vérifiant qu'une valeur est un objet simple.
 */
function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === "object" &&
    value !== null &&
    !Array.isArray(value);
}

/**
 * Normalise une valeur textuelle.
 *
 * Les chaînes vides ou composées uniquement d'espaces
 * sont transformées en null.
 */
function compactString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== ""
    ? value.trim()
    : null;
}

/**
 * Nettoie et déduplique une liste de chaînes
 * en conservant leur ordre d'apparition.
 */
function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const normalized = compactString(value);

    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    output.push(normalized);
  }

  return output;
}

/**
 * Guard minimal pour les patches globaux.
 *
 * Il vérifie uniquement qu'il s'agit d'un objet.
 * La structure interne reste supposée provenir d'une source fiable.
 */
function isLiveMemoryContextPatch(
  value: unknown
): value is LiveMemoryContextPatch {
  return isRecord(value);
}

/**
 * Guard minimal pour les patches de topics.
 *
 * Il confirme la présence des trois sous-objets principaux,
 * sans valider en profondeur leur contenu.
 */
function isLiveMemoryTopicPatch(
  value: unknown
): value is LiveMemoryTopicPatch {
  return isRecord(value) &&
    isRecord(value.sourceAnalyzeSupportText) &&
    isRecord(value.sourceProposeTopicUpdates) &&
    isRecord(value.sourceTopicManager);
}

/**
 * Ignore les éléments de la liste qui ne sont pas des objets.
 */
function normalizePatches(
  patches: unknown[]
): LiveMemoryContextPatch[] {
  return patches.filter(isLiveMemoryContextPatch);
}

/**
 * Détermine si le message réellement livré doit être utilisé
 * pour previousBotMessage.
 */
function shouldUseDeliveredBotMessage(
  deliveryResult: ApplyLiveMemoryPatchDeliveryResult | undefined
): boolean {
  return deliveryResult?.status === "sent" ||
    (
      deliveryResult?.status === "partial" &&
      (deliveryResult.deliveredMessages?.length ?? 0) > 0
    );
}

/**
 * Reconstitue le message bot réellement livré.
 *
 * Plusieurs messages livrés sont concaténés avec une ligne vide.
 */
function getDeliveredBotMessage(
  deliveryResult: ApplyLiveMemoryPatchDeliveryResult | undefined
): string | null {
  if (!shouldUseDeliveredBotMessage(deliveryResult)) {
    return null;
  }

  const message = deliveryResult?.deliveredMessages
    ?.map((item) => item.content.trim())
    .filter((content) => content !== "")
    .join("\n\n") ?? "";

  return message === "" ? null : message;
}

/**
 * Fusion de chaînes nullable.
 *
 * Une valeur entrante non vide remplace la précédente.
 * Une valeur entrante vide ou null laisse la précédente inchangée.
 */
function mergeNullableString(params: {
  previous: string | null;
  incoming: string | null | undefined;
}): string | null {
  return compactString(params.incoming) ?? params.previous;
}

/**
 * Fusionne l'historique des case details.
 *
 * La déduplication utilise actuellement une signature exacte composée de :
 * - key ;
 * - value ;
 * - evidence ;
 * - status.
 *
 * Deux facts sémantiquement identiques avec une evidence différente
 * restent donc deux éléments distincts.
 */
function mergeCaseDetailsExtracted(params: {
  previous:
    LiveMemoryTopicOptimized["sourceAnalyzeSupportText"]["caseDetailsExtracted"];

  incoming:
    LiveMemoryTopicOptimized["sourceAnalyzeSupportText"]["caseDetailsExtracted"];
}): LiveMemoryTopicOptimized["sourceAnalyzeSupportText"]["caseDetailsExtracted"] {
  const bySignature = new Map<
    string,
    LiveMemoryTopicOptimized[
      "sourceAnalyzeSupportText"
    ]["caseDetailsExtracted"][number]
  >();

  for (const detail of [
    ...params.previous,
    ...params.incoming
  ]) {
    const signature = JSON.stringify([
      detail.key,
      detail.value,
      detail.evidence,
      detail.status
    ]);

    bySignature.set(signature, detail);
  }

  return [...bySignature.values()];
}

/**
 * Fusionne l'historique des attempted actions.
 *
 * La déduplication utilise une signature exacte composée de :
 * - action ;
 * - outcome ;
 * - evidence ;
 * - status.
 */
function mergeAttemptedActionsExtracted(params: {
  previous:
    LiveMemoryTopicOptimized[
      "sourceAnalyzeSupportText"
    ]["attemptedActionsExtracted"];

  incoming:
    LiveMemoryTopicOptimized[
      "sourceAnalyzeSupportText"
    ]["attemptedActionsExtracted"];
}): LiveMemoryTopicOptimized[
  "sourceAnalyzeSupportText"
]["attemptedActionsExtracted"] {
  const bySignature = new Map<
    string,
    LiveMemoryTopicOptimized[
      "sourceAnalyzeSupportText"
    ]["attemptedActionsExtracted"][number]
  >();

  for (const action of [
    ...params.previous,
    ...params.incoming
  ]) {
    const signature = JSON.stringify([
      action.action,
      action.outcome,
      action.evidence,
      action.status
    ]);

    bySignature.set(signature, action);
  }

  return [...bySignature.values()];
}

/**
 * Retourne l'identifiant numérique d'un topic existant.
 */
function getTopicId(
  topic: LiveMemoryTopicOptimized
): number {
  return topic.sourceProposeTopicUpdates.topicId;
}

/**
 * Recherche un topic existant par son identifiant.
 */
function findTopicById(
  topics: LiveMemoryTopicOptimized[],
  topicId: number
): LiveMemoryTopicOptimized | null {
  return topics.find((topic) => {
    return getTopicId(topic) === topicId;
  }) ?? null;
}

/**
 * Construit le nouvel état complet d'un topic à partir :
 * - du topic précédent éventuel ;
 * - du patch entrant ;
 * - de l'identifiant final.
 *
 * Stratégies de fusion :
 * - status : remplacement ;
 * - facts : accumulation et déduplication ;
 * - titre/summary/domain : dernière valeur non vide ;
 * - topic manager : remplacement complet.
 */
function buildTopicFromPatch(params: {
  patch: LiveMemoryTopicPatch;
  previousTopic: LiveMemoryTopicOptimized | null;
  topicId: number;
}): LiveMemoryTopicOptimized {
  /**
   * Pour un nouveau topic, on part du template vide.
   */
  const previousTopic =
    params.previousTopic ??
    createEmptyLiveMemoryTopicOptimized(params.topicId);

  return {
    status: params.patch.status ?? previousTopic.status,

    sourceAnalyzeSupportText: {
      caseDetailsExtracted: mergeCaseDetailsExtracted({
        previous:
          previousTopic
            .sourceAnalyzeSupportText
            .caseDetailsExtracted,

        incoming:
          params.patch
            .sourceAnalyzeSupportText
            .caseDetailsExtracted
      }),

      attemptedActionsExtracted: mergeAttemptedActionsExtracted({
        previous:
          previousTopic
            .sourceAnalyzeSupportText
            .attemptedActionsExtracted,

        incoming:
          params.patch
            .sourceAnalyzeSupportText
            .attemptedActionsExtracted
      })
    },

    sourceProposeTopicUpdates: {
      topicId: params.topicId,

      title: mergeNullableString({
        previous:
          previousTopic
            .sourceProposeTopicUpdates
            .title,

        incoming:
          params.patch
            .sourceProposeTopicUpdates
            .title
      }),

      summaryTopic: mergeNullableString({
        previous:
          previousTopic
            .sourceProposeTopicUpdates
            .summaryTopic,

        incoming:
          params.patch
            .sourceProposeTopicUpdates
            .summaryTopic
      }),

      supportDomain: {
        value: mergeNullableString({
          previous:
            previousTopic
              .sourceProposeTopicUpdates
              .supportDomain
              .value,

          incoming:
            params.patch
              .sourceProposeTopicUpdates
              .supportDomain
              .value
        }),

        reason: mergeNullableString({
          previous:
            previousTopic
              .sourceProposeTopicUpdates
              .supportDomain
              .reason,

          incoming:
            params.patch
              .sourceProposeTopicUpdates
              .supportDomain
              .reason
        })
      }
    },

    /**
     * Contrairement aux facts et métadonnées,
     * le topic manager n'est pas fusionné.
     *
     * Le snapshot entrant devient la nouvelle source de vérité.
     */
    sourceTopicManager: params.patch.sourceTopicManager
  };
}

/**
 * Applique tous les patches de topics.
 *
 * Étapes :
 * 1. Indexer les topics existants par ID.
 * 2. Déterminer le prochain ID disponible.
 * 3. Pour chaque patch :
 *    - réutiliser l'ID existant si valide ;
 *    - sinon attribuer un nouvel ID ;
 *    - fusionner ou créer le topic.
 * 4. Retourner les topics triés par ID.
 */
function applyTopicPatches(params: {
  previousTopics: LiveMemoryTopicOptimized[];
  topicPatches: LiveMemoryTopicPatch[] | null | undefined;
}): LiveMemoryTopicOptimized[] {
  if (!params.topicPatches || params.topicPatches.length === 0) {
    return params.previousTopics;
  }

  const topicsById = new Map<number, LiveMemoryTopicOptimized>();

  for (const topic of params.previousTopics) {
    topicsById.set(getTopicId(topic), topic);
  }

  let nextTopicId =
    getNextLiveMemoryTopicId(params.previousTopics);

  for (const incomingTopicPatch of params.topicPatches) {
    if (!isLiveMemoryTopicPatch(incomingTopicPatch)) {
      continue;
    }

    /**
     * Un topicId valide désigne une mise à jour.
     * Un topicId absent ou invalide désigne un nouveau topic.
     */
    const parsedTopicId = parseLiveMemoryTopicId(
      incomingTopicPatch
        .sourceProposeTopicUpdates
        .topicId
    );

    const topicId = parsedTopicId ?? nextTopicId++;

    const previousTopic = findTopicById(
      params.previousTopics,
      topicId
    );

    topicsById.set(
      topicId,
      buildTopicFromPatch({
        patch: incomingTopicPatch,
        previousTopic,
        topicId
      })
    );
  }

  return [...topicsById.values()].sort(
    (first, second) => {
      return getTopicId(first) - getTopicId(second);
    }
  );
}

/**
 * Applique les parties globales d'un patch.
 *
 * Chaque section possède sa propre stratégie :
 * - handover : remplacement si fourni ;
 * - previousConversationTurn : fusion ;
 * - failedPipelineMessages : append ;
 * - securityAlerts : append ;
 * - userState : fusion du status et union des flags.
 */
function mergeGlobalPatch(params: {
  previousContext: LiveMemoryContextOptimized;
  patch: LiveMemoryContextPatch;
  deliveryResult?: ApplyLiveMemoryPatchDeliveryResult;
}): LiveMemoryContextOptimized {
  const deliveredBotMessage =
    getDeliveredBotMessage(params.deliveryResult);

  return {
    ...params.previousContext,

    handover:
      params.patch.handover ??
      params.previousContext.handover,

    previousConversationTurn:
      params.patch.previousConversationTurn
        ? {
            previousUserMessage:
              params.patch
                .previousConversationTurn
                .previousUserMessage ??
              params.previousContext
                .previousConversationTurn
                .previousUserMessage,

            /**
             * Priorité :
             * 1. message réellement livré ;
             * 2. message prévu dans le patch ;
             * 3. ancien message mémorisé.
             */
            previousBotMessage:
              deliveredBotMessage ??
              params.patch
                .previousConversationTurn
                .previousBotMessage ??
              params.previousContext
                .previousConversationTurn
                .previousBotMessage
          }
        : {
            ...params.previousContext.previousConversationTurn,

            /**
             * Même sans patch conversationnel,
             * un message livré peut mettre à jour previousBotMessage.
             */
            previousBotMessage:
              deliveredBotMessage ??
              params.previousContext
                .previousConversationTurn
                .previousBotMessage
          },

    /**
     * Les failedPipelineMessages forment un historique append-only.
     */
    failedPipelineMessages:
      params.patch.failedPipelineMessages
        ? [
            ...params.previousContext.failedPipelineMessages,
            ...params.patch.failedPipelineMessages
          ]
        : params.previousContext.failedPipelineMessages,

    /**
     * Les securityAlerts forment également un historique append-only.
     */
    securityAlerts:
      params.patch.securityAlerts
        ? [
            ...params.previousContext.securityAlerts,
            ...params.patch.securityAlerts
          ]
        : params.previousContext.securityAlerts,

    /**
     * Le status entrant non vide remplace l'ancien.
     * Les flags sont fusionnés et dédupliqués.
     */
    userState:
      params.patch.userState
        ? {
            status:
              compactString(params.patch.userState.status) ??
              params.previousContext.userState.status,

            flags: uniqueStrings([
              ...params.previousContext.userState.flags,
              ...params.patch.userState.flags
            ])
          }
        : params.previousContext.userState
  };
}

/**
 * Applique un patch complet :
 * 1. fusion globale ;
 * 2. application des patches de topics ;
 * 3. normalisation de topics vide en null.
 */
function applyOnePatch(params: {
  previousContext: LiveMemoryContextOptimized;
  patch: LiveMemoryContextPatch;
  deliveryResult?: ApplyLiveMemoryPatchDeliveryResult;
}): LiveMemoryContextOptimized {
  const contextWithGlobalPatch = mergeGlobalPatch(params);

  const previousTopics =
    contextWithGlobalPatch.topics ?? [];

  const topics = applyTopicPatches({
    previousTopics,
    topicPatches: params.patch.topics
  });

  return {
    ...contextWithGlobalPatch,
    topics: topics.length > 0 ? topics : null
  };
}

/**
 * Point d'entrée principal de la persistance.
 *
 * Étapes :
 * 1. Lire la mémoire existante.
 * 2. Utiliser un contexte vide si elle n'existe pas.
 * 3. Normaliser et appliquer les patches séquentiellement.
 * 4. Écrire le contexte final.
 * 5. Retourner la nouvelle mémoire.
 */
async function applyLiveMemoryPatch(
  input: ApplyLiveMemoryPatchInput
): Promise<LiveMemoryContextOptimized> {
  const previousContext =
    await readLiveMemoryContext(input.conversationKey) ??
    createEmptyLiveMemoryContextOptimized();

  /**
   * Les patches sont appliqués dans leur ordre d'entrée.
   * Chaque patch voit le résultat du patch précédent.
   */
  const updatedContext =
    normalizePatches(input.patches)
      .reduce<LiveMemoryContextOptimized>(
        (currentContext, patch) => {
          return applyOnePatch({
            previousContext: currentContext,
            patch,
            deliveryResult: input.deliveryResult
          });
        },
        previousContext
      );

  await writeLiveMemoryContext(
    input.conversationKey,
    updatedContext
  );

  return updatedContext;
}

export {
  applyLiveMemoryPatch
};

export type {
  ApplyLiveMemoryPatchDeliveryResult,
  ApplyLiveMemoryPatchInput,
  LiveMemoryContextPatch,
  LiveMemoryTopicPatch
};