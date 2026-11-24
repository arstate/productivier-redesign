# Product Requirements Document (PRD) — Productivier

## 1. Problem Statement
Tim internal membutuhkan platform terpusat untuk:
1. Mencatat realisasi tugas harian secara cepat tanpa formulir rumit.
2. Memantau progres proyek tim dan kualifikasi target per divisi.
3. Melacak anggota tim yang belum menginput realisasi hari ini.
4. Menghasilkan rekap cepat untuk format WhatsApp dan file spreadsheet Excel/CSV.

## 2. Core Personas
- **Leader / Admin (Fifa)**: Mengelola proyek, memantau absensi input harian tim, mengunduh laporan CSV, mengelola akun tim.
- **Anggota Tim (Karyawan)**: Mengisi target dan capaian harian, mengecek to-do list hari ini, dan melihat progres pribadi.

## 3. Key Feature Modules
1. **Executive Dashboard (Bento Grid)**:
   - Quick Virtual Assistant & action chips.
   - 8-Hour Gantt Timeline (07:00 - 02:00) with visual project milestones.
   - Dynamic To-do List with checklist indicators.
   - 7-Day Productivity Spline with interactive tooltip markers.
2. **Projects Hub**:
   - Status categorization (Semua, Aktif, Selesai).
   - Real-time progress bars with percentage completion.
3. **Daily Input**:
   - Real-time percentage badge.
   - Field: Proyek, Tanggal, Aktivitas, Target, Realisasi, Satuan, Kendala, Solusi, Bukti Foto.
4. **Reports & Exports**:
   - Live search & filter per divisi.
   - One-click WhatsApp Markdown formatting.
   - RFC 4180 CSV Export.
5. **Team & Security Hub**:
   - Team compliance tracker (Sudah Input vs Belum).
   - Admin account creator & member management.
