/**
 * Data Producer
 *
 * This file is the local orchestrator of the data-producer block.
 *
 * Its responsibility is to produce the updated ticket memory after the current
 * pipeline turn.
 *
 * It does not write directly to the database.
 * It prepares the structured ticketMemoryAfterTurn that can later be persisted
 * by an infrastructure or repository layer.
 *
 * INPUTS:
 * - ticketMemoryBeforeTurn
 * - supportKnowledgeAfterTurn
 * - supportKnowledgeDelta
 * - conversationLogs
 * - userInformations
 * - responsePlan
 *
 * OUTPUT:
 * - ticketMemoryAfterTurn
 *
 * Internal steps:
 *
 * 1. Conversation logs update
 *    Updates the conversation logs using the responsePlan and the existing conversation context.
 *    This step prepares the logs that should be kept for the next pipeline turn.
 *    INPUTS  - conversationLogs, responsePlan, ticketMemoryBeforeTurn
 *    OUTPUTS - conversationLogsAfterTurn
 *
 * 2. Support knowledge delta memory update
 *    Stores the latest supportKnowledgeDelta as the last delta and optionally appends it
 *    to supportKnowledgeDeltaHistory.
 *    INPUTS  - supportKnowledgeDelta, ticketMemoryBeforeTurn
 *    OUTPUTS - supportKnowledgeDeltaMemory
 *
 * 3. Visibility update
 *    Updates visibility metadata for ticket objects such as topics, attempts, signals,
 *    scope boundaries, internal fields, or user-facing fields.
 *    INPUTS  - supportKnowledgeAfterTurn, supportKnowledgeDelta, ticketMemoryBeforeTurn
 *    OUTPUTS - visibilityAfterTurn
 *
 * 4. Cleanup and compaction
 *    Removes, archives, or compacts obsolete temporary data.
 *    This may include old resolved topics, outdated signals, unnecessary debug data,
 *    or overly long context fields.
 *    INPUTS  - ticketMemoryBeforeTurn, supportKnowledgeAfterTurn, supportKnowledgeDelta
 *    OUTPUTS - cleanupResult
 *
 * 5. Ticket memory assembly
 *    Builds the final ticketMemoryAfterTurn from all updated memory parts.
 *    It stores the supportKnowledgeAfterTurn, updated logs, delta memory, visibility,
 *    metadata, and any useful data required for the next pipeline turn.
 *    INPUTS  - ticketMemoryBeforeTurn, supportKnowledgeAfterTurn,
 *              supportKnowledgeDelta, conversationLogsAfterTurn,
 *              supportKnowledgeDeltaMemory, visibilityAfterTurn,
 *              cleanupResult, userInformations, responsePlan
 *    OUTPUTS - ticketMemoryAfterTurn
 */

type UnknownObject = Record<string, unknown>;

type SupportKnowledge = UnknownObject;

type SupportKnowledgeDelta = UnknownObject;

type DataProducerStep<TInput, TOutput> = (input: TInput) => TOutput;

interface TicketMemory {
  supportKnowledge?: SupportKnowledge;
  lastSupportKnowledgeDelta?: SupportKnowledgeDelta | null;
  supportKnowledgeDeltaHistory?: SupportKnowledgeDelta[];
  conversationLogs?: UnknownObject[];
  userInformations?: UnknownObject | null;
  visibility?: UnknownObject;
  metadata?: UnknownObject;
  [key: string]: unknown;
}

interface DataProducerInput {
  ticketMemoryBeforeTurn?: TicketMemory | null;
  supportKnowledgeAfterTurn: SupportKnowledge;
  supportKnowledgeDelta: SupportKnowledgeDelta;
  conversationLogs?: UnknownObject[];
  userInformations?: UnknownObject | null;
  responsePlan: unknown;
}

interface DataProducerSteps {
  updateConversationLogs?: DataProducerStep<UnknownObject, UnknownObject[]>;
  updateSupportKnowledgeDeltaMemory?: DataProducerStep<UnknownObject, UnknownObject>;
  updateVisibility?: DataProducerStep<UnknownObject, UnknownObject>;
  cleanupAndCompact?: DataProducerStep<UnknownObject, UnknownObject>;
  assembleTicketMemory?: DataProducerStep<UnknownObject, TicketMemory>;
}

/**
 * Creates a placeholder function for data-producer steps that are not implemented yet.
 */
function createMissingStep<TInput, TOutput>(
  stepName: string
): DataProducerStep<TInput, TOutput> {
  return function missingStep(): never {
    throw new Error(`${stepName} is not implemented yet`);
  };
}

/**
 * Temporary assertion placeholders.
 *
 * These functions are intentionally empty for now.
 * Their real validation logic can be implemented later in a dedicated assertions file.
 */
