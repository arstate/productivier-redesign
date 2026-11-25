# 🔍 Laporan Audit QA, UI/UX, Alur Ekosistem & Keamanan — Productivier

**Target:** `http://localhost:3007/`  
**Codebase:** `/mnt/HDD-2/BACKUP LINUX/FILE DATA/WEBSITE/productivier-redesign`  
**Tanggal Audit:** 25 November 2026  
**Metode:** Live Browser QA via Chrome DevTools Protocol (Desktop `1440×900` Light/Dark, Mobile `390×844`, Client Portal `/client/project/1`, Login Screen) + Static Type Check (`npx tsc --noEmit`) + Deep Code & Style Structure Audit.

---

## Ringkasan Eksekutif

Secara fondasi fitur, integrasi lintas-modul sudah mulai terbentuk (`project_members`, auto-provisioning grup chat pada `POST /api/projects`, delegasi tugas di `InputTab`, serta `ProjectDetailView` dengan tab `Aset`, `Kalender`, `Notes`, `Log Tugas`). Hasil `npx tsc --noEmit` juga bersih (0 error) dan tidak ada error runtime di Console/Network selama navigasi utama.

Namun, hasil bedah mendalam menemukan **4 bug kritikal (P0)**, **6 masalah UI/UX & kerapihan layout (P1)**, dan **5 celah workflow/konsistensi data (P2)** yang langsung mengganggu penggunaan harian tim agensi—terutama **Dark Mode yang rusak total (teks putih di atas kartu putih)**, **Floating AI Avatar yang menutupi menu navigasi mobile**, **kebocoran kredensial di layar login**, dan **putusnya sinkronisasi proyek lama ke grup chat**.

---

## 1. Temuan Kritikal (P0 — Wajib Fix Segera)

### 1.1 Dark Mode Rusak Total (Teks Putih di Atas Kartu Putih)
- **Lokasi:** `src/app/globals.css` (baris 16–34) & `src/app/page.tsx` (baris 396)
- **Akar Masalah:**
  1. `.intellecta-card` di `globals.css` mengunci `background: #FFFFFF;` tanpa override `.dark .intellecta-card`.
  2. `html, body` di `globals.css` mengunci `background: radial-gradient(circle at 4% 96%, #D6DCF2 0%, #ECEEF3 45%, #F4F5F8 100%);`.
  3. Wrapper utama di `src/app/page.tsx` menggunakan `bg-radial from-[#D6DCF2] via-[#ECEEF3] to-[#F4F5F8] text-[#18181B]` tanpa varian `dark:`.
- **Dampak Visual (Terverifikasi via CDP & Screenshot Dark Mode):** Saat tombol `Dark Mode` diklik (`html.dark` aktif), teks berubah putih (`lab(96.286 ...)`), tetapi background halaman dan seluruh `.intellecta-card` tetap `#FFFFFF`! Rincian elemen yang **hilang/tidak terbaca** di Dark Mode:
  - **Dashboard:** Judul widget (*Sprint Velocity & Aksi Cepat*, *Status Setor Realisasi Tim*, *Review & Kendala Tim*) dan angka metrik (`0/3 anggota`, `17 tugas`) menjadi putih di atas putih.
  - **Proyek:** Heading `Daftar Proyek Tim`, seluruh judul proyek (*Redesign Landing Page MVP*, *QWQW*, dll.), serta angka persentase (`0%`, `7%`) hilang total di atas kartu putih.
  - **Kalender:** Heading `Kalender & Agenda Kerja`, judul bulan `November 2026`, tanggal terpilih (`Rabu, 25 November 2026`), dan angka tanggal aktif (`25`) di grid kalender menjadi putih di atas putih.
  - **Chat Tim:** Judul room `Squad Operasional & Konten` hilang (hanya emoji `🚀` yang terlihat mengambang), dan bubble balasan AI memiliki efek gradient/sheen putih terang di tengah teks sehingga teks di tengah bubble tidak terbaca.
- **Solusi:**
  - Tambahkan CSS variable semantic (`--surface-card`, `--bg-canvas`) dengan blok `.dark { ... }` di `globals.css`, dan terapkan `background: var(--surface-card)` pada `.intellecta-card`.
  - Tambahkan kelas `dark:from-[#0B0D12] dark:via-[#11141C] dark:to-[#161924] dark:text-slate-100` pada wrapper `page.tsx`.

