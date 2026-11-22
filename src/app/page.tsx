"use client";

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Home,
  FolderKanban,
  PlusCircle,
  FileText,
  User,
  LogOut,
  BarChart3,
  Copy,
  Download,
  Trash2,
  CheckCircle2,
  Clock,
  ExternalLink,
  Search,
  ChevronRight,
  Bell,
  Pencil,
  Play,
  Users,
} from "lucide-react";

type UserType = {
  id: number;
  username: string;
  nama: string;
  divisi: string;
  role: "admin" | "karyawan";
  avatar_url?: string;
};

type ProjectType = {
  id: number;
  nama_proyek: string;
  pic_id: number | null;
  pic_nama: string | null;
  divisi: string;
  target_total: number;
  total_realisasi: number;
  jumlah_laporan: number;
  satuan: string;
  status: string;
  persentase: number;
};

type RealisasiType = {
  id: number;
  project_id: number | null;
  nama_proyek: string | null;
  user_id: number;
  nama: string;
  divisi: string;
  tanggal: string;
  aktivitas: string;
  target: number;
  realisasi: number;
  satuan: string;
  persentase: number;
  status: string;
  kendala?: string;
  solusi?: string;
  bukti_foto_url?: string;
};

type MonitoringType = {
  today: string;
  statusTim: Array<{
    id: number;
    nama: string;
    divisi: string;
    sudah_input: boolean;
    jumlah_input: number;
    rata_persen: number;
  }>;
  tren7Hari: Array<{
    tanggal: string;
    jumlah_laporan: number;
    rata_persen: number;
  }>;
};

const NAV_ITEMS = [
  { id: "home", label: "Dashboard", Icon: Home },
  { id: "projects", label: "Proyek", Icon: FolderKanban },
  { id: "input", label: "Input", Icon: PlusCircle },
  { id: "reports", label: "Laporan", Icon: FileText },
  { id: "profile", label: "Profil", Icon: User },
] as const;

const SPRING = { type: "spring" as const, stiffness: 380, damping: 32 };

