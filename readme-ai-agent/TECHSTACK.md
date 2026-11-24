# Technical Stack & Architecture Decisions — Productivier

## 1. Stack Matrix
- **Framework**: Next.js 16.4.6 (App Router with Turbopack)
- **UI Library**: React 19.3.0
- **Styling**: Tailwind CSS v4 (`@tailwindcss/postcss`) with CSS Container Queries
- **Animations**: `motion/react` v14.14.0 (Spring physics: `stiffness: 420, damping: 32`)
- **Icons**: `lucide-react` v1.77.0
- **Database Engine**: Native Node.js SQLite (`node:sqlite` via `src/lib/db.ts`)
- **Font**: `next/font/google` with `Plus Jakarta Sans` (weights 400, 500, 600, 700, 800) and `JetBrains Mono`

## 2. Architectural Decisions (ADR)
- **ADR-01: Modular Component Separation**:
  - `page.tsx` serves strictly as the state orchestrator.
  - Sub-views and tabs are isolated in `src/components/dashboard` and `src/components/tabs`.
- **ADR-02: SQLite Zero-Compute Backend**:
  - Avoid heavy external database servers; use Node.js experimental SQLite for zero-latency local embedded persistence.
- **ADR-03: Dual-Mode Styling (Light + Dark)**:
  - Base theme adopts Stitch Design System (`Intellecta Clean Slate`).
  - Dark mode activates elevated charcoal glass cards (`#18191F` / `#121316`) without contrast degradation.
