import type { GlobalPipelineGroup } from "../typesTextAnalysisDataset";

export const androidGroups: GlobalPipelineGroup[] = [
  { id: "android", label: "All Android-tagged cases", tags: ["android"] },
  { id: "android-notifications", label: "Android notification cases", tags: ["android", "notifications"] }
];