### 1.2 Mobile Bottom Dock Tertutup Floating Miu AI (`390×844`)
- **Lokasi:** `src/app/page.tsx` (baris 997–1032) & `src/components/ai/FloatingAIAgent.tsx`
- **Akar Masalah:** Pada viewport mobile `390×844`, tombol avatar melayang `FloatingAIAgent` diposisikan di pojok kanan bawah (`bottom-right`) dengan `z-index` lebih tinggi daripada `<nav>` Bottom Dock (`z-40`).
- **Dampak UX (Terverifikasi di Screenshot Mobile):** Avatar kucing Miu AI **menutupi penuh tab ke-8 (`Profil & Tim`) dan separuh tab ke-7 (`Laporan`)**. User mobile tidak bisa menekan menu `Profil & Tim`.
- **Solusi:** Naikkan posisi default floating button Miu AI di mobile (`bottom-24 right-4 md:bottom-6 md:right-6`) agar selalu berada di atas dock navigasi, atau sembunyikan saat keyboard/dock aktif.

### 1.3 Celah Keamanan Autentikasi & Kebocoran Password di Login Screen
- **Lokasi:** `src/app/page.tsx` (baris 116–128, 335, 355–376) & seluruh `/api/*`
- **Temuan:**
  1. **Auto-Login Admin Tanpa Password:** Di `page.tsx` baris 117–128, jika `localStorage` kosong, aplikasi otomatis login sebagai `fifa` (`role: "admin"`). Siapa pun yang membuka URL langsung masuk sebagai Leader/Admin.
  2. **Password Asli Dipajang di Placeholder:** Input password menampilkan `placeholder="cewekalay / tim123"`, dan ada tombol `Akses Cepat (Demo): Fifa (Admin) | Tim 1 (Karyawan)` yang langsung mengirim kredensial hardcoded.
  3. **Tanpa Server-Side Session:** `/api/login` hanya mengembalikan JSON `user` tanpa `HttpOnly` cookie/JWT. Semua route `/api/*` mempercayai `user_id` dan `role` dari query param atau body request (rentan IDOR).
- **Solusi:**
  - Hapus auto-login admin & hapus password asli dari placeholder serta tombol demo sebelum deployment produksi (atau batasi hanya jika `process.env.NODE_ENV === 'development'` dengan flag eksplisit).
  - Terapkan signed `HttpOnly` session cookie di `/api/login` dan verifikasi sesi di setiap route `/api/*`.

### 1.4 `select-none` Mengunci Seluruh Aplikasi
- **Lokasi:** `src/app/page.tsx` (baris 396)
- **Masalah:** Class `select-none` dipasang di container root aplikasi.
- **Dampak UX:** Pengguna tidak bisa memblok atau menyalin teks dari laporan realisasi, deskripsi tugas, catatan meeting, maupun balasan AI di chat.
- **Solusi:** Hapus `select-none` dari root wrapper `page.tsx`; pasang `select-none` hanya pada elemen tombol/ikon/navigasi jika diperlukan.

---

## 2. Audit UI/UX, Kerapihan Desain & Struktur Style (P1)

### 2.1 `ProjectDetailView` — Action Bar Terlalu Padat & Button Wrap
- **Lokasi:** `src/components/projects/ProjectDetailView.tsx` (terverifikasi di screenshot `light_detail_hub.png`)
- **Temuan:**
  1. Tombol `Kembali ke Semua Proyek` membungkus menjadi **2 baris** di dalam pil (`Kembali ke Semua` / `Proyek`).
  2. Baris header teratas menampung 1 tombol kembali + breadcrumb + **6 tombol aksi sekaligus** (`Diskusi Tim`, `Bagikan ke Klien`, `Portal Klien ↗`, `Buka di Menu Notes Penuh ↗`, `Tandai Selesai`, `Hapus`). Akibatnya, tombol `Hapus` terpental turun ke baris kedua sendirian.
  3. Tombol `Buka di Menu Notes Penuh ↗` terasa redundan di header atas karena sudah ada sub-tab `Notes (0)` tepat di bawahnya.
- **Rekomendasi:**
  - Persingkat label tombol kembali menjadi `← Semua Proyek` (`whitespace-nowrap`).
  - Jadikan action bar atas maksimal 3 aksi utama (`Diskusi Tim`, `Bagikan ke Klien`, `Tandai Selesai`) dan pindahkan `Portal Klien`, `Menu Notes Penuh`, dan `Hapus` ke dropdown menu `⋯` (More Actions).

