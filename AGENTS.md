@[Project Brain State](readme-ai-agent/AGENTS.md)

# Productivier — Workspace & Development Rules

- **Framework**: Next.js 16 (App Router, Turbopack) + React 19 + Tailwind CSS v4 + motion/react + SQLite (`src/lib/db.ts`).
- **Design System**: Intellecta Clean Slate (Stitch Design System).
- **Architecture**: Modular component structure (`src/components/dashboard`, `src/components/layout`, `src/components/tabs`, `src/types`).
- **Port**: Development default `3000`.
- **Quality Gates**: Zero TypeScript error, zero horizontal overflow, full SQLite CRUD integrity.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
