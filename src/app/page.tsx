"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { m, AnimatePresence } from "motion/react";
import {
  Home,
  LayoutGrid,
  Calendar,
  StickyNote,
  Zap,
  FileText,
  User,
  LogOut,
  Search,
  ChevronRight,
  Sparkles,
  X,
  PanelLeft,
  PanelLeftClose,
  Moon,
  Sun,
} from "lucide-react";

import HomeTab from "@/components/dashboard/HomeTab";
import NotificationDropdown from "@/components/notifications/NotificationDropdown";
import CustomSelect, { CustomSelectOption } from "@/components/ui/CustomSelect";
import ProductivierLogo from "@/components/ui/ProductivierLogo";
import { UserType, ProjectType, RealisasiType, MonitoringType, TabType, ViewModeType } from "@/types";
import { MessageSquare } from "lucide-react";

const TabFallback = () => (
  <div className="dashboard-card p-6 md:p-8 animate-pulse space-y-4">
    <div className="h-6 w-44 rounded-xl bg-slate-200/80 dark:bg-slate-800/80" />
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="h-28 rounded-2xl bg-slate-200/60 dark:bg-slate-800/60" />
      <div className="h-28 rounded-2xl bg-slate-200/60 dark:bg-slate-800/60" />
      <div className="h-28 rounded-2xl bg-slate-200/60 dark:bg-slate-800/60" />
    </div>
  </div>
);

const ProjectsTab = dynamic(() => import("@/components/tabs/ProjectsTab"), { loading: TabFallback });
const CalendarTab = dynamic(() => import("@/components/tabs/CalendarTab"), { loading: TabFallback });
const NotesTab = dynamic(() => import("@/components/tabs/NotesTab"), { loading: TabFallback });
const InputTab = dynamic(() => import("@/components/tabs/InputTab"), { loading: TabFallback });
const ReportsTab = dynamic(() => import("@/components/tabs/ReportsTab"), { loading: TabFallback });
const ProfileTab = dynamic(() => import("@/components/tabs/ProfileTab"), { loading: TabFallback });
const ChatTab = dynamic(() => import("@/components/tabs/ChatTab"), { loading: TabFallback });
const FloatingAIAgent = dynamic(() => import("@/components/ai/FloatingAIAgent"), { ssr: false, loading: () => null });

const NAV_ITEMS = [
  { id: "home", label: "Dashboard", shortLabel: "Home", Icon: Home },
  { id: "projects", label: "Proyek", shortLabel: "Proyek", Icon: LayoutGrid },
  { id: "calendar", label: "Kalender", shortLabel: "Agenda", Icon: Calendar },
  { id: "notes", label: "Notes", shortLabel: "Memo", Icon: StickyNote },
  { id: "chat", label: "Chat Tim", shortLabel: "Chat", Icon: MessageSquare },
  { id: "input", label: "Input", shortLabel: "Input", Icon: Zap },
  { id: "reports", label: "Laporan", shortLabel: "Rekap", Icon: FileText },
  { id: "profile", label: "Profil & Tim", shortLabel: "Profil", Icon: User },
] as const;

const SPRING = { type: "spring" as const, stiffness: 420, damping: 32 };

function getDisplayGreetingName(fullName: string): string {
  const clean = (fullName || "").trim();
  if (!clean) return "Rekan";
  if (clean.toLowerCase().startsWith("anggota ")) {
    return clean;
  }
  return clean.split(" ")[0].replace(/[^\w\s-]/g, "") || clean;
}

