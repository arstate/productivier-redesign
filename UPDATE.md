# 🚀 PRODUCTIVIER REDESIGN — RELEASE NOTES & SYSTEM UPDATES
*Tanggal Rilis: 24 November 2026*  
*Versi Aplikasi: v2.4.0 Production Build (Next.js 16.4.6 Turbopack)*

---

## 🌟 Ringkasan Pembaruan Utama (Highlights)

Pembaruan komprehensif ini menghadirkan perombakan total pada arsitektur AI Agent (**Miu**), penyatuan identitas visual maskot SVG, sistem *Multi-Project Connector* pada obrolan tim, *Interactive Slash Autocomplete* `/project`, instant zero-animation chat scroll, serta penguatan keamanan database (*password hashing* & *access control*).

---

## 🤖 1. Transformasi AI Agent Universal: "Miu" & Autonomous Full Control
- **Identitas Baru:** Seluruh penyebutan nama AI diubah secara universal menjadi **"Miu"** (atau **"Miu AI"** di header/badge).
- **Database Migration:** Data seeded dan nama asisten pada tabel SQLite `chat_groups` dan `chat_messages` dimigrasikan otomatis menjadi `'Miu'`.
- **Zero-Tolerance Anti-Refusal Policy:**
  - AI dilarang keras menolak perintah operasional dengan dalih "tidak ada fitur", "cuma bisa manual", atau "bukan wewenang".
  - Dilengkapi **Server-Side Anti-Refusal Interceptor** di endpoint `/api/ai/chat` dan `/api/chat/messages`: Jika model upstream mencoba memuntahkan kalimat penolakan, server otomatis mencegatnya, mengeksekusi aksi otonom yang diminta (colek tim, tag/mention di grup, tambah anggota, buat rencana sprint), dan menulis ulang respon menjadi konfirmasi sukses.
- **Dynamic Thinking Mode Adaptation:**
  - Pilihan mode berpikir menyesuaikan kapabilitas asli model di OpenRouter secara dinamis:
    - **Baidu ERNIE 5.5 Flash:** Mendukung `reasoning_effort` (`Low`, `Medium`, `High Thinking`).
    - **NVIDIA Nemotron 3.5 Super VL:** Mendukung native reasoning (`Native Reasoning` atau `Direct / Tanpa Penalaran`).
    - **Model Non-Reasoning:** Selector otomatis dinonaktifkan dengan badge *Tidak Didukung*.

---

## 🎨 2. Standarisasi Maskot Vector SVG 1:1 (Anti-Meleyot)
- **Aset Vektor Resmi:** Menggunakan aset vector SVG beresolusi tinggi di `/public/mascot-ai.svg`.
- **Komponen `<AIMascot />`:** Dibuat komponen terpusat di `src/components/ui/AIMascot.tsx` dengan jaminan aspect-ratio 1:1 terkunci (`aspectRatio: "1 / 1"`, `objectFit: "contain"`, `shrink-0`, `drop-shadow-xs`), mencegah distorsi, squishing, atau 'meleyot' di seluruh ukuran layar.
- **Penerapan Universal:**
  - Pesan obrolan AI di feed grup & floating workspace.
  - Indikator AI sedang mengetik (*typing indicator*).
  - Floating orb trigger bubble & header modal AI.
  - Kartu profil Asisten AI di modal info grup & panel Quick Launchpad.

---

## ⚡ 3. Instant Pre-Paint Scroll to Bottom (Tanpa Animasi Lag)
- **Penyelesaian Lag Scroll:** Menghapus delay animasi gulir halus (*smooth scroll lag*) saat membuka grup chat atau jendela obrolan AI.
- **Sinkronisasi Pre-Paint:** Menggunakan `useLayoutEffect` bersamaan dengan `scrollBehavior = "auto"` dan penetapan langsung `chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight`.
- **Hasil:** Pesan obrolan langsung terpaku seketika di posisi paling bawah sebelum frame rendering pertama browser selesai, baik di `ChatTab.tsx` maupun `FloatingAIAgent.tsx`.

---