### 2.2 Chat Tim di Mobile Tidak Ergonomis (`390×844`)
- **Lokasi:** `src/components/tabs/ChatTab.tsx` (terverifikasi di screenshot `mobile_light_chat_tim.png`)
- **Temuan:**
  1. Panel daftar grup (`Saluran Grup`) dan area chat ditumpuk vertikal (`flex-col`). Akibatnya, area pesan hanya mendapat ruang sempit di bagian bawah layar dan kolom ketik pesan terdorong keluar layar.
  2. Badge `LIVE TEAM CHANNEL` membungkus menjadi 2 baris di mobile.
- **Rekomendasi:** Terapkan pola **Master-Detail Mobile**: tampilkan daftar grup penuh di layar pertama; saat grup diklik, tampilkan ruang chat penuh dengan tombol `← Daftar Grup` di header chat.

### 2.3 Badge Notifikasi `9+` & Touch Target Kecil
- **Lokasi:** Header `src/app/page.tsx`, `HomeTab.tsx`, `NotesTab.tsx`, `ChatTab.tsx`
- **Temuan (Terverifikasi via CDP Metrics):**
  - Posisi badge oranye `9+` pada ikon lonceng notifikasi agak turun menutupi badan ikon lonceng.
  - Banyak tombol interaktif memiliki tinggi `< 36px` (standar minimal aksesibilitas touch target `>= 44px` pada mobile, atau min `32–36px` pada desktop):
    - `Tim` / `Pribadi` toggle (`h: 24px`)
    - `Dark Mode` / `Light Mode` (`24×24px`)
    - `Colek WA` (`h: 23px`)
    - `Balas` di chat (`h: 19px`)
    - Tag pills di Notes (`h: 24px`)
- **Rekomendasi:** Perbesar padding area klik (`min-h-[36px]` desktop, `min-h-[44px]` mobile) atau gunakan hitbox pseudo-element, serta geser badge `9+` ke `-top-1 -right-1`.

### 2.4 Teks Dropdown & Tombol Terpotong (`...`)
- **Lokasi:** `ProfileTab.tsx` & `client/project/[id]/page.tsx`
- **Temuan:**
  - Di `ProfileTab` -> *Buat Akun Tim*: placeholder/value dropdown terpotong menjadi `Anggota Tim (Karyawa...` dan `Laki-laki (Bro / Men / C...`.
  - Di `Client Portal` (`/client/project/1`): tombol kategori terpotong `Feedback Desain & Kon...`.
  - Di `NotesTab`: deretan filter tag horizontal terpotong di sisi kanan tanpa indikator scroll.
- **Rekomendasi:** Gunakan label yang ringkas dan jelas (mis. `Karyawan`, `Admin / Leader`; `Laki-laki`, `Perempuan`; `Feedback Desain`), serta tambahkan fade/tombol scroll horizontal pada filter tag Notes.

### 2.5 Kebocoran Istilah Teknis & Konten Tidak Profesional
- **Lokasi:** `InputTab.tsx`, `NotificationDropdown.tsx`, & Data Live SQLite (`notes`, `chat_messages`, `projects`)
- **Temuan:**
  - Placeholder di `InputTab`: `"Contoh: Selesaikan redesign bento dashboard"` (istilah internal UI *bento* bocor ke form pengguna).
  - Preview di `NotificationDropdown`: menampilkan sintaks markdown mentah (`**Kamis, 27 Agustus 2026**`) dan footer teknis `Productivier Realtime Notification Engine`.
  - Di `ProfileTab`, opsi gender memakai bahasa slang (`Bro / Men / Cuy`, `Bestie / Sis / Beb`) di form registrasi HR/Admin.
  - Database live mengandung data uji coba tidak pantas/sampah:
    - Proyek duplikat: `Redesign Landing Page MVP` (muncul 2 kali identik) dan `QWQW`.
    - Catatan di `Notes`: judul `"tes"`, isi `"ets"`, checklist `"wawawaw"`, `"cok"`.
    - Pesan di `Chat`: mengandung kata kasar `"jancok"` dari sesi testing AI.

