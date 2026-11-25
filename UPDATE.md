# 🚀 PRODUCTIVIER REDESIGN — RELEASE NOTES & SYSTEM UPDATES

## 🧹 Versi v2.6.1 — ESLint Zero (0 Error, 0 Warning)
*Tanggal: 25 November 2026*

- Menambahkan `src/types/db-rows.ts` (`Row`) sebagai satu-satunya titik `any` di lapisan API; semua `as any` / `error: any` / `db: any` di `src/app/api/**` diganti tipe eksplisit (`Row`, `DatabaseSync`, `catch (error)` + `instanceof Error`).
- `FloatingAIAgent.tsx`: tipe minimal Web Speech API menggantikan `window as any`.
- `ChatTab.tsx`: `any` diganti `ChatGroupType`.
- Menghapus import/variabel tak terpakai di 10+ komponen; anotasi `eslint-disable-next-line` + alasan untuk pola efek load-awal, `Date.now` di event handler, dan `<img>` SVG/avatar.
- Hasil: `eslint src` 0 error 0 warning (sebelumnya 244 error + 66 warning), `tsc --noEmit` 0 error, `npm run build` OK, `test_ecosystem.mjs` 56 PASS / 0 FAIL, `test_markdown.mjs` 9 PASS, CDP QA pass6 0 console/page error, smoke test `/api/ai/chat` (3 skenario) + `/api/chat/groups` OK.

## 🔒 Versi v2.6.0 — Cookie Session Auth, Client Token Portal, Dark Mode Fix, & 5-Pass Mobile/CDP QA
*Tanggal Rilis: 25 November 2026*  
*Versi Aplikasi: v2.6.0 Production Build (Next.js 16.4.6 Turbopack)*

---

### 🌟 Ringkasan Pembaruan Utama (Pass 1 s/d Pass 5)
1. **Autentikasi Sesi Cookie `HttpOnly` & Penguncian API:**
   - Menambahkan modul `src/lib/auth.ts` (`prod_session` HMAC-SHA256 cookie) dan menerapkannya pada rute `/api/*` via `requireAuth`/`requireAdmin`.
   - Menghapus auto-login admin serta kredensial demo dari layar login `src/app/page.tsx`, serta menambahkan validasi ketat di `src/lib/validation.ts`.
   - Mengamankan Client Portal SSR & `client-notes` dengan `?token=` (`share_token`).
2. **Dark Mode Deterministik, Data Nyata, & Integrasi Kalender/Todo:**
   - Memperbarui token warna `:root`/`.dark`, persistensi `localStorage`, spesifisitas `@custom-variant dark (.dark &, &.dark);`, serta penghapusan flash transisi di header & Launchpad.
   - Menghapus metrik dummy pada `HomeTab`, `PersonalFocusChart`, dan `QuickLaunchpadCard`, serta menambahkan konversi `PersonalTodo` ke realisasi/kalender.
3. **UX Mobile (`360px`–`390px`), Kontrol Kustom, & DB Hygiene:**
   - Memperbaiki Master-Detail mobile di `ChatTab`, tinggi komposer agar bebas dari tabrakan dock 8-kolom & menyembunyikan orb `FloatingAIAgent` di mode chat mobile, serta merapikan header mobile (`Halo, ...!`) dan `ProjectDetailView`.
   - Mengganti seluruh `<select>`, `alert()`, dan `confirm()` bawaan dengan `<CustomSelect />`, banner/toast, dan `<ConfirmModal />`, plus pembersihan data DB melalui migrasi `v2` & `v3`.
   - **Verifikasi 5-Pass:** `9` unit Markdown, `56/56` API & security suite (`scripts/test_ecosystem.mjs`), `0` error TypeScript & targeted ESLint (18 file), dan `23/23` cek Chrome CDP Pass 5.

---

