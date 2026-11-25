# 🐞 PRODUCTIVIER REDESIGN — BUG AND FIX LOG
*Audit & Hardening Report — 25 November 2026*  
*Versi: v2.5.0 Ecosystem & Collaborative Hub*

---

## 📋 Daftar Bug & Celah yang Berhasil Diperbaiki

### 1. Monitoring False-Positive Bug pada Delegasi Tugas
- **File Terdampak:** `src/app/api/monitoring/route.ts`
- **Gejala / Vulnerability:** Ketika seorang leader/PIC mendelegasikan tugas ke anggota tim dengan status awal `realisasi: 0` (`status: 'Belum'`), endpoint monitoring mendeteksi adanya baris di tabel `realisasi` untuk tanggal hari ini, sehingga menganggap karyawan tersebut sudah menginput realisasi hariannya (`sudah_input = true`), padahal tugas tersebut belum dikerjakan sama sekali.
- **Root Cause:** Query sebelumnya hanya memeriksa `WHERE tanggal = ?` tanpa memfilter apakah realisasi telah dikerjakan atau merupakan delegasi gantung.
- **Solusi:**
  ```sql
  -- Sebelum:
  SELECT user_id, COUNT(*) as total FROM realisasi WHERE tanggal = ? GROUP BY user_id
  -- Sesudah:
  SELECT COALESCE(assigned_to_user_id, user_id) as effective_user_id,
         COUNT(*) as total,
         AVG(persentase) as avg_pct
  FROM realisasi
  WHERE tanggal = ? AND (realisasi > 0 OR assigned_by_user_id IS NULL)
  GROUP BY effective_user_id
  ```
- **Verifikasi:** Diuji dengan tugas delegasi `realisasi: 0` serta skenario reassignment `assigned_to_user_id`. Endpoint `/api/monitoring` mengembalikan `sudah_input = false` saat `realisasi: 0` dan mengatribusikan ke penerima baru saat selesai (PASS pada automated test suite).

---

### 1b. Sinkronisasi `nama`/`divisi`, Kalkulasi Ulang Parsial, & Guard Otorisasi di `PATCH/DELETE /api/realisasi/[id]`
- **File Terdampak:** `src/app/api/realisasi/[id]/route.ts`, `src/app/api/ai/chat/route.ts`
- **Gejala / Vulnerability:**
  1. Saat `PATCH` memperbarui `assigned_to_user_id`, kolom `nama` dan `divisi` tidak ikut tersinkronisasi dari tabel `users`, sehingga laporan & notifikasi penyelesaian menampilkan nama penerima lama.
  2. Update `PATCH` hanya mengirim `realisasi` tanpa mengulang `target` gagal menghitung ulang `persentase` dan `status`, dan edit berulang pada tugas yang sudah `>= 100%` memicu notifikasi duplikat.
  3. Tool AI `executePlanTasks` di `src/app/api/ai/chat/route.ts` belum mengisi `assigned_to_user_id`, `assigned_by_user_id`, `deadline`, dan notifikasi delegasi, serta `get_team_status` / `executeNudge` masih belum menerapkan filter `(realisasi > 0 OR assigned_by_user_id IS NULL)`.
- **Solusi:** Sinkronisasi `nama`/`divisi` dari `users` saat reassign, hitung ulang `persentase`/`status` setiap kali `target` atau `realisasi` berubah, cegah duplikasi notifikasi selesai (`existing.persentase < 100 && updated.persentase >= 100`), tambahkan guard otorisasi `x-user-id`, serta selaraskan query di `ai/chat/route.ts`.
- **Verifikasi:** PASS pada `scripts/test_ecosystem.mjs` (35/35 assertions) dan verifikasi PATCH parsial.

---

### 2. Kebocoran Deadline Lintas Proyek di Kalender (Calendar Project Deadline Leak)
- **File Terdampak:** `src/app/api/calendar/route.ts`
- **Gejala / Vulnerability:** Saat pengguna membuka sub-tab "Milestone & Kalender" di dalam suatu proyek spesifik (`?project_id=X`), kalender menampilkan deadline dari **semua** proyek yang ada di database, bukan hanya proyek yang sedang dibuka.
- **Root Cause:** Query penarikan deadline proyek di baris 53 tidak menyertakan klausa filter `AND id = ?` ketika parameter `projectId` ada.
- **Solusi:**
  ```typescript
  let projSql = 'SELECT id, nama_proyek, deadline FROM projects WHERE deadline IS NOT NULL AND deadline != ""';
  const projParams: any[] = [];
  if (projectId) {
    projSql += ' AND id = ?';
    projParams.push(Number(projectId));
  }
  ```
- **Verifikasi:** Uji isolasi `/api/calendar?project_id=X` memverifikasi bahwa `foreignDeadlines.length === 0` (PASS pada automated test suite).

