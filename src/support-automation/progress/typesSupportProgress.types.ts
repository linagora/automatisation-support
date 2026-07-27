type SupportProcessingProgressEvent = {
  code: string;
  title: string;
  details?: string[];
};

type ReportSupportProcessingProgress = (
  event: SupportProcessingProgressEvent
) => Promise<void>;

export type {
  ReportSupportProcessingProgress,
  SupportProcessingProgressEvent
};