## 📦 Versi v2.5.0 — Multi-Collaborator Projects, Task Delegation, & Clean AI UX
*Tanggal Rilis: 25 November 2026*  
*Versi Aplikasi: v2.5.0 Production Build (Next.js 16.4.6 Turbopack)*

---

### 🌟 Ringkasan Pembaruan Utama (Highlights)

Rilis v2.5.0 merealisasikan seluruh cetak biru kolaborasi tim dari `system_ecosystem_gap_and_implementation_plan.md`:
1. **Multi-Assignee Projects & Auto-Provisioning Ruang Obrolan Tim:**
   - Proyek kini mendukung banyak kolaborator melalui tabel `project_members (id, project_id, user_id, role, created_at)`.
   - Pembuatan proyek baru otomatis mem-provisioning grup koordinasi tim di `chat_groups` & `chat_group_projects`, menambahkan seluruh kolaborator ke grup, dan memicu pesan sambutan inisial dari Miu AI.
2. **Detail Hub Kolaborasi (`ProjectDetailView`):**
   - Tombol shortcut `[💬 Diskusi Tim]` untuk melompat langsung ke ruang chat proyek.
   - Sub-tab ke-4: `[📅 Milestone & Kalender]` yang menampilkan target deadline proyek dan agenda terhubung.
   - Widget "Tim Kolaborator Proyek" dengan tombol `+ Tambah Anggota` dan modal pemilihan tim yang reaktif.
3. **Sistem Delegasi Tugas Terpadu (True Task Delegation):**
   - Penugasan tugas ke anggota tim lain via `assigned_to_user_id` di `InputTab` dan modal Quick Progress proyek.
   - Notifikasi lonceng otomatis terkirim ke anggota yang ditugaskan saat tugas dibuat (`Tugas Baru Didelegasikan`).
   - Notifikasi lonceng terkirim balik ke pemberi tugas saat tugas diselesaikan 100% (`Tugas Delegasi Selesai`).
   - Badge penugasan visual transparan di `ReportsTab` (`Didelegasikan oleh [Nama]`).
4. **Penyelesaian 5 Celah Forensik (Hidden Forensic Gaps):**
   - **Fix Monitoring False-Positive:** Filter `(realisasi > 0 OR assigned_by_user_id IS NULL)` mencegah tugas delegasi yang belum dikerjakan terhitung sebagai realisasi harian karyawan.
   - **Fix Calendar Deadline Leak:** Isolasi deadline proyek di `/api/calendar?project_id=X` agar tidak bocor ke proyek lain.
   - **Fix Non-Admin Project Realisasi Visibility:** Akses penuh untuk melihat seluruh tugas tim di bawah proyek tanpa terblokir filter role.
   - **Fix Employee Data Starvation:** Fetch `/api/users` tanpa syarat role di `src/app/page.tsx` sehingga karyawan biasa dapat melihat rekan tim.
   - **Fix Navigation State Loss:** Sinkronisasi ganda `sessionStorage` pada `NotesTab` dan `CalendarTab`.
