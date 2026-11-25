# Laporan Bedah Mendalam QA, UI/UX, Struktur Style, Ekosistem & Keamanan — Productivier

**URL Target:** `http://localhost:3007/`  
**Direktori Project:** `/mnt/HDD-2/BACKUP LINUX/FILE DATA/WEBSITE/productivier-redesign`  
**Tanggal Audit:** 25 November 2026  
**Cakupan Pengujian Live (CDP Port `9223` + Static & API Audit):**
- **Multi-Viewport Visual & DOM QA:** Desktop (`1440×900`, `1280×800`), Tablet (`768×1024`), Mobile (`390×844`, `360×800`).
- **Role & State Matrix:** Mode `Tim` vs `Pribadi`, `Light Mode` vs `Dark Mode`, Akun `Admin (fifa)` vs `Karyawan (tim1)`, Portal Klien (`/client/project/1`), & Layar Login.
- **Interactive Surface & Modals:** Seluruh 8 Tab Utama, `ProjectDetailView` (4 sub-tab + modal anggota), `CalendarTab` (`Bulan` & `Timeline Jam`), `ChatTab` (`GroupInfoModal` + bubble AI), `FloatingAIAgent` drawer (desktop & mobile), `NotificationDropdown`, `QuickSearch`, Modal `Tambah Proyek`, `Buat Catatan`, dan `Edit Realisasi`.
- **Hasil Type Check & Console:** `npx tsc --noEmit` keluar dengan kode `0` (0 error tipe), 0 error JS Console, dan 0 error HTTP 4xx/5xx pada navigasi normal.

---

## Ringkasan Skor Kesehatan Aplikasi

| Dimensi Audit | Status | Skor | Catatan Utama |
|---|---|---|---|
| **Fungsionalitas Dasar & Build** | Baik | 80/100 | TypeScript bersih (`0` error), API cepat, auto-connect proyek baru → grup chat berjalan |
| **Konektivitas & Akurasi Data** | Lemah | 48/100 | Banyak metrik fallback/hardcoded palsu (`HomeTab`, `PersonalFocusChart`), 4 proyek lama belum punya grup |
| **UI/UX Desktop & Kerapihan** | Cukup | 65/100 | Header detail proyek kepenuhan, masih ada 8 `<select>` native & 10 popup `alert`/`confirm` |
| **UI/UX Mobile (`360–390px`)** | Buruk | 35/100 | Floating AI nutupin tab `Profil & Tim` & `Laporan`; `ChatTab` numpuk vertikal |
| **Dark Mode & Struktur Style** | Kritis | 20/100 | `.intellecta-card` & `body` tetap putih saat teks putih; 297 warna hex hardcoded |
| **Keamanan & Otorisasi** | Kritis | 15/100 | Auto-login admin, password bocor di placeholder, 0 session cookie, 0 Zod validation |

---

## Bagian 1 — Temuan Kritikal (P0 — Harus Diselesaikan Pertama)

