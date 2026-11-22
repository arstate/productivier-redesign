# Design System & Workflow Plan v3 — Productivier (Lisso-Inspired Editorial)

## 1. Referensi Visual & Palet Warna (60 / 30 / 10)
Mengadaptasi estetika **Lisso Productivity** ke dalam **Productivier** tanpa AI slop:
- **60% Canvas (Warm Sand & Cream):** `#F5F1EB` dengan radial gradient lembut `#EFE6DA` -> `#E3D5C5` (hangat, organik, tidak pucat).
- **30% Surface (Crisp White & Dark Obsidian):**
  - Card Konten: `#FFFFFF` (`rgba(255,255,255,0.92)`, `backdrop-blur-md`, border `1px solid rgba(17,24,39,0.06)`, `rounded-3xl`).
  - Desktop Floating Sidebar: `#111827` (Ink Black) agar kontras tajam dan tidak mati warna.
- **10% Aksen & Status:**
  - **Ink Black Pill:** `#111827` (tombol utama, switcher aktif `Pribadi | Tim`).
  - **Butter Yellow Card:** `#FDE047` / `#FCD34D` (kartu highlight *Aktivitas Proyek* dengan teks `#111827`).
  - **Emerald:** `#10B981` / `#CCFBF1` (`Tercapai` / `Sudah Input`).
  - **Coral Red:** `#EF4444` / `#FEE2E2` (`Prioritas Tinggi` / `Belum Input`).
  - **Indigo:** `#6366F1` (badge `Statistik`).

## 2. Tipografi & Hierarki
- **Font Utama:** `Plus Jakarta Sans` (400, 500, 600, 700).
- **Angka & Metrik:** `tabular-nums` wajib di semua persentase, jam, dan target.
- **Hero Metric:** `64px–72px` (`text-6xl` / `text-7xl`), weight `500`–`600`, tracking `-0.04em` (contoh: `85%` *Produktivitas Hari Ini*).

## 3. Penyesuaian Workflow (3 Perspektif)
1. **Mode Pribadi (User):**
   - Fokus pada produktivitas diri sendiri (`85%`), daftar target & realisasi pribadi hari ini, serta input cepat.
2. **Mode Tim (Kolaborasi):**
   - User bisa melihat **siapa saja anggota tim yang kerja bareng** di proyek yang sama (Avatar Stack + status input rekan kerja: *Sudah Input* / *Belum*).
3. **Mode Leader (Fifa / Admin):**
   - Panel Monitoring Kinerja Tim: siapa yang belum input hari ini, filter per divisi/proyek, tren 7 hari, buat proyek & akun tim, Copy Rekap WA, dan Export CSV.

## 4. Sistem Animasi Smooth & Morphing (`motion/react`)
- **Library:** `motion/react` (GPU-only `transform`/`opacity` + `layoutId` shared-element morphing, zero layout thrash).
- **Morphing Transitions:**
  1. **Mode Switcher Pill (`Pribadi` | `Tim`):** Menggunakan `layoutId="mode-pill"` dengan spring physics (`stiffness: 380, damping: 30`) sehingga pill hitam bergeser/morphing mulus.
  2. **Sidebar & Bottom Nav Active Indicator:** Menggunakan `layoutId="nav-active-bg"` untuk perpindahan indikator menu yang fluid.
  3. **Project & Task Cards:** `layout` prop + `AnimatePresence` saat filter/switch mode (`Pribadi` <-> `Tim`), sehingga kartu realisasi melakukan morph posisi dan ukuran secara halus.
  4. **Progress Bar & Hero Metric (`85%`):** Smooth spring width transition & number count-up.
  5. **Accessibility:** Selalu hormati `prefers-reduced-motion: reduce`.

## 5. Aturan Anti-Slop
- **0 Emoji** di seluruh UI (100% Pure SVG / Lucide).
- **0 Meta-Jargon** (*Bento*, *Hero Section*, *CTA*, *brutalist*).
- **Responsive:** Desktop pakai **Dark Floating Left Sidebar**, Mobile (`< 768px`) pakai **Bottom Navigation Bar**.
