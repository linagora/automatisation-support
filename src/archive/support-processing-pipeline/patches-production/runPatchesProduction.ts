import type {
  Patches,
  PatchesProductionInput
} from "../typesSupportProcessingPipeline.types";

function runPatchesProduction(input: PatchesProductionInput): Patches {
  const { turnUnderstandingDelta, responsePlan } = input;

  return {
    analysisPatch: {
      turnUnderstandingDelta
    },
    securityPatch: {
      securityGateSummary: turnUnderstandingDelta.securityGateSummary ?? {
        gateChecked: {},
        gateFailed: []
      }
    },
    responsePatch: {
      responsePlan
    },
    metadataPatch: {
      generatedAt: new Date().toISOString(),
      source: "support-processing-pipeline"
    }
  };
}

export { runPatchesProduction };