### 1.1 Dark Mode Rusak Total (Teks Putih di Atas Kartu Putih)
- **Bukti File:** [globals.css](file:///mnt/HDD-2/BACKUP%20LINUX/FILE%20DATA/WEBSITE/productivier-redesign/src/app/globals.css#L16-L34), [page.tsx](file:///mnt/HDD-2/BACKUP%20LINUX/FILE%20DATA/WEBSITE/productivier-redesign/src/app/page.tsx#L396), [ChatTab.tsx](file:///mnt/HDD-2/BACKUP%20LINUX/FILE%20DATA/WEBSITE/productivier-redesign/src/components/tabs/ChatTab.tsx#L815)
- **Akar Masalah:**
  1. `.intellecta-card` mengunci `background: #FFFFFF;` tanpa `.dark .intellecta-card`.
  2. `html, body` mengunci gradient terang `#D6DCF2 → #ECEEF3 → #F4F5F8`, dan wrapper root `page.tsx` memakai `bg-radial from-[#D6DCF2] via-[#ECEEF3] to-[#F4F5F8]` tanpa varian `dark:`.
  3. Di `ChatTab.tsx` baris 815, bubble AI memakai `from-[#DCD4FB]/40 via-purple-50/50 to-white/90 dark:from-purple-950/40 dark:to-slate-800` **tanpa `dark:via-*`**. Tailwind mempertahankan warna tengah `purple-50/50` (putih terang) memotong tengah bubble gelap!
- **Dampak Terverifikasi:**
  - **Dashboard Dark Mode:** Judul widget & angka metrik (`0/3 anggota`, `17 tugas`) menghilang (putih di atas putih).
  - **Proyek Dark Mode:** Judul seluruh proyek dan persentase (`0%`, `7%`) hilang total di atas kartu putih.
  - **Kalender Dark Mode:** Judul bulan `November 2026`, `Rabu, 25 November 2026`, serta angka `25` pada kotak tanggal terpilih menjadi putih di atas putih.
  - **Chat Tim Dark Mode:** Nama grup hilang (hanya emoji `🚀` terlihat) dan balasan Miu AI terpotong pita putih terang di tengah teks.

### 1.2 Floating Miu AI Menutupi Bottom Navigation Mobile (`390×844` & `360×800`)
- **Bukti File:** [FloatingAIAgent.tsx](file:///mnt/HDD-2/BACKUP%20LINUX/FILE%20DATA/WEBSITE/productivier-redesign/src/components/ai/FloatingAIAgent.tsx#L443-L487) vs [page.tsx](file:///mnt/HDD-2/BACKUP%20LINUX/FILE%20DATA/WEBSITE/productivier-redesign/src/app/page.tsx#L997)
- **Masalah:** Tombol orb AI diposisikan `bottom-6 right-6 z-50`, sementara dock navigasi bawah mobile di `fixed bottom-4 inset-x-3 z-40`.
- **Dampak UX:** Di layar HP, ikon kucing AI menutupi penuh tombol tab ke-8 (`Profil & Tim`) dan setengah tombol `Laporan`. Saat drawer AI dibuka (`bottom-6 right-6 w-[410px] max-w-[calc(100vw-24px)]`), drawer menempel ke sisi kiri `0px` dan tidak simetris.

### 1.3 Keamanan Autentikasi, Kebocoran Password & API Tanpa Sesi
- **Bukti File:** [page.tsx](file:///mnt/HDD-2/BACKUP%20LINUX/FILE%20DATA/WEBSITE/productivier-redesign/src/app/page.tsx#L116-L128), [page.tsx](file:///mnt/HDD-2/BACKUP%20LINUX/FILE%20DATA/WEBSITE/productivier-redesign/src/app/page.tsx#L335-L375), seluruh `src/app/api/*`
- **Temuan:**
  1. **Auto-Login Admin:** Jika `localStorage` kosong, pengguna baru langsung diloginkan sebagai `fifa` (`role: "admin"`) tanpa autentikasi.
  2. **Password Asli di Layar Login:** Placeholder password menulis `"cewekalay / tim123"` secara gamblang, disertai 2 tombol `Akses Cepat (Demo)` untuk 1-klik login Admin/Karyawan.
  3. **Otorisasi API Rapuh:** Scan di seluruh 25 route `/api/*` menunjukkan **0 `HttpOnly` session cookie/JWT** dan **0 validasi Zod**. Hanya 3 route (`notes/[id]`, `realisasi/[id]`, `users/[id]`) yang membaca header `x-user-id`, dan pada `realisasi/[id]` baris 19 ditulis opsional—header mudah dipalsukan (`curl` spoofing) atau dilewati.
  4. **Client Portal Enumerable:** `/client/project/[id]` memakai ID integer berurutan (`1`, `2`, `3`...) tanpa `share_token` acak.

### 1.4 Metrik Palsu / Hardcoded pada Dashboard (`HomeTab` & `PersonalFocusChart`)
- **Bukti File:** [HomeTab.tsx](file:///mnt/HDD-2/BACKUP%20LINUX/FILE%20DATA/WEBSITE/productivier-redesign/src/components/dashboard/HomeTab.tsx#L163-L180), [HomeTab.tsx](file:///mnt/HDD-2/BACKUP%20LINUX/FILE%20DATA/WEBSITE/productivier-redesign/src/components/dashboard/HomeTab.tsx#L203-L292), [PersonalFocusChart.tsx](file:///mnt/HDD-2/BACKUP%20LINUX/FILE%20DATA/WEBSITE/productivier-redesign/src/components/dashboard/PersonalFocusChart.tsx#L48-L54)
- **Temuan Kritis:**
  1. **`Kecepatan Sprint Divisi` Palsu (`67% / 85% / 100%`):** `HomeTab.tsx` memfilter secara kaku `r.divisi === "Operasional"`, `"Kreatif"`, `"Management"`, padahal divisi asli di DB adalah `"Operasional & Konten"`, `"Technology"`, dan `"Umum"`. Jika kosong, `calcAvg` memakai angka fallback hardcoded (`67`, `85`, `100`)! Akibatnya saat login sebagai **Karyawan (`tim1`)** (yang hanya menerima 1 tugas pribadinya dari `/api/realisasi`), dashboard tetap menampilkan **`84% Efisiensi Tim`** dan `Divisi Kreatif 85%` padahal datanya fiktif!
  2. **`Jadwal Fokus Saya` Hardcoded 100%:** Di mode `Pribadi`, blok Gantt `Project onboarding`, `Design & Layout Focus`, `Coffee break & Walk` (`Efisiensi Jadwal 85%`) ditulis statis di JSX, sama sekali tidak membaca `/api/calendar`.
  3. **`Summary Energi Diri` Campur Data Tim & Dummy:** `PersonalFocusChart` mengarang skor `65%–75%` jika tanggal tersebut kosong, serta memakai `tren7Hari` agregat tim untuk grafik mode `Pribadi`.

### 1.5 `select-none` Mengunci Seluruh Aplikasi
- **Bukti File:** [page.tsx](file:///mnt/HDD-2/BACKUP%20LINUX/FILE%20DATA/WEBSITE/productivier-redesign/src/app/page.tsx#L396)
- **Masalah:** Class `select-none` ditempatkan di root container aplikasi sehingga user tidak dapat memblok atau menyalin teks deskripsi tugas, laporan realisasi, catatan, maupun respons AI.

---

## Bagian 2 — Audit UI/UX, Kerapihan Layout & Struktur Style (P1)

### 2.1 Struktur CSS Tokens, Tipografi & Konsistensi Komponen
1. **297 Warna Hex Hardcoded:** Kode warna `#D2F27C`, `#DCD4FB`, `#1C1D21`, `#18181B`, `#ECEEF3`, `#FFFFFF` tersebar langsung di file komponen, bukan di `@theme` / CSS variables di `globals.css`.
2. **8× Native `<select>` vs `CustomSelect`:** `GroupInfoModal.tsx` (2), `ProjectDetailView.tsx` (4), `QuickLaunchpadCard.tsx` (1), dan `InputTab.tsx` (1) masih menggunakan `<select>` bawaan OS yang kontras tampilannya dengan `CustomSelect` beranimasi.
3. **10× Dialog Browser Native (`alert`/`confirm`):** Aksi hapus proyek, anggota, tautan, catatan, jadwal, user, serta error submit `InputTab` masih memakai `window.confirm()` / `window.alert()`.
4. **206× Micro-Text `< 11px`:** Terlalu banyak teks `text-[9px]` / `text-[10px]`, terutama label dock mobile `text-[9px]`, yang mengurangi keterbacaan pada layar DPI tinggi/mobile.
5. **Campuran Ikon Lucide & Emoji Sistem:** Tombol dan badge mencampur ikon SVG `lucide-react` dengan emoji (`🇨🇳`, `🤖`, `👉`, `👤`, `💬`, `⚠️`, `💡`, `📊`, `🔥`).
6. **Sisa Branding Lama (`Intellecta`) & Meta-Jargon:**
   - CSS class `.intellecta-card`
   - Placeholder `InputTab`: `"Contoh: Selesaikan redesign bento dashboard"` (bocor kata *bento*)
   - Selector `QuickLaunchpadCard.tsx:71`: `[aria-label="Buka Intellecta AI Agent"]`
   - Footer dropdown notifikasi: `"Productivier Realtime Notification Engine"`

### 2.2 Ketidakrapihan Layout per Halaman (Terverifikasi Screenshot)
- **`ProjectDetailView.tsx` (Header Kepenuhan):**
  - Tombol `Kembali ke Semua Proyek` membungkus 2 baris.
  - 6 tombol aksi ditaruh sejajar di 1 baris (`Diskusi Tim`, `Bagikan ke Klien`, `Portal Klien ↗`, `Buka di Menu Notes Penuh ↗`, `Tandai Selesai`, `Hapus`), sehingga tombol **`Hapus` terpental turun ke baris kedua sendirian**.
- **`ChatTab.tsx` (Mobile `390×844`):**
  - Daftar grup (`Saluran Grup`) dan ruang obrolan ditumpuk vertikal (`flex-col`), mendorong area pesan & input composer ke luar layar.
  - Badge `LIVE TEAM CHANNEL` membungkus menjadi 2 baris.
  - Akses ke `GroupInfoModal` kurang intuitif (harus klik judul grup/badge anggota tanpa tombol `Info ⓘ` eksplisit), dan modal di desktop memotong bagian bawah `Pengaturan Asisten AI Grup`.
- **`Header`, `Toast`, `NotificationDropdown` & `Search`:**
  - Toast global (`fixed top-6 right-6 z-50`) menutupi ikon lonceng & avatar saat muncul.
  - Badge notifikasi `9+` sedikit turun/berimpitan di atas ikon lonceng; preview notifikasi membocorkan sintaks markdown mentah (`**Kamis, 27 Agustus 2026**`).
  - `Modal Tambah Proyek`, `Catatan`, `Realisasi` memakai `z-50` yang sama dengan `FloatingAIAgent` dan `Toast` (risiko tumpang-tindih layer).
- **Teks Terpotong (`...`) & Empty State:**
  - `ProfileTab` (form buat akun): `Anggota Tim (Karyawa...` dan `Laki-laki (Bro / Men / C...`, plus bahasa slang di form HR.
  - `NotesTab` (modal): `Tanpa Proyek Khusus (...`, dan filter tag horizontal terpotong di kanan tanpa indikator scroll.
  - `Client Portal` (`/client/project/1`): tombol kategori terpotong `Feedback Desain & Kon...`.
  - `CalendarTab` (`Timeline Jam`): tidak memiliki pesan empty state atau aksi cepat `+` pada slot jam `07:00–17:00` yang kosong.
- **Perbedaan Konten Role `Karyawan` (`tim1`):**
  - Header menyapa `"Good morning, Anggota!"` karena `.split(" ")[0]` pada `"Anggota Tim 1"`.
  - Karyawan masih melihat tombol `+ Delegasikan Tugas` dan tombol `Colek WA` ke atasan (`Fifa (Leader)`).
  - Halaman `Profil & Tim` menyisakan 60% area bawah kosong saat panel manajemen akun disembunyikan untuk non-admin.
  - Touch target sejumlah tombol (`Tim/Pribadi` `24px`, `Dark/Light` `24px`, `Colek WA` `23px`, `Balas` chat `19px`, tag Notes `24px`) berada di bawah standar `36–44px`.

---

## Bagian 3 — Audit Alur Ekosistem, Konsistensi Role & Kebersihan Data (P2)

1. **Putus Alur Proyek Lama ↔ Grup Chat (`ChatTab.tsx`):**
   - `POST /api/projects` sudah otomatis membuat grup chat untuk proyek baru, namun 4 proyek lama (`Redesign Landing Page MVP` x2, `QWQW`, `Redesign UI Intellecta Clean Slate`) belum punya grup chat.
   - Saat tombol `Chat` diklik pada proyek tersebut, `ChatTab` tidak menemukan grup yang cocok lalu **diam-diam membuka grup milik proyek lain (`Squad Operasional & Konten 🚀`)**.
   - `sessionStorage` (`productivier_chat_project_id` / `productivier_chat_group_id`) tidak dibersihkan setelah dibaca, menyebabkan perpindahan grup bisa tertarik balik saat data di-refresh.
2. **Ketidaksinkronan `QuickLaunchpadCard` dengan Filter Proyek Dashboard:**
   - Tombol `Salin Portal Klien` selalu menyalin `projects[0]?.id || 1`, mengabaikan proyek yang sedang dipilih user di dropdown filter atas.
3. **Bug Query `monitoring/route.ts`:**
   - Query `WHERE role != 'admin' OR username = 'fifa'` meng-hardcode username `'fifa'`. Jika ada Leader/Admin baru ditambahkan, anggota tersebut tidak masuk pantauan kepatuhan input tim.
4. **Isolasi `PersonalTodo` vs Modul Lain:**
   - Item `personal_todos` di mode `Pribadi` tidak dapat dikonversi menjadi entri realisasi proyek ataupun jadwal kalender.
5. **Kotornya Data Database & Lemahnya Validasi `POST /api/realisasi`:**
   - Tabel laporan menampilkan 5 baris teratas berisi `NAMA: Tim`, `DIVISI: Umum`, `PROYEK: Umum`, `AKTIVITAS: -`, serta tanggal laporan (`2026-11-29`) yang melewati `deadline` (`2026-11-28`) karena `POST /api/realisasi` tidak menolak aktivitas kosong.
   - Terdapat proyek ganda (`Redesign Landing Page MVP` 2×) serta data uji coba tidak pantas (`QWQW`, catatan `"tes"` / `"wawawaw"` / `"cok"`, pesan `"jancok"`), dan inkonsistensi label role (`Anggota Tim 2` tampil `Role: Lead Developer` sementara status sebenarnya `karyawan`).

---

## Bagian 4 — Matriks Rencana Perbaikan Terstruktur

| Fase | Target Utama | File Terkait | Kriteria Selesai (Done) |
|---|---|---|---|
| **Fase 1 (P0): Stabilitas, Dark Mode & Keamanan** | 1. Tambah CSS variables & `.dark .intellecta-card` + fix `ChatTab` line 815 (`dark:via-purple-950/60`)<br>2. Ubah `FloatingAIAgent` mobile ke `bottom-24 right-4` + center drawer di `<640px`<br>3. Hapus `select-none` root, hapus auto-login admin & password placeholder, tambah `HttpOnly` session + cek role di `/api/*`<br>4. Ganti fallback angka palsu `HomeTab` & `PersonalFocusChart` dengan agregasi DB asli & sync `/api/calendar` | `globals.css`, `page.tsx`, `ChatTab.tsx`, `FloatingAIAgent.tsx`, `HomeTab.tsx`, `PersonalFocusChart.tsx`, `api/*` | Dark Mode terbaca 100% di semua tab, bottom dock mobile bebas klik, 0 data metrik fiktif, 0 kebocoran password |
| **Fase 2 (P1): Kerapihan UI/UX & Standarisasi Style** | 1. Sederhanakan header `ProjectDetailView` (kembali `← Semua Proyek`, kelompokkan aksi ke dropdown `⋯`)<br>2. Ubah `ChatTab` mobile ke pola Master-Detail + tombol `Info Grup ⓘ`<br>3. Ganti 8 `<select>` native menjadi `CustomSelect` & 10 `alert/confirm` menjadi komponen Toast/ConfirmModal<br>4. Perbaiki posisi Toast (pindah ke `bottom-6 left-1/2` atau di bawah header), badge `9+`, teks terpotong, & meta-jargon (`bento`, `Intellecta`) | `ProjectDetailView.tsx`, `ChatTab.tsx`, `GroupInfoModal.tsx`, `InputTab.tsx`, `ProfileTab.tsx`, `NotesTab.tsx`, `CalendarTab.tsx`, `ReportsTab.tsx` | 0 button wrap 2 baris, 0 popup native, 0 teks terpotong `...`, mobile chat ergonomis |
| **Fase 3 (P2): Integrasi Ekosistem & Kebersihan Data** | 1. Backfill / auto-create grup chat on-demand saat klik `Chat` + clear `sessionStorage`<br>2. Hubungkan `QuickLaunchpadCard` dengan `selectedProjectId` & `monitoring/route.ts` untuk semua role/admin<br>3. Tambah validasi Zod di `/api/realisasi` & endpoint mutasi, tambah `share_token` Client Portal, bersihkan data test DB | `ProjectsTab.tsx`, `ChatTab.tsx`, `QuickLaunchpadCard.tsx`, `api/realisasi/route.ts`, `api/monitoring/route.ts`, `db.ts`, `client/project/[id]/page.tsx` | Semua proyek punya grup chat terhubung, 0 baris `-` di laporan, Portal Klien terproteksi token |
