import type { GlobalPipelineGroup } from "../typesTextAnalysisDataset";

export const billingGroups: GlobalPipelineGroup[] = [
  { id: "billing", label: "All billing-tagged cases", tags: ["billing"] },
  { id: "billing-regression", label: "Core billing regression cases", cases: ["double_charge_clarification", "billing_android_multitopic"] }
];
