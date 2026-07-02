const fs = require("fs");
const path = require("path");

const file = path.resolve(
  process.cwd(),
  "src/support-processing-pipeline-v2/typesSupportProcessingPipelineV2.types.ts"
);

let text = fs.readFileSync(file, "utf8");
const before = text;

text = text.replace(
  /route:\s*["']retrieve_knowledge["']\s*\|\s*["']no_retrieval["'];/g,
  'route: "none" | "catalog_only" | "rag_only" | "catalog_and_rag";'
);

if (text === before) {
  console.log("No route type replacement was applied. Check the type manually.");
} else {
  fs.writeFileSync(file, text);
  console.log("Updated KnowledgeEnrichmentPlan.route type.");
}