export default function ProductivierApp() {
  const [user, setUser] = useState<UserType | null>(null);
  const [tab, setTab] = useState<"home" | "projects" | "input" | "reports" | "profile">("home");
  const [viewMode, setViewMode] = useState<"pribadi" | "tim">("tim");
  const [projects, setProjects] = useState<ProjectType[]>([]);
  const [realisasi, setRealisasi] = useState<RealisasiType[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [monitoring, setMonitoring] = useState<MonitoringType | null>(null);
  const [toast, setToast] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [uName, setUName] = useState("");
  const [uPass, setUPass] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2600);
  };

  const loadAll = async (activeUser: UserType) => {
    const [pRes, rRes] = await Promise.all([
      fetch("/api/projects").then((r) => r.json()),
      fetch(`/api/realisasi?user_id=${activeUser.id}&role=${activeUser.role}`).then((r) => r.json()),
    ]);
    setProjects(pRes.projects || []);
    setRealisasi(rRes.realisasi || []);

    if (activeUser.role === "admin") {
      const [uRes, mRes] = await Promise.all([
        fetch("/api/users").then((r) => r.json()),
        fetch("/api/monitoring").then((r) => r.json()),
      ]);
      setUsers(uRes.users || []);
      setMonitoring(mRes);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem("prod_next_user");
    if (saved) {
      const parsed = JSON.parse(saved) as UserType;
      Promise.resolve().then(() => {
        setUser(parsed);
        loadAll(parsed);
      });
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErr("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: uName, password: uPass }),
    });
    const data = await res.json();
    if (!res.ok) {
      setLoginErr(data.error || "Username atau password salah");
      return;
    }
    setUser(data.user);
    localStorage.setItem("prod_next_user", JSON.stringify(data.user));
    loadAll(data.user);
  };

  const handleLogout = () => {
    localStorage.removeItem("prod_next_user");
    setUser(null);
    setTab("home");
  };

  if (!user) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-5">
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={SPRING}
          className="w-full max-w-sm bg-white/95 backdrop-blur-md border border-black/5 rounded-3xl p-7 shadow-[0_20px_50px_rgb(0,0,0,0.06)]"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-[#111827] text-[#FDE047] grid place-items-center shadow-xs">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight block leading-none">Productivier</span>
              <span className="text-[11px] font-medium text-[#6B7280] tracking-wider uppercase">Workspace Tim</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Masuk Akun</h1>
          <p className="text-sm text-[#6B7280] mb-6">Catat realisasi harian & pantau progres proyek dalam satu tempat.</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#4B5563] mb-1.5">Username</label>
              <input
                type="text"
                required
                value={uName}
                onChange={(e) => setUName(e.target.value)}
                placeholder="Masukkan username"
                className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 bg-[#FAF9F6] text-base sm:text-sm focus:bg-white focus:outline-none focus:border-[#111827] transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#4B5563] mb-1.5">Password</label>
              <input
                type="password"
                required
                value={uPass}
                onChange={(e) => setUPass(e.target.value)}
                placeholder="Masukkan password"
                className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 bg-[#FAF9F6] text-base sm:text-sm focus:bg-white focus:outline-none focus:border-[#111827] transition"
              />
            </div>
            {loginErr && (
              <div className="px-3 py-2 rounded-xl bg-[#FEE2E2] text-[#B91C1C] text-xs font-medium">
                {loginErr}
              </div>
            )}
            <button
              type="submit"
              className="w-full min-h-[46px] rounded-xl bg-[#111827] text-white font-semibold text-sm hover:bg-[#1F2937] active:scale-[0.98] transition"
            >
              Masuk ke Dashboard
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  const activeProjects = projects.filter((p) => p.status === "aktif").length;

  return (
    <div className="min-h-dvh pb-24 md:pb-10">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.95 }}
            className="fixed top-5 right-5 z-50 bg-[#111827] text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-lg"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* DESKTOP TOP NAVBAR (Exact Lisso Style) */}
      <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-black/5">
        <div className="max-w-6xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-4">
          {/* Left: Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#111827] text-white grid place-items-center">
              <BarChart3 className="w-4 h-4" />
            </div>
            <span className="font-bold text-base tracking-tight">Productivier</span>
          </div>

          {/* Center: Horizontal Navigation Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map(({ id, label }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`relative px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    active ? "text-[#111827]" : "text-[#6B7280] hover:text-[#111827]"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="top-nav-pill"
                      transition={SPRING}
                      className="absolute inset-0 bg-[#F3EFE8] rounded-full"
                    />
                  )}
                  <span className="relative z-10">{label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right: Mode Switcher (Pribadi | Tim) + Bell/Logout */}
          <div className="flex items-center gap-2.5">
            <div className="inline-flex bg-[#F3EFE8] p-1 rounded-full">
              {(["pribadi", "tim"] as const).map((m) => {
                const isAct = viewMode === m;
                return (
                  <button
                    key={m}
                    onClick={() => setViewMode(m)}
                    className={`relative px-3.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                      isAct ? "text-white" : "text-[#6B7280] hover:text-[#111827]"
                    }`}
                  >
                    {isAct && (
                      <motion.span
                        layoutId="mode-switcher-pill"
                        transition={SPRING}
                        className="absolute inset-0 bg-[#111827] rounded-full"
                      />
                    )}
                    <span className="relative z-10 capitalize">{m}</span>
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleLogout}
              title="Keluar"
              className="w-9 h-9 rounded-full bg-[#111827] text-white grid place-items-center hover:opacity-90 transition"
            >
              <Bell className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* MAIN WORKSPACE */}
      <main className="max-w-6xl mx-auto px-4 md:px-8 pt-6">
        {/* Sub-Header Greeting Row (Exact Lisso Style) */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 mb-6 border-b border-black/5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-[#111827] text-[#FDE047] font-bold text-sm grid place-items-center shadow-xs">
              {user.nama.slice(0, 2).toUpperCase()}
            </div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              Halo, {user.nama.split(" ")[0]}!
            </h1>
          </div>

          <div className="hidden md:block text-sm font-medium text-[#111827]">
            {tab === "home" ? "Tugas & Realisasi Hari Ini" : NAV_ITEMS.find((n) => n.id === tab)?.label}
          </div>

          {/* Team Avatar Stack */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#6B7280] font-medium">Tim:</span>
            <div className="flex -space-x-2">
              {(monitoring?.statusTim || [{ id: user.id, nama: user.nama, sudah_input: true }]).slice(0, 3).map((m) => (
                <span
                  key={m.id}
                  title={m.nama}
                  className={`w-7 h-7 rounded-full text-[10px] font-bold grid place-items-center ring-2 ring-white ${
                    m.sudah_input ? "bg-[#0F766E] text-white" : "bg-[#E5E7EB] text-[#374151]"
                  }`}
                >
                  {m.nama.slice(0, 2).toUpperCase()}
                </span>
              ))}
              {monitoring && monitoring.statusTim.length > 3 && (
                <span className="w-7 h-7 rounded-full bg-white text-[#111827] text-[10px] font-bold grid place-items-center ring-2 ring-white border border-black/10">
                  +{monitoring.statusTim.length - 3}
                </span>
              )}
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {tab === "home" && (
              <HomeTab
                user={user}
                viewMode={viewMode}
                activeProjects={activeProjects}
                projects={projects}
                realisasi={realisasi}
                monitoring={monitoring}
                onGoProjects={() => setTab("projects")}
                onGoInput={() => setTab("input")}
                onGoReports={() => setTab("reports")}
                showToast={showToast}
              />
            )}

            {tab === "projects" && (
              <ProjectsTab
                user={user}
                users={users}
                projects={projects}
                onRefresh={() => loadAll(user)}
                showToast={showToast}
              />
            )}

            {tab === "input" && (
              <InputTab
                user={user}
                projects={projects}
                onSaved={async () => {
                  await loadAll(user);
                  showToast("Realisasi tersimpan");
                  setTab("home");
                }}
              />
            )}

            {tab === "reports" && <ReportsTab realisasi={realisasi} showToast={showToast} />}

            {tab === "profile" && (
              <ProfileTab
                user={user}
                users={users}
                onUserUpdated={(updated) => {
                  setUser(updated);
                  localStorage.setItem("prod_next_user", JSON.stringify(updated));
                  showToast("Profil diperbarui");
                }}
                onRefresh={() => loadAll(user)}
                showToast={showToast}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-black/5 z-40">
        <div className="flex justify-around py-1.5 px-1">
          {NAV_ITEMS.map(({ id, label, Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`relative flex flex-col items-center justify-center gap-0.5 min-h-[46px] min-w-[60px] rounded-xl px-2.5 transition-colors ${
                  active ? "text-[#111827]" : "text-[#6B7280]"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="mobile-nav-pill"
                    transition={SPRING}
                    className="absolute inset-0 bg-[#FDE047]/40 rounded-xl"
                  />
                )}
                <Icon className="relative z-10 w-5 h-5" />
                <span className="relative z-10 text-[11px] font-semibold">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function HomeTab({
  user,
  viewMode,
  activeProjects,
  projects,
  realisasi,
  monitoring,
  onGoProjects,
  onGoInput,
  onGoReports,
  showToast,
}: {
  user: UserType;
  viewMode: "pribadi" | "tim";
  activeProjects: number;
  projects: ProjectType[];
  realisasi: RealisasiType[];
  monitoring: MonitoringType | null;
  onGoProjects: () => void;
  onGoInput: () => void;
  onGoReports: () => void;
  showToast: (m: string) => void;
}) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");

  const visibleRealisasi = useMemo(() => {
    let list = realisasi;
    if (viewMode === "pribadi") {
      list = list.filter((r) => r.user_id === user.id);
    }
    if (selectedProjectId !== "all") {
      list = list.filter((r) => String(r.project_id) === selectedProjectId);
    }
    return list;
  }, [realisasi, viewMode, user.id, selectedProjectId]);

  const heroPct = useMemo(() => {
    if (!visibleRealisasi.length) return 0;
    return Math.round(visibleRealisasi.reduce((a, b) => a + b.persentase, 0) / visibleRealisasi.length);
  }, [visibleRealisasi]);

  const copyQuickWA = () => {
    const lines = visibleRealisasi
      .slice(0, 10)
      .map((r) => `- ${r.nama}: ${r.aktivitas} (${r.realisasi}/${r.target} ${r.satuan} = ${r.persentase}%)`);
    navigator.clipboard.writeText(`*REKAP HARIAN*\n${lines.join("\n")}`);
    showToast("Rekap WA disalin");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* LEFT COLUMN (Lisso Style: Project Selector + Giant 85% + Butter Yellow Activity Card) */}
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-white/75 backdrop-blur-md border border-black/5 rounded-2xl p-3 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#FEF08A] text-[#854D0E] grid place-items-center shrink-0">
            <FolderKanban className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="w-full bg-transparent text-sm font-bold text-[#111827] focus:outline-none cursor-pointer truncate"
            >
              <option value="all">Semua Proyek ({projects.length})</option>
              {projects.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.nama_proyek}
                </option>
              ))}
            </select>
            <div className="text-[11px] text-[#6B7280] truncate">Progres & Realisasi Tim</div>
          </div>
        </div>

        <motion.div
          key={`${viewMode}-${selectedProjectId}`}
          initial={{ opacity: 0.4, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={SPRING}
          className="px-1"
        >
          <div className="text-7xl font-normal tracking-tighter tabular-nums leading-none text-[#111827]">
            {heroPct}%
          </div>
          <div className="text-sm text-[#4B5563] mt-2 font-medium">
            {viewMode === "pribadi" ? "Produktivitas pribadi" : "Produktivitas tim hari ini"}
          </div>
        </motion.div>

        {/* Butter Yellow Highlight Card + Floating White Pencil Button */}
        <motion.div
          layout
          transition={SPRING}
          className="relative bg-[#FCD34D] rounded-3xl p-5 pb-8 shadow-[0_12px_32px_rgb(252,211,77,0.3)] text-[#111827]"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold">Aktivitas Proyek</span>
            <span className="px-2.5 py-0.5 rounded-full bg-[#4F46E5] text-white text-[10px] font-semibold">
              Statistik
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <div className="text-2xl font-semibold tabular-nums">{visibleRealisasi.length}</div>
              <div className="text-[11px] text-[#111827]/75">Laporan</div>
            </div>
            <div>
              <div className="text-2xl font-semibold tabular-nums">{activeProjects}</div>
              <div className="text-[11px] text-[#111827]/75">Proyek</div>
            </div>
            <div>
              <div className="text-2xl font-semibold tabular-nums">
                {monitoring ? monitoring.statusTim.filter((u) => !u.sudah_input).length : 0}
              </div>
              <div className="text-[11px] text-[#111827]/75">Belum Input</div>
            </div>
          </div>
          <button
            onClick={onGoInput}
            title="Input Realisasi Baru"
            className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-white text-[#111827] shadow-md border border-black/5 grid place-items-center hover:scale-105 active:scale-95 transition"
          >
            <Pencil className="w-4 h-4" />
          </button>
        </motion.div>
      </div>

      {/* CENTER COLUMN (Stacked White Realisasi Cards) */}
      <div className="lg:col-span-5 space-y-4">
        <AnimatePresence mode="popLayout">
          {visibleRealisasi.slice(0, 3).map((r) => (
            <motion.div
              key={r.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={SPRING}
              className="bg-white rounded-3xl p-5 shadow-[0_8px_24px_rgb(0,0,0,0.04)] border border-black/5 space-y-4"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <BarChart3 className="w-4 h-4 text-[#111827] shrink-0" />
                  <h3 className="font-semibold text-base truncate">{r.aktivitas}</h3>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold shrink-0 tabular-nums ${
                    r.persentase >= 100
                      ? "bg-[#34D399]/20 text-[#065F46]"
                      : r.persentase >= 70
                      ? "bg-[#FDE047]/40 text-[#854D0E]"
                      : "bg-[#EF4444]/15 text-[#B91C1C]"
                  }`}
                >
                  {r.persentase >= 100 ? "Tercapai" : `${r.persentase}%`}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-[11px] text-[#6B7280] block">Pelaksana:</span>
                  <strong className="font-medium text-[#111827]">{r.nama.split(" ")[0]}</strong>
                </div>
                <div>
                  <span className="text-[11px] text-[#6B7280] block">Proyek:</span>
                  <strong className="font-medium text-[#111827] truncate block">{r.nama_proyek || "-"}</strong>
                </div>
                <div>
                  <span className="text-[11px] text-[#6B7280] block">Capaian:</span>
                  <strong className="font-medium text-[#111827] tabular-nums">
                    {r.realisasi}/{r.target} {r.satuan}
                  </strong>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-black/5">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#111827] text-[#FDE047] text-[10px] font-bold grid place-items-center">
                    {r.nama.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="text-[11px] text-[#6B7280] tabular-nums">{r.tanggal}</span>
                </div>
                <button
                  onClick={onGoReports}
                  className="px-4 py-1.5 rounded-full bg-[#111827] text-white text-xs font-medium hover:opacity-90 transition"
                >
                  Lihat Detail
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {visibleRealisasi.length === 0 && (
          <div className="bg-white/90 border border-black/5 rounded-3xl p-6 text-center space-y-3">
            <p className="text-sm font-semibold">Belum ada realisasi hari ini</p>
            <button
              onClick={onGoInput}
              className="px-4 py-2 rounded-full bg-[#111827] text-white text-xs font-semibold"
            >
              + Catat Realisasi Pertama
            </button>
          </div>
        )}
      </div>

      {/* RIGHT COLUMN (Quick Requests + Team Status Card) */}
      <div className="lg:col-span-3 space-y-5">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Aksi Cepat</span>
            <button onClick={onGoInput} className="text-xs font-medium text-[#4B5563] hover:text-[#111827]">
              + Set Tugas
            </button>
          </div>
          <div className="divide-y divide-black/10 text-xs">
            <button
              onClick={copyQuickWA}
              className="w-full py-3 flex items-center justify-between text-left hover:text-[#0F766E] transition"
            >
              <span className="font-medium leading-snug pr-2">Salin ringkasan realisasi tim untuk WhatsApp</span>
              <Play className="w-3 h-3 fill-current shrink-0" />
            </button>
            <button
              onClick={onGoReports}
              className="w-full py-3 flex items-center justify-between text-left hover:text-[#0F766E] transition"
            >
              <span className="font-medium leading-snug pr-2">Unduh laporan lengkap format CSV Excel</span>
              <Play className="w-3 h-3 fill-current shrink-0" />
            </button>
            <button
              onClick={onGoProjects}
              className="w-full py-3 flex items-center justify-between text-left hover:text-[#0F766E] transition"
            >
              <span className="font-medium leading-snug pr-2">Pantau progres & target semua proyek</span>
              <Play className="w-3 h-3 fill-current shrink-0" />
            </button>
          </div>
        </div>

        {/* Bottom Right Highlight Card (Lisso Voice Tasks equivalent -> Status Tim) */}
        {monitoring && (
          <div className="relative bg-white/85 backdrop-blur-md border border-black/5 rounded-3xl p-5 pb-8 shadow-xs space-y-3">
            <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#4F46E5] text-white text-[10px] font-semibold">
              Status Tim
            </span>
            <div className="text-base font-semibold leading-snug">
              {monitoring.statusTim.filter((u) => u.sudah_input).length} dari {monitoring.statusTim.length} anggota sudah input
            </div>
            <div className="space-y-1.5">
              {monitoring.statusTim.slice(0, 3).map((u) => (
                <div key={u.id} className="flex items-center justify-between text-[11px]">
                  <span className="truncate font-medium">{u.nama}</span>
                  {u.sudah_input ? (
                    <span className="text-[#065F46] font-semibold inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> {u.rata_persen}%
                    </span>
                  ) : (
                    <span className="text-[#B91C1C] font-semibold inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Belum
                    </span>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={onGoReports}
              title="Lihat Semua Laporan"
              className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-white text-[#111827] shadow-md border border-black/5 grid place-items-center hover:scale-105 transition"
            >
              <Users className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectsTab({
  user,
  users,
  projects,
  onRefresh,
  showToast,
}: {
  user: UserType;
  users: UserType[];
  projects: ProjectType[];
  onRefresh: () => Promise<void>;
  showToast: (m: string) => void;
}) {
  const [nama, setNama] = useState("");
  const [picId, setPicId] = useState(users[0]?.id ? String(users[0].id) : "");
  const [divisi, setDivisi] = useState("Operasional");
  const [target, setTarget] = useState("100");
  const [satuan, setSatuan] = useState("Tugas");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nama_proyek: nama,
        pic_id: picId || user.id,
        divisi,
        target_total: Number(target),
        satuan,
      }),
    });
    setNama("");
    showToast("Proyek ditambahkan");
    await onRefresh();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {user.role === "admin" && (
        <div className="lg:col-span-5 bg-white/95 border border-black/5 rounded-3xl p-5 h-fit shadow-xs">
          <h2 className="font-bold text-base mb-1">Buat Proyek Baru</h2>
          <p className="text-xs text-[#6B7280] mb-4">Tentukan PIC dan total target capaian proyek.</p>
          <form onSubmit={handleCreate} className="space-y-3">
            <input
              required
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Nama proyek (misal: Produksi Konten)"
              className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 bg-[#FAF9F6] text-base sm:text-sm"
            />
            <div className="grid grid-cols-2 gap-2.5">
              <select
                value={picId}
                onChange={(e) => setPicId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-black/10 text-base sm:text-sm bg-white"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nama}
                  </option>
                ))}
              </select>
              <input
                required
                value={divisi}
                onChange={(e) => setDivisi(e.target.value)}
                placeholder="Divisi"
                className="w-full px-3 py-2.5 rounded-xl border border-black/10 text-base sm:text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <input
                type="number"
                required
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="Target Total"
                className="w-full px-3 py-2.5 rounded-xl border border-black/10 text-base sm:text-sm"
              />
              <input
                required
                value={satuan}
                onChange={(e) => setSatuan(e.target.value)}
                placeholder="Satuan"
                className="w-full px-3 py-2.5 rounded-xl border border-black/10 text-base sm:text-sm"
              />
            </div>
            <button
              type="submit"
              className="w-full min-h-[44px] rounded-xl bg-[#111827] text-white font-semibold text-sm"
            >
              Simpan Proyek
            </button>
          </form>
        </div>
      )}

      <div className={`${user.role === "admin" ? "lg:col-span-7" : "lg:col-span-12"} bg-white/95 border border-black/5 rounded-3xl p-5 shadow-xs`}>
        <h2 className="font-bold text-base mb-3">Daftar Proyek ({projects.length})</h2>
        <div className="divide-y divide-black/5">
          {projects.map((p) => (
            <div key={p.id} className="py-3.5">
              <div className="flex items-center justify-between gap-2">
                <strong className="text-sm">{p.nama_proyek}</strong>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#CCFBF1] text-[#115E59] tabular-nums">
                  {p.persentase}%
                </span>
              </div>
              <div className="text-xs text-[#6B7280] mt-1 tabular-nums">
                PIC: {p.pic_nama || "-"} · {p.divisi} · {p.total_realisasi}/{p.target_total} {p.satuan} ({p.jumlah_laporan} laporan)
              </div>
              <div className="w-full h-2 bg-[#F5F1EB] rounded-full overflow-hidden mt-2.5">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${p.persentase}%` }}
                  transition={SPRING}
                  className="h-full bg-[#111827] rounded-full"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InputTab({
  user,
  projects,
  onSaved,
}: {
  user: UserType;
  projects: ProjectType[];
  onSaved: () => Promise<void>;
}) {
  const [projectId, setProjectId] = useState(projects[0]?.id ? String(projects[0].id) : "");
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [aktivitas, setAktivitas] = useState("");
  const [target, setTarget] = useState("");
  const [realisasi, setRealisasi] = useState("");
  const [satuan, setSatuan] = useState("Tugas");
  const [kendala, setKendala] = useState("");
  const [solusi, setSolusi] = useState("");
  const [foto, setFoto] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/realisasi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: projectId,
        user_id: user.id,
        nama: user.nama,
        divisi: user.divisi,
        tanggal,
        aktivitas,
        target: Number(target),
        realisasi: Number(realisasi),
        satuan,
        kendala,
        solusi,
        bukti_foto_url: foto,
      }),
    });
    await onSaved();
  };

  return (
    <div className="max-w-2xl bg-white/95 border border-black/5 rounded-3xl p-6 shadow-xs">
      <h2 className="font-bold text-base">Form Input Realisasi Harian</h2>
      <p className="text-xs text-[#6B7280] mb-5">Capaian otomatis menambah progress bar proyek terkait.</p>
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[#4B5563] mb-1">Proyek</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-base sm:text-sm bg-white"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nama_proyek} ({p.satuan})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#4B5563] mb-1">Tanggal</label>
            <input
              type="date"
              required
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-base sm:text-sm"
            />
          </div>
        </div>
        <input
          required
          value={aktivitas}
          onChange={(e) => setAktivitas(e.target.value)}
          placeholder="Aktivitas / Pekerjaan hari ini"
          className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-base sm:text-sm"
        />
        <div className="grid grid-cols-3 gap-3">
          <input
            type="number"
            step="any"
            required
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="Target"
            className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-base sm:text-sm"
          />
          <input
            type="number"
            step="any"
            required
            value={realisasi}
            onChange={(e) => setRealisasi(e.target.value)}
            placeholder="Realisasi"
            className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-base sm:text-sm"
          />
          <input
            required
            value={satuan}
            onChange={(e) => setSatuan(e.target.value)}
            placeholder="Satuan"
            className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-base sm:text-sm"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            value={kendala}
            onChange={(e) => setKendala(e.target.value)}
            placeholder="Kendala (opsional)"
            className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-base sm:text-sm"
          />
          <input
            value={solusi}
            onChange={(e) => setSolusi(e.target.value)}
            placeholder="Solusi (opsional)"
            className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-base sm:text-sm"
          />
        </div>
        <input
          type="url"
          value={foto}
          onChange={(e) => setFoto(e.target.value)}
          placeholder="Link bukti foto Cloudinary (opsional)"
          className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-base sm:text-sm"
        />
        <button
          type="submit"
          className="w-full min-h-[46px] rounded-xl bg-[#111827] text-white font-semibold text-sm hover:opacity-95 transition"
        >
          Simpan Realisasi
        </button>
      </form>
    </div>
  );
}

function ReportsTab({
  realisasi,
  showToast,
}: {
  realisasi: RealisasiType[];
  showToast: (m: string) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return realisasi;
    const q = query.toLowerCase();
    return realisasi.filter(
      (r) =>
        r.aktivitas.toLowerCase().includes(q) ||
        r.nama.toLowerCase().includes(q) ||
        (r.nama_proyek || "").toLowerCase().includes(q)
    );
  }, [realisasi, query]);

  const copyWA = () => {
    const lines = filtered
      .slice(0, 15)
      .map((r) => `- ${r.tanggal} | ${r.nama}: ${r.aktivitas} (${r.realisasi}/${r.target} ${r.satuan} = ${r.persentase}%)`);
    navigator.clipboard.writeText(`*REKAP REALISASI TIM*\n${lines.join("\n")}`);
    showToast("Rekap WA disalin");
  };

  const exportCSV = () => {
    const header = ["Tanggal", "Nama", "Divisi", "Proyek", "Aktivitas", "Target", "Realisasi", "Satuan", "Persentase", "Status"];
    const rows = filtered.map((r) => [
      r.tanggal, r.nama, r.divisi, r.nama_proyek || "-", r.aktivitas, r.target, r.realisasi, r.satuan, `${r.persentase}%`, r.status,
    ]);
    const csv = [header, ...rows].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `rekap-realisasi-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    showToast("CSV diunduh");
  };

  return (
    <div className="bg-white/95 border border-black/5 rounded-3xl p-5 space-y-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-bold text-base">Laporan Realisasi ({filtered.length})</h2>
          <p className="text-xs text-[#6B7280]">Salin rekap cepat ke WhatsApp atau unduh CSV untuk Excel.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copyWA}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-black/10 text-xs font-semibold hover:bg-[#F5F1EB]"
          >
            <Copy className="w-3.5 h-3.5" /> Copy WA
          </button>
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#111827] text-white text-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-[#6B7280] absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari aktivitas, nama anggota, atau nama proyek..."
          className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-black/10 bg-[#FAF9F6] text-xs focus:bg-white focus:outline-none focus:border-[#111827]"
        />
      </div>

      <div className="divide-y divide-black/5">
        {filtered.map((r) => (
          <div key={r.id} className="py-3">
            <div className="flex items-center justify-between gap-2">
              <strong className="text-sm">{r.aktivitas}</strong>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#CCFBF1] text-[#115E59] tabular-nums shrink-0">
                {r.persentase}%
              </span>
            </div>
            <div className="text-xs text-[#6B7280] mt-1 tabular-nums">
              {r.tanggal} · {r.nama} ({r.divisi}) · Proyek: {r.nama_proyek || "-"} · {r.realisasi}/{r.target} {r.satuan}
            </div>
            {r.bukti_foto_url && (
              <a
                href={r.bukti_foto_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0F766E] mt-1"
              >
                Lihat Bukti Foto <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        ))}
        {filtered.length === 0 && <p className="text-xs text-[#6B7280] py-4">Belum ada data realisasi.</p>}
      </div>
    </div>
  );
}

function ProfileTab({
  user,
  users,
  onUserUpdated,
  onRefresh,
  showToast,
}: {
  user: UserType;
  users: UserType[];
  onUserUpdated: (u: UserType) => void;
  onRefresh: () => Promise<void>;
  showToast: (m: string) => void;
}) {
  const [nama, setNama] = useState(user.nama);
  const [divisi, setDivisi] = useState(user.divisi);
  const [pass, setPass] = useState("");

  const [newUser, setNewUser] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newNama, setNewNama] = useState("");
  const [newDivisi, setNewDivisi] = useState("Operasional");
  const [newRole, setNewRole] = useState<"karyawan" | "admin">("karyawan");

  const saveMe = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actor_id: user.id,
        actor_role: user.role,
        nama,
        divisi,
        password: pass,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      setPass("");
      onUserUpdated(data.user);
    }
  };

  const createMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: newUser,
        password: newPass,
        nama: newNama,
        divisi: newDivisi,
        role: newRole,
      }),
    });
    if (res.ok) {
      setNewUser("");
      setNewPass("");
      setNewNama("");
      showToast("Akun tim dibuat");
      await onRefresh();
    }
  };

  const deleteMember = async (id: number) => {
    await fetch(`/api/users/${id}`, { method: "DELETE" });
    showToast("Akun dihapus");
    await onRefresh();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      <div className="lg:col-span-5 bg-white/95 border border-black/5 rounded-3xl p-5 h-fit shadow-xs">
        <h2 className="font-bold text-base mb-1">Edit Profil Saya</h2>
        <p className="text-xs text-[#6B7280] mb-4">Perbarui nama tampilan, divisi, atau password akun Anda.</p>
        <form onSubmit={saveMe} className="space-y-3">
          <input
            required
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            placeholder="Nama Lengkap"
            className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-base sm:text-sm"
          />
          <input
            required
            value={divisi}
            onChange={(e) => setDivisi(e.target.value)}
            placeholder="Divisi"
            className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-base sm:text-sm"
          />
          <input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="Password baru (kosongkan jika tidak diubah)"
            className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-base sm:text-sm"
          />
          <button
            type="submit"
            className="w-full min-h-[44px] rounded-xl bg-[#111827] text-white font-semibold text-sm"
          >
            Simpan Profil
          </button>
        </form>
      </div>

      {user.role === "admin" && (
        <div className="lg:col-span-7 space-y-5">
          <div className="bg-white/95 border border-black/5 rounded-3xl p-5 shadow-xs">
            <h2 className="font-bold text-base mb-1">Panel Admin: Buat Akun Tim</h2>
            <p className="text-xs text-[#6B7280] mb-4">Daftarkan username & password untuk anggota tim baru.</p>
            <form onSubmit={createMember} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input
                  required
                  value={newUser}
                  onChange={(e) => setNewUser(e.target.value)}
                  placeholder="Username"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-base sm:text-sm"
                />
                <input
                  required
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="Password"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-base sm:text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  required
                  value={newNama}
                  onChange={(e) => setNewNama(e.target.value)}
                  placeholder="Nama Lengkap"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-base sm:text-sm"
                />
                <input
                  required
                  value={newDivisi}
                  onChange={(e) => setNewDivisi(e.target.value)}
                  placeholder="Divisi"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-base sm:text-sm"
                />
              </div>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as "karyawan" | "admin")}
                className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-base sm:text-sm bg-white"
              >
                <option value="karyawan">Anggota Tim</option>
                <option value="admin">Admin / Leader</option>
              </select>
              <button
                type="submit"
                className="w-full min-h-[44px] rounded-xl bg-[#0F766E] text-white font-semibold text-sm"
              >
                Buat Akun Tim
              </button>
            </form>
          </div>

          <div className="bg-white/95 border border-black/5 rounded-3xl p-5 shadow-xs">
            <h2 className="font-bold text-base mb-2">Daftar Akun Terdaftar ({users.length})</h2>
            <div className="divide-y divide-black/5">
              {users.map((u) => (
                <div key={u.id} className="flex items-center justify-between py-3 text-xs">
                  <div>
                    <strong className="text-sm">{u.nama}</strong>{" "}
                    <span className="text-[#6B7280]">
                      (@{u.username} · {u.divisi} · {u.role})
                    </span>
                  </div>
                  {u.username !== "fifa" ? (
                    <button
                      onClick={() => deleteMember(u.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#FEE2E2] text-[#B91C1C] font-semibold"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Hapus
                    </button>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full bg-[#CCFBF1] text-[#115E59] font-semibold">
                      Leader Utama
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