5. **Penyempurnaan UX Format Markdown, Reasoning AI, & Hardening Backend Audit:**
   - **Real Shareable Markdown Parser (`src/lib/markdown.ts` + `MarkdownText.tsx`):** Memperbaiki regex `isTableSeparator` agar garis horizontal polos (`-----------------`) tidak bentrok dengan separator tabel; mendukung pemulihan baris tabel yang terbungkus / `|` menggantung, tabel tanpa baris separator, alignment (`:---`, `:---:`, `---:`), escaped pipe `\|`, `__bold__`, boundary-safe `_italic_`, `~~strikethrough~~`, checkbox `[x]`/`[ ]`, strip tag `<think>` tertutup maupun tidak tertutup, dan tabel horizontal scroll responsif (`whitespace-nowrap`, zebra striping) di `FloatingAIAgent.tsx` & `ChatTab.tsx`.
   - **Concise Reasoning & Pulsing State:** Saat AI berpikir aktif tampil indikator ringkas `"Reasoning..."` dengan maskot pulsing dan titik memantul; setelah selesai isi penalaran otomatis tersembunyi (collapsed by default) di bawah tombol `"Reasoning"` / `"Log Sistem"`. Label model/mode verbose di `ChatTab.tsx` disederhanakan.
   - **Backend, AppSec, & UI Visual Hardening:** `/api/monitoring` & AI tools mengelompokkan berdasarkan `COALESCE(assigned_to_user_id, user_id)`; `PATCH /api/realisasi/[id]` menyinkronkan `nama` & `divisi` saat reassignment, mencegah notifikasi selesai ganda, dan mendukung guard `x-user-id`; `/api/chat/groups` kini memverifikasi role admin langsung dari database (menutup eskalasi hak akses); `/api/projects/[id]` & `/members` memvalidasi `pic_id`/user eksistensi; `DELETE /api/users/[id]` menjaga grup chat tim tetap utuh; `MarkdownText` menyanitasi tautan berbahaya (`sanitizeLinkUrl`) dan memperbaiki kontras teks putih pada bubble user gelap (`inverted`). Verifikasi: `9 PASSED` unit Markdown, `44 PASSED` ecosystem + security suite (2x), dan audit visual Chrome CDP port `9223`.

---

## 📦 Versi v2.4.0 — Universal AI Assistant "Miu" & Multi-Project Connector
*Tanggal Rilis: 24 November 2026*  
*Versi Aplikasi: v2.4.0 Production Build (Next.js 16.4.6 Turbopack)*

---

### 🌟 Ringkasan Pembaruan v2.4.0 (Highlights)
Pembaruan komprehensif ini menghadirkan perombakan total pada arsitektur AI Agent (**Miu**), penyatuan identitas visual maskot SVG, sistem *Multi-Project Connector* pada obrolan tim, *Interactive Slash Autocomplete* `/project`, instant zero-animation chat scroll, serta penguatan keamanan database (*password hashing* & *access control*).

### 🤖 1. Transformasi AI Agent Universal: "Miu" & Autonomous Full Control
- **Identitas Baru:** Seluruh penyebutan nama AI diubah secara universal menjadi **"Miu"** (atau **"Miu AI"** di header/badge).
- **Database Migration:** Data seeded dan nama asisten pada tabel SQLite `chat_groups` dan `chat_messages` dimigrasikan otomatis menjadi `'Miu'`.
- **Zero-Tolerance Anti-Refusal Policy:** AI dilarang keras menolak perintah operasional dengan dalih "tidak ada fitur", "cuma bisa manual", atau "bukan wewenang". Dilengkapi Server-Side Anti-Refusal Interceptor.

### 🎨 2. Standarisasi Maskot Vector SVG 1:1 (Anti-Meleyot)
- Menggunakan aset vector SVG beresolusi tinggi di `/public/mascot-ai.svg`.
- Komponen `<AIMascot />` di `src/components/ui/AIMascot.tsx` menjamin aspect-ratio 1:1 terkunci.

### ⚡ 3. Instant Pre-Paint Scroll to Bottom (Tanpa Animasi Lag)
- Menghapus delay animasi gulir halus saat membuka ruang obrolan. Sinkronisasi pre-paint dengan `useLayoutEffect`.

### 🔗 4. Multi-Project Connector di Grup Chat
- Relasi multi-proyek `chat_group_projects (group_id, project_id)`. Satu grup obrolan dapat mengikat lebih dari 1 proyek sekaligus.

### ⌨️ 5. Interactive Dropup Autocomplete Slash Tag `/project` & `/pro`
- Dropup interaktif muncul saat mengetik `/pro` atau `/project` dengan navigasi panah keyboard dan instant filtering.

### 🔒 6. Hardening Keamanan, Autentikasi & Integrasi UI
- Password Hashing `scryptSync` (salt 16-byte, keylen 64-byte).
- Access Control Guard pada routes manajemen data.
