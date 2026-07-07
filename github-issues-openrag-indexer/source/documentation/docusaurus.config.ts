import { themes as prismThemes } from "prism-react-renderer";
import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config: Config = {
  title: "Twake Workplace",
  tagline: "The open-source alternative to Microsoft Office",
  favicon: "img/favicon.ico",

  url: "https://docs.twake.app",
  baseUrl: "/",

  organizationName: "linagora",
  projectName: "twake-workplace",

  onBrokenLinks: "throw",

  markdown: {
    mermaid: true,
    hooks: {
      onBrokenMarkdownLinks: "throw",
    },
  },

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  presets: [
    [
      "classic",
      {
        docs: {
          routeBasePath: "/",
          sidebarPath: "./sidebars.ts",
          editUrl:
            "https://github.com/linagora/twake-workplace/tree/main/documentation/",
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: ["./plugins/docusaurus-plugin-llm-docs.js"],

  themes: [
    "@docusaurus/theme-mermaid",
    [
      "@easyops-cn/docusaurus-search-local",
      {
        hashed: true,
        language: ["en"],
        indexBlog: false,
        docsRouteBasePath: "/",
      },
    ],
  ],

  themeConfig: {
    navbar: {
      title: "Twake Workplace",
      logo: {
        alt: "Twake Workplace",
        src: "img/logo.svg",
      },
      items: [
        {
          to: "/overview/getting-started",
          label: "Getting Started",
          position: "left",
        },
        { to: "/overview", label: "Concepts", position: "left" },
        { to: "/developer-guide", label: "Developer Guide", position: "left" },
        { to: "/services", label: "Services", position: "left" },
        { to: "/deployment", label: "Deployment", position: "left" },
        { to: "/reference", label: "Reference", position: "left" },
        {
          href: "https://github.com/linagora/twake-workplace",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Get Started",
          items: [
            { label: "Getting Started", to: "/overview/getting-started" },
            { label: "Concepts", to: "/overview" },
            { label: "Developer Guide", to: "/developer-guide" },
          ],
        },
        {
          title: "Services",
          items: [
            { label: "Apps", to: "/apps" },
            { label: "Platform Services", to: "/platform-services" },
          ],
        },
        {
          title: "Operate",
          items: [
            { label: "Deployment", to: "/deployment" },
            { label: "Reference", to: "/reference" },
          ],
        },
        {
          title: "More",
          items: [
            {
              label: "GitHub",
              href: "https://github.com/linagora/twake-workplace",
            },
            { label: "Twake", href: "https://twake.app" },
          ],
        },
      ],
      copyright: `Copyright ${new Date().getFullYear()} Linagora. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ["bash", "json", "yaml", "nginx", "perl"],
    },
    colorMode: {
      defaultMode: "light",
      respectPrefersColorScheme: true,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
