# Technical Stack & Architecture Decisions — Productivier (v2.6.2)

## 1. Stack Matrix
- **Framework**: Next.js 16.4.6 (App Router with Turbopack, `compress: true`, `optimizePackageImports: ["lucide-react", "motion"]`)
- **UI Library**: React 19.3.0
- **Styling**: Tailwind CSS v4 (`@tailwindcss/postcss`) with `@custom-variant dark (.dark &, &.dark);`
- **Animations**: `motion/react` v14.14.0 via `MotionProvider` (`LazyMotion` async `domMax` + `MotionConfig reducedMotion="user"`)
- **Icons**: `lucide-react` v1.77.0
- **Database Engine**: Native Node.js SQLite (`node:sqlite` via `src/lib/db.ts` — `WAL`, `synchronous=NORMAL`, `temp_store=MEMORY`, `cache_size=-16000`, `busy_timeout=5000`, 8 indexes)
- **Auth & Security**: `node:crypto` (`scryptSync` password hashing, HMAC-SHA256 `HttpOnly` cookie `prod_session` in `src/lib/auth.ts`), `share_token` client portal gate
- **Font**: `next/font/google` (`Plus Jakarta Sans` & `JetBrains Mono`)

## 2. Architectural Decisions (ADR)
- **ADR-01: Modular & Lazy-Loaded Component Architecture**:
  - `page.tsx` acts as the authenticated state orchestrator and dynamically splits heavy tabs (`ProjectsTab`, `CalendarTab`, `NotesTab`, `InputTab`, `ReportsTab`, `ProfileTab`, `ChatTab`, `FloatingAIAgent`) via `next/dynamic`.
  - Heavy sub-views (`ProjectDetailView`, `GroupInfoModal`) are also split with `ssr: false` to keep initial JS chunk ceiling <= 224 KB.
- **ADR-02: SQLite WAL Zero-Compute Local Backend**:
  - Uses `node:sqlite` in WAL mode with 8 hot-path indexes for fast local development/testing. Note: For Vercel serverless deployment, migrate `src/lib/db.ts` to an external database (e.g., Firestore / Postgres) since serverless disks are ephemeral.
- **ADR-03: GPU-Safe Dual-Mode Styling (Light + Dark)**:
  - Fixed background gradient is isolated in a dedicated `fixed inset-0 -z-10 pointer-events-none` layer (`layout.tsx`) rather than `background-attachment: fixed`, avoiding scroll repaints on low-spec GPUs.
- **ADR-04: Visibility-Aware Polling & Delta Fetch**:
  - `useVisibilityPolling` pauses background polling when `document.hidden === true`. `ChatTab` polls deltas via `after_id` so idle polls return empty payloads.
