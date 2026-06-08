export type PersistenceResult = {
  updatedTicketId?: string;
  updatedUserId?: string;
  ticketCreated?: boolean;
  storedIncomingMessageIds: string[];
  storedOutgoingMessageIds: string[];
  patchStatus: "applied" | "skipped" | "partial";
  warnings?: string[];
};
