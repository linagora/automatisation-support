import React, { type ReactNode } from "react";
import { useLocation } from "@docusaurus/router";

const mdIcon = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M14.85 3H1.15C.52 3 0 3.52 0 4.15v7.69C0 12.48.52 13 1.15 13h13.69c.64 0 1.15-.52 1.15-1.15V4.15C16 3.52 15.48 3 14.85 3zM9 11H7V8L5.5 9.92 4 8v3H2V5h2l1.5 2L7 5h2v6zm2.99.5L9.5 8H11V5h2v3h1.5l-2.51 3.5z" />
  </svg>
);

export default function MarkdownLink(): ReactNode {
  const { pathname } = useLocation();
  const mdPath = "/md" + (pathname.replace(/\/$/, "") || "/index") + ".md";

  return (
    <a
      href={mdPath}
      target="_blank"
      rel="noopener noreferrer"
      title="Raw Markdown source for AI agents and LLMs"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.3rem",
        fontSize: "0.85rem",
      }}
    >
      {mdIcon}
      View as Markdown
    </a>
  );
}