---

### 3. Starvasi Visibilitas Tugas Proyek untuk Karyawan Non-Admin
- **File Terdampak:** `src/app/api/realisasi/route.ts`
- **Gejala / Vulnerability:** Ketika karyawan biasa membuka Hub Proyek Kolaboratif (`ProjectDetailView`), daftar realisasi proyek kosong atau hanya menampilkan tugas miliknya sendiri. Tugas yang dikerjakan rekan tim lain dalam proyek yang sama tidak terlihat.
- **Root Cause:** Filter `role !== 'admin'` secara kaku membatasi `WHERE r.user_id = ?` tanpa mengecek apakah pengguna sedang berada di konteks proyek tertentu.
- **Solusi:** Memprioritaskan parameter `projectId`: jika `projectId` disediakan, semua tugas di proyek tersebut dapat dilihat oleh seluruh anggota kolaborator proyek tanpa terpotong batasan role.
- **Verifikasi:** Karyawan non-admin (`role = 'karyawan'`) berhasil mengakses seluruh laporan tugas di bawah proyek yang diikutinya (PASS).

---

### 4. Starvasi Data Pengguna pada Akun Karyawan (Employee Data Starvation)
- **File Terdampak:** `src/app/page.tsx`
- **Gejala / Vulnerability:** Dropdown penugasan anggota, pemilihan kolaborator tim, dan avatar delegasi tidak muncul ketika login sebagai karyawan biasa.
- **Root Cause:** Pemanggilan `fetchUsers()` di `page.tsx` sebelumnya dibungkus dalam kondisi `if (user.role === 'admin')`. Karyawan non-admin tidak pernah mendapatkan daftar rekan kerja.
- **Solusi:** Menghapus pengondisian role pada `fetchUsers()` sehingga seluruh anggota tim dapat melihat daftar rekan kerja untuk keperluan kolaborasi dan delegasi tugas.
- **Verifikasi:** Endpoint `/api/users` mengembalikan daftar lengkap anggota tim ke semua pengguna terautentikasi (PASS).

---

### 5. Kehilangan Status Navigasi & Deep Linking (`NotesTab`, `CalendarTab`, `NotificationDropdown`, `FloatingAIAgent`)
- **File Terdampak:** `src/components/tabs/NotesTab.tsx`, `src/components/tabs/CalendarTab.tsx`, `src/components/notifications/NotificationDropdown.tsx`, `src/components/ai/FloatingAIAgent.tsx`, `src/components/tabs/ChatTab.tsx`, `src/app/page.tsx`
- **Gejala / Vulnerability:** Saat beralih tab atau mengklik notifikasi (`chat`, `task`, `client`, `nudge`) serta aksi navigasi AI, `project_id` dan `group_id` kerap tidak ikut diteruskan atau hilang karena `AnimatePresence` belum me-mount tab tujuan saat custom event ditembakkan.
- **Root Cause:** `NotificationDropdown` mengirim argumen `extra` (`{ groupId }`) yang diabaikan oleh `onNavigateTab` di `page.tsx`, `ChatTab` belum membaca `productivier_chat_group_id`, dan navigasi UI belum menyinkronkan URL query + `sessionStorage` sebelum state tab diubah.
- **Solusi:** Menambahkan `navigateWithContext` di `src/app/page.tsx`, parsing `payload_json` & `action_url` di `NotificationDropdown.tsx`, dukungan `groupId` di `FloatingAIAgent.tsx` & `ChatTab.tsx`, serta pembersihan `project_id` usang saat berpindah tab lewat sidebar.
- **Verifikasi:** Navigasi antar tab, notifikasi deep link, dan otomasi UI AI tetap mempertahankan konteks proyek & grup yang akurat.

---

### 6. Format Output Markdown AI Berantakan (Wrapped Pipe Rows, HR Collision, Escaped Pipes, `<think>` Leak)
- **File Terdampak:** `src/lib/markdown.ts`, `src/components/ui/MarkdownText.tsx`, `src/app/api/ai/chat/route.ts`, `src/app/api/chat/messages/route.ts`
- **Gejala / Vulnerability:** Balasan Miu AI yang memuat format tabel markdown terkadang pecah ketika baris tabel terbungkus ke baris berikutnya dengan tanda `|` menggantung, separator dihilangkan, atau garis horizontal `-----------------` keliru terdeteksi sebagai separator tabel oleh regex `isTableSeparator`.
- **Root Cause:** Regex lama `(\|?\s*:?-+:?\s*)+` mengizinkan pipe opsional sehingga HR polos cocok sebagai separator tabel; parser belum menangani baris terbungkus, escaped pipe `\|`, alignment (`:---`, `:---:`, `---:`), `__bold__`, `_italic_`, `~~strike~~`, checkbox `[x]`/`[ ]`, maupun tag `<think>` yang tidak tertutup.
- **Solusi:**
  - Mengekstrak parser murni yang dapat diuji langsung ke `src/lib/markdown.ts` (diimpor oleh `MarkdownText.tsx` dan `scripts/test_markdown.mjs`).
  - Memperbaiki `isTableSeparator` agar wajib memiliki `|` tak-terescape, menambahkan pemulihan baris tabel terbungkus & tabel tanpa separator, alignment kolom, `\|`, `__bold__`, boundary-safe `_italic_`, `~~strikethrough~~`, checkbox list, serta `stripThinkTags`.
  - Memperketat system prompt di `ai/chat/route.ts` dan `chat/messages/route.ts` agar setiap baris tabel ditulis dalam satu baris tunggal.