### 2.6 Audit Struktur Style, Token CSS & Interaksi Komponen
- **297 Warna Hex Hardcoded:** Warna merek (`#D2F27C`, `#DCD4FB`, `#1C1D21`, `#18181B`, `#ECEEF3`, `#FFFFFF`) ditulis inline di ratusan baris TSX alih-alih dipusatkan ke CSS custom properties / Tailwind `@theme` tokens di `globals.css`. Hal ini yang menyebabkan Dark Mode gagal serentak saat class `.dark` aktif.
- **10× Dialog Native Browser (`alert` / `confirm`):** Aksi hapus proyek, hapus anggota, hapus catatan, hapus jadwal, dan error submit `InputTab` masih memakai `window.confirm()` / `window.alert()` bawaan browser, sehingga memutus konsistensi visual modal modern aplikasi.
- **Campuran Ikon & Emoji:** Sebagian komponen memakai `lucide-react` yang rapi, sementara tombol aksi/status masih mencampur emoji (`🇨🇳`, `🤖`, `👉`, `👤`, `💬`, `⚠️`, `💡`, `📊`, `🔥`) yang rendering-nya berbeda antar OS.
- **Global Search Terbatas:** Modal `Pencarian Cepat` baru mencakup proyek, realisasi, dan anggota tim—belum mengindeks `Notes`, `Chat Groups`, maupun `Calendar Events`.
- **Komponen Select Tidak Seragam:** Modal `Tambah Kolaborator Proyek` di `ProjectDetailView.tsx` dan pemilih delegasi di `InputTab.tsx` masih memakai HTML `<select>` native browser, bukan komponen `CustomSelect` yang dipakai di seluruh bagian lain aplikasi.
- **Toast Menutupi Header Kanan:** Toast global (`fixed top-6 right-6 z-50`) muncul tepat di atas ikon lonceng notifikasi dan avatar user saat ganti mode (`Mode Tampilan: Pribadi`).
- **`Timeline Jam` Tanpa Empty State:** Di `CalendarTab.tsx` mode `Timeline Jam`, jika hari terpilih tidak punya agenda, seluruh baris jam `07:00–17:00` tampil kosong tanpa pesan panduan atau tombol quick-add di slot jam.

---

## 3. Audit Alur Kerja, API Security & Konektivitas Ekosistem (P2)

### 3.0 `Jadwal Fokus Saya` di Mode Pribadi Masih Hardcoded (Tidak Sync Kalender)
- **Lokasi:** `src/components/dashboard/HomeTab.tsx` (baris 203–292)
- **Temuan (Terverifikasi via Screenshot & Kode):** Meskipun subjudulnya berbunyi *"Alur kerja prioritas hari ini berdasarkan agenda kalender"*, blok Gantt `Jadwal Fokus Saya` (`Project onboarding`, `Design & Layout Focus`, `Coffee break & Walk`, `Efisiensi Jadwal 85%`) ternyata **100% hardcoded di JSX**—tidak mengambil data dari `/api/calendar` (padahal di `CalendarTab` pada tanggal `25 Nov 2026` tertera `Jadwal & Meeting (0)`).

### 3.0b Keamanan API: Tanpa Session Cookie, Tanpa Zod, & Header `x-user-id` Opsional
- **Lokasi:** Seluruh `src/app/api/*` (25 route)
- **Temuan:**
  - **0 Zod Validation:** Tidak satu pun API route menggunakan schema validation (`zod`), sehingga payload kosong/invalid bisa masuk ke SQLite.
  - **Otorisasi Rapuh (`x-user-id`):** Hanya 3 route (`notes/[id]`, `realisasi/[id]`, `users/[id]`) yang membaca header `x-user-id`, dan di `realisasi/[id]` pengecekan tersebut bersifat opsional (*"Optional requester authorization check"*). Tanpa signed `HttpOnly` cookie/JWT, siapa pun dapat memalsukan `x-user-id` atau mengabaikannya untuk memodifikasi/menghapus data user lain.

### 3.1 Proyek Lama Belum Terhubung ke Grup Chat (`ChatTab.tsx`)
- **Kondisi Saat Ini:** `POST /api/projects` sudah otomatis membuat grup chat untuk proyek *baru*, tetapi dari 5 proyek yang ada di sistem, hanya 1 proyek (`Operasional & Konten Harian`) yang punya grup chat. 4 proyek lainnya (`Redesign Landing Page MVP` x2, `QWQW`, `Redesign UI Intellecta Clean Slate`) tidak punya grup chat.
- **Bug Alur (Terverifikasi di `ChatTab.tsx` baris 120–141):**
  1. Saat user klik tombol `Chat` pada proyek yang belum punya grup chat, `ChatTab` tidak menemukan grup yang cocok dan **diam-diam membuka grup pertama yang ada (`Squad Operasional & Konten 🚀`)**, sehingga user mengira itu ruang chat proyek tersebut padahal bukan!
  2. `sessionStorage.getItem("productivier_chat_project_id")` dan `productivier_chat_group_id` **tidak pernah di-`removeItem()`** setelah dibaca di `loadGroups()`. Akibatnya, jika user berpindah ke grup lain lalu terjadi `productivier:refresh_data`, UI akan menarik user kembali ke grup lama yang tersimpan di `sessionStorage`.
