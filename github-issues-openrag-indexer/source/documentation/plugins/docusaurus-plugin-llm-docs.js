const fs = require("fs");
const path = require("path");

/**
 * Docusaurus plugin that makes documentation AI-agent-friendly:
 *
 * 1. Copies raw .md source files to `build/md/` so they can be fetched directly
 * 2. Generates `llms.txt` at the site root listing all pages and their markdown URLs
 * 3. Injects a client-side script that adds a <link rel="alternate" type="text/markdown">
 *    tag to each page's <head>, pointing to the corresponding .md file
 */
module.exports = function pluginLlmDocs(context) {
  const { siteDir } = context;
  const docsDir = path.join(siteDir, "docs");

  return {
    name: "docusaurus-plugin-llm-docs",

    /**
     * Inject a small inline script on every page that adds a <link> tag
     * pointing to the raw markdown source for the current page.
     */
    injectHtmlTags() {
      return {
        headTags: [
          {
            tagName: "script",
            innerHTML: `
(function() {
  var p = window.location.pathname.replace(/\\/$/, '') || '/index';
  var md = '/md' + p + '.md';
  var link = document.createElement('link');
  link.rel = 'alternate';
  link.type = 'text/markdown';
  link.href = md;
  document.head.appendChild(link);
})();
            `.trim(),
          },
        ],
      };
    },

    /**
     * After build: copy .md files to build/md/ and generate llms.txt
     */
    async postBuild({ outDir }) {
      const mdOutDir = path.join(outDir, "md");
      const entries = [];

      function walkDir(dir, relPath) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const fullPath = path.join(dir, entry.name);
          const rel = path.join(relPath, entry.name);

          if (entry.isDirectory()) {
            if (entry.name.startsWith(".") || entry.name === "node_modules") {
              continue;
            }
            walkDir(fullPath, rel);
          } else if (entry.name.endsWith(".md")) {
            const destPath = path.join(mdOutDir, rel);
            fs.mkdirSync(path.dirname(destPath), { recursive: true });
            fs.copyFileSync(fullPath, destPath);

            // Build the page URL from the file path
            let pagePath = rel
              .replace(/\.md$/, "")
              .replace(/\\/g, "/")
              .replace(/\/index$/, "");

            if (pagePath === "index") {
              pagePath = "";
            }

            entries.push({
              page: "/" + pagePath,
              md: "/md/" + rel.replace(/\\/g, "/"),
            });
          }
        }
      }

      walkDir(docsDir, "");

      // Sort entries for consistent output
      entries.sort((a, b) => a.page.localeCompare(b.page));

      // Generate llms.txt with relative paths so it works on any host
      const lines = [
        `# ${context.siteConfig.title}`,
        `# ${context.siteConfig.tagline}`,
        "",
        "# Documentation pages",
        "# Each line: page path | raw markdown path",
        "",
        ...entries.map((e) => `${e.page} | ${e.md}`),
      ];

      fs.writeFileSync(path.join(outDir, "llms.txt"), lines.join("\n") + "\n");

      console.log(
        `[llm-docs] Copied ${entries.length} markdown files to ${mdOutDir}`,
      );
      console.log(
        `[llm-docs] Generated llms.txt with ${entries.length} entries`,
      );
    },
  };
};