- **Verifikasi:** Diuji langsung terhadap parser nyata via `node --experimental-strip-types scripts/test_markdown.mjs` (8/8 PASS) serta uji live endpoint `/api/ai/chat`.

---

### 7. Verbose Thinking Header & AI Reasoning Open State
- **File Terdampak:** `src/components/ai/FloatingAIAgent.tsx` & `src/components/tabs/ChatTab.tsx`
- **Gejala / Vulnerability:** Indikator saat berpikir masih menampilkan teks verbose, header pesan AI di `ChatTab` menampilkan label teknis model/mode (`⚡ Nemotron (Medium)`), dan container tabel di bubble chat butuh `min-w-0` agar scroll horizontal responsif tetap rapi.
- **Solusi:**
  - Menampilkan indikator ringkas `"Reasoning..."` dengan maskot pulsing dan titik memantul saat AI aktif berpikir (`loading` / `aiTyping`).
  - Menyembunyikan/menciutkan isi penalaran secara default di bawah tombol pill ringkas `"Reasoning"` (atau `"Log Sistem"`).
  - Menyederhanakan badge header AI di `ChatTab.tsx` menjadi pill `"AI"` yang bersih dan menambahkan `min-w-0` pada bubble pesan.
- **Verifikasi:** Diverifikasi di `FloatingAIAgent.tsx` dan `ChatTab.tsx`, serta lolos TypeScript check dan production build.

---

### 8. Batch A/B Hardening, Keamanan (AppSec), Navigasi SPA, & Kontras Bubble Gelap `MarkdownText`
- **File Terdampak:** `src/app/api/chat/groups/route.ts`, `src/app/api/projects/[id]/route.ts`, `src/app/api/projects/[id]/members/route.ts`, `src/app/api/realisasi/[id]/route.ts`, `src/app/api/users/[id]/route.ts`, `src/lib/markdown.ts`, `src/components/ui/MarkdownText.tsx`, `src/components/tabs/ChatTab.tsx`, `src/components/ai/FloatingAIAgent.tsx`, `src/app/page.tsx`, `src/components/tabs/ProjectsTab.tsx`, `src/components/tabs/CalendarTab.tsx`, `src/components/tabs/NotesTab.tsx`, `src/components/tabs/InputTab.tsx`, `src/components/tabs/ReportsTab.tsx`, `src/components/projects/ProjectDetailView.tsx`
- **Gejala / Vulnerability:**
  1. Endpoint `PATCH` dan `DELETE /api/chat/groups` masih mempercayai `user_role === 'admin'` dari parameter klien tanpa verifikasi DB (`Privilege Escalation` / bypass hapus grup oleh akun non-admin).
  2. `MarkdownText.tsx` belum menyaring URI link berbahaya (`javascript:`, `data:`, `vbscript:`, `//`) dan meng-hardcode kelas `text-slate-800 dark:text-slate-200`, menyebabkan teks di bubble user gelap (`ChatTab` & `FloatingAIAgent`) nyaris tak terbaca di Light Mode (ditemukan via audit visual Chrome CDP).
  3. `PATCH /api/projects/[id]` belum menyinkronkan perubahan `pic_id` ke `project_members` (`leader`) & `chat_group_members`, `POST /members` belum menolak user non-eksisten (`404`), `DELETE /members` belum memblokir penghapusan PIC (`403`), dan `DELETE /api/users/[id]` berisiko cascade-menghapus grup chat jika user dihapus adalah pembuat grup.
  4. Navigasi SPA (`ProjectsTab` reset via sidebar, sinkronisasi `CalendarTab`/`NotesTab` saat mounted, `InputTab` auto-delegate, `ReportsTab` header `x-user-id`, serta `ProjectDetailView` tombol quick completion `✓ Selesai` & penggunaan `currentProject`), plus race condition double-submit di `FloatingAIAgent.handleSend`.
