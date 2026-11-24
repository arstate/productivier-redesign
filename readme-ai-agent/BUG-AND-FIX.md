# Bug & Fix Ledger — Productivier

## 1. Monolithic 2.628-Line File Bloat
- **Symptom**: `src/app/page.tsx` contained all tabs, modal dialogs, and helper functions in a single file (>2.600 lines), hurting maintainability and readability.
- **Root Cause**: Rapid feature addition in single file without component extraction.
- **Resolution**: Extracted `HomeTab`, `ProjectsTab`, `InputTab`, `ReportsTab`, and `ProfileTab` into dedicated files under `src/components/tabs/` and `src/components/dashboard/`.

## 2. TypeScript Compilation Errors on Modularization
- **Symptom**: `error TS2304: Cannot find name 'UserPlus'`.
- **Root Cause**: Missing icon import in `src/components/tabs/ProfileTab.tsx`.
- **Resolution**: Added `UserPlus` to `lucide-react` import statement.

## 3. To-do List Pribadi Missing Persistence & Add Form
- **Symptom**: User could not add new items to the dashboard to-do checklist, and checked items reset upon page refresh.
- **Root Cause**: In `HomeTab.tsx`, `personalTasks` was hardcoded inside `useState` without a database table or API route, and no add form existed in the UI.
- **Resolution**: Created `personal_todos` table in SQLite (`src/lib/db.ts`), created `/api/todos` (GET, POST) and `/api/todos/[id]` (PATCH, DELETE), and refactored `HomeTab.tsx` with an inline input form (`+ Tambah to-do... [Enter]`), tag selector pills, delete button, and optimistic checkbox toggling.

## 4. Client Portal Broken Link (404 Error)
- **Symptom**: "Salin Portal Klien" button in `QuickLaunchpadCard.tsx` copied `/portal/${id}` which returned 404 Not Found.
- **Root Cause**: The actual Next.js App Router route is `/client/project/[id]`.
- **Resolution**: Updated `QuickLaunchpadCard.tsx` to generate `${window.location.origin}/client/project/${firstProjId}`.

## 5. False Sprint Velocity Metric (68% on 0 Tasks)
- **Symptom**: New accounts or days with 0 completed tasks displayed 68% velocity.
- **Root Cause**: `Math.round(...) || 68` evaluated `0 || 68` to `68%`.
- **Resolution**: Replaced with `totalTargetCount > 0 ? Math.min(100, Math.round((completedCount / totalTargetCount) * 100)) : 0`.

## 6. Fake 17-23 Nov Dates on Personal Focus Chart
- **Symptom**: Chart rendered hardcoded "17 Nov - 23 Nov" dates and artificial `60 + idx*5` efficiency scores.
- **Root Cause**: `DEFAULT_DAYS` was static and fallback formula added fake points.
- **Resolution**: Replaced with a dynamic 7-day rolling window generator based on `new Date()`.

## 7. Missing Project Status & Deletion Controls
- **Symptom**: "Selesai" tab in `ProjectsTab.tsx` was always empty; projects could not be marked done or deleted.
- **Root Cause**: `/api/projects` lacked PATCH and DELETE handlers, and `ProjectDetailView.tsx` lacked action buttons.
- **Resolution**: Created `/api/projects/[id]` (PATCH, DELETE) and added "Tandai Selesai" / "Buka Kembali" and "Hapus Proyek" buttons in `ProjectDetailView.tsx`.

## 8. Hardcoded OpenRouter API Key & Exposure Risk
- **Symptom**: `OPENROUTER_API_KEY` was committed in plaintext across API routes.
- **Root Cause**: Missing `.env.local` isolation and hardcoded fallback strings.
- **Resolution**: Created `.env.local` with `OPENROUTER_API_KEY`, updated `src/app/api/ai/chat/route.ts` and `src/app/api/chat/messages/route.ts` to consume `process.env.OPENROUTER_API_KEY` first.

## 9. Plaintext Passwords in Database & Seed Reset
- **Symptom**: User passwords were stored in plaintext, and server restart in `initDb()` could reset passwords back to default values.
- **Root Cause**: Missing password hashing logic and unconditional seed re-runs.
- **Resolution**: Implemented native `node:crypto` `scryptSync` with random salt (`hashPassword`, `verifyPassword`). Added transparent auto-upgrade in `src/app/api/login/route.ts` that detects plaintext passwords on successful login and immediately writes a salted scrypt hash back to SQLite without locking users out. Guarded seed inserts in `initDb()` to prevent overwrites.

## 10. Missing Access Control Guard on Critical API Endpoints
- **Symptom**: Any client could mutate or delete any user or note by sending arbitrary IDs to `/api/users/[id]` and `/api/notes/[id]`.
- **Root Cause**: Endpoint handlers executed SQL statements without checking requester permissions or ownership.
- **Resolution**: Enforced requester identification (`x-user-id` header). Prevented non-admin users from altering other accounts or deleting users, protected root account (`fifa`), and restricted note edits/deletions to note owners and administrators.