function assertValidDataProducerInput(input: unknown): asserts input is DataProducerInput {}

function assertValidConversationLogsAfterTurn(
  conversationLogsAfterTurn: unknown
): asserts conversationLogsAfterTurn is UnknownObject[] {}

function assertValidSupportKnowledgeDeltaMemory(
  supportKnowledgeDeltaMemory: unknown
): asserts supportKnowledgeDeltaMemory is UnknownObject {}

function assertValidVisibilityAfterTurn(
  visibilityAfterTurn: unknown
): asserts visibilityAfterTurn is UnknownObject {}

function assertValidCleanupResult(cleanupResult: unknown): asserts cleanupResult is UnknownObject {}

function assertValidTicketMemory(ticketMemory: unknown): asserts ticketMemory is TicketMemory {}

/**
 * Runs the data-producer block.
 */
function runDataProducer(
  input: DataProducerInput,
  steps: DataProducerSteps = {}
): TicketMemory {
  assertValidDataProducerInput(input);

  const dataProducerSteps: Required<DataProducerSteps> = {
    updateConversationLogs:
      steps.updateConversationLogs ||
      createMissingStep<UnknownObject, UnknownObject[]>("updateConversationLogs"),

    updateSupportKnowledgeDeltaMemory:
      steps.updateSupportKnowledgeDeltaMemory ||
      createMissingStep<UnknownObject, UnknownObject>("updateSupportKnowledgeDeltaMemory"),

    updateVisibility:
      steps.updateVisibility ||
      createMissingStep<UnknownObject, UnknownObject>("updateVisibility"),

    cleanupAndCompact:
      steps.cleanupAndCompact ||
      createMissingStep<UnknownObject, UnknownObject>("cleanupAndCompact"),

    assembleTicketMemory:
      steps.assembleTicketMemory ||
      createMissingStep<UnknownObject, TicketMemory>("assembleTicketMemory")
  };

  /**
   * Step 1: Conversation logs update
   */
  const conversationLogsAfterTurn = dataProducerSteps.updateConversationLogs({
    conversationLogs: input.conversationLogs,
    responsePlan: input.responsePlan,
    ticketMemoryBeforeTurn: input.ticketMemoryBeforeTurn
  });

  assertValidConversationLogsAfterTurn(conversationLogsAfterTurn);

  /**
   * Step 2: Support knowledge delta memory update
   */
  const supportKnowledgeDeltaMemory = dataProducerSteps.updateSupportKnowledgeDeltaMemory({
    supportKnowledgeDelta: input.supportKnowledgeDelta,
    ticketMemoryBeforeTurn: input.ticketMemoryBeforeTurn
  });

  assertValidSupportKnowledgeDeltaMemory(supportKnowledgeDeltaMemory);

  /**
   * Step 3: Visibility update
   */
  const visibilityAfterTurn = dataProducerSteps.updateVisibility({
    supportKnowledgeAfterTurn: input.supportKnowledgeAfterTurn,
    supportKnowledgeDelta: input.supportKnowledgeDelta,
    ticketMemoryBeforeTurn: input.ticketMemoryBeforeTurn
  });

  assertValidVisibilityAfterTurn(visibilityAfterTurn);

  /**
   * Step 4: Cleanup and compaction
   */
  const cleanupResult = dataProducerSteps.cleanupAndCompact({
    ticketMemoryBeforeTurn: input.ticketMemoryBeforeTurn,
    supportKnowledgeAfterTurn: input.supportKnowledgeAfterTurn,
    supportKnowledgeDelta: input.supportKnowledgeDelta
  });

  assertValidCleanupResult(cleanupResult);

  /**
   * Step 5: Ticket memory assembly
   */
  const ticketMemoryAfterTurn = dataProducerSteps.assembleTicketMemory({
    ticketMemoryBeforeTurn: input.ticketMemoryBeforeTurn,
    supportKnowledgeAfterTurn: input.supportKnowledgeAfterTurn,
    supportKnowledgeDelta: input.supportKnowledgeDelta,
    conversationLogsAfterTurn,
    supportKnowledgeDeltaMemory,
    visibilityAfterTurn,
    cleanupResult,
    userInformations: input.userInformations,
    responsePlan: input.responsePlan
  });

  assertValidTicketMemory(ticketMemoryAfterTurn);

  return ticketMemoryAfterTurn;
}

export {
  runDataProducer,
  assertValidDataProducerInput,
  assertValidConversationLogsAfterTurn,
  assertValidSupportKnowledgeDeltaMemory,
  assertValidVisibilityAfterTurn,
  assertValidCleanupResult,
  assertValidTicketMemory
};

export type {
  DataProducerInput,
  DataProducerSteps,
  TicketMemory,
  SupportKnowledge,
  SupportKnowledgeDelta
};