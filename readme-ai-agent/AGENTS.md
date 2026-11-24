# Project Brain State — Productivier

## 1. Project Overview
- **Name**: Productivier (Intellecta Clean Slate Edition)
- **Repo / Path**: `/mnt/HDD-2/BACKUP LINUX/FILE DATA/WEBSITE/productivier-redesign`
- **Core Domain**: Manajemen realisasi kerja harian, progres proyek tim, kualifikasi target, monitoring kepatuhan tim, dan pelaporan operasional.
- **Design Style**: Intellecta Clean Slate (Stitch Design System) — minimal modern SaaS, generous whitespace, rounded geometry (24px/32px), deep charcoal (`#18181B`) dengan aksen pastel (Lime `#D2F27C`, Lavender `#DCD4FB`, Slate `#D7DEEA`).

## 2. Active Component Architecture
- `src/app/page.tsx`: Main Controller (~780 lines, orchestrates session, search modal, tab switching, and data hydration).
- `src/types/index.ts`: Shared TypeScript interfaces (`UserType`, `ProjectType`, `RealisasiType`, `MonitoringType`, `TabType`, `ViewModeType`).
- `src/components/dashboard/HomeTab.tsx`: 4-Card Bento Grid Dashboard (`VirtualAssistantCard`, `ActivityTimelineCard`, `TodoListCard`, `SummarySplineCard`).
- `src/components/tabs/ProjectsTab.tsx`: Project listing, progress tracking, and admin project creation modal.
- `src/components/tabs/InputTab.tsx`: Realisasi daily logger with date picker, decimal inputs, and photo proof.
- `src/components/tabs/ReportsTab.tsx`: Tabular reporting, search & division filter, RFC 4180 CSV export, and WhatsApp formatter.
- `src/components/tabs/ProfileTab.tsx`: Profile editing, password change, team compliance monitoring, and admin user CRUD.
- `src/lib/db.ts`: SQLite persistent database engine.

## 3. Current Sprint Status
- [x] Full design system tokens integrated from `stitch_design_system_redesign.zip`.
- [x] Monolithic `page.tsx` (2.628 lines) modularized into dedicated tabs and components.
- [x] SQLite CRUD operations verified on `/api/login`, `/api/projects`, `/api/realisasi`, `/api/monitoring`, `/api/users`.
- [x] Full TypeScript type-checking passed (0 errors).
