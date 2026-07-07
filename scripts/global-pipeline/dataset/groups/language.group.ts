import type { GlobalPipelineGroup } from "../typesTextAnalysisDataset";

export const languageGroups: GlobalPipelineGroup[] = [
  { id: "language", label: "All language-specific cases", tags: ["language"] },
  { id: "bilingual", label: "Bilingual and multilingual cases", tags: ["bilingual", "language"] }
];