- **Solusi:** Verifikasi otorisasi role langsung dari tabel `users` pada `/api/chat/groups`, tambah `sanitizeLinkUrl` di `src/lib/markdown.ts`, tambah prop `inverted` serta pewarisan warna teks di `MarkdownText.tsx`, lengkapi validasi & transfer kepemilikan backend, tambahkan guard sinkron `sendingRef` di `FloatingAIAgent.tsx`, serta sinkronisasi event/header UI frontend.
- **Verifikasi:**
  - `node --experimental-strip-types scripts/test_markdown.mjs`: **9 PASSED, 0 FAILED**.
  - `node scripts/test_ecosystem.mjs` (2x berturut-turut, incl. AppSec IDOR/PrivEsc/SQLi/Secret-Leak): **44 PASSED, 0 FAILED**.
  - Audit Chrome CDP port `9223` mengonfirmasi `overflow: false`, indikator `Reasoning...` & toggle `Reasoning`, serta warna teks putih kontras penuh di bubble chat gelap.

---

### 9. Resolusi Total Audit P0/P1/P2 (5-Pass Iterative QA Verification — `v2.6.0`)
- **File Terdampak:** `src/lib/auth.ts`, `src/lib/validation.ts`, `src/lib/db.ts`, `src/app/api/**`, `src/app/page.tsx`, `src/app/globals.css`, `src/app/client/project/[id]/page.tsx`, `src/components/ui/ConfirmModal.tsx`, `src/components/ui/CustomSelect.tsx`, `src/components/dashboard/*`, `src/components/tabs/*`, `src/components/projects/ProjectDetailView.tsx`, `src/components/chat/GroupInfoModal.tsx`, `src/components/ai/FloatingAIAgent.tsx`, `src/components/notifications/NotificationDropdown.tsx`, `src/components/client/ClientNotesSection.tsx`
- **Cakupan Perbaikan:**
  1. **Keamanan & Autentikasi Sesi (`P0`):** Penegakan cookie sesi terenkripsi `HttpOnly` (`prod_session`) via `requireAuth` / `requireAdmin` di seluruh rute API; menyingkirkan bypass header/query (`x-user-id` / `user_role`) serta auto-login admin & kredensial demo di `src/app/page.tsx`; proteksi token acak `share_token` (`?token=`) pada Portal Klien SSR & `/api/projects/[id]/client-notes`; validasi ketat input via `src/lib/validation.ts`.
  2. **Database Hygiene (`P2`):** Migrasi `hygiene_and_backfill_v2` dan `hygiene_and_backfill_v3` menormalkan role tidak valid ke `'karyawan'`, membersihkan data uji/profanitas, menghapus legacy branding, serta mem-backfill `share_token`, `project_members`, dan ruang grup chat otomatis untuk proyek yang belum terhubung.
  3. **Dark Mode & Metrik Riil (`P0`–`P1`):** Token `:root`/`.dark` + `@custom-variant dark (.dark &, &.dark);` di `src/app/globals.css`, persistensi `productivier_dark_mode` di `localStorage`, penghapusan `transition-colors` yang menunda rendering tema di header & Launchpad, serta penghapusan seluruh metrik dummy (`PersonalFocusChart`, `HomeTab`, `QuickLaunchpadCard`) agar terikat 100% ke data DB nyata.
  4. **Responsif Mobile, Layering, & Kontrol UI Kustom (`P0`–`P1`):** Layout Master-Detail mobile di `ChatTab`, pembersihan tumpang-tindih `FloatingAIAgent`, Toast, & Dock 8-kolom (`360px`–`1440px`), pemangkasan tombol header `ProjectDetailView`, pengisian kartu ringkasan karyawan non-admin di `ProfileTab`, penggantian seluruh `<select>`, `alert()`, dan `confirm()` bawaan dengan `<CustomSelect />`, toast/inline alert, dan `<ConfirmModal />`.
- **Verifikasi 5-Pass QA (Pass 5 Final Clean):**
  - `node --experimental-strip-types scripts/test_markdown.mjs`: **9 PASSED**.
  - `node scripts/test_ecosystem.mjs`: **56 PASSED, 0 FAILED** (unauthenticated `401`, cookie session, share_token SSR/API, schema `400`, forged header/role `403`, IDOR/SQLi/XSS, & cleanup).
  - `./node_modules/.bin/tsc --noEmit`: **0 error**; ESLint pada 18 file inti terdampak: **0 error**; `npm run build`: sukses.
  - Chrome CDP port `9223` (`Pass 5`): **23/23 PASS, 0 FAIL, 0 console/page/HTTP errors** lintas `1440x900`, `1280x800`, `768x1024`, `390x844`, `360x800`, Light + Dark Mode, Admin + Karyawan (`tim1`), & Client Portal bertoken.