export default function ProductivierApp() {
  const [user, setUser] = useState<UserType | null>(null);
  const [tab, setTab] = useState<TabType>("home");
  const [viewMode, setViewMode] = useState<ViewModeType>("tim");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [projects, setProjects] = useState<ProjectType[]>([]);
  const [realisasi, setRealisasi] = useState<RealisasiType[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [monitoring, setMonitoring] = useState<MonitoringType | null>(null);
  const [toast, setToast] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [uName, setUName] = useState("");
  const [uPass, setUPass] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");
  const [initialized, setInitialized] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2600);
  };

  const loadAll = async (activeUser: UserType) => {
    try {
      const [pRes, rRes, uRes, mRes] = await Promise.all([
        fetch("/api/projects").then((r) => r.json()),
        fetch(`/api/realisasi?user_id=${activeUser.id}&role=${activeUser.role}`).then((r) => r.json()),
        fetch("/api/users").then((r) => r.json()),
        fetch("/api/monitoring").then((r) => r.json()),
      ]);
      setProjects(pRes.projects || []);
      setRealisasi(rRes.realisasi || []);
      setUsers(uRes.users || []);
      setMonitoring(mRes || null);
    } catch (e) {
      console.error("Gagal memuat data", e);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const bootstrapSession = async () => {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        if (params.get("sidebar") === "open") {
          setSidebarOpen(true);
        }
        const requestedTab = params.get("tab") as TabType;
        if (requestedTab && ["home", "projects", "calendar", "notes", "chat", "input", "reports", "profile"].includes(requestedTab)) {
          setTab(requestedTab);
        }
        const savedDark = localStorage.getItem("productivier_dark_mode") === "1";
        if (savedDark) {
          document.documentElement.classList.add("dark");
          setIsDarkMode(true);
        }
      }
      try {
        const res = await fetch("/api/login", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled && data?.user) {
            setUser(data.user);
            localStorage.setItem("prod_next_user", JSON.stringify(data.user));
            await loadAll(data.user);
            setInitialized(true);
            return;
          }
        }
      } catch {
        // Ignore network error during bootstrap
      }
      if (!cancelled) {
        localStorage.removeItem("prod_next_user");
        setUser(null);
        setInitialized(true);
      }
    };
    bootstrapSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  const handleToggleDarkMode = (dark: boolean) => {
    setIsDarkMode(dark);
    if (typeof window !== "undefined") {
      localStorage.setItem("productivier_dark_mode", dark ? "1" : "0");
    }
  };

  useEffect(() => {
    const handleRefresh = () => {
      if (user) {
        loadAll(user);
      }
    };
    window.addEventListener("productivier:refresh_data", handleRefresh);
    return () => {
      window.removeEventListener("productivier:refresh_data", handleRefresh);
    };
  }, [user]);

  const handleLogin = async (e?: React.FormEvent, customUser?: { u: string; p: string }) => {
    if (e) e.preventDefault();
    setLoginErr("");
    const loginUser = customUser ? customUser.u : uName;
    const loginPass = customUser ? customUser.p : uPass;

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: loginUser, password: loginPass }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginErr(data.error || "Username atau password salah");
        return;
      }
      setUser(data.user);
      localStorage.setItem("prod_next_user", JSON.stringify(data.user));
      loadAll(data.user);
      showToast(`Selamat datang, ${data.user.nama}`);
    } catch {
      setLoginErr("Gagal menghubungi server");
    }
  };

  const navigateWithContext = (
    targetTab: string,
    extra?: { groupId?: number; projectId?: number }
  ) => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", targetTab);

      if (extra?.projectId) {
        url.searchParams.set("project_id", String(extra.projectId));
        if (targetTab === "notes") {
          sessionStorage.setItem("productivier_notes_project_id", String(extra.projectId));
        } else if (targetTab === "calendar") {
          sessionStorage.setItem("productivier_calendar_project_id", String(extra.projectId));
        } else if (targetTab === "chat") {
          sessionStorage.setItem("productivier_chat_project_id", String(extra.projectId));
        }
      } else if (targetTab !== "projects" && targetTab !== "notes" && targetTab !== "calendar") {
        url.searchParams.delete("project_id");
      }

      if (extra?.groupId) {
        sessionStorage.setItem("productivier_chat_group_id", String(extra.groupId));
        url.searchParams.set("group", String(extra.groupId));
      } else if (targetTab !== "chat") {
        url.searchParams.delete("group");
      }

      window.history.pushState(null, "", url.toString());

      if (extra?.projectId) {
        window.dispatchEvent(
          new CustomEvent("productivier:open_project", {
            detail: { projectId: Number(extra.projectId) },
          })
        );
      }
      if (extra?.groupId) {
        window.dispatchEvent(
          new CustomEvent("productivier:open_chat_group", {
            detail: { groupId: Number(extra.groupId) },
          })
        );
      }
    }
    setTab(targetTab as TabType);
  };

  const handleSelectNavTab = (targetTab: TabType) => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", targetTab);
      url.searchParams.delete("project_id");
      url.searchParams.delete("group");
      window.history.pushState(null, "", url.toString());
      if (targetTab === "projects") {
        window.dispatchEvent(new CustomEvent("productivier:reset_project_selection"));
      }
    }
    setTab(targetTab);
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/login", { method: "DELETE" });
    } catch {
      // Ignore network error on logout
    }
    localStorage.removeItem("prod_next_user");
    setUser(null);
    setMonitoring(null);
    setProjects([]);
    setRealisasi([]);
    setUsers([]);
    setTab("home");
    showToast("Anda telah keluar akun");
  };

  const filteredSearchResults = useMemo(() => {
    if (!searchQuery.trim()) return { projects: [], tasks: [] };
    const q = searchQuery.toLowerCase();
    const p = projects.filter(
      (item) => item.nama_proyek.toLowerCase().includes(q) || item.divisi.toLowerCase().includes(q)
    );
    const t = realisasi.filter(
      (item) =>
        item.aktivitas.toLowerCase().includes(q) ||
        (item.nama_proyek && item.nama_proyek.toLowerCase().includes(q)) ||
        item.nama.toLowerCase().includes(q)
    );
    return { projects: p.slice(0, 4), tasks: t.slice(0, 5) };
  }, [searchQuery, projects, realisasi]);

  const projectFilterOptions: CustomSelectOption[] = [
    { value: "all", label: `Semua Proyek (${projects.length})` },
    ...projects.map((p) => ({
      value: String(p.id),
      label: p.nama_proyek,
      subLabel: `${p.divisi} · ${p.persentase}%`,
    })),
  ];

  if (!initialized) {
    return (
      <div className="min-h-screen bg-dashboard-gradient flex items-center justify-center p-4">
        <div className="w-10 h-10 rounded-full border-2 border-slate-900 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-dashboard-gradient flex items-center justify-center p-4 sm:p-6 select-none antialiased">
        <m.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={SPRING}
          className="w-full max-w-md dashboard-card p-8 sm:p-10 dark:text-slate-100"
        >
          {/* Custom SVG Logo & Header */}
          <div className="flex items-center gap-3.5 mb-8">
            <ProductivierLogo size={44} />
            <div>
              <span className="font-extrabold text-xl tracking-tight block text-slate-900 dark:text-white leading-tight">
                Productivier
              </span>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 tracking-wider uppercase">
                Team Workspace
              </span>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2">
            Masuk Akun
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-8 font-medium">
            Kelola produktivitas harian, kalender agenda, memo to-do, dan asisten AI.
          </p>

          <form onSubmit={(e) => handleLogin(e)} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Username
              </label>
              <input
                type="text"
                required
                value={uName}
                onChange={(e) => setUName(e.target.value)}
                placeholder="Masukkan username"
                className="w-full px-4 py-3 rounded-2xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/70 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Password
              </label>
              <input
                type="password"
                required
                value={uPass}
                onChange={(e) => setUPass(e.target.value)}
                placeholder="Masukkan password"
                className="w-full px-4 py-3 rounded-2xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200/70 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition"
              />
            </div>

            {loginErr && (
              <div className="px-4 py-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs font-semibold border border-red-200/80 dark:border-red-800">
                {loginErr}
              </div>
            )}

            <button
              type="submit"
              className="w-full min-h-[48px] rounded-full bg-[#1C1D21] hover:bg-black text-white font-semibold text-sm shadow-lg shadow-black/10 active:scale-[0.98] transition mt-2 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Masuk ke Dashboard</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </form>
        </m.div>
      </div>
    );
  }

  const activeProjectsCount = projects.filter((p) => p.status === "aktif").length;
  const modeFilteredRealisasi = realisasi.filter((r) =>
    viewMode === "pribadi" ? r.user_id === user.id || r.assigned_to_user_id === user.id : true
  );
  const visibleRealisasi = modeFilteredRealisasi.filter((r) =>
    selectedProjectId === "all" ? true : String(r.project_id) === selectedProjectId
  );

  const totalTasksDone = visibleRealisasi.length;
  const completionPercentage = visibleRealisasi.length
    ? Math.round(visibleRealisasi.reduce((a, b) => a + b.persentase, 0) / visibleRealisasi.length)
    : 0;

  return (
    <div className="min-h-screen bg-radial from-[#D6DCF2] via-[#ECEEF3] to-[#F4F5F8] dark:from-[#161925] dark:via-[#0F1117] dark:to-[#090B10] text-[#18181B] dark:text-slate-100 flex flex-col antialiased">
      {/* GLOBAL TOAST */}
      <AnimatePresence>
        {toast && (
          <m.div
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            className="fixed bottom-24 md:bottom-6 left-1/2 -translate-x-1/2 z-[80] max-w-[calc(100vw-32px)] bg-[#1C1D21] dark:bg-white text-white dark:text-slate-900 text-xs font-semibold px-5 py-3 rounded-full shadow-xl flex items-center gap-2 border border-white/10 dark:border-black/10"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#D2F27C] dark:text-purple-600 shrink-0" />
            <span className="truncate">{toast}</span>
          </m.div>
        )}
      </AnimatePresence>

      {/* SEARCH MODAL */}
      <AnimatePresence>
        {searchOpen && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-start justify-center pt-20 px-4"
            onClick={() => setSearchOpen(false)}
          >
            <m.div
              initial={{ scale: 0.96, y: -10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: -10 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg dashboard-card p-6 shadow-2xl dark:text-slate-100"
            >
              <div className="flex items-center gap-3 border-b border-slate-200/80 dark:border-slate-700/80 pb-4">
                <Search className="w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Cari proyek, aktivitas harian, atau anggota tim..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
                />
                <button
                  onClick={() => setSearchOpen(false)}
                  className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 max-h-80 overflow-y-auto space-y-4">
                {filteredSearchResults.projects.length > 0 && (
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                      Proyek
                    </span>
                    <div className="space-y-1.5">
                      {filteredSearchResults.projects.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => {
                            setTab("projects");
                            setSearchOpen(false);
                          }}
                          className="p-2.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between cursor-pointer transition"
                        >
                          <div>
                            <span className="text-xs font-bold text-slate-900 dark:text-white block">
                              {p.nama_proyek}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">{p.divisi}</span>
                          </div>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                            {p.persentase}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {filteredSearchResults.tasks.length > 0 && (
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                      Aktivitas Realisasi
                    </span>
                    <div className="space-y-1.5">
                      {filteredSearchResults.tasks.map((t) => (
                        <div
                          key={t.id}
                          onClick={() => {
                            setTab("reports");
                            setSearchOpen(false);
                          }}
                          className="p-2.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between cursor-pointer transition"
                        >
                          <div>
                            <span className="text-xs font-semibold text-slate-900 dark:text-white block">
                              {t.aktivitas}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              {t.nama} · {t.tanggal}
                            </span>
                          </div>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                            {t.persentase}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {searchQuery.trim() &&
                  filteredSearchResults.projects.length === 0 &&
                  filteredSearchResults.tasks.length === 0 && (
                    <div className="py-8 text-center text-xs text-slate-500">
                      Tidak ada hasil yang sesuai dengan kata kunci pencarian.
                    </div>
                  )}

                {!searchQuery.trim() && (
                  <div className="py-6 text-center text-xs text-slate-400">
                    Ketik kata kunci untuk mencari cepat proyek dan tugas.
                  </div>
                )}
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>

      {/* TOP FIXED NAVBAR (Fixed at absolute top 0, zero scroll gap) */}
      <header
        className="fixed top-0 inset-x-0 z-40 bg-[#ECEEF3]/95 dark:bg-[#121316]/95 backdrop-blur-xl border-b border-black/[0.06] dark:border-white/[0.08] shadow-[0_2px_16px_rgba(0,0,0,0.03)]"
        data-purpose="top-header"
      >
        <div className="w-full max-w-[1600px] mx-auto px-3 sm:px-8 lg:px-12 xl:px-14 py-2.5 sm:py-3.5 flex items-center justify-between gap-2 sm:gap-4">
          {/* Left: Morning Greeting (Clean Minimal - No Duplicate Logo) */}
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 pr-1">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-tight truncate">
                  <span className="hidden sm:inline">Good morning, </span>
                  <span className="sm:hidden">Halo, </span>
                  {getDisplayGreetingName(user.nama)}!
                </h1>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
                {viewMode === "tim"
                  ? `Monitoring ${activeProjectsCount} proyek aktif & progres tim ${user.divisi}.`
                  : "Let's make this day productive."}
              </p>
            </div>
          </div>

          {/* Center-Right Controls */}
          <div className="flex items-center gap-1 sm:gap-3.5 shrink-0">
            {/* View Mode Toggle: Pribadi vs Tim */}
            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-full p-0.5 sm:p-1 flex items-center gap-0.5 sm:gap-1 shadow-xs border border-white/60 dark:border-white/10">
              <button
                onClick={() => {
                  setViewMode("tim");
                  showToast("Mode Tampilan: Tim");
                }}
                className={`px-2 sm:px-3.5 py-1 sm:py-1.5 min-h-[30px] sm:min-h-[34px] text-[11px] sm:text-xs font-semibold rounded-full transition cursor-pointer ${
                  viewMode === "tim"
                    ? "bg-[#1C1D21] text-white shadow-xs dark:bg-white dark:text-slate-900"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
                }`}
              >
                Tim
              </button>
              <button
                onClick={() => {
                  setViewMode("pribadi");
                  showToast("Mode Tampilan: Pribadi");
                }}
                className={`px-2 sm:px-3.5 py-1 sm:py-1.5 min-h-[30px] sm:min-h-[34px] text-[11px] sm:text-xs font-semibold rounded-full transition cursor-pointer ${
                  viewMode === "pribadi"
                    ? "bg-[#1C1D21] text-white shadow-xs dark:bg-white dark:text-slate-900"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
                }`}
              >
                Pribadi
              </button>
            </div>

            {/* Single compact Light / Dark toggle on <640px mobile to save header width */}
            <button
              onClick={() => handleToggleDarkMode(!isDarkMode)}
              className="sm:hidden w-8 h-8 rounded-full bg-white/80 dark:bg-slate-800/80 flex items-center justify-center text-slate-700 dark:text-slate-200 shadow-xs border border-white/60 dark:border-white/10 transition cursor-pointer"
              title={isDarkMode ? "Light Mode" : "Dark Mode"}
            >
              {isDarkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>

            {/* Dual Light / Dark Theme Switcher on sm+ */}
            <div className="hidden sm:flex bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-full p-1 items-center gap-0.5 shadow-xs border border-white/60 dark:border-white/10">
              <button
                onClick={() => handleToggleDarkMode(true)}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition cursor-pointer ${
                  isDarkMode
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                    : "text-slate-400 hover:text-slate-700"
                }`}
                title="Dark Mode"
              >
                <Moon className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleToggleDarkMode(false)}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition cursor-pointer ${
                  !isDarkMode
                    ? "bg-white text-slate-800 shadow-xs"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Light Mode"
              >
                <Sun className="w-3.5 h-3.5 stroke-[2.2]" />
              </button>
            </div>

            {/* Global Search Button */}
            <button
              onClick={() => setSearchOpen(true)}
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-white/70 hover:bg-white dark:bg-slate-800/70 dark:hover:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 shadow-xs border border-white/60 dark:border-white/10 transition cursor-pointer"
              title="Pencarian Cepat"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Notification Center */}
            <NotificationDropdown
              user={user}
              showToast={showToast}
              onRefreshData={() => loadAll(user)}
              onNavigateTab={navigateWithContext}
            />

            {/* User Profile Avatar */}
            <div
              onClick={() => setTab("profile")}
              className="relative cursor-pointer group shrink-0"
              title={`${user.nama} (${user.role})`}
            >
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-[#D2F27C] via-amber-200 to-[#DCD4FB] ring-2 ring-white/80 dark:ring-slate-700 flex items-center justify-center font-bold text-[11px] sm:text-xs text-slate-900 shadow-xs">
                {user.nama.slice(0, 2).toUpperCase()}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* WORKSPACE ROW: FLOATING SIDEBAR + CONTENT AREA (Pixel-Perfect Top Baseline Alignment & Spacious Navbar Breathing Room) */}
      <div className="w-full max-w-[1600px] mx-auto px-3 sm:px-8 lg:px-12 xl:px-14 pt-[86px] sm:pt-[106px] lg:pt-[110px] pb-28 md:pb-10 flex-1 flex gap-6 lg:gap-8 items-start min-h-0">
        {/* FLOATING COLLAPSIBLE SIDEBAR CONTAINER */}
        <m.aside
          animate={{
            width: sidebarOpen ? 220 : 58,
          }}
          transition={SPRING}
          className="hidden md:flex flex-col flex-shrink-0 z-30 sticky top-[100px] sm:top-[106px] lg:top-[110px] select-none"
        >
          <div className="w-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[28px] p-1.5 border border-white/80 dark:border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.04)] flex flex-col items-center gap-2 transition-all">
            {/* Sidebar Top Header Row: Logo + Brand + Collapse Toggle */}
            <div className={`w-full flex items-center ${sidebarOpen ? "justify-between px-2" : "justify-center"}`}>
              {sidebarOpen ? (
                <>
                  <div className="flex items-center gap-2 min-w-0">
                    <ProductivierLogo size={24} />
                    <span className="font-extrabold text-xs tracking-wider text-slate-900 dark:text-white uppercase truncate">
                      PRODUCTIVIER
                    </span>
                  </div>
                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center transition cursor-pointer shrink-0"
                    title="Ciutkan Sidebar"
                    aria-label="Collapse Sidebar"
                  >
                    <PanelLeftClose className="w-4 h-4 stroke-[2.2]" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="w-11 h-11 rounded-full bg-white/90 dark:bg-slate-800/90 hover:bg-white text-slate-800 dark:text-slate-100 flex items-center justify-center shadow-xs transition backdrop-blur-md cursor-pointer hover:scale-105 active:scale-95 shrink-0"
                  title="Buka Sidebar"
                  aria-label="Expand Sidebar"
                >
                  <PanelLeft className="w-5 h-5 stroke-[2.2]" />
                </button>
              )}
            </div>

            <div className="w-7 h-[1px] bg-slate-200/70 dark:bg-slate-700/70 my-0.5" />

            {/* Navigation Buttons */}
            <nav className="flex flex-col items-stretch w-full gap-1.5">
              {NAV_ITEMS.map(({ id, label, Icon }) => {
                const active = tab === id;
                return (
                  <button
                    key={id}
                    onClick={() => handleSelectNavTab(id)}
                    title={label}
                    className={`w-full h-11 rounded-full transition-colors flex items-center ${
                      sidebarOpen ? "px-2.5 gap-3 justify-start" : "justify-center"
                    } cursor-pointer ${
                      active
                        ? "bg-[#18181B] text-white shadow-md dark:bg-white dark:text-slate-900"
                        : "bg-transparent hover:bg-slate-100/90 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900"
                    }`}
                  >
                    <div className="w-6 h-6 flex items-center justify-center shrink-0">
                      <Icon className="w-[18px] h-[18px]" />
                    </div>
                    {sidebarOpen && (
                      <m.span
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.15 }}
                        className="text-xs font-bold whitespace-nowrap overflow-hidden text-ellipsis tracking-tight"
                      >
                        {label}
                      </m.span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="w-7 h-[1px] bg-slate-200/70 dark:bg-slate-700/70 my-0.5" />

            {/* Logout Action */}
            <button
              onClick={handleLogout}
              className={`w-full h-11 rounded-full hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-500 hover:text-red-600 flex items-center ${
                sidebarOpen ? "px-2.5 gap-3 justify-start" : "justify-center"
              } transition cursor-pointer`}
              title="Keluar Akun"
            >
              <div className="w-6 h-6 flex items-center justify-center shrink-0">
                <LogOut className="w-[18px] h-[18px]" />
              </div>
              {sidebarOpen && (
                <m.span
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15 }}
                  className="text-xs font-bold text-red-600 whitespace-nowrap"
                >
                  Keluar
                </m.span>
              )}
            </button>
          </div>
        </m.aside>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* ActionStatsBar: Hanya muncul di Dashboard (Home) dengan Diferensiasi Tim vs Pribadi */}
          {tab === "home" && (
            <section className="flex flex-wrap items-center justify-between gap-4 mb-6" data-purpose="hero-stats">
              {/* Custom Morph Animated Dropdown */}
              <div className="w-52 sm:w-64">
                <CustomSelect
                  value={selectedProjectId}
                  onChange={setSelectedProjectId}
                  options={projectFilterOptions}
                  variant="pill"
                />
              </div>

              {/* Dynamic Mode-Specific Metrics & CTA */}
              <div className="flex flex-wrap items-center gap-5 sm:gap-7 lg:gap-8">
                {viewMode === "pribadi" ? (
                  <>
                    {/* Mode Pribadi: Tugas Saya */}
                    <div>
                      <span className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">
                        Tugas Saya Selesai
                      </span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight tabular-nums">
                          {totalTasksDone.toLocaleString()}
                        </span>
                        <span className="text-sm text-slate-600 dark:text-slate-400 font-semibold">↗</span>
                      </div>
                    </div>

                    {/* Mode Pribadi: Efisiensi Diri */}
                    <div>
                      <span className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">
                        Efisiensi Diri
                      </span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight tabular-nums">
                          {completionPercentage}%
                        </span>
                        <span className="text-sm text-slate-600 dark:text-slate-400 font-semibold">↗</span>
                      </div>
                    </div>

                    {/* CTA Mode Pribadi */}
                    <button
                      onClick={() => setTab("input")}
                      className="bg-[#1C1D21] hover:bg-black text-white px-5 py-2.5 rounded-full font-semibold text-xs flex items-center gap-2 shadow-lg shadow-black/10 transition active:scale-95 whitespace-nowrap cursor-pointer dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                      data-purpose="add-task-cta"
                    >
                      <span className="text-base leading-none">+</span>
                      <span>Catat Tugas Diri</span>
                    </button>
                  </>
                ) : (
                  <>
                    {/* Mode Tim: Kepatuhan Input Tim */}
                    <div>
                      <span className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">
                        Kepatuhan Input Tim
                      </span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight tabular-nums">
                          {monitoring?.statusTim
                            ? `${monitoring.statusTim.filter((s) => s.sudah_input).length}/${monitoring.statusTim.length}`
                            : `${totalTasksDone}`}
                        </span>
                        <span className="text-sm text-slate-600 dark:text-slate-400 font-semibold">anggota</span>
                      </div>
                    </div>

                    {/* Mode Tim: Output Beban Kerja */}
                    <div>
                      <span className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">
                        Output Kerja Tim
                      </span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight tabular-nums">
                          {realisasi.length}
                        </span>
                        <span className="text-sm text-slate-600 dark:text-slate-400 font-semibold">tugas ↗</span>
                      </div>
                    </div>

                    {/* CTA Mode Tim */}
                    <button
                      onClick={() => {
                        if (user.role === "admin" && typeof window !== "undefined") {
                          sessionStorage.setItem("productivier_input_delegate_mode", "1");
                        }
                        setTab("input");
                      }}
                      className="bg-[#1C1D21] hover:bg-black text-white px-5 py-2.5 rounded-full font-semibold text-xs flex items-center gap-2 shadow-lg shadow-black/10 transition active:scale-95 whitespace-nowrap cursor-pointer dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                      data-purpose="add-task-cta"
                    >
                      <span className="text-base leading-none">+</span>
                      <span>{user.role === "admin" ? "Delegasikan Tugas" : "Catat Tugas Proyek"}</span>
                    </button>
                  </>
                )}
              </div>
            </section>
          )}

          {/* MAIN TAB VIEWS */}
          <AnimatePresence mode="wait">
            <m.div
              key={tab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="flex-1 pb-20 md:pb-6"
            >
              {tab === "home" && (
                <HomeTab
                  user={user}
                  viewMode={viewMode}
                  activeProjectsCount={activeProjectsCount}
                  selectedProjectId={selectedProjectId}
                  projects={projects}
                  realisasi={visibleRealisasi}
                  monitoring={monitoring}
                  onGoProjects={() => setTab("projects")}
                  onGoCalendar={() => setTab("calendar")}
                  onGoNotes={() => setTab("notes")}
                  onGoChat={(draftMessage, projectId) => {
                    if (draftMessage && typeof window !== "undefined") {
                      sessionStorage.setItem("productivier_chat_draft", draftMessage);
                      if (projectId) {
                        sessionStorage.setItem("productivier_chat_project_id", String(projectId));
                      }
                    }
                    setTab("chat");
                  }}
                  onGoInput={() => setTab("input")}
                  onGoReports={() => setTab("reports")}
                  onRefreshData={() => loadAll(user)}
                  showToast={showToast}
                />
              )}

              {tab === "projects" && (
                <ProjectsTab
                  user={user}
                  users={users}
                  projects={projects}
                  viewMode={viewMode}
                  onRefresh={() => loadAll(user)}
                  onGoInput={(projId?: number, delegateUserId?: number) => {
                    if (typeof window !== "undefined") {
                      if (projId) sessionStorage.setItem("productivier_input_project_id", String(projId));
                      if (delegateUserId) sessionStorage.setItem("productivier_input_delegate_user_id", String(delegateUserId));
                    }
                    setTab("input");
                  }}
                  onGoChat={(projectId) => {
                    if (typeof window !== "undefined" && projectId) {
                      sessionStorage.setItem("productivier_chat_project_id", String(projectId));
                    }
                    setTab("chat");
                  }}
                  onGoCalendar={(projectId) => {
                    if (typeof window !== "undefined" && projectId) {
                      sessionStorage.setItem("productivier_calendar_project_id", String(projectId));
                    }
                    setTab("calendar");
                  }}
                  onGoNotes={(projId) => {
                    if (projId && typeof window !== "undefined") {
                      sessionStorage.setItem("productivier_notes_project_id", String(projId));
                      const url = new URL(window.location.href);
                      url.searchParams.set("tab", "notes");
                      url.searchParams.set("project_id", String(projId));
                      window.history.pushState(null, "", url.toString());
                    }
                    setTab("notes");
                  }}
                  showToast={showToast}
                />
              )}

              {tab === "calendar" && (
                <CalendarTab
                  user={user}
                  projects={projects}
                  realisasi={realisasi}
                  showToast={showToast}
                  onGoInput={() => setTab("input")}
                />
              )}

              {tab === "notes" && (
                <NotesTab
                  user={user}
                  projects={projects}
                  showToast={showToast}
                />
              )}

              {tab === "chat" && (
                <ChatTab
                  user={user}
                  projects={projects}
                  showToast={showToast}
                />
              )}

              {tab === "input" && (
                <InputTab
                  user={user}
                  users={users}
                  projects={projects}
                  showToast={showToast}
                  onSaved={async () => {
                    await loadAll(user);
                    showToast("Realisasi berhasil disimpan");
                    setTab("home");
                  }}
                />
              )}

              {tab === "reports" && (
                <ReportsTab
                  user={user}
                  realisasi={modeFilteredRealisasi}
                  projects={projects}
                  showToast={showToast}
                  onRefresh={() => loadAll(user)}
                />
              )}

              {tab === "profile" && (
                <ProfileTab
                  user={user}
                  users={users}
                  monitoring={monitoring}
                  onUserUpdated={(updated) => {
                    setUser(updated);
                    localStorage.setItem("prod_next_user", JSON.stringify(updated));
                    showToast("Profil diperbarui");
                  }}
                  onRefresh={() => loadAll(user)}
                  showToast={showToast}
                />
              )}
            </m.div>
          </AnimatePresence>
        </main>
      </div>

      {/* MOBILE BOTTOM NAVIGATION DOCK */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 rounded-t-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-black/5 dark:border-white/10 shadow-[0_-6px_28px_rgba(24,24,27,0.08)] px-1 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-8 gap-0.5">
          {NAV_ITEMS.map(({ id, shortLabel, Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => handleSelectNavTab(id)}
                className={`relative flex flex-col items-center justify-center min-h-[44px] rounded-xl px-0.5 py-1 transition-colors cursor-pointer ${
                  active ? "text-white dark:text-slate-900" : "text-slate-500 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                {active && (
                  <m.span
                    layoutId="mobile-dock-pill"
                    transition={SPRING}
                    className="absolute inset-0 bg-[#1C1D21] dark:bg-white rounded-xl shadow-xs"
                  />
                )}
                <Icon className="relative z-10 w-4 h-4 shrink-0" />
                <span className="relative z-10 text-[10px] font-semibold mt-0.5 leading-none tracking-tight truncate max-w-full">
                  {shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Floating Draggable AI Agent (Universal Across All Tabs) */}
      <FloatingAIAgent
        user={user}
        showToast={showToast}
        onRefreshData={() => loadAll(user)}
        onNavigateTab={navigateWithContext}
        hideOrbOnMobile={tab === "chat"}
      />
    </div>
  );
}
