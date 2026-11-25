"use client";

import React, { useState } from "react";
import {
  Zap,
  Plus,
  StickyNote,
  Calendar,
  Link2,
  X,
  ArrowRight,
} from "lucide-react";
import { UserType, ProjectType, RealisasiType } from "@/types";
import AIMascot from "@/components/ui/AIMascot";
import CustomSelect from "@/components/ui/CustomSelect";

interface QuickLaunchpadCardProps {
  user: UserType;
  projects: ProjectType[];
  realisasi: RealisasiType[];
  selectedProjectId?: string;
  onRefreshData?: () => Promise<void>;
  onGoInput: () => void;
  onGoNotes?: () => void;
  onGoCalendar?: () => void;
  showToast: (m: string) => void;
}

export default function QuickLaunchpadCard({
  user,
  projects,
  realisasi,
  selectedProjectId = "all",
  onRefreshData,
  onGoInput,
  onGoNotes,
  onGoCalendar,
  showToast,
}: QuickLaunchpadCardProps) {
  // Quick Input Modal State
  const [showQuickInput, setShowQuickInput] = useState(false);
  const [aktivitas, setAktivitas] = useState("");
  const [target, setTarget] = useState("1");
  const [realisasiNum, setRealisasiNum] = useState("1");
  const [projectId, setProjectId] = useState(
    selectedProjectId !== "all" ? selectedProjectId : projects[0]?.id ? String(projects[0].id) : "1"
  );
  const [submitting, setSubmitting] = useState(false);

  // Calculate Sprint Velocity for Today
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayTasks = realisasi.filter((r) => r.tanggal === todayStr);
  const completedCount = todayTasks.filter((r) => r.persentase >= 100).length;
  const totalTargetCount = todayTasks.length;
  const velocityPct =
    totalTargetCount > 0
      ? Math.min(100, Math.round((completedCount / totalTargetCount) * 100))
      : 0;

  // SVG Radial Ring calculations
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (velocityPct / 100) * circumference;

  const handleCopyPortalLink = () => {
    const targetProject =
      (selectedProjectId !== "all"
        ? projects.find((p) => String(p.id) === selectedProjectId)
        : undefined) || projects[0];
    if (!targetProject) {
      showToast("Belum ada proyek aktif untuk disalin.");
      return;
    }
    const tokenQs = targetProject.share_token ? `?token=${encodeURIComponent(targetProject.share_token)}` : "";
    const portalUrl = `${window.location.origin}/client/project/${targetProject.id}${tokenQs}`;
    navigator.clipboard.writeText(portalUrl);
    showToast(`Tautan portal "${targetProject.nama_proyek}" berhasil disalin!`);
  };

  const handleOpenFloatingAI = () => {
    const btn = document.querySelector('[aria-label="Buka Miu AI Agent"]') as HTMLButtonElement | null;
    if (btn) {
      btn.click();
    } else {
      showToast("Asisten AI siap di sudut kanan bawah layar!");
    }
  };

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aktivitas.trim()) return;
    setSubmitting(true);
    try {
      const t = Number(target) || 1;
      const r = Number(realisasiNum) || 0;
      const pct = t > 0 ? Math.min(100, Math.round((r / t) * 100)) : 100;
      const res = await fetch("/api/realisasi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: Number(projectId) || 1,
          user_id: user.id,
          nama: user.nama,
          divisi: user.divisi,
          tanggal: todayStr,
          aktivitas: aktivitas.trim(),
          target: t,
          realisasi: r,
          satuan: "Tugas",
          persentase: pct,
          status: pct >= 100 ? "Tercapai" : "Proses",
        }),
      });
      if (res.ok) {
        showToast("Realisasi kilat berhasil dicatat!");
        setAktivitas("");
        setShowQuickInput(false);
        if (onRefreshData) await onRefreshData();
      } else {
        showToast("Gagal mencatat realisasi");
      }
    } catch {
      showToast("Terjadi kesalahan jaringan");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <article className="dashboard-card p-6 flex flex-col justify-between min-h-[350px] h-full dark:text-slate-100 relative overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between pb-3 border-b border-black/[0.05] dark:border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-lg text-[#18181B] dark:text-white">
              Sprint Velocity &amp; Aksi Cepat
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-[#D2F27C]/40 text-slate-900 dark:text-[#D2F27C] text-[10px] font-extrabold uppercase tracking-wider">
              Launchpad
            </span>
          </div>
          <p className="text-xs text-[#71717A] dark:text-slate-400 mt-0.5">
            Pusat kendali eksekusi harian tim
          </p>
        </div>
      </div>

      {/* Sprint Velocity Gauge Row */}
      <div className="my-4 p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          {/* Circular Gauge */}
          <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
              <circle
                cx="40"
                cy="40"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="7"
                className="text-slate-200 dark:text-slate-700"
              />
              <circle
                cx="40"
                cy="40"
                r={radius}
                fill="none"
                stroke="#D2F27C"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className="transition-all duration-700"
              />
            </svg>
            <span className="absolute text-sm font-black text-slate-900 dark:text-white tabular-nums">
              {velocityPct}%
            </span>
          </div>

          <div>
            <div className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span>Kecepatan Sprint Hari Ini</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              <strong className="text-slate-800 dark:text-slate-200">{completedCount}</strong> tugas tuntas dari{" "}
              <strong className="text-slate-800 dark:text-slate-200">{totalTargetCount}</strong> target
            </p>
            <span className="inline-block mt-1.5 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px] font-bold">
              ✓ Ritme Terjaga
            </span>
          </div>
        </div>
      </div>

      {/* 4 One-Click Action Buttons Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => setShowQuickInput(true)}
          className="p-3 rounded-2xl bg-[#18181B] hover:bg-black text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 text-left transition-transform active:scale-95 cursor-pointer flex flex-col justify-between gap-2 shadow-sm"
        >
          <div className="w-7 h-7 rounded-xl bg-white/15 dark:bg-slate-900/10 grid place-items-center">
            <Plus className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-extrabold leading-tight">Input Realisasi</div>
            <div className="text-[10px] opacity-75 mt-0.5">Catat progres kilat</div>
          </div>
        </button>

        <button
          type="button"
          onClick={onGoNotes || onGoInput}
          className="p-3 rounded-2xl bg-slate-100/90 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-left transition-transform active:scale-95 cursor-pointer flex flex-col justify-between gap-2 border border-slate-200/60 dark:border-slate-700"
        >
          <div className="w-7 h-7 rounded-xl bg-[#DCD4FB] text-slate-900 grid place-items-center">
            <StickyNote className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-extrabold leading-tight">Catat Memo Baru</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Simpan ide ke Notes</div>
          </div>
        </button>

        <button
          type="button"
          onClick={onGoCalendar || onGoInput}
          className="p-3 rounded-2xl bg-slate-100/90 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-left transition-transform active:scale-95 cursor-pointer flex flex-col justify-between gap-2 border border-slate-200/60 dark:border-slate-700"
        >
          <div className="w-7 h-7 rounded-xl bg-[#D2F27C] text-slate-900 grid place-items-center">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-extrabold leading-tight">Buat Jadwal</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Atur agenda kalender</div>
          </div>
        </button>

        <button
          type="button"
          onClick={handleCopyPortalLink}
          className="p-3 rounded-2xl bg-slate-100/90 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-left transition-transform active:scale-95 cursor-pointer flex flex-col justify-between gap-2 border border-slate-200/60 dark:border-slate-700"
        >
          <div className="w-7 h-7 rounded-xl bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 grid place-items-center">
            <Link2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-extrabold leading-tight">Salin Portal Klien</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">1-klik salin tautan</div>
          </div>
        </button>
      </div>

      {/* Floating AI Agent Status Pill */}
      <button
        type="button"
        onClick={handleOpenFloatingAI}
        className="mt-3.5 w-full py-2 px-3.5 rounded-2xl bg-gradient-to-r from-[#DCD4FB]/50 to-[#D2F27C]/30 hover:from-[#DCD4FB]/80 hover:to-[#D2F27C]/50 dark:from-purple-950/50 dark:to-lime-950/30 border border-purple-200/60 dark:border-purple-800/40 flex items-center justify-between text-xs transition cursor-pointer"
      >
        <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
          <AIMascot size={20} />
          <span>Universal Floating AI Siap</span>
        </div>
        <span className="text-[10px] font-extrabold text-purple-800 dark:text-purple-300 flex items-center gap-1">
          <span>Panggil</span>
          <ArrowRight className="w-3 h-3" />
        </span>
      </button>

      {/* Quick Input Modal Overlay */}
      {showQuickInput && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                Input Realisasi Kilat
              </h3>
              <button
                onClick={() => setShowQuickInput(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 grid place-items-center text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Proyek Terkait
                </label>
                <CustomSelect
                  variant="form"
                  value={projectId}
                  onChange={setProjectId}
                  options={projects.map((p) => ({
                    value: String(p.id),
                    label: `${p.nama_proyek} (${p.divisi})`,
                  }))}
                  placeholder="Pilih Proyek Terkait..."
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Aktivitas / Tugas
                </label>
                <input
                  type="text"
                  required
                  value={aktivitas}
                  onChange={(e) => setAktivitas(e.target.value)}
                  placeholder="Contoh: Desain 3 Carousel IG Feed"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Target
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Realisasi
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={realisasiNum}
                    onChange={(e) => setRealisasiNum(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-full bg-[#1C1D21] hover:bg-black text-white dark:bg-white dark:text-slate-900 font-bold text-xs shadow-md transition cursor-pointer disabled:opacity-50"
              >
                {submitting ? "Menyimpan..." : "Simpan Realisasi Sekarang"}
              </button>
            </form>
          </div>
        </div>
      )}
    </article>
  );
}