## 11. Disconnected UI Capabilities (Calendar Edit, Realisasi Actions, Profile Fields)
- **Symptom**: Users could not edit calendar events, could not modify or delete realisasi reports from the table, and could not edit phone or gender in profile.
- **Root Cause**: `PUT /api/calendar/[id]` and `PATCH/DELETE /api/realisasi/[id]` existed in the API or backend but lacked UI trigger buttons, modals, and form inputs.
- **Resolution**: Added "Edit Jadwal" modal in `CalendarTab.tsx`, Edit and Delete action buttons and modals in `ReportsTab.tsx`, and WhatsApp phone number plus gender selector in `ProfileTab.tsx`.

## 12. Static Chat View & Unbounded Message Query Payload
- **Symptom**: Chat messages did not update automatically when another user or AI replied, and chat query fetched all historical messages without a limit.
- **Root Cause**: Lack of polling/subscription mechanism in `ChatTab.tsx` and missing query `LIMIT` in `/api/chat/messages`.
- **Resolution**: Added 4-second background silent polling in `ChatTab.tsx` while a group is active, and added `LIMIT 100` subquery ordering by ID in `src/app/api/chat/messages/route.ts`.

## 13. Smooth Scroll Animation Lag When Opening Group and AI Chat
- **Symptom**: When switching chat groups or opening the floating AI chat window, messages scrolled down with a visible, delayed animation or started at the top before scrolling down.
- **Root Cause**: Reliance on delayed `setTimeout(scrollToBottom, 100)` or absence of `useLayoutEffect` pre-paint positioning, causing the browser to paint top-of-chat before scrolling.
- **Resolution**: Integrated synchronous `useLayoutEffect` coupled with `behavior: "auto"` and direct `chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight`, ensuring messages are pinned to the very bottom before the browser's first paint frame.

## 14. Inconsistent AI Avatars & Robot Icons Across UI
- **Symptom**: Chat tabs, floating assistant, group modal, and launchpad tiles used generic Lucide `Bot` icons, lacking branding cohesion.
- **Root Cause**: The custom vector mascot SVG had not been unified into a dedicated component across all touchpoints.
- **Resolution**: Deployed `AIMascot.tsx` (rendering `/mascot-ai.svg` with strict 1:1 square aspect ratio and `object-contain`) into `ChatTab.tsx`, `FloatingAIAgent.tsx`, `GroupInfoModal.tsx`, and `QuickLaunchpadCard.tsx`.

## 15. Group Chat AI Canned Refusal Statements
- **Symptom**: When users mentioned `@ai` in a group chat asking to colek/nudge someone or add a member, the AI responded with canned refusal messages ("Maaf Bestie, gw nggak bisa langsung ngirim reminder...", "gw nggak bisa otomatis tambah anggota...").
- **Root Cause**: Group chat message handler in `src/app/api/chat/messages/route.ts` lacked anti-refusal instructions, intent recognition for colek/add member, and server-side refusal interception.
- **Resolution**: Added strict Zero-Tolerance Anti-Refusal instructions, autonomous SQLite handlers for inserting nudge notifications into `notifications` and inserting members into `chat_group_members`, and an automated server-side interceptor that rewrites any refusal output into an actionable confirmation.

## 16. Disconnected "Review & Kendala Tim" Card & Single Project Group Limitation
- **Symptom**: Kartu "Review & Kendala Tim" di Dashboard HomeTab terkesan misah sendiri dan pasif tanpa integrasi langsung ke alur kerja tim. Grup chat tim sebelumnya hanya bisa mengikat satu proyek (`project_id`), AI Miu tidak memiliki konteks menyeluruh tentang progres proyek tim, dan tidak ada autocomplete untuk tag proyek di chat.
- **Root Cause**: Kartu blockers hanya mengarah ke `ReportsTab` dan `InputTab` tanpa interaksi langsung ke diskusi grup atau AI. Tabel `chat_groups` menggunakan kolom tunggal `project_id`. Komponen composer chat belum memiliki listener autocomplete slash command `/project`.
- **Resolution**:
  1. Dibuat tabel `chat_group_projects (id, group_id, project_id, created_at, UNIQUE(group_id, project_id))` dengan auto-migration di `src/lib/db.ts` dan endpoints RESTful `/api/chat/groups/[id]/projects`.
  2. Modul "Konektor Proyek Tim" ditambahkan di `GroupInfoModal.tsx` yang menampilkan seluruh proyek terhubung, bar progres %, target/realisasi, status kendala aktif, opsi hapus koneksi, dan modal penghubung proyek.
  3. Interactive Autocomplete Dropup diimplementasikan di `ChatTab.tsx` saat pengguna mengetik `/project` atau `/pro`, dengan prioritas proyek grup, filter pencarian instan, navigasi keyboard panah atas/bawah, Enter/Tab auto-fill format rapi `/project "[Nama Proyek]" `, dan Escape untuk menutup.
  4. Kartu "Review & Kendala Tim" di `HomeTab.tsx` dilengkapi badge proyek serta tombol aksi langsung "Bahas di Chat" dan "Tanya Miu AI" yang membuka `ChatTab` dengan auto-populated draft message dan navigasi ke grup yang relevan.
  5. Di `src/app/api/chat/messages/route.ts` & `src/app/api/ai/chat/route.ts`, AI Miu secara cerdas membaca seluruh proyek yang terkoneksi ke grup chat. Ketika pengguna menyertakan tag `/project [Nama Proyek]`, Miu mengekstrak seluruh capaian target, realisasi tugas, dan rincian kendala proyek tersebut secara akurat.