## 🔗 4. Multi-Project Connector di Grup Chat
- **Relasi Multi-Proyek:** Dibuat tabel relasi baru `chat_group_projects (group_id, project_id)` di SQLite. Satu grup obrolan sekarang dapat mengikat **lebih dari 1 proyek sekaligus**.
- **RESTful Endpoints:** Disediakan endpoint lengkap di `/api/chat/groups/[id]/projects` (`GET`, `POST`, `DELETE`).
- **Antarmuka Manajemen Proyek:** Pada `GroupInfoModal.tsx`, tersedia modul "Konektor Proyek Tim" yang menampilkan seluruh proyek terhubung, bar progres persentase, target vs realisasi, status kendala aktif, serta opsi tambah dan hapus koneksi proyek.
- **Konteks Proyek Menyeluruh Miu AI:** Saat Miu AI merespons di obrolan tim, AI membaca metrik seluruh proyek yang terkoneksi untuk memberikan rekomendasi operasional yang akurat.

---

## ⌨️ 5. Interactive Dropup Autocomplete Slash Tag `/project` & `/pro`
- **Pemicu Cepat:** Cukup mengetik `/pro` atau `/project` di input composer obrolan.
- **Menu Melayang Interaktif:** Dropup otomatis muncul di atas kotak chat menampilkan daftar proyek (proyek yang terhubung ke grup diprioritaskan di posisi atas) lengkap dengan nama proyek, divisi, dan persentase capaian.
- **Navigasi Keyboard Penuh:**
  - `ArrowDown` & `ArrowUp` untuk memilih item.
  - Mengetik huruf tambahan (misal: `/pro landing`) memfilter proyek secara instan.
  - Menekan `Enter` atau `Tab` langsung meng-insert teks berformat rapi `/project "[Nama Proyek]"` ke input chat.
  - Menekan `Escape` atau mengklik di luar area composer otomatis menutup menu dropup.
- **Ulasan Otomatis Miu:** Ketika pesan terkirim dengan tag `/project "[Nama Proyek]"`, Miu AI mengekstrak data forensik proyek tersebut dan mengulas progres serta kendalanya.

---

## 📊 6. Integrasi Terhubung Kartu "Review & Kendala Tim" Dashboard
- **Konektivitas Alur Kerja:** Kartu "Review & Kendala Tim" di Dashboard Mode Tim (`HomeTab.tsx`) tidak lagi bersifat pasif.
- **Tombol Aksi Langsung:**
  - **"Bahas di Chat":** Langsung membuka grup chat proyek dan mengisi draft pesan `/project "[Nama Proyek]"` untuk didiskusikan bersama tim.
  - **"Tanya Miu AI":** Membuka Floating AI Agent dengan pertanyaan solusi terarah mengenai kendala yang bersangkutan.

---

## 🔒 7. Hardening Keamanan, Autentikasi & Integrasi UI
- **Password Hashing Modern:** Mengganti plaintext password dengan algoritma native `node:crypto` `scryptSync` (salt 16-byte, keylen 64-byte) di `src/lib/db.ts` dan `src/app/api/login/route.ts`, dilengkapi auto-upgrade transparan saat pengguna login pertama kali.
- **Access Control Guard:** Menambahkan verifikasi otorisasi di `/api/users/[id]` dan `/api/notes/[id]` untuk mencegah modifikasi atau penghapusan tanpa hak akses.
- **Isolasi Kredensial:** Memindahkan `OPENROUTER_API_KEY` ke `.env.local`.
- **Fitur UI Lengkap:**
  - Modal **Edit Jadwal** di `CalendarTab.tsx` terhubung ke `PUT /api/calendar/[id]`.
  - Modal **Edit & Hapus Realisasi** di `ReportsTab.tsx` terhubung ke `PATCH/DELETE /api/realisasi/[id]`.
  - Input **Nomor WhatsApp & Gender** di `ProfileTab.tsx` terhubung ke `PUT /api/users/[id]`.
  - **Background Silent Polling (4 Detik)** di `ChatTab.tsx` untuk penerimaan pesan real-time.

---

## 🧪 8. Rekapitulasi Verifikasi & Uji Sistem
- `npx tsc --noEmit`: **0 error** (TypeScript Strict Passed).
- `npm run build`: **0 warning / 0 error** (Turbopack 18/18 routes passed).
- Server produksi lokal aktif di `http://localhost:3007` (HTTP 200 OK).
