"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Calendar,
  ArrowUpRight,
  Check,
  MessageCircle,
  MessageSquare,
  CheckCircle2,
  Trash2,
  Plus,
  Loader2,
  Sparkles,
  FolderKanban,
} from "lucide-react";
import {
  UserType,
  ProjectType,
  RealisasiType,
  MonitoringType,
  PersonalTodoType,
  CalendarEventType,
} from "@/types";
import QuickLaunchpadCard from "@/components/dashboard/QuickLaunchpadCard";
import PersonalFocusChart from "@/components/dashboard/PersonalFocusChart";

interface HomeTabProps {
  user: UserType;
  viewMode: "pribadi" | "tim";
  activeProjectsCount: number;
  selectedProjectId?: string;
  projects: ProjectType[];
  realisasi: RealisasiType[];
  monitoring: MonitoringType | null;
  onGoProjects: () => void;
  onGoCalendar?: () => void;
  onGoNotes?: () => void;
  onGoChat?: (draftMessage?: string, projectId?: number) => void;
  onGoInput: () => void;
  onGoReports: () => void;
  onRefreshData?: () => Promise<void>;
  showToast: (m: string) => void;
}

function timeToHourFloat(timeStr?: string, fallbackHour = 9): number {
  if (!timeStr || !timeStr.includes(":")) return fallbackHour;
  const [h, m] = timeStr.split(":").map(Number);
  if (!Number.isFinite(h)) return fallbackHour;
  return h + (Number.isFinite(m) ? m : 0) / 60;
}