- **Solusi:**
  - Hapus `sessionStorage` key segera setelah dibaca di `ChatTab.tsx`.
  - Jika proyek belum memiliki grup chat saat tombol `Chat` / `Diskusi Tim` diklik, sediakan auto-create group on-demand (atau modal konfirmasi 1-klik buat grup proyek) daripada salah masuk ke grup proyek lain.

### 3.2 Data Laporan Realisasi Kosong / Default (`Tim / Umum / -`)
- **Lokasi:** `src/app/api/realisasi/route.ts` (baris 59–85) & `ReportsTab.tsx`
- **Temuan (Terverifikasi di Screenshot `light_laporan.png`):** Terdapat 5 baris teratas di tabel laporan dengan `NAMA: Tim`, `DIVISI: Umum`, `PROYEK: Umum`, `AKTIVITAS: -`, `Target: 1 Tugas`. Ini terjadi karena `POST /api/realisasi` tidak memvalidasi `aktivitas` wajib diisi (fallback ke `'-'`) dan tidak memvalidasi tanggal vs deadline (`2026-11-29` tercatat padahal `Deadline: 2026-11-28`).
- **Solusi:** Tambahkan validasi ketat di `POST /api/realisasi`: tolak jika `aktivitas` kosong, dan lookup `nama` & `divisi` dari `targetUserId` secara konsisten (bukan fallback `'Tim'` / `'Umum'`).

### 3.3 Ketidakkonsistenan Label Role di `ProfileTab`
- **Lokasi:** `light_profil__tim.png`
- **Temuan:** `Anggota Tim 2` tampil dengan `Role: Lead Developer`, padahal skema role sistem adalah `admin` / `karyawan`. Perlu diseragamkan antara `role` (hak akses) dan `jabatan` (title).

### 3.4 Integrasi `PersonalTodo` vs `Realisasi`
- **Lokasi:** `HomeTab.tsx` (`/api/todos` vs `/api/realisasi`)
- **Temuan:** To-do pribadi (`personal_todos`) di mode *Pribadi* berdiri sendiri dan tidak bisa dipromosikan (1-klik convert) menjadi laporan realisasi proyek atau event kalender, sehingga terjadi duplikasi pencatatan kerja.

### 3.5 Keamanan Akses `Client Portal`
- **Lokasi:** `src/app/client/project/[id]/page.tsx`
- **Temuan:** URL menggunakan ID integer berurutan (`/client/project/1`, `/2`, `/3`...) tanpa token unik (`share_token`). Siapa pun bisa menebak ID proyek klien lain hanya dengan mengganti angka di URL.
- **Solusi:** Tambahkan kolom `share_token` (UUID/random hex) di tabel `projects` dan gunakan `/client/project/[token]` untuk portal publik.

---

## 4. Rencana Tindak Lanjut Prioritas

| Prioritas | Item Perbaikan | Estimasi Dampak |
|---|---|---|
| **P0** | Perbaiki `.dark` CSS variables di `globals.css` & `page.tsx` | Menyelamatkan seluruh tampilan Dark Mode agar terbaca |
| **P0** | Geser posisi `FloatingAIAgent` di mobile (`bottom-24`) | Membuka kembali akses tab `Laporan` & `Profil & Tim` di HP |
| **P0** | Hapus `select-none` di root `page.tsx` & amankan Login/API Session | Memungkinkan copy-paste teks & menutup celah auto-login admin |
| **P1** | Rapikan action bar `ProjectDetailView` (grouping ke menu `⋯`) | Menghilangkan button wrap 2 baris & tombol `Hapus` yang jatuh |
| **P1** | Ubah `ChatTab` mobile menjadi Master-Detail view + clear `sessionStorage` | Chat tim nyaman dipakai di HP & tidak salah room |
| **P2** | Validasi `POST /api/realisasi`, bersihkan dummy data DB, tambah `share_token` klien | Data laporan akurat & portal klien aman |
