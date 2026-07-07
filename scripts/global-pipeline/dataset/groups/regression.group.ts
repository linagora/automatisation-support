import { textAnalysisDataset } from "../textAnalysisDataset";
import type { GlobalPipelineGroup } from "../typesTextAnalysisDataset";

export const regressionGroups: GlobalPipelineGroup[] = [
  { id: "regression", label: "All current dataset cases", cases: textAnalysisDataset.map((testCase) => testCase.id) }
];
