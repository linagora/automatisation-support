---
title: AI Workflows
---

Twake Workplace is set up for AI-assisted development using [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Each service has its own AI configuration with custom skills, hooks, and guardrails.

## How It Works

Every service has a `CLAUDE.md` file at its root that gives the AI agent project-specific context: what the service does, how to build it, testing conventions, architectural constraints, and common pitfalls. When you open Claude Code in a service directory, it reads these files automatically.

```
twake-workplace/
  CLAUDE.md                          # Root: git workflow, /simplify requirement
  registration/CLAUDE.md             # SvelteKit patterns, path aliases, Svelte runes
  admin-panel-backend/CLAUDE.md      # LLNG auth (not OIDC), HMAC proxy, Express layers
  twake-ldap-rest/CLAUDE.md          # LDAP architecture, DN constraints, owner role rules
  dashboard/CLAUDE.md                # Read-only caching strategy, streaming patterns
```

[Cozy Admin](https://github.com/linagora/cozy-admin) uses `AGENTS.md` (symlinked as `CLAUDE.md`) with React/Cozy-specific guidelines.

## Custom Skills

Skills are slash commands that automate common workflows. Type `/skill-name` in Claude Code to run them.

### Available everywhere

| Skill | What it does |
|-------|--------------|
| `/simplify` | Reviews changed code for reuse, quality, and efficiency. **Required after completing a feature** (per root CLAUDE.md). |
| `/pr` | Creates a branch and opens a PR following team conventions. Auto-detects change type (feat/fix/chore), writes a human-focused summary. |
| `/docker-up` | Starts local development services via docker compose. Auto-detects the compose file and verifies service health. |
| `/sync-env-docs` | Audits environment variables across source code, `.env.example` files, and docker-compose docs. Finds missing entries and updates all locations. |

### Per-service

| Service | Skill | What it does |
|---------|-------|--------------|
| Registration | `/verify` | `npm run format && npm run check && npm run lint && npm test` |
| Admin Panel Backend | `/verify` | `npx tsc --noEmit && npm test && npm run build` |
| LDAP REST | `/verify` | `npm run check && npm test && npm run build` |
| Dashboard | `/verify` | `npm run format && npm run check && npm run lint` |
| Registration | `/db-migrate` | Generates Drizzle ORM migrations, asks before applying |
| Admin Panel Backend | `/db-migrate` | Same, for admin panel schema |

## Hooks

Hooks run automatically after certain actions. They enforce consistency without manual intervention.

### Auto-formatting (Registration, Dashboard)

After every file write or edit, a PostToolUse hook runs Prettier on the modified file. This means AI-generated code is always formatted before you see it.

### Auto-linting (Root)

After file modifications, ESLint runs on `.ts`, `.js`, `.svelte`, `.jsx`, and `.tsx` files. Lint errors surface immediately rather than waiting for CI.

### Environment variable documentation check (Registration)

After writing or editing `.ts`, `.js`, or `.svelte` files, a hook scans for new `$env/` imports or `process.env.` references. If a variable is used in code but missing from `.env.example`, you get a warning.

## MCP Servers

### Svelte Documentation (Registration)

The registration service configures a [Svelte MCP server](https://www.npmjs.com/package/@sveltejs/mcp) that gives the AI agent access to Svelte documentation. It can:

- Browse documentation sections
- Fetch docs for specific Svelte features
- Run the Svelte autofixer before presenting code (required by the rules)
- Generate Svelte playground links

Configured in `registration/.mcp.json`.

## Best Practices

### Starting a new feature

1. Open Claude Code in the service directory (so it picks up the service-specific `CLAUDE.md`)
2. Describe what you want to build
3. Let the AI explore the codebase first. It reads the architecture docs, existing patterns, and test conventions
4. After implementation, run `/verify` to catch issues
5. Run `/simplify` to review the code for quality
6. Run `/pr` to create the pull request

### Writing effective prompts

**Be specific about the service context.** "Add a rate limiter to the check-email endpoint" is better than "add rate limiting" because the AI knows exactly which file and pattern to follow.

**Reference existing patterns.** "Follow the same pattern as check-phone" tells the AI to look at a working example rather than inventing from scratch.

**Let it read first.** Don't paste code into the prompt. Say "read the auth middleware and add X" so the AI understands the full context.

### What to watch for

- **LDAP operations**: The `twake-ldap-rest/CLAUDE.md` documents critical constraints (owner role atomicity, cross-branch uniqueness). Make sure AI-generated LDAP code respects these.
- **Auth model**: The admin panel uses LLNG, not OIDC. If the AI suggests `express-openid-connect`, it's wrong.
- **Svelte runes**: Registration uses Svelte 5 runes mode (`$state`, `$derived`, `$effect`). The AI should not generate legacy Svelte 4 reactive syntax (`$:`, `let x = writable()`).
- **Test patterns**: Each service has different test frameworks (Vitest for registration/dashboard, Mocha for admin-panel-backend/ldap-rest). The AI should match the service's framework.

### Environment variables

When adding new env vars in code, the `/sync-env-docs` skill and the registration hook will catch missing documentation. But as a habit:

1. Add the variable to the service's `.env.example`
2. Add it to the root `.env.example`
3. Document it in the service's configuration page
4. Add it to the [Local Dev with Docker](/overview/docker-compose) env var tables

### Git workflow

The root `CLAUDE.md` enforces:
- Never push directly to main - always branch + PR
- Required CI checks must pass before merge
- Never use `gh pr merge --admin`
- PR flow: branch -> push -> `gh pr create` -> CI green -> `gh pr merge --squash --delete-branch`

The `/pr` skill automates this entire flow.
