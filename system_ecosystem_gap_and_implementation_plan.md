# 🏛️ PRODUCTIVIER REDESIGN — FORENSIC GAP AUDIT & IMPLEMENTATION BLUEPRINT
**Dokumen Perencanaan Arsitektur: Auto-Connected Ecosystem (Multi-Assignee, Auto-Provisioning Chat, True Delegation, & Deep Hub Integration)**  
*Target Repository: `/mnt/HDD-2/BACKUP LINUX/FILE DATA/WEBSITE/productivier-redesign`*  
*Teknologi: Next.js 16.4.6 Turbopack, SQLite (`node:sqlite`), React 19, Motion, Lucide Icons, Miu AI Autonomous Engine*  
*Status: Siap Eksekusi (Zero-Regression & Backward-Compatible)*

---

## 📑 DAFTAR ISI
1. [Eksekutif Ringkasan & Konfirmasi Temuan](#1-eksekutif-ringkasan--konfirmasi-temuan)
2. [Forensic Audit: Validasi 4 Temuan Utama (Bukti Kode & Dampak)](#2-forensic-audit-validasi-4-temuan-utama)
   - [2.1 Disconnect Proyek ↔ Tim Member (Multi-Assignee Hilang)](#21-disconnect-proyek--tim-member-multi-assignee-hilang)
   - [2.2 Disconnect Pembuatan Proyek ↔ Grup Chat (Gak Auto-Provisioning)](#22-disconnect-pembuatan-proyek--grup-chat-gak-auto-provisioning)
   - [2.3 Disconnect Delegasi Tugas ↔ Anggota Tim (Fake Delegation)](#23-disconnect-delegasi-tugas--anggota-tim-fake-delegation)
   - [2.4 Isolasi Modul Kalender & Notes dari Proyek](#24-isolasi-modul-kalender--notes-dari-proyek)
3. [Forensic Audit: 6 Celah Tersembunyi (Hidden Disconnects)](#3-forensic-audit-6-celah-tersembunyi-hidden-disconnects)
   - [3.1 Karyawan Data Starvation (Users Array Kosong untuk Non-Admin)](#31-karyawan-data-starvation)
   - [3.2 Missing Delegation Notifications](#32-missing-delegation-notifications)
   - [3.3 Navbar "Pribadi" vs "Tim" Mode Disconnect di Tab Proyek](#33-navbar-pribadi-vs-tim-mode-disconnect)
   - [3.4 Celah Keamanan Otorisasi di Task Mutation (`PATCH/DELETE /api/realisasi/[id]`)](#34-celah-keamanan-otorisasi-task-mutation)
   - [3.5 Disconnect pada Miu AI Autonomous Tool Calling (`create_project` & `plan_tasks`)](#35-disconnect-pada-miu-ai-autonomous-tool-calling)
   - [3.6 Broken State Navigation ke Notes & Calendar Tab](#36-broken-state-navigation-ke-notes--calendar-tab)
4. [Target Arsitektur Blueprint (Auto-Connected Ecosystem)](#4-target-arsitektur-blueprint)
   - [4.1 Database Schema Evolution (SQLite)](#41-database-schema-evolution-sqlite)
   - [4.2 Backend API Contract & Auto-Provisioning Hooks](#42-backend-api-contract--auto-provisioning-hooks)
   - [4.3 Frontend Component Architecture & Data Flow](#43-frontend-component-architecture--data-flow)
5. [Rencana Eksekusi Bertahap (Implementation Roadmap)](#5-rencana-eksekusi-bertahap-implementation-roadmap)
6. [Matriks Pengujian & Zero-Regression Guardrails](#6-matriks-pengujian--zero-regression-guardrails)

---

## 1. EKSEKUTIF RINGKASAN & KONFIRMASI TEMUAN

Berdasarkan audit forensik mendalam pada codebase aktual Productivier Redesign di `/mnt/HDD-2/BACKUP LINUX/FILE DATA/WEBSITE/productivier-redesign`, **seluruh 4 temuan disconnect dari pengguna 100% TERKONFIRMASI VALID** dan terbukti merupakan akar penyebab masalah operasional.

Selain itu, investigasi forensik menemukan **6 celah tersembunyi tambahan (hidden gaps)** yang memperparah fragmentasi data, termasuk kelaparan data anggota pada akun karyawan non-admin, nihilnya notifikasi saat tugas didelegasikan, hilangnya filter "Pribadi" pada daftar proyek, serta kegagalan navigasi lintas tab (state loss saat membuka Notes dan Kalender dari Detail Hub Proyek).

Dokumen ini menyajikan audit berbasis bukti (file paths, baris kode, dan respons data SQLite) serta cetak biru teknis (blueprint) lengkap untuk mentransformasikan Productivier menjadi **Auto-Connected Ecosystem**.

---

## 2. FORENSIC AUDIT: VALIDASI 4 TEMUAN UTAMA

### 2.1 Disconnect Proyek ↔ Tim Member (Multi-Assignee Hilang)
- **File Referensi:**
  - `src/lib/db.ts` (L62–L73)
  - `src/app/api/projects/route.ts` (L32–L50)
  - `src/components/tabs/ProjectsTab.tsx` (L37, L383–L394)
  - `src/components/projects/ProjectDetailView.tsx` (L1–L1909)
  - `src/types/index.ts` (L42–L56)
- **Bukti Kode Aktual:**
  Di `src/lib/db.ts`, skema tabel `projects` hanya menyediakan:
  ```sql
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama_proyek TEXT NOT NULL,
    pic_id INTEGER,
    divisi TEXT NOT NULL DEFAULT 'Umum',
    target_total REAL NOT NULL DEFAULT 100,
    satuan TEXT NOT NULL DEFAULT 'Tugas',
    status TEXT NOT NULL DEFAULT 'aktif',
    deadline TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pic_id) REFERENCES users(id) ON DELETE SET NULL
  );
  ```
  Tidak ada tabel `project_members`. Akibatnya, pada saat pembuatan proyek di `ProjectsTab.tsx`, form modal hanya menyediakan dropdown tunggal `picId` (`PIC (Leader)`).
- **Kondisi Data Riil:**
  Query ke `productivier.db` menunjukkan:
  - Proyek #1 (`Operasional & Konten Harian`) -> `pic_id = 1` (Fifa)
  - Proyek #2 (`Redesign UI Intellecta Clean Slate`) -> `pic_id = 1` (Fifa)
  - Anggota tim `tim1` (id: 2) dan `tim2` (id: 3) **sama sekali tidak tercatat di proyek mana pun**.
- **Dampak UX/Operasional:**
  Karyawan (Tim 1 dan Tim 2) tidak memiliki status keanggotaan pada proyek. Di `ProjectDetailView`, tidak ada daftar kolaborator proyek, dan sistem tidak bisa membedakan proyek mana yang dikerjakan oleh Tim 1 vs Tim 2.

---

### 2.2 Disconnect Pembuatan Proyek ↔ Grup Chat (Gak Auto-Provisioning)
- **File Referensi:**
  - `src/app/api/projects/route.ts` (L32–L54)
  - `src/components/projects/ProjectDetailView.tsx` (Header Action Bar)
  - `src/components/tabs/ProjectsTab.tsx` (L281–L306)
- **Bukti Kode Aktual:**
  Di `src/app/api/projects/route.ts`:
  ```typescript
  export async function POST(req: Request) {
    // ...
    const info = db.prepare(
      'INSERT INTO projects (nama_proyek, pic_id, divisi, target_total, satuan, status, deadline) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(...);
    return NextResponse.json({ id: Number(info.lastInsertRowid) }, { status: 201 });
  }
  ```
  API endpoint pembuatan proyek hanya melakukan `INSERT` ke tabel `projects`.
- **Dampak Workflow:**
  1. Grup chat tim untuk proyek tidak otomatis terbuat.
  2. Tabel relasi `chat_group_projects` yang sudah ada di database tidak pernah diisi saat proyek dibuat.
  3. Leader harus manual pindah ke tab Chat -> klik "Buat Grup Chat" -> buka modal Info Grup -> buka tab "Konektor Proyek Tim" -> baru manual menghubungkan proyek.
  4. Di `ProjectDetailView` (Detail Hub), pencarian string `chat` menghasilkan **0 temuan** — tidak ada satupun tombol cepat seperti `"💬 Diskusi Tim"` untuk langsung melompat ke ruang diskusi grup proyek terkait.

---

### 2.3 Disconnect Delegasi Tugas ↔ Anggota Tim (Fake Delegation)
- **File Referensi:**
  - `src/app/page.tsx` (L772–L780)
  - `src/components/tabs/InputTab.tsx` (L43–L83)
  - `src/app/api/realisasi/route.ts` (L32–L70)
  - `src/lib/db.ts` (L75–L94)
- **Bukti Kode Aktual:**
  1. Tombol `+ Delegasikan Tugas` di Dashboard Mode Tim (`src/app/page.tsx:778`):
     ```tsx
     <button
       onClick={() => setTab("input")}
       className="..."
       data-purpose="add-task-cta"
     >
       <span>+</span>
       <span>Delegasikan Tugas</span>
     </button>
     ```
     Tombol ini hanya mengeksekusi `setTab("input")`.
  2. Di `InputTab.tsx`, form submission mengunci `user_id`:
     ```tsx
     body: JSON.stringify({
       project_id: projectId ? Number(projectId) : null,
       user_id: user.id, // <--- SELALU MENGUNCI USER YG LOGIN
       nama: user.nama,
       divisi: user.divisi,
       tanggal: tanggal || new Date().toISOString().slice(0, 10),
       aktivitas: aktivitas.trim(),
       target: Number(target),
       realisasi: Number(realisasi),
       satuan: satuan.trim(),
       // ...
     })
     ```
  3. Di skema tabel `realisasi`, tidak ada kolom `assigned_to_user_id` maupun `assigned_by_user_id`.
- **Dampak Operasional:**
  Ketika Leader Fifa ingin membagikan tugas ke Anggota Tim 1, form tidak menyediakan pilihan penerima tugas. Begitu tombol simpan ditekan, tugas tersebut langsung tercatat sebagai tugas milik Fifa sendiri (`user_id = 1`) dengan status `Tercapai` (karena default target = 10, realisasi = 10). Tim 1 tidak pernah melihat tugas tersebut pada akun mereka.

---

### 2.4 Isolasi Modul Kalender & Notes dari Proyek
- **File Referensi:**
  - `src/components/projects/ProjectDetailView.tsx` (L33, L73, L568–L800)
  - `src/app/api/calendar/route.ts` (L1–L40)
  - `src/app/page.tsx` (L827–L870)
- **Bukti Kode Aktual:**
  1. Di `ProjectDetailView.tsx` baris 33, icon `Calendar` diimpor dari `lucide-react`:
     ```tsx
     import { ... Calendar ... } from "lucide-react";
     ```
     Namun grep pada file membuktikan tag `<Calendar` **tidak pernah dirender sekali pun**.
  2. Tab kiri di `ProjectDetailView` hanya memiliki 3 sub-tab:
     ```tsx
     const [activeLeftTab, setActiveLeftTab] = useState<"resources" | "notes" | "realisasi">("resources");
     ```
     Tidak ada sub-tab/widget Kalender Proyek, timeline sprint, maupun pengingat deadline proyek.
  3. Database dan backend API `/api/calendar` sebenarnya **sudah siap** menerima parameter `project_id` dan mengembalikan deadline proyek sebagai milestone (`projectDeadlines`), namun data ini tidak pernah di-fetch atau ditampilkan di Detail Hub Proyek!

---

## 3. FORENSIC AUDIT: 6 CELAH TERSEMBUNYI (HIDDEN DISCONNECTS)

Melalui penelusuran menyeluruh pada seluruh modul, ditemukan 6 kelemahan sistem tersembunyi yang krusial untuk diselesaikan bersamaan:

### 3.1 Karyawan Data Starvation
- **Lokasi:** `src/app/page.tsx` (L83–L93)
- **Akar Masalah:**
  ```tsx
  if (activeUser.role === "admin") {
    const [uRes, mRes] = await Promise.all([
      fetch("/api/users").then((r) => r.json()),
      fetch("/api/monitoring").then((r) => r.json()),
    ]);
    setUsers(uRes.users || []);
    setMonitoring(mRes);
  }
  ```
- **Dampak:** Saat karyawan (`tim1` atau `tim2`) login, state `users` dibiarkan kosong `[]`. Akibatnya, jika ada komponen yang butuh menampilkan nama rekan tim, avatar, atau penugasan anggota, komponen tersebut akan gagal render atau blank.
- **Rekomendasi Fix:** Ambil data `users` untuk semua pengguna yang login. Endpoint `/api/users` sudah aman karena tidak menyertakan password hash.

---

### 3.2 Missing Delegation Notifications
- **Lokasi:** `src/app/api/realisasi/route.ts` (L32–L70)
- **Akar Masalah:** Saat tugas baru dibuat via `POST /api/realisasi`, API sama sekali tidak meng-insert baris ke tabel `notifications`.
- **Dampak:** Ketika Leader mendelegasikan tugas kepada staff, staff tersebut tidak menerima notifikasi, tidak muncul unread badge merah di navbar, dan tidak tahu bahwa ada tugas baru yang ditugaskan kepadanya hingga ia membuka halaman laporan secara manual.

---

### 3.3 Navbar "Pribadi" vs "Tim" Mode Disconnect di Tab Proyek
- **Lokasi:** `src/app/page.tsx` (L491–L520, L825–L840)
- **Akar Masalah:** Toggle "Pribadi" vs "Tim" di navbar hanya mengubah `viewMode` yang memfilter realisasi di Dashboard (`HomeTab`). Prop `viewMode` **tidak dioper sama sekali** ke `ProjectsTab`.
- **Dampak:** Saat user memilih mode "Pribadi" dan membuka tab Proyek, seluruh proyek agensi tetap tampil tanpa filter. User tidak bisa menyaring proyek mana yang menjadi tanggung jawab pribadinya ("Proyek Saya").

---

### 3.4 Celah Keamanan Otorisasi di Task Mutation (`PATCH/DELETE /api/realisasi/[id]`)
- **Lokasi:** `src/app/api/realisasi/[id]/route.ts` (L8–L87)
- **Akar Masalah:** Handler `PATCH` dan `DELETE` tidak memvalidasi role atau kepemilikan `user_id`.
- **Dampak:** Siapa pun dapat mengirim request HTTP PATCH/DELETE untuk mengubah atau menghapus data realisasi tugas anggota lain tanpa verifikasi hak akses (berbeda dengan endpoint chat groups yang menerapkan guard ketat).

---

### 3.5 Disconnect pada Miu AI Autonomous Tool Calling (`create_project` & `plan_tasks`)
- **Lokasi:** `src/app/api/ai/actions/route.ts` (L244–L258, L700–L725)
- **Akar Masalah:**
  1. Saat Asisten AI mengeksekusi action `create_project`, AI hanya meng-insert ke tabel `projects`. AI tidak meng-generate grup chat maupun mengaitkan anggota tim.
  2. Saat AI mengeksekusi `plan_tasks`, AI mengisi `realisasi = 0` dan `status = 'Belum'`, tetapi tidak mencatat siapa yang memerintahkan delegasi tersebut (`assigned_by_user_id`).

---

### 3.6 Broken State Navigation ke Notes & Calendar Tab
- **Lokasi:** `src/app/page.tsx` (L827–L865)
- **Akar Masalah:** Di `ProjectsTab`, callback `onGoNotes(project.id)` mengubah state `selectedProjectId` di `page.tsx` dan memanggil `setTab("notes")`. Namun, saat `NotesTab` dirender:
  ```tsx
  {tab === "notes" && (
    <NotesTab
      user={user}
      projects={projects}
      showToast={showToast}
    />
  )}
  ```
  `NotesTab` **tidak menerima prop `initialProjectId` atau `selectedProjectId`**, melainkan membaca dari `window.location.search` yang tidak pernah diupdate. Akibatnya, filter proyek di Notes Tab kembali reset ke "Semua Proyek". Hal yang sama terjadi pada navigasi ke `CalendarTab`.

---

## 4. TARGET ARSITEKTUR BLUEPRINT (AUTO-CONNECTED ECOSYSTEM)

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                           ALUR PROSES TERHUBUNG OTOMATIS                       │
└────────────────────────────────────────────────────────────────────────────────┘

  [Leader / Admin Buat Proyek Baru]
                │
                ├────────────────────────────────────────────────────────────────┐
                ▼                                                                ▼
   1. Insert ke `projects`                                         2. Insert Multi-Member
   (nama, pic_id, divisi, target, deadline)                       ke `project_members`
                │                                                 (project_id, user_id, role)
                ▼                                                                │
   3. Auto-Provisioning Grup Chat                                                │
      ├─ Insert `chat_groups`: "[Nama Proyek] 🚀"                                │
      ├─ Insert `chat_group_projects`: (group_id, project_id)                    │
      ├─ Auto-join semua member ke `chat_group_members` ◄────────────────────────┘
      └─ Kirim pesan selamat datang pembuka dari Miu AI
                │
                ▼
   4. UI Hub Terintegrasi (`ProjectDetailView`)
      ├─ Shortcut 1-Klik: [💬 Diskusi Tim Proyek] (Langsung loncat ke room chat)
      ├─ Tab Baru: [📅 Milestone & Kalender] (Deadline & event proyek)
      ├─ Widget Anggota Tim (Daftar kolaborator aktif & tambah anggota)
      └─ Form Delegasi Cepat (Pilih penerima tugas + auto notifikasi bell)
```

---

### 4.1 Database Schema Evolution (SQLite)

Pembaruan skema dilakukan dengan prinsip **Additive Migration** (hanya menambahkan tabel dan kolom baru tanpa merusak data lama, dieksekusi secara idempotent via `try/catch` di `src/lib/db.ts`).

#### A. Tabel Baru: `project_members`
```sql
CREATE TABLE IF NOT EXISTS project_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'member', -- 'leader' | 'member'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(project_id, user_id)
);
```

#### B. Kolom Tambahan pada Tabel `realisasi`
```sql
ALTER TABLE realisasi ADD COLUMN assigned_to_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE realisasi ADD COLUMN assigned_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE realisasi ADD COLUMN deadline TEXT DEFAULT '';
```

#### C. Migrasi Data Eksisting (Seeding Idempotent)
1. Setiap proyek yang sudah ada di database otomatis meng-insert PIC eksisting (`pic_id`) ke `project_members` dengan `role = 'leader'`.
2. Masukkan anggota divisi terkait (misal Tim 1 untuk Operasional, Tim 2 untuk Kreatif) ke `project_members`.
3. Untuk data `realisasi` lama, set default `assigned_to_user_id = user_id`.

---

### 4.2 Backend API Contract & Auto-Provisioning Hooks

#### A. Hook Pembuatan Proyek (`POST /api/projects`)
- **Input Payload Tambahan:**
  ```json
  {
    "nama_proyek": "Optimasi Web & Konten Meta Ads",
    "pic_id": 1,
    "member_ids": [1, 2, 3],
    "divisi": "Operasional",
    "target_total": 100,
    "satuan": "Tugas",
    "deadline": "2026-12-31"
  }
  ```
- **Proses Auto-Provisioning:**
  1. Insert proyek ke `projects`.
  2. Insert seluruh `member_ids` (dan `pic_id`) ke `project_members`.
  3. Cek apakah sudah ada grup chat proyek. Jika belum, buat grup baru di `chat_groups`:
     - `name`: `${nama_proyek} 🚀`
     - `description`: `Ruang koordinasi resmi proyek ${nama_proyek}`
     - `project_id`: ID proyek baru
     - `created_by`: `pic_id` (atau user yang membuat)
     - `ai_name`: `'Miu'`
  4. Kaitkan ke tabel multi-konektor `chat_group_projects`:
     `INSERT OR IGNORE INTO chat_group_projects (group_id, project_id) VALUES (?, ?)`
  5. Daftarkan seluruh `member_ids` ke `chat_group_members`:
     - PIC sebagai `role = 'admin'`
     - Anggota lain sebagai `role = 'member'`
  6. Insert pesan sambutan pertama dari Miu AI di `chat_messages`.
- **Response:**
  Mengembalikan ID proyek beserta `chat_group_id` yang terbuat.

#### B. Endpoint Baru: `/api/projects/[id]/members`
- `GET`: Mengambil daftar anggota proyek dengan detail profil user (nama, username, divisi, avatar, role dalam proyek).
- `POST`: Menambahkan anggota baru ke proyek. Otomatis menambahkan user tersebut ke `chat_group_members` di seluruh grup chat yang terhubung ke proyek ini!
- `DELETE`: Menghapus anggota dari proyek.

#### C. Hook Delegasi Tugas (`POST /api/realisasi`)
- **Input Payload:**
  ```json
  {
    "project_id": 1,
    "user_id": 2, // ID Pelaksana (Tim 1)
    "assigned_to_user_id": 2,
    "assigned_by_user_id": 1, // Leader Fifa
    "aktivitas": "Produksi 3 Konten Carousel Feed 3:4",
    "target": 3,
    "realisasi": 0, // Tugas baru dimulai dari 0
    "satuan": "Konten",
    "deadline": "2026-11-28",
    "kendala": "",
    "solusi": ""
  }
  ```
- **Logika Otomatis:**
  - Jika `assigned_to_user_id !== assigned_by_user_id`:
    - Status tugas otomatis = `'Belum'`.
    - Buat notifikasi instan di tabel `notifications`:
      - `user_id`: `assigned_to_user_id`
      - `title`: `'Tugas Baru Didelegasikan'`
      - `message`: `"${leader_nama} menugaskan Anda: ${aktivitas} (Target: ${target} ${satuan})"`
      - `type`: `'task'`
      - `action_url`: `'/?tab=projects&project_id=' + project_id`

---

### 4.3 Frontend Component Architecture & Data Flow

#### A. `ProjectDetailView.tsx` (Perombakan Detail Hub)
1. **Header Action Bar:**
   - Tambahkan tombol utama bernuansa aksen:
     `[💬 Diskusi Tim]` -> onClick: set `sessionStorage.setItem("productivier_chat_project_id", project.id)` dan panggil `onGoChat(project.id)` untuk langsung berpindah ke tab chat dan membuka room proyek secara mulus.
2. **Sub-Tab Navigation Kiri:**
   - Ubah sub-tab menjadi 4 pilihan:
     1. `resources` -> Aset & Cloud Links
     2. `calendar` -> **Milestone & Jadwal Proyek (BARU)**
     3. `notes` -> Catatan & SOP Internal
     4. `realisasi` -> Log Tugas & Delegasi
3. **Tab Kalender Proyek (Widget Baru):**
   - Menampilkan deadline proyek, agenda rapat, dan milestone yang berelasi dengan `project_id`.
   - Tombol `+ Tambah Jadwal Proyek` langsung mengunci `project_id`.
4. **Kolom Kanan / Member Section:**
   - Tambahkan **Widget Anggota Tim Proyek**:
     - Avatar stack seluruh kolaborator.
     - Role label (`Leader PIC` vs `Kolaborator Tim`).
     - Tombol `+ Tambah Anggota` (khusus Leader/PIC).

#### B. `ProjectsTab.tsx` (Filter "Pribadi" vs "Tim" & Multi-Member Select)
1. Menerima prop `viewMode: "pribadi" | "tim"`.
2. Jika `viewMode === "pribadi"`:
   - Saring daftar proyek menjadi hanya proyek di mana pengguna yang sedang login terdaftar sebagai PIC (`p.pic_id === user.id`) atau anggota tim (`p.members.some(m => m.user_id === user.id)`).
3. Modal `Tambah Proyek Baru`:
   - Tambahkan multi-checkbox / token selector untuk memilih anggota tim kolaborator.
4. Kartu Proyek:
   - Tampilkan tumpukan avatar anggota tim (`+2 kolaborator`).
   - Sediakan tombol pintas `Chat Proyek`.

#### C. `InputTab.tsx` (Form Delegasi Sejati)
1. Ubah header dan mode form secara dinamis:
   - Jika diakses dari tombol "+ Delegasikan Tugas": Judul form menjadi **"Delegasikan Tugas Tim"**.
   - Tambahkan dropdown **"Penerima Tugas / Pelaksana"** (`CustomSelect`) berisi daftar anggota tim.
   - Default `realisasi` diisi `0` jika mendelegasikan ke orang lain, dengan status `'Belum'`.
   - Tetap sediakan toggle untuk "Catat Tugas Sendiri" vs "Delegasikan ke Anggota Tim".

#### D. Global State & Navigation Sync (`src/app/page.tsx`)
1. Ambil data `users` untuk seluruh user yang login (hapus pembatasan `if (role === 'admin')`).
2. Sinkronkan prop `initialProjectId` ke `NotesTab` dan `CalendarTab` saat berpindah tab.
3. Hubungkan navigasi `onGoChat(projectId)` dari `ProjectsTab` dan `ProjectDetailView` ke `ChatTab`.

---

## 5. RENCANA EKSEKUSI BERTAHAP (IMPLEMENTATION ROADMAP)

| Tahap | Modul Target | Aksi Spesifik | Estimasi File |
| :--- | :--- | :--- | :--- |
| **Fase 1** | **Database & Migrasi** | Buat tabel `project_members`, tambahkan kolom `assigned_to_user_id`, `assigned_by_user_id`, `deadline` di `realisasi`, seed relasi awal. | `src/lib/db.ts`, `src/types/index.ts` |
| **Fase 2** | **Backend API Hooks** | Perbarui `POST/GET /api/projects` untuk auto-provisioning grup chat, buat `api/projects/[id]/members`, update `POST /api/realisasi` untuk auto-notifikasi. | `src/app/api/projects/route.ts`, `src/app/api/projects/[id]/members/route.ts`, `src/app/api/realisasi/route.ts` |
| **Fase 3** | **Detail Hub Proyek** | Pasang tombol "💬 Diskusi Tim", sub-tab "Milestone & Kalender", widget anggota tim di `ProjectDetailView`. | `src/components/projects/ProjectDetailView.tsx` |
| **Fase 4** | **Delegasi Tugas UI** | Perbarui form `InputTab.tsx` dengan pilihan assignee, sinkronkan tombol "+ Delegasikan Tugas" dari dashboard. | `src/components/tabs/InputTab.tsx`, `src/app/page.tsx` |
| **Fase 5** | **Filter & Kolaborasi** | Terapkan filter "Pribadi" vs "Tim" pada `ProjectsTab`, tampilkan avatar stack anggota, aktifkan fetch `users` untuk karyawan. | `src/components/tabs/ProjectsTab.tsx`, `src/app/page.tsx` |
| **Fase 6** | **AI & Deep Integration** | Sinkronkan action tool Miu AI (`create_project` & `plan_tasks`) agar otomatis menyertakan grup chat dan anggota tim. | `src/app/api/ai/actions/route.ts`, `src/app/api/ai/chat/route.ts` |

---

## 6. MATRIKS PENGUJIAN & ZERO-REGRESSION GUARDRAILS

1. **Uji Regresi Database:**
   - Pastikan database lama (`productivier.db`) tidak mengalami reset data atau kegagalan saat migrasi kolom baru.
2. **Uji Auto-Provisioning:**
   - Buat proyek baru "Kampanye Video TikTok Q1 2027" -> Verifikasi otomatis muncul grup chat "Kampanye Video TikTok Q1 2027 🚀", semua member terpilih auto-join, dan koneksi tercatat di `chat_group_projects`.
3. **Uji Delegasi Tugas:**
   - Login sebagai Fifa -> Buka "+ Delegasikan Tugas" -> Pilih Anggota Tim 1 -> Kirim tugas.
   - Login sebagai Tim 1 -> Verifikasi ada notifikasi lonceng masuk, tugas muncul di dashboard Tim 1 dengan realisasi 0/Target.
4. **Uji 1-Klik Chat & Kalender:**
   - Di Detail Hub proyek, klik "💬 Diskusi Tim" -> Verifikasi tab langsung berpindah ke Chat dan room proyek terbuka seketika tanpa delay scroll.
   - Buka sub-tab "Kalender" di Detail Hub -> Verifikasi jadwal dan deadline proyek tampil dengan akurat.
5. **Uji TypeScript Strict:**
   - Jalankan `./node_modules/.bin/tsc --noEmit` wajib **0 error**.
   - Jalankan `npm run build` wajib **0 error**.
