import type { GlobalPipelineGroup } from "../typesTextAnalysisDataset";

export const smokeGroups: GlobalPipelineGroup[] = [
  {
    id: "smoke",
    label: "Fast critical fake Matrix checks",
    cases: [
      "double_charge_clarification",
      "android_notifications_already_tried",
      "billing_android_multitopic"
    ]
  }
];
