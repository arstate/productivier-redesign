# Project Brain State — Productivier (v2.6.2)

## 1. Project Overview
- **Name**: Productivier (Intellecta Clean Slate Edition)
- **Repo / Path**: `/mnt/HDD-2/BACKUP LINUX/FILE DATA/WEBSITE/productivier-redesign`
- **GitHub**: `https://github.com/arstate/productivier-redesign.git` (branch `main`, latest code baseline `e569001`)
- **Core Domain**: Manajemen realisasi kerja harian, progres proyek tim multi-assignee, chat grup + Miu AI co-worker, kalender, notes, portal klien bertoken, dan monitoring kepatuhan tim.
- **Design Style**: Intellecta Clean Slate — minimal modern SaaS, generous whitespace, rounded geometry (24px/32px), deep charcoal (`#18181B`) + aksen pastel (`#D2F27C`, `#DCD4FB`, `#D7DEEA`) + Dark Mode tokens deterministik (`@custom-variant dark (.dark &, &.dark);`).

## 2. Active Architecture & Key Files
- `src/app/layout.tsx` & `src/components/providers/MotionProvider.tsx`: Root layout dengan fixed GPU background layer + `<LazyMotion features={loadMotionFeatures}>` (async `domMax`) + `<MotionConfig reducedMotion="user">`.
- `src/app/page.tsx`: Main Controller — session auth gate, tab orchestration, dan `next/dynamic` code splitting untuk `ProjectsTab`, `CalendarTab`, `NotesTab`, `InputTab`, `ReportsTab`, `ProfileTab`, `ChatTab`, dan `FloatingAIAgent`.
- `src/components/tabs/ProjectsTab.tsx` & `src/components/projects/ProjectDetailView.tsx`: Manajemen proyek + lazy-loaded detail hub kolaborasi.
- `src/components/tabs/ChatTab.tsx` & `src/components/chat/GroupInfoModal.tsx`: Chat grup real-time dengan delta polling (`after_id`), slash tag `/project`, dan lazy-loaded `GroupInfoModal`.
- `src/hooks/useVisibilityPolling.ts`: Polling helper yang otomatis pause saat `document.hidden` dan sync ulang saat tab kembali aktif.
- `src/lib/db.ts`: Native `node:sqlite` (`productivier.db`) dengan `WAL`, `synchronous = NORMAL`, `temp_store = MEMORY`, `cache_size = -16000`, `busy_timeout = 5000`, dan **8 hot-path indexes**.
- `src/lib/auth.ts` & `src/lib/validation.ts`: Cookie `HttpOnly` HMAC-SHA256 (`prod_session`), `requireAuth`/`requireAdmin`, serta validasi schema input.
- `src/lib/markdown.ts` & `src/components/ui/MarkdownText.tsx`: Parser GFM + sanitasi URL XSS.
- `src/types/index.ts` & `src/types/db-rows.ts`: Shared TypeScript interfaces + `Row` boundary type untuk lapisan API.

## 3. Guardrails for Next Agent
1. **Animasi & Bundle:** Gunakan `m` dari `motion/react` (bukan `motion`), dan jangan ubah `ChatTab.tsx` menjadi `m` tanpa alias (`MotionEl`) karena variabel map `m: ChatMessageType` akan bentrok. Pertahankan `next/dynamic` untuk tab/modal berat agar chunk awal tetap kecil (saat ini maks chunk `224 KB`, turun dari `530 KB`).
2. **GPU & Scroll:** Jangan kembalikan `background-attachment: fixed` di `globals.css` dan hindari `backdrop-blur-*` di dalam kartu list yang di-scroll berulang.
3. **Database SQLite:** Kolom tanggal di `calendar_events` bernama `date` (bukan `start_date`). File `*.db`, `*.db-wal`, `*.db-shm`, dan `.env*.local` wajib tetap ter-ignore di `.gitignore`.
4. **Lint & Test Wajib Sebelum Commit:**
   - `./node_modules/.bin/eslint src` (harus **0 error, 0 warning**)
   - `./node_modules/.bin/tsc --noEmit` (exit **0**)
   - `npm run build`
   - `node --experimental-strip-types scripts/test_markdown.mjs` (`9 PASSED`)
   - `node scripts/test_ecosystem.mjs` (`56 PASSED, 0 FAILED`)

## 4. Current Sprint Status
- [x] `v2.5.0`: Ecosystem & Collaborative Hub (`project_members`, auto chat group, delegasi tugas, Markdown parser, AI thinking UX).
- [x] `v2.6.0` (`3def372`): Cookie session `HttpOnly` auth, client portal `share_token`, Dark Mode fix, & 5-pass multi-viewport CDP QA.
- [x] `v2.6.1` (`e835d56`): ESLint Zero (244 errors + 66 warnings -> **0/0**).
- [x] `v2.6.2` (`e569001`): Low-spec performance optimization (`LazyMotion` async `domMax`, `next/dynamic`, `useVisibilityPolling`, delta `after_id` chat, GPU scroll fix, SQLite WAL + 8 indexes).
- [ ] **Next Suggested Development:** Persiapan migrasi `src/lib/db.ts` (`node:sqlite`) ke cloud DB (mis. Firebase Firestore Spark + Auth) & media upload (Cloudinary Free) jika siap deploy ke Vercel Hobby, plus rotasi password akun demo (`fifa`, `tim1`, `tim2`) sebelum rilis publik.