export default function HomeTab({
  user,
  viewMode,
  selectedProjectId = "all",
  projects,
  realisasi,
  monitoring,
  onGoCalendar,
  onGoNotes,
  onGoChat,
  onGoInput,
  onGoReports,
  onRefreshData,
  showToast,
}: HomeTabProps) {
  // Database-backed to-do state for personal mode
  const [personalTasks, setPersonalTasks] = useState<PersonalTodoType[]>([]);
  const [loadingTodos] = useState(false);
  const [newTodoTitle, setNewTodoTitle] = useState("");
  const [newTodoTag, setNewTodoTag] = useState("Desain");
  const [addingTodo, setAddingTodo] = useState(false);

  // Real Calendar Events for Mode Pribadi Focus Timeline
  const [todayEvents, setTodayEvents] = useState<CalendarEventType[]>([]);
  const todayStr = new Date().toISOString().slice(0, 10);

  const fetchTodayEvents = async () => {
    try {
      const monthStr = todayStr.slice(0, 7);
      const res = await fetch(`/api/calendar?month=${monthStr}&mine=true`);
      if (res.ok) {
        const data = await res.json();
        const evs = ((data.events || []) as CalendarEventType[]).filter((ev) => ev.date === todayStr);
        setTodayEvents(evs);
      }
    } catch {
      // ignore network error
    }
  };

  useEffect(() => {
    let active = true;
    const monthStr = todayStr.slice(0, 7);
    Promise.all([
      fetch(`/api/todos?user_id=${user.id}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/calendar?month=${monthStr}&mine=true`).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([todosData, calData]) => {
        if (!active) return;
        if (todosData) setPersonalTasks(todosData);
        if (calData) {
          const evs = ((calData.events || []) as CalendarEventType[]).filter((ev) => ev.date === todayStr);
          setTodayEvents(evs);
        }
      })
      .catch(() => {});

    const handleRefresh = () => fetchTodayEvents();
    window.addEventListener("productivier:refresh_data", handleRefresh);
    return () => {
      active = false;
      window.removeEventListener("productivier:refresh_data", handleRefresh);
    };
  // Efek mount/trigger tunggal: fungsi loader sengaja tidak jadi dependency agar tidak refetch tiap render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id, todayStr]);

  const handleConvertTodoToCalendar = async (e: React.MouseEvent, t: PersonalTodoType) => {
    e.stopPropagation();
    try {
      const start = t.time && /^\d{2}:\d{2}$/.test(t.time) ? t.time : "10:00";
      const startHr = Number(start.split(":")[0]);
      const end = `${String(Math.min(23, startHr + 1)).padStart(2, "0")}:${start.split(":")[1] || "00"}`;
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: t.title,
          description: `Dari To-do Pribadi (${t.tag})`,
          date: todayStr,
          start_time: start,
          end_time: end,
          category: "activity",
          color: "#D2F27C",
        }),
      });
      if (res.ok) {
        showToast(`"${t.title}" dijadwalkan ke Kalender hari ini!`);
        await fetchTodayEvents();
      } else {
        showToast("Gagal menjadwalkan to-do ke kalender");
      }
    } catch {
      showToast("Kesalahan jaringan");
    }
  };

  const handleConvertTodoToRealisasi = async (e: React.MouseEvent, t: PersonalTodoType) => {
    e.stopPropagation();
    const fallbackProjectId =
      selectedProjectId !== "all" ? Number(selectedProjectId) : projects[0]?.id || null;
    try {
      const res = await fetch("/api/realisasi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: fallbackProjectId,
          tanggal: todayStr,
          aktivitas: t.title,
          target: 1,
          realisasi: t.done ? 1 : 0,
          satuan: t.tag || "Tugas",
        }),
      });
      if (res.ok) {
        showToast(`"${t.title}" dicatat ke Realisasi Proyek!`);
        if (onRefreshData) await onRefreshData();
      } else {
        showToast("Gagal mencatat ke realisasi");
      }
    } catch {
      showToast("Kesalahan jaringan");
    }
  };

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoTitle.trim()) return;
    setAddingTodo(true);
    try {
      const res = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          title: newTodoTitle.trim(),
          tag: newTodoTag,
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setPersonalTasks((prev) => [json.todo, ...prev]);
        setNewTodoTitle("");
        showToast("To-do berhasil ditambahkan!");
      } else {
        showToast("Gagal menambahkan to-do");
      }
    } catch {
      showToast("Kesalahan koneksi jaringan");
    } finally {
      setAddingTodo(false);
    }
  };

  const toggleTask = async (taskId: string) => {
    const target = personalTasks.find((t) => t.id === taskId);
    if (!target) return;
    const nextDone = !target.done;

    // Optimistic update
    setPersonalTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, done: nextDone } : t))
    );

    try {
      const res = await fetch(`/api/todos/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: nextDone }),
      });
      if (res.ok) {
        showToast(nextDone ? "Tugas selesai! Mantap!" : "Status to-do diperbarui");
      } else {
        // Rollback on error
        setPersonalTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, done: target.done } : t))
        );
        showToast("Gagal memperbarui status di database");
      }
    } catch {
      setPersonalTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, done: target.done } : t))
      );
      showToast("Kesalahan jaringan");
    }
  };

  const handleDeleteTodo = async (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    const previous = [...personalTasks];
    setPersonalTasks((prev) => prev.filter((t) => t.id !== taskId));

    try {
      const res = await fetch(`/api/todos/${taskId}`, { method: "DELETE" });
      if (res.ok) {
        showToast("To-do dihapus");
      } else {
        setPersonalTasks(previous);
        showToast("Gagal menghapus to-do");
      }
    } catch {
      setPersonalTasks(previous);
      showToast("Kesalahan jaringan");
    }
  };

  // Real Division Sprint Statistics (Zero Fake Hardcoded Fallbacks)
  const divisiStats = useMemo(() => {
    const normalize = (val: string) => val.toLowerCase();
    const opTasks = realisasi.filter((r) => {
      const d = normalize(r.divisi || "");
      return d.includes("operasional") || d.includes("konten") || d.includes("ads");
    });
    const krTasks = realisasi.filter((r) => {
      const d = normalize(r.divisi || "");
      return d.includes("kreatif") || d.includes("desain") || d.includes("tech");
    });
    const mgTasks = realisasi.filter((r) => {
      const d = normalize(r.divisi || "");
      return d.includes("management") || d.includes("manajemen") || d.includes("umum") || d.includes("strategi");
    });

    const calcAvg = (tasks: RealisasiType[]) => {
      if (tasks.length === 0) return 0;
      const total = tasks.reduce((sum, t) => sum + (Number(t.persentase) || 0), 0);
      return Math.min(100, Math.round(total / tasks.length));
    };

    const opPct = calcAvg(opTasks);
    const krPct = calcAvg(krTasks);
    const mgPct = calcAvg(mgTasks);
    const overallAvg = calcAvg(realisasi);

    return {
      opPct,
      opCount: opTasks.length,
      krPct,
      krCount: krTasks.length,
      mgPct,
      mgCount: mgTasks.length,
      overallAvg,
    };
  }, [realisasi]);

  // Team status list
  const teamStatusList = monitoring?.statusTim || [];
  const blockersList = realisasi.filter((r) => r.kendala && r.kendala.trim().length > 0);
  const doneTodosCount = personalTasks.filter((t) => t.done).length;
  const personalScheduleEfficiency =
    personalTasks.length > 0
      ? Math.round((doneTodosCount / personalTasks.length) * 100)
      : todayEvents.length > 0
      ? 100
      : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch" data-purpose="workspace-cards-grid">
      {/* 1. TOP-LEFT CARD: SPRINT VELOCITY & QUICK ACTION LAUNCHPAD */}
      <div className="lg:col-span-5">
        <QuickLaunchpadCard
          user={user}
          projects={projects}
          realisasi={realisasi}
          selectedProjectId={selectedProjectId}
          onRefreshData={onRefreshData}
          onGoInput={onGoInput}
          onGoNotes={onGoNotes}
          onGoCalendar={onGoCalendar}
          showToast={showToast}
        />
      </div>

      {/* 2. TOP-RIGHT CARD: CONDITIONAL PERSONAL TIMELINE VS TEAM WORKLOAD RADAR */}
      {viewMode === "pribadi" ? (
        /* MODE PRIBADI: REAL DB CALENDAR FOCUS TIMELINE (07:00 - 17:00) */
        <article className="lg:col-span-7 dashboard-card p-6 flex flex-col justify-between min-h-[350px] dark:text-slate-100">
          <div className="flex items-start justify-between pb-3">
            <div>
              <h2 className="font-bold text-lg text-[#18181B] dark:text-white">Jadwal Fokus Saya</h2>
              <p className="text-xs text-[#71717A] dark:text-slate-400 mt-0.5">
                Agenda aktif hari ini ({todayStr}) tersinkron langsung dari Kalender Kerja
              </p>
            </div>
            <button
              type="button"
              onClick={onGoCalendar}
              aria-label="Buka Kalender Kerja"
              title="Buka Kalender Kerja Lengkap"
              className="w-9 h-9 rounded-full bg-white dark:bg-slate-800 text-[#18181B] dark:text-white border border-black/5 dark:border-white/10 shadow-xs grid place-items-center hover:bg-gray-50 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              <Calendar className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 flex flex-col justify-between py-2 relative">
            <div className="grid grid-cols-6 text-[11px] font-medium text-[#71717A] dark:text-slate-400 text-center pb-2 border-b border-black/[0.04] dark:border-white/[0.06]">
              <span>07:00</span>
              <span>09:00</span>
              <span>11:00</span>
              <span className="font-bold text-[#18181B] dark:text-white">13:00</span>
              <span>15:00</span>
              <span>17:00</span>
            </div>

            <div className="relative py-3 flex flex-col gap-2.5 min-h-[175px] justify-center">
              {todayEvents.length === 0 ? (
                <div className="text-center py-8 px-4 rounded-2xl bg-slate-50/90 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 space-y-2">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Belum ada agenda terjadwal untuk hari ini.
                  </p>
                  <button
                    type="button"
                    onClick={onGoCalendar}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#18181B] text-white dark:bg-white dark:text-slate-900 text-xs font-bold hover:opacity-90 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Jadwalkan Sesi Fokus</span>
                  </button>
                </div>
              ) : (
                todayEvents.slice(0, 3).map((ev, idx) => {
                  const startH = Math.max(7, Math.min(16.5, timeToHourFloat(ev.start_time, 9 + idx * 2)));
                  const endH = Math.max(startH + 1, Math.min(17.5, timeToHourFloat(ev.end_time, startH + 1.5)));
                  const leftPct = Math.round(((startH - 7) / 10) * 100);
                  const widthPct = Math.max(28, Math.min(100 - leftPct, Math.round(((endH - startH) / 10) * 100)));
                  const cardTone =
                    idx % 3 === 0
                      ? "bg-[#D2F27C] text-[#18181B]"
                      : idx % 3 === 1
                      ? "bg-[#DCD4FB] text-[#18181B]"
                      : "bg-slate-100 dark:bg-slate-800 border border-black/5 dark:border-white/10 text-[#18181B] dark:text-white";
                  return (
                    <div
                      key={ev.id}
                      onClick={onGoCalendar}
                      style={{ marginLeft: `${leftPct}%`, width: `${widthPct}%` }}
                      className={`relative z-10 p-3 rounded-2xl ${cardTone} flex items-center justify-between gap-2 shadow-2xs cursor-pointer hover:scale-[1.01] transition`}
                    >
                      <div className="min-w-0">
                        <span className="font-bold text-xs block truncate">{ev.title}</span>
                        <span className="text-[11px] opacity-75 block truncate">
                          {ev.start_time} – {ev.end_time}
                          {ev.project_nama ? ` · ${ev.project_nama}` : ""}
                        </span>
                      </div>
                      <span className="w-6 h-6 rounded-full bg-[#18181B] text-[#D2F27C] text-[10px] font-bold grid place-items-center shrink-0">
                        {user.nama.slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between text-xs text-[#71717A] dark:text-slate-400 border-t border-black/[0.04] dark:border-white/[0.06]">
            <span>Agenda aktif hari ini: {todayEvents.length} sesi</span>
            <span className="font-semibold text-[#18181B] dark:text-white tabular-nums">
              Penyelesaian To-do: {personalScheduleEfficiency}%
            </span>
          </div>
        </article>
      ) : (
        /* MODE TIM: WORKLOAD RADAR & TEAM SUBMISSION STATUS */
        <article className="lg:col-span-7 dashboard-card p-6 flex flex-col justify-between min-h-[350px] dark:text-slate-100">
          <div className="flex items-start justify-between pb-3 border-b border-slate-200/80 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-lg text-[#18181B] dark:text-white">Status Setor Realisasi Tim</h2>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold">
                  {teamStatusList.filter((m) => m.sudah_input).length}/{teamStatusList.length} Siap
                </span>
              </div>
              <p className="text-xs text-[#71717A] dark:text-slate-400 mt-0.5">
                Pantau kedisiplinan input progres harian setiap anggota tim secara real-time
              </p>
            </div>
            <button
              onClick={onGoReports}
              className="w-9 h-9 rounded-full bg-white dark:bg-slate-800 border border-black/5 shadow-xs grid place-items-center hover:bg-slate-50 transition"
              title="Ke Halaman Laporan"
            >
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3 flex-1 py-3 overflow-y-auto max-h-56">
            {teamStatusList.map((m) => {
              const memberPhone = m.phone || (m.nama.includes("1") ? "6281234567890" : m.nama.includes("2") ? "6289876543210" : "6285196598881");
              return (
                <div
                  key={m.id}
                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-700 grid place-items-center text-xs font-bold shrink-0">
                      {m.nama.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <strong className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                        {m.nama}
                      </strong>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate block">
                        {m.divisi} · {m.jumlah_input} entri tercatat ({m.rata_persen}%)
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        m.sudah_input
                          ? "bg-[#D2F27C] text-slate-900"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                      }`}
                    >
                      {m.sudah_input ? "✓ Sudah Input" : "Belum Input"}
                    </span>

                    {user.role === "admin" && !m.sudah_input && m.id !== user.id && m.role !== "admin" && (
                      <a
                        href={`https://wa.me/${memberPhone}?text=Halo%20${encodeURIComponent(
                          m.nama
                        )},%20jangan%20lupa%20input%20realisasi%20harian%20di%20Productivier%20ya!`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 shadow-2xs transition"
                        title="Colek via WhatsApp"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Colek WA</span>
                      </a>
                    )}
                  </div>
                </div>
              );
            })}

            {teamStatusList.length === 0 && (
              <div className="text-center py-6 text-xs text-slate-400">
                Memuat data pemantauan tim...
              </div>
            )}
          </div>

          <div className="pt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 dark:border-slate-800">
            <span>Standar batas setor: 17:00 WIB</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {teamStatusList.filter((m) => !m.sudah_input).length} Perlu Follow-up
            </span>
          </div>
        </article>
      )}

      {/* 3. BOTTOM-LEFT CARD: CONDITIONAL PERSONAL TO-DO VS TEAM REVIEW & BLOCKERS */}
      {viewMode === "pribadi" ? (
        /* MODE PRIBADI: INTERACTIVE TO-DO CHECKLIST WITH DIRECT INPUT */
        <article className="lg:col-span-5 dashboard-card p-6 flex flex-col justify-between min-h-[350px] dark:text-slate-100">
          <div className="flex items-start justify-between pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-lg text-[#18181B] dark:text-white">To-do List Hari Ini</h2>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold">
                  {personalTasks.filter((t) => t.done).length}/{personalTasks.length}
                </span>
              </div>
              <p className="text-xs text-[#71717A] dark:text-slate-400 mt-0.5">
                Kelola dan centang target tugas produktivitas pribadi Anda
              </p>
            </div>
            <button
              type="button"
              onClick={onGoNotes}
              aria-label="Lihat Semua Catatan & Memo"
              title="Buka Tab Catatan & Memo Lengkap"
              className="w-9 h-9 rounded-full bg-white dark:bg-slate-800 text-[#18181B] dark:text-white border border-black/5 dark:border-white/10 shadow-xs grid place-items-center hover:bg-gray-50 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>

          {/* List To-do Items */}
          <div className="space-y-2 flex-1 max-h-48 overflow-y-auto pr-1 py-1">
            {loadingTodos && personalTasks.length === 0 ? (
              <div className="flex items-center justify-center py-6 text-xs text-slate-400 gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#18181B] dark:text-white" />
                <span>Memuat to-do pribadi...</span>
              </div>
            ) : personalTasks.length === 0 ? (
              <div className="text-center py-6 px-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-400">
                Belum ada to-do hari ini. Tambahkan tugas pertama Anda di bawah!
              </div>
            ) : (
              personalTasks.map((t) => (
                <div
                  key={t.id}
                  onClick={() => toggleTask(t.id)}
                  className={`group p-2.5 rounded-2xl border transition flex items-center justify-between gap-3 cursor-pointer ${
                    t.done
                      ? "bg-slate-100/60 dark:bg-slate-800/40 border-slate-200/50 line-through text-slate-400"
                      : "bg-[#F4F5F8] dark:bg-slate-800 border-black/5 dark:border-white/5 text-slate-900 dark:text-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-5 h-5 rounded-full grid place-items-center shrink-0 border transition ${
                        t.done
                          ? "bg-[#D2F27C] border-[#D2F27C] text-slate-900"
                          : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                      }`}
                    >
                      {t.done && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <span className="text-xs font-semibold truncate">{t.title}</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                      {t.tag}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleConvertTodoToCalendar(e, t)}
                      title="Jadwalkan ke Kalender hari ini"
                      className="opacity-70 group-hover:opacity-100 p-1 text-slate-500 hover:text-purple-600 transition rounded-lg hover:bg-purple-50 dark:hover:bg-purple-950/40 cursor-pointer"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleConvertTodoToRealisasi(e, t)}
                      title="Catat sebagai Realisasi Proyek"
                      className="opacity-70 group-hover:opacity-100 p-1 text-slate-500 hover:text-emerald-600 transition rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteTodo(e, t.id)}
                      title="Hapus to-do"
                      className="opacity-70 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Inline Add To-do Input Form */}
          <form onSubmit={handleAddTodo} className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newTodoTitle}
                onChange={(e) => setNewTodoTitle(e.target.value)}
                placeholder="+ Tambah to-do hari ini... [Enter]"
                className="flex-1 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-slate-300 dark:focus:border-slate-600 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-hidden transition"
              />
              <button
                type="submit"
                disabled={addingTodo || !newTodoTitle.trim()}
                className="px-3 py-1.5 rounded-xl bg-[#1C1D21] hover:bg-black text-white dark:bg-white dark:text-slate-900 text-xs font-bold transition disabled:opacity-50 cursor-pointer shadow-2xs"
              >
                {addingTodo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Tambah"}
              </button>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5 flex-wrap">
                {["Desain", "Konten", "Ads", "Dev", "Umum"].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setNewTodoTag(tag)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition cursor-pointer ${
                      newTodoTag === tag
                        ? "bg-[#D2F27C] text-slate-900 font-extrabold"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <span className="font-medium text-slate-400 hidden sm:inline">
                {personalTasks.filter((t) => t.done).length} dari {personalTasks.length} selesai
              </span>
            </div>
          </form>
        </article>
      ) : (
        /* MODE TIM: TEAM REVIEW & URGENT BLOCKERS */
        <article className="lg:col-span-5 dashboard-card p-6 flex flex-col justify-between min-h-[350px] dark:text-slate-100">
          <div className="flex items-start justify-between pb-3 border-b border-slate-200/80 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-lg text-[#18181B] dark:text-white">Review &amp; Kendala Tim</h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-bold uppercase">
                  Perlu Atensi
                </span>
              </div>
              <p className="text-xs text-[#71717A] dark:text-slate-400 mt-0.5">
                Aktivitas tim yang memiliki kendala atau butuh arahan leader
              </p>
            </div>
            <button
              onClick={onGoReports}
              className="w-9 h-9 rounded-full bg-white dark:bg-slate-800 border border-black/5 shadow-xs grid place-items-center hover:bg-slate-50 transition"
              title="Ke Halaman Laporan"
            >
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3 flex-1 py-3 overflow-y-auto max-h-56">
            {blockersList.map((b) => (
              <div
                key={b.id}
                className="p-3.5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-bold text-slate-900 dark:text-white truncate">{b.nama}</span>
                    {b.nama_proyek && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[10px] font-bold border border-blue-200/50">
                        <FolderKanban className="w-2.5 h-2.5" />
                        <span className="truncate max-w-[130px]">{b.nama_proyek}</span>
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded-md shrink-0">
                    {b.status}
                  </span>
                </div>

                <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                  {b.aktivitas}
                </p>

                <div className="text-[11px] text-red-600 dark:text-red-400 bg-white/60 dark:bg-slate-900/60 p-2 rounded-xl border border-red-100 dark:border-red-900/40">
                  <strong>Kendala:</strong> {b.kendala}
                </div>

                {b.solusi && (
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400">
                    <strong>Rencana Solusi:</strong> {b.solusi}
                  </div>
                )}

                {/* Direct Action Buttons to Chat & AI */}
                <div className="flex items-center gap-2 pt-1 border-t border-amber-200/40 dark:border-amber-800/30">
                  <button
                    type="button"
                    onClick={() => {
                      const tagPart = b.nama_proyek ? `/project "${b.nama_proyek}" ` : "";
                      const draft = `${tagPart}Kendala tim ${b.nama}: "${b.kendala}". Mohon arahan & solusi bersama tim.`;
                      onGoChat?.(draft, b.project_id || undefined);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-[10px] font-bold border border-amber-200 dark:border-amber-800/60 hover:bg-amber-100/50 dark:hover:bg-amber-950/40 transition flex items-center gap-1 shadow-2xs cursor-pointer"
                    title="Bahas kendala ini di chat grup"
                  >
                    <MessageSquare className="w-3 h-3 text-purple-600 dark:text-[#D2F27C]" />
                    <span>Bahas di Chat</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const tagPart = b.nama_proyek ? `/project "${b.nama_proyek}" ` : "";
                      const draft = `@Miu ${tagPart}Berikan rekomendasi solusi konkret untuk kendala ${b.nama}: "${b.kendala}"`;
                      onGoChat?.(draft, b.project_id || undefined);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#18181B] dark:bg-white text-white dark:text-slate-900 text-[10px] font-bold hover:bg-black transition flex items-center gap-1 shadow-2xs cursor-pointer"
                    title="Minta AI Miu merumuskan rekomendasi solusi"
                  >
                    <Sparkles className="w-3 h-3 text-[#D2F27C] dark:text-purple-600" />
                    <span>Tanya Miu AI</span>
                  </button>
                </div>
              </div>
            ))}

            {blockersList.length === 0 && (
              <div className="text-center py-8 text-xs text-slate-400 flex flex-col items-center gap-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 opacity-80" />
                <span>Semua aktivitas tim berjalan lancar tanpa blocker hari ini!</span>
              </div>
            )}
          </div>

          <div className="pt-2 flex items-center justify-between text-xs text-slate-400 border-t border-slate-100 dark:border-slate-800">
            <span>{blockersList.length} kendala dilaporkan</span>
            <button
              onClick={onGoInput}
              className="font-bold text-slate-900 dark:text-white hover:underline cursor-pointer"
            >
              + Input Solusi
            </button>
          </div>
        </article>
      )}

      {/* 4. BOTTOM-RIGHT CARD: CONDITIONAL PERSONAL FOCUS CHART VS TEAM EFFICIENCY */}
      {viewMode === "pribadi" ? (
        /* MODE PRIBADI: PERSONAL FOCUS EFFICIENCY BAR CHART */
        <PersonalFocusChart
          user={user}
          viewMode={viewMode}
          realisasi={realisasi}
          tren7Hari={monitoring?.tren7Hari}
          onGoReports={onGoReports}
        />
      ) : (
        /* MODE TIM: DIVISION SPRINT VELOCITY & SPEED BREAKDOWN */
        <article className="lg:col-span-7 dashboard-card p-6 flex flex-col justify-between min-h-[350px] dark:text-slate-100">
          <div className="flex items-start justify-between pb-3 border-b border-slate-200/80 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-lg text-[#18181B] dark:text-white">Kecepatan Sprint Divisi</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[11px] font-bold">
                  {divisiStats.overallAvg}% Efisiensi
                </span>
              </div>
              <p className="text-xs text-[#71717A] dark:text-slate-400 mt-0.5">
                Tingkat pencapaian target berdasarkan {realisasi.length} laporan realisasi nyata
              </p>
            </div>
            <button
              onClick={onGoReports}
              className="w-9 h-9 rounded-full bg-white dark:bg-slate-800 border border-black/5 shadow-xs grid place-items-center hover:bg-slate-50 transition"
              title="Lihat Rekapitulasi Laporan"
            >
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 flex flex-col justify-around py-3 space-y-4">
            {/* Division 1: Operasional & Konten */}
            <div>
              <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                <span className="text-slate-800 dark:text-slate-200">
                  Divisi Operasional &amp; Konten ({divisiStats.opCount})
                </span>
                <span className="tabular-nums text-slate-900 dark:text-white">{divisiStats.opPct}% Efisiensi</span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-[#1C1D21] dark:bg-white rounded-full transition-all duration-700"
                  style={{ width: `${divisiStats.opPct}%` }}
                />
              </div>
            </div>

            {/* Division 2: Kreatif & Teknologi */}
            <div>
              <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                <span className="text-slate-800 dark:text-slate-200">
                  Divisi Kreatif &amp; Teknologi ({divisiStats.krCount})
                </span>
                <span className="tabular-nums text-slate-900 dark:text-white">{divisiStats.krPct}% Efisiensi</span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-[#D2F27C] rounded-full transition-all duration-700"
                  style={{ width: `${divisiStats.krPct}%` }}
                />
              </div>
            </div>

            {/* Division 3: Manajemen & Umum */}
            <div>
              <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                <span className="text-slate-800 dark:text-slate-200">
                  Divisi Manajemen &amp; Umum ({divisiStats.mgCount})
                </span>
                <span className="tabular-nums text-slate-900 dark:text-white">{divisiStats.mgPct}% Efisiensi</span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                  style={{ width: `${divisiStats.mgPct}%` }}
                />
              </div>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 dark:border-slate-800">
            <span>Rata-rata kecepatan tim: {divisiStats.overallAvg}%</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">Target Sprint Terjaga</span>
          </div>
        </article>
      )}
    </div>
  );
}
