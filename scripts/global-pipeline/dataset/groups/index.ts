import { androidGroups } from "./android.group";
import { billingGroups } from "./billing.group";
import { languageGroups } from "./language.group";
import { multiTopicGroups } from "./multiTopic.group";
import { regressionGroups } from "./regression.group";
import { smokeGroups } from "./smoke.group";

import type { GlobalPipelineGroup } from "../typesTextAnalysisDataset";

export const globalPipelineGroups: GlobalPipelineGroup[] = [
  ...smokeGroups,
  ...billingGroups,
  ...androidGroups,
  ...languageGroups,
  ...multiTopicGroups,
  ...regressionGroups
];

export function findGlobalPipelineGroup(groupId: string): GlobalPipelineGroup | undefined {
  return globalPipelineGroups.find((group) => group.id === groupId);
}

export {
  androidGroups,
  billingGroups,
  languageGroups,
  multiTopicGroups,
  regressionGroups,
  smokeGroups
};
