type MatrixSupportAutomationLogger = {
  log: (message?: unknown, ...optionalParams: unknown[]) => void;
  warn?: (message?: unknown, ...optionalParams: unknown[]) => void;
  error: (message?: unknown, ...optionalParams: unknown[]) => void;
};

type StructuredLogLevel = "info" | "warn" | "error";

function buildLogRecord(
  level: StructuredLogLevel,
  eventName: string,
  metadata: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    level,
    eventName,
    timestamp: new Date().toISOString(),
    ...metadata
  };
}

function logInfo(params: {
  logger: MatrixSupportAutomationLogger;
  eventName: string;
  metadata?: Record<string, unknown>;
}): void {
  params.logger.log(buildLogRecord("info", params.eventName, params.metadata));
}

function logWarn(params: {
  logger: MatrixSupportAutomationLogger;
  eventName: string;
  metadata?: Record<string, unknown>;
}): void {
  const record = buildLogRecord("warn", params.eventName, params.metadata);

  if (params.logger.warn) {
    params.logger.warn(record);
    return;
  }

  params.logger.log(record);
}

function logError(params: {
  logger: MatrixSupportAutomationLogger;
  eventName: string;
  metadata?: Record<string, unknown>;
}): void {
  params.logger.error(buildLogRecord("error", params.eventName, params.metadata));
}

export {
  logError,
  logInfo,
  logWarn
};

export type {
  MatrixSupportAutomationLogger
};
