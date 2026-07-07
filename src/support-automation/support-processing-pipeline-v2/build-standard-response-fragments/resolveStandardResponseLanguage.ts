import type {
  BuildStandardResponseFragmentsInput,
  StandardResponseLanguage
} from "./typesBuildStandardResponseFragments.types";

/**
 * Deprecated compatibility shim.
 *
 * Standard response fragments no longer depend on the user's language.
 * They are renderer instructions and must stay in English.
 *
 * Final user-facing language must be resolved in the renderer from
 * textSurfaceAnalysis.userLanguage, not here.
 */
function resolveStandardResponseLanguage(
  _input: BuildStandardResponseFragmentsInput
): StandardResponseLanguage {
  return "renderer_instructions";
}

export {
  resolveStandardResponseLanguage
};
