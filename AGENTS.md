@[Project Brain State](readme-ai-agent/AGENTS.md)

# Productivier — Workspace & Development Rules (v2.6.2)

- **Framework**: Next.js 16.4.6 (App Router, Turbopack) + React 19.3 + Tailwind CSS v4 + `motion/react` (`LazyMotion` async `domMax`) + SQLite (`node:sqlite` WAL mode via `src/lib/db.ts`).
- **Design System**: Intellecta Clean Slate (Light + Dark mode tokens in `src/app/globals.css`).
- **Architecture & Performance**:
  - `src/app/layout.tsx` mounts `MotionProvider` (`LazyMotion` + `MotionConfig reducedMotion="user"`) and a dedicated fixed GPU background layer.
  - `src/app/page.tsx` lazy-loads secondary tabs (`ProjectsTab`, `CalendarTab`, `NotesTab`, `InputTab`, `ReportsTab`, `ProfileTab`, `ChatTab`, `FloatingAIAgent`) via `next/dynamic`; `ProjectDetailView` and `GroupInfoModal` are also dynamically split.
  - Components use `m` from `motion/react` (`MotionEl` in `ChatTab.tsx` to avoid shadowing `m: ChatMessageType`).
  - Background polling uses `src/hooks/useVisibilityPolling.ts` (auto-pause when `document.hidden`) + delta fetch `after_id` on `/api/chat/messages`.
- **Auth & Typing**:
  - Cookie `HttpOnly` HMAC-SHA256 (`prod_session`) in `src/lib/auth.ts` (`requireAuth` / `requireAdmin`), plus `?token=` (`share_token`) for `/client/project/[id]`.
  - API DB rows use `Row` from `src/types/db-rows.ts` (single intentional `eslint-disable-next-line` boundary).
- **Ports & Verification**: Dev default `3000`, QA/Prod server `3007`. Gates: `./node_modules/.bin/eslint src`, `./node_modules/.bin/tsc --noEmit`, `npm run build`, `node --experimental-strip-types scripts/test_markdown.mjs`, `node scripts/test_ecosystem.mjs`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
