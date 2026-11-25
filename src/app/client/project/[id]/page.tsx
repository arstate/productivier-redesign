import React from "react";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import { SESSION_COOKIE_NAME, getSessionUserFromToken } from "@/lib/auth";
import ProductivierLogo from "@/components/ui/ProductivierLogo";
import ClientNotesSection from "@/components/client/ClientNotesSection";
import CopyPortalButton from "@/components/client/CopyPortalButton";
import {
  ExternalLink,
  CheckCircle2,
  Calendar,
  MessageCircle,
  FolderKanban,
  FileCheck2,
  ArrowUpRight,
  ShieldCheck,
  Gauge,
  Timer,
  Database,
  Sparkles,
  Layers,
  FileText,
  FileSpreadsheet,
  FolderGit2,
} from "lucide-react";

interface ClientProjectPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}

export const dynamic = "force-dynamic";

export default async function ClientProjectPage({ params, searchParams }: ClientProjectPageProps) {
  const { id } = await params;
  const { token } = await searchParams;
  const projectId = Number(id);

  if (!projectId) {
    return (
      <div className="min-h-screen bg-[#ECEEF3] flex items-center justify-center p-6 text-slate-800">
        <div className="dashboard-card p-8 text-center max-w-md">
          <h2 className="text-xl font-bold mb-2">Proyek Tidak Ditemukan</h2>
          <p className="text-xs text-slate-500">Tautan proyek yang Anda tuju tidak valid.</p>
        </div>
      </div>
    );
  }

  const db = getDb();
  const project = db
    .prepare(`
      SELECT p.*, u.nama as pic_nama, u.avatar_url as pic_avatar, u.divisi as pic_divisi,
        COALESCE((SELECT SUM(r.realisasi) FROM realisasi r WHERE r.project_id = p.id), 0) as total_realisasi,
        COALESCE((SELECT COUNT(r.id) FROM realisasi r WHERE r.project_id = p.id), 0) as jumlah_laporan
      FROM projects p
      LEFT JOIN users u ON p.pic_id = u.id
      WHERE p.id = ?
    `)
    .get(projectId) as
    | {
        id: number;
        nama_proyek: string;
        divisi: string;
        target_total: number;
        satuan: string;
        status: string;
        deadline?: string;
        share_token?: string;
        pic_nama?: string;
        pic_avatar?: string;
        pic_divisi?: string;
        total_realisasi: number;
        jumlah_laporan: number;
      }
    | undefined;

  if (!project) {
    return (
      <div className="min-h-screen bg-[#ECEEF3] flex items-center justify-center p-6 text-slate-800">
        <div className="dashboard-card p-8 text-center max-w-md">
          <h2 className="text-xl font-bold mb-2">Proyek Tidak Ditemukan</h2>
          <p className="text-xs text-slate-500">Proyek dengan ID ini tidak terdaftar atau sudah diarsipkan.</p>
        </div>
      </div>
    );
  }

  const cookieStore = await cookies();
  const sessionUser = getSessionUserFromToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  const validToken = Boolean(project.share_token && token && String(token).trim() === String(project.share_token));
  if (!validToken && !sessionUser) {
    return (
      <div className="min-h-screen bg-[#ECEEF3] flex items-center justify-center p-6 text-slate-800">
        <div className="dashboard-card p-8 text-center max-w-md space-y-2">
          <h2 className="text-xl font-bold">Tautan Portal Terbatas</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Portal proyek ini memerlukan token akses resmi dari tim pengelola atau sesi tim yang terautentikasi.
          </p>
        </div>
      </div>
    );
  }

  const target = Number(project.target_total) || 100;
  const total = Number(project.total_realisasi) || 0;
  const persentase = target > 0 ? Math.max(0, Math.min(100, Math.round((total / target) * 100))) : 0;
  const isComplete = persentase >= 100;
  const rawSisa = Math.max(0, target - total);
  const cleanSisa = Number.isInteger(rawSisa) ? rawSisa : Number(rawSisa.toFixed(1));
  const isAktif = (project.status || "").toLowerCase() === "aktif";

  // Fetch project links
  const links = db
    .prepare("SELECT * FROM project_links WHERE project_id = ? ORDER BY id ASC")
    .all(projectId) as Array<{ id: number; title: string; url: string; platform: string }>;

  // Fetch verified task logs
  const realisasiLogs = db
    .prepare("SELECT * FROM realisasi WHERE project_id = ? ORDER BY tanggal DESC, id DESC LIMIT 20")
    .all(projectId) as Array<{
      id: number;
      aktivitas: string;
      nama: string;
      tanggal: string;
      persentase: number;
      target: number;
      realisasi: number;
      satuan: string;
      status: string;
      kendala?: string;
      solusi?: string;
      bukti_foto_url?: string;
    }>;

  // Fetch client feedback/notes
  const rawClientNotes = db
    .prepare(`
      SELECT id, project_id, author_name, author_role, message, category, status, created_at
      FROM project_client_notes
      WHERE project_id = ?
      ORDER BY created_at DESC, id DESC
    `)
    .all(projectId) as Array<Record<string, unknown>>;

  const clientNotes = rawClientNotes.map((r) => ({
    id: Number(r.id),
    project_id: Number(r.project_id),
    author_name: String(r.author_name || ""),
    author_role: (r.author_role === "team" ? "team" : "client") as "team" | "client",
    message: String(r.message || ""),
    category: String(r.category || "feedback") as "feedback" | "revisi" | "pertanyaan" | "apresiasi",
    status: String(r.status || "open") as "open" | "in_progress" | "resolved",
    created_at: String(r.created_at || ""),
  }));

  const getPlatformConfig = (rawPlatform?: string | null) => {
    const p = (rawPlatform || "").toLowerCase().trim();
    if (p.includes("drive") || p.includes("google")) {
      return {
        label: "Google Drive",
        icon: FolderKanban,
        badgeColor: "bg-amber-100 text-amber-800",
        cardBg: "bg-amber-50/40 hover:bg-amber-50/80",
        borderColor: "border-amber-200/70 hover:border-amber-400/80",
      };
    }
    if (p.includes("figma")) {
      return {
        label: "Figma Canvas",
        icon: Layers,
        badgeColor: "bg-purple-100 text-purple-800",
        cardBg: "bg-purple-50/40 hover:bg-purple-50/80",
        borderColor: "border-purple-200/70 hover:border-purple-400/80",
      };
    }
    if (p.includes("notion")) {
      return {
        label: "Notion Workspace",
        icon: FileText,
        badgeColor: "bg-slate-200 text-slate-800",
        cardBg: "bg-slate-50/60 hover:bg-slate-100/80",
        borderColor: "border-slate-200/80 hover:border-slate-400/80",
      };
    }
    if (p.includes("sheet") || p.includes("excel") || p.includes("spread")) {
      return {
        label: "Spreadsheet Data",
        icon: FileSpreadsheet,
        badgeColor: "bg-emerald-100 text-emerald-800",
        cardBg: "bg-emerald-50/40 hover:bg-emerald-50/80",
        borderColor: "border-emerald-200/70 hover:border-emerald-400/80",
      };
    }
    if (p.includes("git") || p.includes("hub") || p.includes("repo") || p.includes("web") || p.includes("code")) {
      return {
        label: "Web / Repository",
        icon: FolderGit2,
        badgeColor: "bg-zinc-200 text-zinc-900",
        cardBg: "bg-zinc-50/60 hover:bg-zinc-100/80",
        borderColor: "border-zinc-200/80 hover:border-zinc-400/80",
      };
    }
    return {
      label: "Tautan Aset",
      icon: ExternalLink,
      badgeColor: "bg-blue-100 text-blue-800",
      cardBg: "bg-blue-50/40 hover:bg-blue-50/80",
      borderColor: "border-blue-200/70 hover:border-blue-400/80",
    };
  };

  const circumference = 2 * Math.PI * 48; // ~301.59
  const strokeDashoffset = circumference * (1 - Math.min(100, Math.max(0, persentase)) / 100);

  return (
    <div className="min-h-screen bg-radial from-[#D6DCF2] via-[#ECEEF3] to-[#F4F5F8] text-[#18181B] antialiased pb-16">
      {/* 1. CLIENT PORTAL TOP HEADER */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-black/[0.06] shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ProductivierLogo size={36} />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base tracking-tight block text-slate-900 leading-tight">
                  Productivier Client Portal
                </span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200/60">
                  Enterprise Sync
                </span>
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Transparansi &amp; Monitoring Progres Proyek
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 font-medium mr-1">
              <span className="text-slate-400">ID Proyek:</span>
              <code className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-bold font-mono text-[11px]">
                #{project.id}
              </code>
            </div>

            <CopyPortalButton projectId={projectId} projectName={project.nama_proyek} />

            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 font-bold text-xs border border-emerald-200/60 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Realtime Live</span>
            </span>
          </div>
        </div>
      </header>

      {/* 2. MAIN CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-6">
        {/* HERO BENTO HEADER (7:5 SPLIT) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
          {/* LEFT HERO CARD: TITLE, DIVISION, PIC & WHATSAPP CTA (7 COLS) */}
          <div className="lg:col-span-7 dashboard-card p-6 sm:p-8 bg-white/95 backdrop-blur-md shadow-sm border border-slate-200/80 flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                  {project.divisi || "Umum"}
                </span>

                {/* STATUS PILL ('Sedang Berjalan' / 'Selesai') */}
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider ${
                    isAktif
                      ? "bg-[#D2F27C] text-slate-900 border border-[#D2F27C]"
                      : "bg-slate-100 text-slate-700 border border-slate-200"
                  }`}
                >
                  {isAktif ? (
                    <span className="w-2 h-2 rounded-full bg-slate-900 animate-pulse" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  )}
                  <span>{isAktif ? "Sedang Berjalan" : "Selesai"}</span>
                </span>

                {project.deadline && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 text-slate-600 text-xs font-semibold border border-slate-200/60">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Target: {project.deadline}</span>
                  </span>
                )}
              </div>

              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight leading-tight">
                  {project.nama_proyek}
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1.5 leading-relaxed">
                  Portal transparansi pengerjaan &amp; kolaborasi proyek resmi bersama tim pelaksana Productivier.
                </p>
              </div>
            </div>

            {/* PIC PROFILE & WHATSAPP CTA BAR */}
            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  {project.pic_avatar ? (
                    <img
                      src={project.pic_avatar}
                      alt={project.pic_nama || "PIC"}
                      className="w-12 h-12 rounded-2xl object-cover shadow-sm border border-slate-200/60"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-[#D2F27C] font-black text-base flex items-center justify-center shadow-sm">
                      {project.pic_nama ? project.pic_nama.substring(0, 2).toUpperCase() : "PM"}
                    </div>
                  )}
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center shadow-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <strong className="text-sm font-black text-slate-900 leading-tight">
                      {project.pic_nama || "Fifa (Leader)"}
                    </strong>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[10px] font-bold text-slate-600">
                      Lead PIC
                    </span>
                  </div>
                  <span className="text-xs text-slate-400 font-medium block mt-0.5">
                    Penanggung Jawab Proyek Utama
                  </span>
                </div>
              </div>

              <a
                href={`https://wa.me/6285196598881?text=${encodeURIComponent(
                  `Halo Tim Productivier, saya ingin konsultasi mengenai progres proyek ${project.nama_proyek} (ID: #${project.id}).`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="px-5 py-2.5 rounded-full bg-[#1C1D21] hover:bg-black text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition active:scale-95 group shrink-0"
              >
                <MessageCircle className="w-4 h-4 text-[#D2F27C] group-hover:scale-110 transition-transform" />
                <span>Hubungi Tim via WhatsApp</span>
              </a>
            </div>
          </div>

          {/* RIGHT HERO CARD: CIRCULAR SPEEDOMETER VELOCITY PROGRESS GAUGE (5 COLS) */}
          <div className="lg:col-span-5 dashboard-card p-6 sm:p-8 bg-white/95 backdrop-blur-md shadow-sm border border-slate-200/80 flex flex-col justify-between space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-slate-700" />
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                  Velocity &amp; Capaian Proyek
                </span>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-2xs">
                <span>{isComplete ? "🏆 Selesai 100%" : "🟢 On Track"}</span>
              </span>
            </div>

            {/* SPEEDOMETER RADIAL GAUGE & SPRINT STATS */}
            <div className="flex flex-col sm:flex-row items-center gap-6 py-1">
              <div className="relative w-36 h-36 flex items-center justify-center shrink-0">
                <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 120 120">
                  <defs>
                    <linearGradient id="velocityGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      {isComplete ? (
                        <>
                          <stop offset="0%" stopColor="#10B981" />
                          <stop offset="100%" stopColor="#059669" />
                        </>
                      ) : (
                        <>
                          <stop offset="0%" stopColor="#18181B" />
                          <stop offset="100%" stopColor="#10B981" />
                        </>
                      )}
                    </linearGradient>
                  </defs>

                  {/* Outer reference graduation track */}
                  <circle
                    cx="60"
                    cy="60"
                    r="54"
                    stroke="#F1F5F9"
                    strokeWidth="1.5"
                    strokeDasharray="2 6"
                    fill="transparent"
                  />

                  {/* Base track circle */}
                  <circle
                    cx="60"
                    cy="60"
                    r="48"
                    stroke="#E2E8F0"
                    strokeWidth="11"
                    fill="transparent"
                  />

                  {/* Velocity progress arc */}
                  <circle
                    cx="60"
                    cy="60"
                    r="48"
                    stroke="url(#velocityGrad)"
                    strokeWidth="11"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    fill="transparent"
                    style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)" }}
                  />
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                  <Gauge className="w-3.5 h-3.5 text-slate-400 mb-0.5" />
                  <span className="text-3xl font-black text-slate-900 tracking-tight tabular-nums leading-none">
                    {persentase}%
                  </span>
                  <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mt-1">
                    Velocity Capaian
                  </span>
                </div>
              </div>

              <div className="w-full space-y-2.5">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Tugas Terverifikasi
                      </span>
                      <span className="text-xs font-black text-slate-900">
                        {project.jumlah_laporan} aktivitas diverifikasi
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                      <Timer className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Sisa Target Proyek
                      </span>
                      <span className="text-xs font-black text-slate-900">
                        {isComplete ? "Semua Target Selesai" : `Sisa ${cleanSisa} ${project.satuan || "Tugas"} lagi`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* LINEAR PROGRESS BREAKDOWN */}
            <div className="pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-[11px] font-bold text-slate-500">
                  Realisasi: <strong className="text-slate-800">{total}</strong> dari <strong className="text-slate-800">{target} {project.satuan || "Tugas"}</strong>
                </span>
                <span className="text-[11px] font-black text-slate-900 tabular-nums">
                  {persentase}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden relative">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${Math.min(100, Math.max(3, persentase))}%`,
                    backgroundColor: isComplete ? "#10B981" : "#18181B",
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 3. ASYMMETRIC MAIN BENTO GRID (7:5 SPLIT) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
          {/* LEFT COLUMN: VAULT & WORK LOGS TIMELINE (7 COLS) */}
          <div className="lg:col-span-7 space-y-5 sm:space-y-6">
            {/* A. CLOUD RESOURCE & DELIVERABLES VAULT */}
            <div className="dashboard-card p-6 sm:p-7 bg-white/95 backdrop-blur-md shadow-sm border border-slate-200/80 space-y-4">
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-200/80">
                <div>
                  <div className="flex items-center gap-2">
                    <FolderKanban className="w-5 h-5 text-slate-800" />
                    <h2 className="text-base sm:text-lg font-black text-slate-900">
                      Vault Berkas &amp; Deliverable Proyek
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Akses langsung ke folder Google Drive, dokumen kerja, dan preview desain final
                  </p>
                </div>
                <span className="text-xs font-black text-slate-700 bg-slate-100 px-3 py-1 rounded-full border border-slate-200/60 shrink-0">
                  {links.length} Berkas
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                {links.map((lnk) => {
                  const badge = getPlatformConfig(lnk.platform);
                  const Icon = badge.icon;
                  const safeUrl = lnk.url?.startsWith("http://") || lnk.url?.startsWith("https://")
                    ? lnk.url
                    : `https://${lnk.url}`;

                  return (
                    <a
                      key={lnk.id}
                      href={safeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={`p-4 rounded-2xl border transition-all duration-200 flex items-start justify-between gap-3 group hover:shadow-md hover:-translate-y-0.5 ${badge.cardBg} ${badge.borderColor}`}
                    >
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-black uppercase tracking-wider ${badge.badgeColor}`}
                          >
                            <Icon className="w-3 h-3" />
                            <span>{badge.label}</span>
                          </span>
                        </div>
                        <h3 className="font-black text-xs sm:text-sm text-slate-900 group-hover:text-black transition line-clamp-2 leading-snug">
                          {lnk.title}
                        </h3>
                        <span className="text-[11px] text-slate-400 group-hover:text-slate-600 transition flex items-center gap-1 font-medium">
                          <span>Buka berkas di tab baru</span>
                          <span className="group-hover:translate-x-0.5 transition-transform">↗</span>
                        </span>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-white shadow-2xs border border-slate-200/60 flex items-center justify-center text-slate-700 group-hover:bg-[#1C1D21] group-hover:text-[#D2F27C] transition shrink-0">
                        <ArrowUpRight className="w-4 h-4" />
                      </div>
                    </a>
                  );
                })}

                {links.length === 0 && (
                  <div className="col-span-full py-10 text-center text-xs text-slate-400 bg-slate-50/80 rounded-2xl border border-dashed border-slate-200">
                    Belum ada tautan deliverable publik yang dibagikan untuk proyek ini.
                  </div>
                )}
              </div>
            </div>

            {/* B. VERIFIED WORK LOGS TIMELINE FEED */}
            <div className="dashboard-card p-6 sm:p-7 bg-white/95 backdrop-blur-md shadow-sm border border-slate-200/80 space-y-4">
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-200/80">
                <div>
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="w-5 h-5 text-slate-800" />
                    <h2 className="text-base sm:text-lg font-black text-slate-900">
                      Timeline Realisasi &amp; Log Tugas Terverifikasi
                    </h2>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Riwayat aktivitas pengerjaan oleh tim pelaksana secara transparan &amp; terukur
                  </p>
                </div>
                <span className="text-xs font-black text-slate-700 bg-slate-100 px-3 py-1 rounded-full border border-slate-200/60 shrink-0">
                  {realisasiLogs.length} Catatan
                </span>
              </div>

              {/* TIMELINE FEED CONTAINER */}
              <div className="relative max-h-[520px] overflow-y-auto pr-2 space-y-4 pt-1">
                {realisasiLogs.map((log) => {
                  const isLogComplete = Number(log.persentase) >= 100 || log.status === "Tercapai";
                  return (
                    <div
                      key={log.id}
                      className="relative pl-7 before:absolute before:left-3 before:top-4 before:bottom-0 before:w-0.5 before:bg-slate-200/70 last:before:hidden text-xs pb-3"
                    >
                      {/* Timeline Bullet Node */}
                      <span
                        className={`absolute left-0.5 top-1.5 w-5 h-5 rounded-full flex items-center justify-center shadow-2xs border ${
                          isLogComplete
                            ? "bg-emerald-500 border-emerald-400 text-white"
                            : "bg-white border-slate-300 text-slate-500"
                        }`}
                      >
                        {isLogComplete ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        )}
                      </span>

                      <div className="p-3.5 rounded-2xl bg-slate-50/70 hover:bg-slate-50 border border-slate-100/90 transition space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <strong className="text-sm font-black text-slate-900 leading-snug">
                                {log.aktivitas}
                              </strong>
                              <span className="px-2 py-0.5 rounded-md bg-white text-[10px] font-bold text-slate-700 border border-slate-200/60 shadow-2xs">
                                Oleh: {log.nama || project.pic_nama || "Tim Pelaksana"}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-[11px] text-slate-400 flex-wrap">
                              <span className="inline-flex items-center gap-1 font-medium">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                <span>{log.tanggal}</span>
                              </span>
                              <span>·</span>
                              <span className="font-semibold text-slate-600">
                                Capaian: {log.realisasi} / {log.target} {log.satuan || project.satuan || "Tugas"}
                              </span>
                            </div>
                          </div>

                          {/* 100% COMPLETION BADGE OR PROGRESS */}
                          {isLogComplete ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[11px] tabular-nums shrink-0 border border-emerald-200/80 shadow-2xs">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>100% Tuntas</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-bold text-[11px] tabular-nums shrink-0 border border-slate-200">
                              <span>{log.persentase || 0}%</span>
                            </span>
                          )}
                        </div>

                        {log.kendala && (
                          <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/60 text-[11px] text-amber-800">
                            <strong className="font-bold">Catatan Kendala:</strong> {log.kendala}
                          </div>
                        )}

                        {log.solusi && (
                          <div className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200/60 text-[11px] text-emerald-800">
                            <strong className="font-bold">Solusi Diterapkan:</strong> {log.solusi}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {realisasiLogs.length === 0 && (
                  <div className="py-10 text-center text-xs text-slate-400 bg-slate-50/80 rounded-2xl border border-dashed border-slate-200">
                    Belum ada catatan aktivitas pengerjaan yang dipublikasikan.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: COLLABORATION & SLA ASSURANCE (5 COLS) */}
          <div className="lg:col-span-5 space-y-5 sm:space-y-6">
            {/* A. CLIENT NOTES & FEEDBACK SECTION */}
            <ClientNotesSection
              projectId={projectId}
              shareToken={typeof project.share_token === "string" ? project.share_token : ""}
              initialNotes={clientNotes}
            />

            {/* B. CLIENT TRANSPARENCY & SLA ASSURANCE CARD */}
            <div className="dashboard-card p-6 bg-white/95 backdrop-blur-md shadow-sm border border-slate-200/80 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200/80">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-black text-sm text-slate-900">
                    Transparansi &amp; Jaminan SLA Tim
                  </h3>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase tracking-wider">
                  Terjamin 100%
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition">
                  <div className="w-8 h-8 rounded-xl bg-slate-900 text-[#D2F27C] flex items-center justify-center shrink-0 shadow-xs">
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="font-bold text-slate-900 block text-xs">
                      Real-time SQLite Sync
                    </strong>
                    <p className="text-slate-500 text-[11px] mt-0.5 leading-relaxed">
                      Terhubung langsung ke mesin basis data produksi internal tanpa jeda delay atau caching usang.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition">
                  <div className="w-8 h-8 rounded-xl bg-[#D2F27C] text-slate-900 flex items-center justify-center shrink-0 shadow-xs">
                    <Timer className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="font-bold text-slate-900 block text-xs">
                      15-Minute Response SLA
                    </strong>
                    <p className="text-slate-500 text-[11px] mt-0.5 leading-relaxed">
                      Respon tanggap maksimal 15 menit pada jam operasional kerja tim untuk setiap tiket feedback dan revisi klien.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition">
                  <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center shrink-0 shadow-xs">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <strong className="font-bold text-slate-900 block text-xs">
                      Verifikasi PIC Terdaftar
                    </strong>
                    <p className="text-slate-500 text-[11px] mt-0.5 leading-relaxed">
                      Seluruh pengerjaan dan log aktivitas ditinjau langsung oleh Lead PIC terdaftar sebelum dipublikasikan.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1.5 text-emerald-700 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Sistem Operasional Normal</span>
                </span>
                <span className="text-slate-400 font-medium">Enterprise Portal v2.4</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. FOOTER (ZERO META-JARGON LEAK) */}
        <footer className="pt-8 pb-4 text-center text-xs text-slate-400">
          <p>© 2026 Productivier Workspace · Client Transparency Portal</p>
        </footer>
      </main>
    </div>
  );
}
