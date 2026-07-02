const fs = require("fs");
const path = require("path");

function patchFile(relativePath, patcher) {
  const filePath = path.resolve(process.cwd(), relativePath);
  if (!fs.existsSync(filePath)) {
    console.log(`SKIP missing ${relativePath}`);
    return;
  }

  const before = fs.readFileSync(filePath, "utf8");
  const after = patcher(before);

  if (after !== before) {
    fs.writeFileSync(filePath, after);
    console.log(`PATCHED ${relativePath}`);
  } else {
    console.log(`UNCHANGED ${relativePath}`);
  }
}

patchFile("src/support-processing-pipeline-v2/typesSupportProcessingPipelineV2.types.ts", (text) => {
  let next = text;

  next = next.replace(
    /route:\s*"no_retrieval"\s*\|\s*"retrieve_knowledge";/g,
    'route: "none" | "catalog_only" | "rag_only" | "catalog_and_rag";'
  );

  next = next.replace(
    /route:\s*"retrieve_knowledge"\s*\|\s*"no_retrieval";/g,
    'route: "none" | "catalog_only" | "rag_only" | "catalog_and_rag";'
  );

  next = next.replace(/\s*\|\s*"planKnowledgeRouting"\n/g, "\n");

  next = next.replace(
    /\n\s*planKnowledgeRouting\?:\s*PipelineStep<[\s\S]*?\n\s*>;\n/g,
    "\n"
  );

  return next;
});

patchFile("src/support-processing-pipeline-v2/runSupportProcessingPipelineV2.ts", (text) => {
  let next = text;

  next = next.replace(
    /import\s*\{\s*planKnowledgeRouting\s*\}\s*from\s*"\.\/plan-knowledge-routing\/planKnowledgeRouting";\n/g,
    ""
  );

  next = next.replace(
    /\n\s*KnowledgeRoutingDecision,\n/g,
    "\n"
  );

  next = next.replace(
    /\n\s*TopicKnowledgeRoutingPlanResult,\n/g,
    "\n"
  );

  next = next.replace(
    /\n\s*planKnowledgeRouting:\s*resolveStep\(\s*steps\.planKnowledgeRouting,\s*"planKnowledgeRouting"\s*\),/g,
    ""
  );

  next = next.replace(/\n\s*"planKnowledgeRouting",/g, "");

  next = next.replace(
    /\n\s*let topicKnowledgeRoutingPlans:[\s\S]*?\|\s*undefined;\n/g,
    "\n"
  );

  next = next.replace(
    /\n\s*topicKnowledgeRoutingPlans = \[\];/g,
    ""
  );

  next = next.replace(
    /\n\s*topicKnowledgeRoutingPlans = topicBranchResults\.map\(\(result\) => \(\{[\s\S]*?\}\)\);\n/g,
    "\n"
  );

  next = next.replace(
    /\n\s*\.\.\.\(typeof topicKnowledgeRoutingPlans !== "undefined"[\s\S]*?\}\),/g,
    ""
  );

  return next;
});

patchFile("tests/support-automation/build-input/buildSupportProcessingInputV2.test.ts", (text) => {
  return text.replace(/topicId: "topic_42"/g, "topicId: 42");
});

patchFile("tests/support-automation/runSupportAutomationPipelineV2.test.ts", (text) => {
  return text.replace(/topicId: "topic_12"/g, "topicId: 12");
});

patchFile("tests/support-automation/build-input/convertLiveMemoryContextToSupportTopicContextV2.test.ts", (text) => {
  return text
    .replace(/topicId: "topic_42"/g, "topicId: 42")
    .replace(/topicId: "temporary-login-topic"/g, "topicId: 42");
});

patchFile("tests/infrastructure/live-memory/liveMemoryContext.test.ts", (text) => {
  return text
    .replace(/topicId: "topic_1"/g, "topicId: 1")
    .replace(/topicId: "topic_2"/g, "topicId: 2");
});

console.log("Done.");
