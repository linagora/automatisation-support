import {describe, expect, it} from "vitest";

import {
  formatCatalogSelection,
  promptCatalogSelection
} from "../../../../src/support-automation/support-processing-pipeline-v2/analyze-text-surface-optimized/catalogSelection";

describe("optimized text-surface catalog selection", function () {
  it("builds canonical format and prompt selections", function () {
    expect(formatCatalogSelection.categories.support_relevant).toBe("support_relevant");
    expect(formatCatalogSelection.subcategoriesByCategory.standard_interaction).toContain("greeting");
    expect(formatCatalogSelection.subcategoriesByCategory.standard_interaction).toContain("handover_request");

    const greeting = promptCatalogSelection.subcategoriesByCategory.standard_interaction.find((item) => item.key === "greeting");
    expect(greeting).toEqual({key: "greeting"});

    const handoverRequest = promptCatalogSelection.subcategoriesByCategory.standard_interaction.find((item) => item.key === "handover_request");
    expect(handoverRequest).toBeDefined();
    expect(handoverRequest && "extractionGuidance" in handoverRequest ? handoverRequest.extractionGuidance : undefined).toEqual(expect.any(String));
    expect(handoverRequest && "extractionGuidance" in handoverRequest ? handoverRequest.extractionGuidance.trim().length : 0).toBeGreaterThan(0);
  });
});
