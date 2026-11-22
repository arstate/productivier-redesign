# Plan Redesign Desktop — Floating Left Sidebar (Productivier v2)

## 1. Konsep & Referensi
- **Referensi:** Mobbin Floating Left Sidebar (minimal, clean, tanpa garis pemisah kaku penuh).
- **Responsive Split:**
  - **Mobile (`< 768px`):** Tetap pakai **Bottom Navigation Bar** (Beranda, Proyek, Input, Laporan, Profil).
  - **Desktop (`>= 768px`):** Bottom navbar disembunyikan, diganti **Floating Left Sidebar** di sisi kiri.

## 2. Spesifikasi Floating Left Sidebar (Desktop)
- **Posisi & Bentuk:** `fixed left-4 top-4 bottom-4 w-60` (mengambang dengan margin `16px` dari tepi layar), `rounded-3xl`, background putih `#FFFFFF`, border halus `1px solid #E5E2DC`, `shadow-sm`.
- **Struktur Isi Sidebar:**
  1. **Brand Header:** Logo `Productivier` + badge role (`Leader` / `Tim`).
  2. **Menu Utama (5 Item):** Beranda, Proyek, Input Realisasi, Laporan, Profil. Item aktif pakai pill lembut `#CCFBF1/50` + teks `#0F766E`.
  3. **Footer Sidebar:** Info user singkat (`Nama · Divisi`) + tombol `Keluar`.
- **Area Konten Utama (`md:pl-72`):**
  - Lebar maksimal `max-w-5xl`, grid 2 kolom di desktop untuk Monitoring Tim & Progres Proyek biar lega dan tidak menumpuk ke bawah.

## 3. Verifikasi & QA
- Build (`tsc --noEmit`, `npm run lint`, `npm run build`).
- Screenshot desktop (`1280x800` & `1440x900`) dan mobile (`390x844`) di browser headless untuk dicek sebelum serah terima.
