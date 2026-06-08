import type {
  MatrixDeliveryResult
} from "../channels/matrix/typesMatrixChannel.types";
import type {
  JsonMessageRepository
} from "../repositories/json/jsonMessageRepository";

type DeliveryResultPersistenceResult = {
  status: "skipped";
  warnings: string[];
};

async function applyDeliveryResult(params: {
  matrixDeliveryResults: MatrixDeliveryResult[];
  messageRepository: JsonMessageRepository;
}): Promise<DeliveryResultPersistenceResult> {
  void params.matrixDeliveryResults;
  void params.messageRepository;

  return {
    status: "skipped",
    warnings: [
      "delivery result persistence not implemented yet; stored outgoing messages are not enriched with providerMessageId"
    ]
  };
}

export {
  applyDeliveryResult
};

export type {
  DeliveryResultPersistenceResult
};
