"use client";

import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus,
  ChevronRight,
  FolderKanban,
  X,
  Link2,
} from "lucide-react";
import { UserType, ProjectType } from "@/types";
import CustomSelect, { CustomSelectOption } from "@/components/ui/CustomSelect";
import ProjectDetailView from "@/components/projects/ProjectDetailView";

export default function ProjectsTab({
  user,
  users,
  projects,
  onRefresh,
  onGoInput,
  onGoNotes,
  showToast,
}: {
  user: UserType;
  users: UserType[];
  projects: ProjectType[];
  onRefresh: () => Promise<void>;
  onGoInput: () => void;
  onGoNotes?: (projectId?: number) => void;
  showToast: (m: string) => void;
}) {
  const [filterStatus, setFilterStatus] = useState<"all" | "aktif" | "selesai">("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectType | null>(null);
  const [nama, setNama] = useState("");
  const [picId, setPicId] = useState(users[0]?.id ? String(users[0].id) : "");
  const [divisi, setDivisi] = useState(user.divisi || "Operasional");
  const [target, setTarget] = useState("100");
  const [satuan, setSatuan] = useState("Tugas");
  const [submitting, setSubmitting] = useState(false);

  // Sync with URL query parameter ?project_id=...
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const pid = params.get("project_id");
      if (pid) {
        const found = projects.find((p) => p.id === Number(pid));
        if (found) {
          setSelectedProject(found);
        }
      }
    }
  }, [projects]);

  // Reset selectedProject if it was deleted
  useEffect(() => {
    if (selectedProject && !projects.some((p) => p.id === selectedProject.id)) {
      setSelectedProject(null);
    }
  }, [projects, selectedProject]);

  // Listen to custom refresh event
  useEffect(() => {
    const handleRefresh = () => {
      onRefresh();
    };
    window.addEventListener("productivier:refresh_data", handleRefresh);
    return () => {
      window.removeEventListener("productivier:refresh_data", handleRefresh);
    };
  }, [onRefresh]);

  // Listen to custom event dispatched by AI Agent: productivier:open_project
  useEffect(() => {
    const handleOpenProjectEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ projectId: number }>;
      const targetId = customEvent.detail?.projectId;
      if (targetId) {
        const found = projects.find((p) => p.id === Number(targetId));
        if (found) {
          setSelectedProject(found);
          if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            url.searchParams.set("tab", "projects");
            url.searchParams.set("project_id", String(found.id));
            window.history.pushState(null, "", url.toString());
          }
        }
      }
    };

    window.addEventListener("productivier:open_project", handleOpenProjectEvent);
    return () => {
      window.removeEventListener("productivier:open_project", handleOpenProjectEvent);
    };
  }, [projects]);

  const handleSelectProject = (p: ProjectType | null) => {
    setSelectedProject(p);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (p) {
        url.searchParams.set("tab", "projects");
        url.searchParams.set("project_id", String(p.id));
      } else {
        url.searchParams.delete("project_id");
      }
      window.history.pushState(null, "", url.toString());
    }
  };

  const filteredProjects = useMemo(() => {
    if (filterStatus === "all") return projects;
    return projects.filter((p) => p.status === filterStatus);
  }, [projects, filterStatus]);

  const userOptions: CustomSelectOption[] = users.map((u) => ({
    value: String(u.id),
    label: u.nama,
    subLabel: `${u.divisi} · @${u.username}`,
  }));

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nama.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nama_proyek: nama.trim(),
          pic_id: picId ? Number(picId) : user.id,
          divisi: divisi.trim(),
          target_total: Number(target),
          satuan: satuan.trim(),
        }),
      });
      if (res.ok) {
        setNama("");
        setShowAddModal(false);
        showToast("Proyek baru berhasil ditambahkan!");
        await onRefresh();
      } else {
        showToast("Gagal menyimpan proyek");
      }
    } catch {
      showToast("Terjadi kesalahan jaringan");
    } finally {
      setSubmitting(false);
    }
  };

  // Dedicated In-Page Full View (Replaces Popup Modal)
  if (selectedProject) {
    const currentProject = projects.find((p) => p.id === selectedProject.id) || selectedProject;
    return (
      <ProjectDetailView
        project={currentProject}
        user={user}
        onBack={() => handleSelectProject(null)}
        onRefreshProjects={onRefresh}
        onGoInput={onGoInput}
        onGoNotes={onGoNotes}
        showToast={showToast}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Projects Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Daftar Proyek Tim
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            Target capaian, progres otomatis, dan kolaborator proyek
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Status Filter Pills */}
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-full p-1 flex items-center gap-1 shadow-xs border border-white/60 dark:border-white/10">
            {(["all", "aktif", "selesai"] as const).map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-full capitalize transition cursor-pointer ${
                  filterStatus === st
                    ? "bg-[#1C1D21] text-white shadow-xs dark:bg-white dark:text-slate-900"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
                }`}
              >
                {st === "all" ? "Semua" : st}
              </button>
            ))}
          </div>

          {/* Add Project CTA (For Admin) */}
          {user.role === "admin" && (
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-[#1C1D21] hover:bg-black text-white px-5 py-2.5 rounded-full font-semibold text-xs sm:text-sm flex items-center gap-2 shadow-md transition active:scale-95 cursor-pointer dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Proyek</span>
            </button>
          )}
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProjects.map((p) => {
          const isComplete = p.persentase >= 100;
          return (
            <div
              key={p.id}
              onClick={() => handleSelectProject(p)}
              className="intellecta-card p-6 flex flex-col justify-between hover:shadow-lg transition-all duration-200 group dark:text-slate-100 cursor-pointer border border-transparent hover:border-slate-300 dark:hover:border-slate-700 hover:-translate-y-0.5"
            >
              <div>
                {/* Top Badge & Status Row */}
                <div className="flex items-center justify-between gap-2 mb-4">
                  <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold text-xs tracking-wide">
                    {p.divisi}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full font-bold text-xs uppercase tracking-wider ${
                      p.status === "aktif"
                        ? "bg-[#D2F27C]/30 text-slate-900 dark:text-[#D2F27C] border border-[#D2F27C]/50"
                        : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {p.status}
                  </span>
                </div>

                {/* Project Title */}
                <h3 className="font-extrabold text-lg text-slate-900 dark:text-white leading-snug group-hover:text-black dark:group-hover:text-[#D2F27C] transition">
                  {p.nama_proyek}
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-1">
                  PIC: <span className="text-slate-700 dark:text-slate-200 font-semibold">{p.pic_nama || user.nama}</span>
                </p>
              </div>

              {/* Progress & Stats Row */}
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold">Progres Capaian</span>
                  <div className="flex items-baseline gap-1 font-extrabold text-slate-900 dark:text-white tabular-nums">
                    <span className="text-base">{p.persentase}%</span>
                    <span className="text-slate-500 dark:text-slate-400 font-normal">
                      ({p.total_realisasi} / {p.target_total} {p.satuan})
                    </span>
                  </div>
                </div>

                {/* Lime Progress Track */}
                <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden relative">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, Math.max(4, p.persentase))}%`,
                      backgroundColor: isComplete ? "#D2F27C" : "#CBD5E1",
                    }}
                  />
                </div>

                {/* Action Shortcuts */}
                <div className="flex items-center justify-between mt-4 pt-1">
                  <span className="text-xs text-slate-400 font-medium">
                    {p.jumlah_laporan || 0} laporan tercatat
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectProject(p);
                      }}
                      className="text-xs font-bold text-slate-900 dark:text-white hover:underline flex items-center gap-1.5 cursor-pointer bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-3 py-1.5 rounded-full transition"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>Detail Hub</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onGoInput();
                      }}
                      className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 cursor-pointer transition hover:underline"
                    >
                      <span>+ Catat Realisasi</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {filteredProjects.length === 0 && (
          <div className="col-span-full py-16 text-center intellecta-card p-8">
            <FolderKanban className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h4 className="font-bold text-base text-slate-800 dark:text-slate-200">Belum Ada Proyek</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Mulai dengan menambahkan proyek baru untuk memantau progres harian dan target kerja tim.
            </p>
          </div>
        )}
      </div>

      {/* Add Project Modal with Custom Animated Select */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md intellecta-card p-6 sm:p-8 shadow-2xl dark:text-slate-100"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-slate-700 mb-6">
                <div>
                  <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">Tambah Proyek Baru</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Tentukan target dan penanggung jawab proyek</p>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateProject} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Nama Proyek
                  </label>
                  <input
                    type="text"
                    required
                    value={nama}
                    onChange={(e) => setNama(e.target.value)}
                    placeholder="Contoh: Optimasi Web & Konten Meta Ads"
                    className="w-full px-4 py-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Divisi
                    </label>
                    <input
                      type="text"
                      required
                      value={divisi}
                      onChange={(e) => setDivisi(e.target.value)}
                      placeholder="Operasional"
                      className="w-full px-4 py-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      PIC (Leader)
                    </label>
                    <CustomSelect
                      value={picId}
                      onChange={setPicId}
                      options={userOptions.length > 0 ? userOptions : [{ value: String(user.id), label: user.nama }]}
                      variant="form"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Target Total
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Satuan
                    </label>
                    <input
                      type="text"
                      required
                      value={satuan}
                      onChange={(e) => setSatuan(e.target.value)}
                      placeholder="Tugas / Konten / Halaman"
                      className="w-full px-4 py-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full min-h-[46px] rounded-full bg-[#1C1D21] hover:bg-black text-white font-semibold text-sm shadow-md active:scale-[0.98] transition flex items-center justify-center gap-2 cursor-pointer dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                  >
                    <span>{submitting ? "Menyimpan..." : "Simpan Proyek"}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
