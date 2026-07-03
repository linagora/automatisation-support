import { readdir, readFile } from "node:fs/promises";
import { basename, extname, join, relative, sep } from "node:path";
import { writeTextFile } from "./utils.mjs";

const ASSET_EXTENSIONS = [
  ".js",
  ".css",
  ".png",
  ".jpg",
  ".jpeg",
  ".svg",
  ".webp",
  ".ico",
  ".woff",
  ".woff2",
  ".map"
];

function decodeHtmlEntities(value) {
  return String(value)
    .replace(/&nbsp;/gu, " ")
    .replace(/&amp;/gu, "&")
    .replace(/&lt;/gu, "<")
    .replace(/&gt;/gu, ">")
    .replace(/&quot;/gu, "\"")
    .replace(/&#39;/gu, "'")
    .replace(/&#(\d+);/gu, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/giu, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function stripTags(value) {
  return decodeHtmlEntities(String(value).replace(/<[^>]+>/gu, ""))
    .replace(/\s+/gu, " ")
    .trim();
}

function extractAttribute(tag, name) {
  const pattern = new RegExp(`${name}\\s*=\\s*("[^"]*"|'[^']*'|[^\\s>]+)`, "iu");
  const match = tag.match(pattern);

  if (!match) {
    return "";
  }

  return match[1].replace(/^["']|["']$/gu, "").trim();
}

function normalizeUrl(url) {
  const parsed = new URL(url);
  parsed.hash = "";

  if (parsed.pathname !== "/" && parsed.pathname.endsWith("/")) {
    parsed.pathname = parsed.pathname.replace(/\/+$/u, "");
  }

  return parsed.toString();
}

function normalizeBaseUrl(url) {
  return normalizeUrl(url);
}

function hasSameHost(url, baseUrl) {
  return new URL(url).host === new URL(baseUrl).host;
}

function isIgnoredAsset(url) {
  const pathname = new URL(url).pathname.toLowerCase();
  return ASSET_EXTENSIONS.some((extension) => pathname.endsWith(extension));
}

function isInternalDocsUrl(url, baseUrl) {
  return hasSameHost(url, baseUrl) && !isIgnoredAsset(url);
}

function debugLog(config, message) {
  if (config.debug) {
    console.log(`[docs] ${message}`);
  }
}

function canonicalRouteUrl(inputUrl, baseUrl) {
  const url = new URL(inputUrl, baseUrl);
  url.search = "";
  url.hash = "";

  if (!hasSameHost(url.toString(), baseUrl)) {
    return null;
  }

  let pathname = url.pathname.replace(/\/+$/u, "");

  if (!pathname) {
    pathname = "/";
  }

  if (pathname === "/md/index.md") {
    pathname = "/";
  } else if (pathname.startsWith("/md/") && pathname.endsWith(".md")) {
    pathname = pathname.slice(3, -3) || "/";
  }

  url.pathname = pathname === "/" ? "/" : pathname;
  return normalizeUrl(url.toString());
}

function candidateMarkdownUrl(routeUrl, baseUrl) {
  const route = new URL(routeUrl, baseUrl);
  const markdown = new URL(baseUrl);
  const pathname = route.pathname === "/"
    ? "/md/index.md"
    : `/md${route.pathname.replace(/\/+$/u, "")}.md`;

  markdown.pathname = pathname;
  markdown.search = "";
  markdown.hash = "";
  return markdown.toString();
}

function extractLinks(html, pageUrl, baseUrl) {
  const links = [];
  const anchorPattern = /<a\b[^>]*href\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)[^>]*>/giu;
  let match;

  while ((match = anchorPattern.exec(html)) !== null) {
    const href = match[1].replace(/^["']|["']$/gu, "").trim();

    if (!href || href.startsWith("mailto:") || href.startsWith("tel:")) {
      continue;
    }

    try {
      const normalized = normalizeUrl(new URL(href, pageUrl).toString());

      if (isInternalDocsUrl(normalized, baseUrl)) {
        links.push(normalized);
      }
    } catch {
      // Ignore malformed links found in upstream docs HTML.
    }
  }

  return Array.from(new Set(links));
}

function findMarkdownUrl(html, pageUrl) {
  const linkPattern = /<link\b[^>]*>/giu;
  let linkMatch;

  while ((linkMatch = linkPattern.exec(html)) !== null) {
    const tag = linkMatch[0];
    const type = extractAttribute(tag, "type").toLowerCase();
    const rel = extractAttribute(tag, "rel").toLowerCase();
    const href = extractAttribute(tag, "href");

    if (href && rel.includes("alternate") && type.includes("markdown")) {
      return new URL(href, pageUrl).toString();
    }
  }

  const anchorPattern = /<a\b[^>]*href\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)[^>]*>[\s\S]*?<\/a>/giu;
  let anchorMatch;

  while ((anchorMatch = anchorPattern.exec(html)) !== null) {
    const tag = anchorMatch[0];
    const href = extractAttribute(tag, "href");
    const label = stripTags(tag).toLowerCase();
    const title = `${extractAttribute(tag, "title")} ${extractAttribute(tag, "aria-label")}`.toLowerCase();
    const targetText = `${label} ${title}`;

    if (!href) {
      continue;
    }

    try {
      const markdownUrl = new URL(href, pageUrl).toString();

      if (
        targetText.includes("voir comme markdown") ||
        targetText.includes("view as markdown") ||
        new URL(markdownUrl).pathname.toLowerCase().endsWith(".md")
      ) {
        return markdownUrl;
      }
    } catch {
      // Ignore malformed markdown links found in upstream docs HTML.
    }
  }

  return null;
}

function extractHrefLikeAttribute(tag) {
  return (
    extractAttribute(tag, "href") ||
    extractAttribute(tag, "data-href") ||
    extractAttribute(tag, "data-url") ||
    extractAttribute(tag, "to")
  );
}

function findMarkdownButtonUrl(html, pageUrl) {
  const buttonPattern = /<button\b[^>]*>[\s\S]*?<\/button>/giu;
  let buttonMatch;

  while ((buttonMatch = buttonPattern.exec(html)) !== null) {
    const tag = buttonMatch[0];
    const targetText = [
      stripTags(tag),
      extractAttribute(tag, "title"),
      extractAttribute(tag, "aria-label")
    ].join(" ").toLowerCase();
    const href = extractHrefLikeAttribute(tag);

    if (
      href &&
      (
        targetText.includes("voir comme markdown") ||
        targetText.includes("view as markdown")
      )
    ) {
      try {
        return new URL(href, pageUrl).toString();
      } catch {
        return null;
      }
    }
  }

  return null;
}

function extractMarkdownTitle(markdown) {
  const frontmatterTitle = markdown.match(/^---[\s\S]*?\ntitle:\s*["']?(.+?)["']?\s*\n[\s\S]*?---/iu);

  if (frontmatterTitle) {
    return frontmatterTitle[1].trim();
  }

  const heading = markdown.match(/^#\s+(.+)$/mu);
  return heading ? heading[1].trim() : "";
}

function extractFrontmatter(markdown) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/u);

  if (!match) {
    return {
      frontmatter: {},
      body: markdown
    };
  }

  const frontmatter = {};

  for (const line of match[1].split(/\r?\n/u)) {
    const field = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/u);

    if (!field) {
      continue;
    }

    const [, key, rawValue] = field;
    frontmatter[key] = rawValue
      .trim()
      .replace(/^["']|["']$/gu, "");
  }

  return {
    frontmatter,
    body: markdown.slice(match[0].length)
  };
}

function extractTitle(html) {
  const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/iu);

  if (h1) {
    return stripTags(h1[1]);
  }

  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/iu);

  if (title) {
    return stripTags(title[1]).replace(/\s*[|-]\s*Twake.*$/iu, "").trim();
  }

  return "";
}

function extractMainHtml(html) {
  const patterns = [
    /<main\b[^>]*>([\s\S]*?)<\/main>/iu,
    /<article\b[^>]*>([\s\S]*?)<\/article>/iu,
    /<div\b[^>]*role\s*=\s*["']main["'][^>]*>([\s\S]*?)<\/div>/iu
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);

    if (match) {
      return match[1];
    }
  }

  const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/iu);
  return body ? body[1] : html;
}

function htmlToMarkdown(html) {
  let content = extractMainHtml(html)
    .replace(/<script\b[\s\S]*?<\/script>/giu, "")
    .replace(/<style\b[\s\S]*?<\/style>/giu, "")
    .replace(/<nav\b[\s\S]*?<\/nav>/giu, "")
    .replace(/<header\b[\s\S]*?<\/header>/giu, "")
    .replace(/<footer\b[\s\S]*?<\/footer>/giu, "")
    .replace(/<aside\b[\s\S]*?<\/aside>/giu, "")
    .replace(/<pre\b[^>]*><code\b[^>]*>([\s\S]*?)<\/code><\/pre>/giu, (_, code) => `\n\n\`\`\`\n${decodeHtmlEntities(stripTags(code))}\n\`\`\`\n\n`)
    .replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/giu, (_, code) => `\n\n\`\`\`\n${decodeHtmlEntities(stripTags(code))}\n\`\`\`\n\n`)
    .replace(/<h1\b[^>]*>([\s\S]*?)<\/h1>/giu, (_, text) => `\n\n# ${stripTags(text)}\n\n`)
    .replace(/<h2\b[^>]*>([\s\S]*?)<\/h2>/giu, (_, text) => `\n\n## ${stripTags(text)}\n\n`)
    .replace(/<h3\b[^>]*>([\s\S]*?)<\/h3>/giu, (_, text) => `\n\n### ${stripTags(text)}\n\n`)
    .replace(/<h4\b[^>]*>([\s\S]*?)<\/h4>/giu, (_, text) => `\n\n#### ${stripTags(text)}\n\n`)
    .replace(/<h5\b[^>]*>([\s\S]*?)<\/h5>/giu, (_, text) => `\n\n##### ${stripTags(text)}\n\n`)
    .replace(/<h6\b[^>]*>([\s\S]*?)<\/h6>/giu, (_, text) => `\n\n###### ${stripTags(text)}\n\n`)
    .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/giu, (_, text) => `\n- ${stripTags(text)}`)
    .replace(/<br\s*\/?>/giu, "\n")
    .replace(/<\/p>/giu, "\n\n")
    .replace(/<\/div>/giu, "\n")
    .replace(/<\/section>/giu, "\n\n")
    .replace(/<a\b[^>]*href\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)[^>]*>([\s\S]*?)<\/a>/giu, (_, href, text) => {
      const cleanHref = href.replace(/^["']|["']$/gu, "").trim();
      const cleanText = stripTags(text);
      return cleanText ? `[${cleanText}](${cleanHref})` : cleanHref;
    })
    .replace(/<code\b[^>]*>([\s\S]*?)<\/code>/giu, (_, code) => `\`${stripTags(code)}\``)
    .replace(/<strong\b[^>]*>([\s\S]*?)<\/strong>/giu, (_, text) => `**${stripTags(text)}**`)
    .replace(/<b\b[^>]*>([\s\S]*?)<\/b>/giu, (_, text) => `**${stripTags(text)}**`)
    .replace(/<em\b[^>]*>([\s\S]*?)<\/em>/giu, (_, text) => `_${stripTags(text)}_`)
    .replace(/<i\b[^>]*>([\s\S]*?)<\/i>/giu, (_, text) => `_${stripTags(text)}_`)
    .replace(/<[^>]+>/gu, "");

  content = decodeHtmlEntities(content)
    .replace(/[ \t]+\n/gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();

  return content ? `${content}\n` : "";
}

function slugFromUrl(pageUrl, baseUrl) {
  const url = new URL(pageUrl);
  const base = new URL(baseUrl);
  let relative = url.pathname;

  if (base.pathname !== "/" && relative.startsWith(base.pathname)) {
    relative = relative.slice(base.pathname.length);
  }

  relative = relative
    .replace(/^\/+|\/+$/gu, "")
    .replace(/\/index$/iu, "");

  if (!relative) {
    return "home";
  }

  return relative
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/iu, "")
    .replace(/[^a-z0-9]+/gu, "_")
    .replace(/^_+|_+$/gu, "") || "home";
}

function sectionFromUrl(pageUrl, baseUrl) {
  const url = new URL(pageUrl);
  const base = new URL(baseUrl);
  let relative = url.pathname;

  if (base.pathname !== "/" && relative.startsWith(base.pathname)) {
    relative = relative.slice(base.pathname.length);
  }

  const [section] = relative.replace(/^\/+|\/+$/gu, "").split("/");
  return section || "home";
}

function wordCount(markdown) {
  const words = markdown.match(/\b[\p{L}\p{N}'-]+\b/gu);
  return words ? words.length : 0;
}

function normalizePathSlug(value) {
  return value
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/iu, "")
    .replace(/(?:^|\/)index$/iu, "")
    .replace(/[^a-z0-9]+/gu, "_")
    .replace(/^_+|_+$/gu, "") || "home";
}

function routeFromDocsRelativePath(relativePath) {
  const withoutExtension = relativePath.replace(/\.[^.]+$/u, "");
  const normalized = withoutExtension.split(sep).join("/");

  if (normalized === "index") {
    return "/";
  }

  if (normalized.endsWith("/index")) {
    return `/${normalized.slice(0, -"/index".length)}`;
  }

  return `/${normalized}`;
}

function sourcePageUrl(baseUrl, route) {
  const url = new URL(baseUrl);
  url.pathname = route;
  url.search = "";
  url.hash = "";
  return normalizeUrl(url.toString());
}

function shouldSkipSourceEntry(entryName) {
  return [
    "node_modules",
    "build",
    "dist",
    ".git",
    "static"
  ].includes(entryName);
}

async function findSourceMarkdownFiles(dir) {
  const files = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const path = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!shouldSkipSourceEntry(entry.name)) {
        files.push(...await findSourceMarkdownFiles(path));
      }

      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const extension = extname(entry.name).toLowerCase();

    if (extension === ".md" || extension === ".mdx") {
      files.push(path);
    }
  }

  return files.sort();
}

function buildDocsHeaders(config, url) {
  const includeSensitiveHeaders = hasSameHost(url, config.baseUrl);

  return {
    Accept: "text/html,text/markdown,text/plain;q=0.9,*/*;q=0.8",
    "User-Agent": "github-issues-openrag-indexer/1.0",
    ...(includeSensitiveHeaders ? config.extraHeaders : {}),
    ...(includeSensitiveHeaders && config.authCookie ? { Cookie: config.authCookie } : {}),
    ...(includeSensitiveHeaders && config.authorizationHeader ? { Authorization: config.authorizationHeader } : {})
  };
}

function resolveStartUrls(config, baseUrl) {
  const startUrls = Array.isArray(config.startUrls) && config.startUrls.length > 0
    ? config.startUrls
    : [baseUrl];

  return startUrls.map((startUrl) => {
    const normalized = normalizeUrl(new URL(startUrl, baseUrl).toString());

    if (!hasSameHost(normalized, baseUrl)) {
      throw new Error(`DOCS_START_URLS contains an URL outside DOCS_BASE_URL host: ${normalized}`);
    }

    return normalized;
  });
}

function isAuthOrEmptyPage({ title, markdown, currentWordCount }) {
  const text = markdown.toLowerCase();
  const normalizedTitle = title.toLowerCase();

  return (
    normalizedTitle.includes("authentication portal") ||
    text.includes("development portal") ||
    (text.includes("single sign-on") && text.includes("connect")) ||
    text.includes("manage your second factors") ||
    currentWordCount < 30
  );
}

function hasAuthPortalContent(body) {
  const text = body.toLowerCase();

  return (
    text.includes("authentication portal") ||
    text.includes("development portal") ||
    text.includes("manage your second factors") ||
    (text.includes("single sign-on") && text.includes("connect"))
  );
}

function assessMarkdownResponse({ status, contentType, body }) {
  if (status !== 200) {
    return {
      accepted: false,
      reason: `status_${status}`
    };
  }

  if (hasAuthPortalContent(body)) {
    return {
      accepted: false,
      reason: "auth_portal"
    };
  }

  const normalizedContentType = contentType.toLowerCase();
  const hasMarkdownContent = (
    /^---\s*$/mu.test(body) ||
    /^\s*slug:\s*/mi.test(body) ||
    /^\s*title:\s*/mi.test(body) ||
    /^#{1,6}\s+\S/mu.test(body)
  );
  const markdownContentType = (
    normalizedContentType.includes("text/markdown") ||
    normalizedContentType.includes("text/plain") ||
    normalizedContentType.includes("text/html")
  );

  if (markdownContentType && hasMarkdownContent) {
    return {
      accepted: true,
      reason: "markdown_content"
    };
  }

  return {
    accepted: false,
    reason: "not_markdown"
  };
}

function extractMarkdownLinks(markdown, routeUrl, baseUrl) {
  const links = [];
  const linkPattern = /!?\[[^\]]+\]\(([^)]+)\)/gu;
  let match;

  while ((match = linkPattern.exec(markdown)) !== null) {
    const href = match[1].trim().replace(/^["']|["']$/gu, "");

    if (
      !href ||
      href.startsWith("#") ||
      href.startsWith("mailto:") ||
      href.startsWith("tel:")
    ) {
      continue;
    }

    try {
      const canonical = canonicalRouteUrl(new URL(href, routeUrl).toString(), baseUrl);

      if (canonical && isInternalDocsUrl(canonical, baseUrl)) {
        links.push(canonical);
      }
    } catch {
      // Ignore malformed markdown links found in upstream docs.
    }
  }

  return Array.from(new Set(links));
}

async function fetchText(config, url) {
  const response = await fetch(url, {
    headers: buildDocsHeaders(config, url)
  });
  const text = await response.text();

  return {
    status: response.status,
    ok: response.ok,
    text,
    contentType: response.headers.get("content-type") ?? ""
  };
}

async function extractDocs(config) {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const docsRootUrl = `${new URL(baseUrl).origin}/`;
  const queue = resolveStartUrls(config, baseUrl)
    .map((startUrl) => canonicalRouteUrl(startUrl, baseUrl))
    .filter(Boolean);
  const seen = new Set();
  const pages = [];
  const failedPages = [];
  const skippedPages = [];
  let markdownFilesGenerated = 0;

  while (queue.length > 0 && seen.size < config.limit) {
    const pageUrl = queue.shift();

    if (!pageUrl || seen.has(pageUrl) || !isInternalDocsUrl(pageUrl, baseUrl)) {
      continue;
    }

    seen.add(pageUrl);
    debugLog(config, `route url=${pageUrl}`);

    try {
      let markdownUrl = candidateMarkdownUrl(pageUrl, baseUrl);
      let markdown = "";
      let title = "";
      const markdownResponse = await fetchText(config, markdownUrl);
      const markdownAssessment = assessMarkdownResponse({
        status: markdownResponse.status,
        contentType: markdownResponse.contentType,
        body: markdownResponse.text
      });

      debugLog(config, `fetch markdown url=${markdownUrl} status=${markdownResponse.status}`);
      debugLog(config, `markdown accepted ${markdownAssessment.accepted ? "yes" : "no"} reason=${markdownAssessment.reason}`);

      if (markdownAssessment.accepted) {
        markdown = markdownResponse.text.trim();
        title = extractMarkdownTitle(markdown) || slugFromUrl(pageUrl, docsRootUrl);

        const markdownLinks = extractMarkdownLinks(markdown, pageUrl, baseUrl);
        debugLog(config, `discovered markdown links count=${markdownLinks.length}`);

        for (const link of markdownLinks) {
          if (!seen.has(link) && queue.length + seen.size < config.limit) {
            queue.push(link);
          }
        }
      } else {
        const htmlResponse = await fetchText(config, pageUrl);
        debugLog(config, `fetch html fallback url=${pageUrl} status=${htmlResponse.status}`);

        if (!htmlResponse.ok) {
          throw new Error(`HTTP ${htmlResponse.status}`);
        }

        const html = htmlResponse.text;

        if (!htmlResponse.contentType.includes("text/html") && !/<html\b|<main\b|<article\b/iu.test(html)) {
          throw new Error(`Unsupported content-type ${htmlResponse.contentType}`);
        }

        for (const link of extractLinks(html, pageUrl, baseUrl)) {
          const canonical = canonicalRouteUrl(link, baseUrl);

          if (canonical && !seen.has(canonical) && queue.length + seen.size < config.limit) {
            queue.push(canonical);
          }
        }

        const htmlMarkdownUrl = findMarkdownUrl(html, pageUrl) ?? findMarkdownButtonUrl(html, pageUrl);

        if (htmlMarkdownUrl && hasSameHost(htmlMarkdownUrl, baseUrl)) {
          const linkedMarkdownResponse = await fetchText(config, htmlMarkdownUrl);
          const linkedAssessment = assessMarkdownResponse({
            status: linkedMarkdownResponse.status,
            contentType: linkedMarkdownResponse.contentType,
            body: linkedMarkdownResponse.text
          });

          debugLog(config, `fetch markdown url=${htmlMarkdownUrl} status=${linkedMarkdownResponse.status}`);
          debugLog(config, `markdown accepted ${linkedAssessment.accepted ? "yes" : "no"} reason=${linkedAssessment.reason}`);

          if (linkedAssessment.accepted) {
            markdown = linkedMarkdownResponse.text.trim();
            markdownUrl = htmlMarkdownUrl;
          }
        }

        if (!markdown) {
          markdown = htmlToMarkdown(html).trim();
          markdownUrl = null;
        }

        title = extractTitle(html) || extractMarkdownTitle(markdown) || slugFromUrl(pageUrl, docsRootUrl);
        debugLog(config, "discovered markdown links count=0");
      }

      const currentWordCount = wordCount(markdown);

      if (isAuthOrEmptyPage({ title, markdown, currentWordCount })) {
        skippedPages.push({
          url: pageUrl,
          title,
          reason: "auth_or_empty_page",
          wordCount: currentWordCount
        });
        continue;
      }

      const slug = slugFromUrl(pageUrl, docsRootUrl);
      const fileId = `docs_twake_${slug}`;
      const filename = `${slug}.md`;
      const markdownPath = join(config.outputDir, filename);
      const finalMarkdown = [
        markdown.startsWith("#") ? markdown : `# ${title}\n\n${markdown}`,
        ""
      ].join("\n");

      writeTextFile(markdownPath, finalMarkdown);
      markdownFilesGenerated += 1;

      pages.push({
        title,
        url: pageUrl,
        markdownUrl,
        fileId,
        filename,
        markdownPath,
        section: sectionFromUrl(pageUrl, docsRootUrl),
        wordCount: wordCount(finalMarkdown)
      });
    } catch (error) {
      failedPages.push({
        url: pageUrl,
        error: error.message
      });
    }
  }

  return {
    baseUrl,
    pagesCrawled: seen.size,
    markdownFilesGenerated,
    skippedAuthOrEmptyPages: skippedPages.length,
    skippedPages,
    failedPages,
    manifest: {
      baseUrl,
      pageCount: pages.length,
      skippedAuthOrEmptyPageCount: skippedPages.length,
      skippedPages,
      failedPages,
      pages
    }
  };
}

async function extractDocsFromSource(config) {
  if (!config.sourceDir) {
    throw new Error("DOCS_SOURCE_DIR is required for RUN_MODE=extract-docs-source.");
  }

  const docsDir = join(config.sourceDir, "docs");
  const sourceFiles = await findSourceMarkdownFiles(docsDir);
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const pages = [];
  let markdownFilesGenerated = 0;

  for (const sourcePath of sourceFiles) {
    const relativePath = relative(docsDir, sourcePath);
    const markdown = await readFile(sourcePath, "utf8");
    const { frontmatter, body } = extractFrontmatter(markdown);
    const trimmedBody = body.trim();
    const title =
      frontmatter.title ||
      extractMarkdownTitle(trimmedBody) ||
      basename(sourcePath, extname(sourcePath));
    const route = routeFromDocsRelativePath(relativePath);
    const slug = normalizePathSlug(relativePath.split(sep).join("/"));
    const fileId = `docs_twake_${slug}`;
    const filename = `${slug}.md`;
    const markdownPath = join(config.outputDir, filename);
    const finalMarkdown = [
      /^#\s+/mu.test(trimmedBody) ? trimmedBody : `# ${title}\n\n${trimmedBody}`,
      ""
    ].join("\n");

    writeTextFile(markdownPath, finalMarkdown);
    markdownFilesGenerated += 1;

    pages.push({
      title,
      url: sourcePageUrl(baseUrl, route),
      sourcePath,
      fileId,
      filename,
      markdownPath,
      section: route === "/" ? "home" : route.replace(/^\/+|\/+$/gu, "").split("/")[0],
      wordCount: wordCount(finalMarkdown)
    });
  }

  return {
    baseUrl,
    sourceDir: config.sourceDir,
    pageCount: pages.length,
    markdownFilesGenerated,
    manifest: {
      baseUrl,
      sourceDir: config.sourceDir,
      pageCount: pages.length,
      pages
    }
  };
}

export {
  extractDocs,
  extractDocsFromSource
};
