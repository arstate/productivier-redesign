"use client";

import React, { useState, useEffect, useMemo } from "react";
import { m, AnimatePresence } from "motion/react";
import {
  Calendar as 
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Trash2,
  X,
  Edit3,
} from "lucide-react";
import { UserType, ProjectType, RealisasiType, CalendarEventType } from "@/types";
import CustomSelect, { CustomSelectOption } from "@/components/ui/CustomSelect";
import ConfirmModal from "@/components/ui/ConfirmModal";


const DAYS_NAMES = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  activity: { bg: "bg-[#D2F27C]/30", text: "text-slate-900 dark:text-[#D2F27C]", border: "border-[#D2F27C]/60", label: "Aktivitas" },
  meeting: { bg: "bg-[#DCD4FB]/40", text: "text-purple-900 dark:text-[#DCD4FB]", border: "border-[#DCD4FB]/60", label: "Meeting" },
  milestone: { bg: "bg-amber-100/60 dark:bg-amber-950/40", text: "text-amber-800 dark:text-amber-300", border: "border-amber-300", label: "Milestone" },
  deadline: { bg: "bg-red-100/60 dark:bg-red-950/40", text: "text-red-700 dark:text-red-300", border: "border-red-300", label: "Deadline" },
};

interface CalendarTabProps {
  user: UserType;
  projects: ProjectType[];
  realisasi: RealisasiType[];
  showToast: (m: string) => void;
  onGoInput: () => void;
}

export default function CalendarTab({
  user,
  projects,
  realisasi,
  showToast,
  onGoInput,
}: CalendarTabProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(new Date().toISOString().slice(0, 10));
  const [events, setEvents] = useState<CalendarEventType[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("project_id") || sessionStorage.getItem("productivier_calendar_project_id");
      if (p) {
        sessionStorage.removeItem("productivier_calendar_project_id");
        return p;
      }
    }
    return "all";
  });
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"month" | "timeline">("month");
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State for Add Event
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDate, setNewDate] = useState(selectedDateStr);
  const [newStartTime, setNewStartTime] = useState("09:00");
  const [newEndTime, setNewEndTime] = useState("10:30");
  const [newCategory, setNewCategory] = useState<"activity" | "meeting" | "milestone" | "deadline">("activity");
  const [newProjId, setNewProjId] = useState<string>(projects[0]?.id ? String(projects[0].id) : "");
  const [submitting, setSubmitting] = useState(false);

  // Form State for Edit Event
  const [editingEvent, setEditingEvent] = useState<CalendarEventType | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editStartTime, setEditStartTime] = useState("09:00");
  const [editEndTime, setEditEndTime] = useState("10:30");
  const [editCategory, setEditCategory] = useState<"activity" | "meeting" | "milestone" | "deadline">("activity");
  const [editProjId, setEditProjId] = useState<string>("");
  const [updating, setUpdating] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const loadCalendarEvents = async () => {
    try {
      const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
      const url = `/api/calendar?month=${monthPrefix}${selectedProjectId !== "all" ? `&project_id=${selectedProjectId}` : ""}`;
      const res = await fetch(url);
      const data = await res.json();
      setEvents(data.events || []);
    } catch (e) {
      console.error("Gagal memuat jadwal kalender", e);
    }
  };

  useEffect(() => {
    const handleOpenProject = (e: Event) => {
      const customEvent = e as CustomEvent<{ projectId?: number }>;
      if (customEvent.detail?.projectId) {
        setSelectedProjectId(String(customEvent.detail.projectId));
      }
    };
    window.addEventListener("productivier:open_project", handleOpenProject);
    return () => {
      window.removeEventListener("productivier:open_project", handleOpenProject);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
    const url = `/api/calendar?month=${monthPrefix}${selectedProjectId !== "all" ? `&project_id=${selectedProjectId}` : ""}`;
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (active) setEvents(data.events || []);
      })
      .catch((e) => console.error("Gagal memuat jadwal kalender", e));

    const handleRefresh = () => {
      loadCalendarEvents();
    };
    window.addEventListener("productivier:refresh_data", handleRefresh);
    return () => {
      active = false;
      window.removeEventListener("productivier:refresh_data", handleRefresh);
    };
  // Efek mount/trigger tunggal: fungsi loader sengaja tidak jadi dependency agar tidak refetch tiap render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, selectedProjectId]);

  const handlePrevMonth = () => {
    const prev = new Date(year, month - 1, 1);
    setCurrentDate(prev);
    setSelectedDateStr(prev.toISOString().slice(0, 10));
  };

  const handleNextMonth = () => {
    const next = new Date(year, month + 1, 1);
    setCurrentDate(next);
    setSelectedDateStr(next.toISOString().slice(0, 10));
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDateStr(now.toISOString().slice(0, 10));
  };

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  // Combine calendar_events + project deadlines
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEventType[]> = {};

    events.forEach((ev) => {
      if (filterCategory !== "all" && ev.category !== filterCategory) return;
      if (!map[ev.date]) map[ev.date] = [];
      map[ev.date].push(ev);
    });

    // Also include project deadlines as deadline events
    projects.forEach((p) => {
      if (p.deadline) {
        if (filterCategory !== "all" && filterCategory !== "deadline") return;
        if (selectedProjectId !== "all" && String(p.id) !== selectedProjectId) return;
        const dStr = p.deadline.slice(0, 10);
        if (!map[dStr]) map[dStr] = [];
        map[dStr].push({
          id: 900000 + p.id,
          user_id: p.pic_id,
          title: `Deadline: ${p.nama_proyek}`,
          description: `Target total: ${p.target_total} ${p.satuan}`,
          date: dStr,
          start_time: "17:00",
          end_time: "18:00",
          category: "deadline",
          color: "#F87171",
          project_id: p.id,
          project_nama: p.nama_proyek,
          created_at: "",
        });
      }
    });

    return map;
  }, [events, projects, filterCategory, selectedProjectId]);

  // Realisasi tasks mapped by date
  const tasksByDate = useMemo(() => {
    const map: Record<string, RealisasiType[]> = {};
    realisasi.forEach((r) => {
      if (!map[r.tanggal]) map[r.tanggal] = [];
      map[r.tanggal].push(r);
    });
    return map;
  }, [realisasi]);

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          title: newTitle.trim(),
          description: newDesc.trim(),
          date: newDate,
          start_time: newStartTime,
          end_time: newEndTime,
          category: newCategory,
          project_id: newProjId ? Number(newProjId) : null,
          color: newCategory === "deadline" ? "#F87171" : newCategory === "meeting" ? "#DCD4FB" : "#D2F27C",
        }),
      });

      if (res.ok) {
        showToast("Agenda berhasil ditambahkan ke kalender!");
        setNewTitle("");
        setNewDesc("");
        setShowAddModal(false);
        await loadCalendarEvents();
      } else {
        showToast("Gagal menyimpan agenda");
      }
    } catch {
      showToast("Terjadi kesalahan jaringan");
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (ev: CalendarEventType) => {
    if (ev.id >= 900000) {
      showToast("Deadline proyek diatur di tab Proyek");
      return;
    }
    setEditingEvent(ev);
    setEditTitle(ev.title);
    setEditDesc(ev.description || "");
    setEditDate(ev.date);
    setEditStartTime(ev.start_time || "09:00");
    setEditEndTime(ev.end_time || "10:30");
    setEditCategory((ev.category as CalendarEventType["category"]) || "activity");
    setEditProjId(ev.project_id ? String(ev.project_id) : "");
  };

  const handleUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent || !editTitle.trim()) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/calendar/${editingEvent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDesc.trim(),
          date: editDate,
          start_time: editStartTime,
          end_time: editEndTime,
          category: editCategory,
          project_id: editProjId ? Number(editProjId) : null,
          color: editCategory === "deadline" ? "#F87171" : editCategory === "meeting" ? "#DCD4FB" : "#D2F27C",
        }),
      });

      if (res.ok) {
        showToast("Jadwal agenda berhasil diperbarui!");
        setEditingEvent(null);
        await loadCalendarEvents();
      } else {
        showToast("Gagal memperbarui jadwal");
      }
    } catch {
      showToast("Terjadi kesalahan jaringan");
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteEvent = (id: number) => {
    if (id >= 900000) {
      showToast("Deadline proyek diatur di tab Proyek");
      return;
    }
    setDeleteTargetId(id);
  };

  const executeDeleteEvent = async () => {
    if (deleteTargetId === null) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/calendar/${deleteTargetId}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Jadwal dihapus");
        setDeleteTargetId(null);
        await loadCalendarEvents();
      } else {
        showToast("Gagal menghapus jadwal");
      }
    } catch {
      showToast("Terjadi kesalahan jaringan");
    } finally {
      setDeleting(false);
    }
  };

  const selectedDateEvents = eventsByDate[selectedDateStr] || [];
  const selectedDateTasks = tasksByDate[selectedDateStr] || [];

  // Options for project dropdown
  const projectOptions: CustomSelectOption[] = [
    { value: "all", label: `Semua Proyek (${projects.length})` },
    ...projects.map((p) => ({
      value: String(p.id),
      label: p.nama_proyek,
      subLabel: `${p.divisi} · ${p.persentase}%`,
    })),
  ];

  const categoryOptions: CustomSelectOption[] = [
    { value: "activity", label: "Aktivitas Tim" },
    { value: "meeting", label: "Meeting / Diskusi" },
    { value: "milestone", label: "Milestone & Sprint" },
    { value: "deadline", label: "Deadline Proyek" },
  ];

  const modalProjectOptions: CustomSelectOption[] = [
    { value: "", label: "Tanpa Proyek Khusus (Umum)" },
    ...projects.map((p) => ({
      value: String(p.id),
      label: p.nama_proyek,
      subLabel: p.divisi,
    })),
  ];

  return (
    <div className="space-y-6">
      {/* Top Header & Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Kalender &amp; Agenda Kerja
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-[#D2F27C]/30 text-slate-900 dark:text-[#D2F27C] font-bold text-[10px] uppercase tracking-wider border border-[#D2F27C]/50">
              Live Sync
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            Jadwal kegiatan harian, meeting tim, milestone sprint, dan deadline proyek
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Custom Morph Project Filter */}
          <div className="w-48 sm:w-56">
            <CustomSelect
              value={selectedProjectId}
              onChange={setSelectedProjectId}
              options={projectOptions}
              variant="pill"
            />
          </div>

          {/* View Switcher: Month / Timeline */}
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-full p-1 flex items-center gap-1 shadow-xs border border-white/60 dark:border-white/10">
            <button
              onClick={() => setViewMode("month")}
              className={`px-3 py-1 text-xs font-semibold rounded-full transition cursor-pointer ${
                viewMode === "month"
                  ? "bg-[#1C1D21] text-white shadow-xs dark:bg-white dark:text-slate-900"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
              }`}
            >
              Bulan
            </button>
            <button
              onClick={() => setViewMode("timeline")}
              className={`px-3 py-1 text-xs font-semibold rounded-full transition cursor-pointer ${
                viewMode === "timeline"
                  ? "bg-[#1C1D21] text-white shadow-xs dark:bg-white dark:text-slate-900"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
              }`}
            >
              Timeline Jam
            </button>
          </div>

          {/* Add Agenda CTA */}
          <button
            onClick={() => {
              setNewDate(selectedDateStr);
              setShowAddModal(true);
            }}
            className="bg-[#1C1D21] hover:bg-black text-white px-5 py-2.5 rounded-full font-semibold text-xs sm:text-sm flex items-center gap-2 shadow-md transition active:scale-95 cursor-pointer dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Agenda</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Left Calendar View (8 Cols) + Right Selected Day Agenda (4 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Calendar / Timeline Widget */}
        <div className="lg:col-span-8 dashboard-card p-6 sm:p-8 dark:text-slate-100 space-y-5">
          {/* Calendar Month Navigation Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-700/80">
            <div className="flex items-center gap-3">
              <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white">
                {MONTH_NAMES[month]} {year}
              </h3>
              <button
                onClick={handleToday}
                className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 transition"
              >
                Hari Ini
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={handlePrevMonth}
                aria-label="Bulan sebelumnya"
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 grid place-items-center text-slate-700 dark:text-slate-200 transition cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleNextMonth}
                aria-label="Bulan berikutnya"
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 grid place-items-center text-slate-700 dark:text-slate-200 transition cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "all", label: "Semua Kategori" },
              { id: "activity", label: "Aktivitas" },
              { id: "meeting", label: "Meeting" },
              { id: "milestone", label: "Milestone" },
              { id: "deadline", label: "Deadline" },
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setFilterCategory(cat.id)}
                className={`px-3 py-1 text-xs font-semibold rounded-full transition cursor-pointer ${
                  filterCategory === cat.id
                    ? "bg-[#18181B] text-white dark:bg-white dark:text-slate-900 shadow-xs"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* VIEW 1: MONTH GRID */}
          {viewMode === "month" && (
            <div className="select-none">
              {/* Day of Week Header */}
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-400 uppercase tracking-wider pb-2 border-b border-slate-100 dark:border-slate-800">
                {DAYS_NAMES.map((d, idx) => (
                  <span key={d} className={idx === 0 ? "text-red-400" : ""}>
                    {d}
                  </span>
                ))}
              </div>

              {/* Day Cells Grid */}
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2 pt-2">
                {/* Blank days from prev month */}
                {Array.from({ length: firstDayIndex }).map((_, i) => (
                  <div key={`blank-${i}`} className="min-h-[75px] sm:min-h-[90px] p-1.5 rounded-2xl opacity-20" />
                ))}

                {/* Days of current month */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dNum = i + 1;
                  const dStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dNum).padStart(2, "0")}`;
                  const isSelected = selectedDateStr === dStr;
                  const isToday = new Date().toISOString().slice(0, 10) === dStr;
                  const dayEvents = eventsByDate[dStr] || [];
                  const dayTasks = tasksByDate[dStr] || [];

                  return (
                    <m.div
                      key={dStr}
                      whileHover={{ scale: 1.02 }}
                      onClick={() => setSelectedDateStr(dStr)}
                      className={`min-h-[75px] sm:min-h-[90px] p-2 rounded-2xl flex flex-col justify-between transition cursor-pointer border ${
                        isSelected
                          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-900 dark:border-white shadow-md ring-2 ring-slate-900/10"
                          : isToday
                          ? "bg-[#D2F27C]/25 border-[#D2F27C] text-slate-900 dark:text-white"
                          : "bg-white/80 hover:bg-white dark:bg-slate-800/80 dark:hover:bg-slate-800 border-slate-200/60 dark:border-slate-700/60 text-slate-800 dark:text-slate-200 shadow-2xs"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-black w-6 h-6 rounded-full grid place-items-center ${
                            isToday && !isSelected
                              ? "bg-[#18181B] text-[#D2F27C] dark:bg-white dark:text-slate-900"
                              : ""
                          }`}
                        >
                          {dNum}
                        </span>
                        {dayTasks.length > 0 && (
                          <span
                            title={`${dayTasks.length} realisasi tugas`}
                            className={`w-2 h-2 rounded-full ${
                              isSelected ? "bg-[#D2F27C]" : "bg-emerald-500"
                            }`}
                          />
                        )}
                      </div>

                      {/* Event Chips / Dots */}
                      <div className="space-y-1 mt-1">
                        {dayEvents.slice(0, 2).map((ev) => (
                          <div
                            key={ev.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModal(ev);
                            }}
                            title="Klik untuk melihat/mengedit agenda"
                            className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold truncate cursor-pointer transition hover:opacity-80 ${
                              isSelected
                                ? "bg-white/20 text-white dark:bg-slate-800 dark:text-white"
                                : `${CATEGORY_COLORS[ev.category]?.bg || "bg-slate-200"} ${CATEGORY_COLORS[ev.category]?.text || "text-slate-800"}`
                            }`}
                          >
                            {ev.title}
                          </div>
                        ))}
                        {dayEvents.length > 2 && (
                          <span
                            className={`text-[9px] font-bold block ${
                              isSelected ? "text-slate-300 dark:text-slate-600" : "text-slate-400"
                            }`}
                          >
                            +{dayEvents.length - 2} lagi
                          </span>
                        )}
                      </div>
                    </m.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* VIEW 2: TIMELINE HOUR VIEW (07:00 - 18:00) */}
          {viewMode === "timeline" && (
            <div className="space-y-3 pt-2">
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
                Timeline Agenda untuk tanggal:{" "}
                <span className="text-slate-900 dark:text-white font-extrabold">{selectedDateStr}</span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {[
                  "07:00", "08:00", "09:00", "10:00", "11:00", "12:00",
                  "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"
                ].map((hour) => {
                  const hourNum = parseInt(hour.slice(0, 2), 10);
                  const matchingEvents = selectedDateEvents.filter((ev) => {
                    const startH = parseInt(ev.start_time.slice(0, 2), 10);
                    return startH === hourNum;
                  });

                  return (
                    <div key={hour} className="py-3 flex items-start gap-4">
                      <span className="text-xs font-bold text-slate-400 dark:text-slate-500 w-12 shrink-0 pt-1 tabular-nums">
                        {hour}
                      </span>

                      <div className="flex-1 space-y-2">
                        {matchingEvents.map((ev) => (
                          <div
                            key={ev.id}
                            className={`p-3 rounded-2xl flex items-center justify-between border ${
                              CATEGORY_COLORS[ev.category]?.bg || "bg-slate-100"
                            } ${CATEGORY_COLORS[ev.category]?.border || "border-slate-200"}`}
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-slate-900 dark:text-slate-900">
                                  {ev.title}
                                </span>
                                <span className="text-[10px] px-2 py-0.2 rounded-full bg-white/70 text-slate-800 font-semibold">
                                  {ev.start_time} - {ev.end_time}
                                </span>
                              </div>
                              {ev.description && (
                                <p className="text-[11px] text-slate-600 mt-0.5">{ev.description}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => openEditModal(ev)}
                                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 transition cursor-pointer"
                                title="Edit Agenda"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteEvent(ev.id)}
                                className="text-slate-400 hover:text-red-600 p-1 transition cursor-pointer"
                                title="Hapus Agenda"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                        {matchingEvents.length === 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setNewDate(selectedDateStr);
                              setNewStartTime(hour);
                              setNewEndTime(`${String(Math.min(23, hourNum + 1)).padStart(2, "0")}:00`);
                              setShowAddModal(true);
                            }}
                            className="w-full min-h-[36px] border border-dashed border-slate-200/70 dark:border-slate-800 rounded-xl px-3 text-left text-xs text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition flex items-center justify-between group/slot cursor-pointer"
                          >
                            <span>Slot tersedia</span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 group-hover/slot:text-slate-900 dark:group-hover/slot:text-[#D2F27C]">
                              <Plus className="w-3.5 h-3.5" />
                              Tambah agenda
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Selected Day Detail Agenda & Logged Realisasi (4 Cols) */}
        <div className="lg:col-span-4 dashboard-card p-6 sm:p-7 dark:text-slate-100 space-y-5">
          <div className="pb-3 border-b border-slate-200/80 dark:border-slate-700/80">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Agenda Hari Terpilih
            </span>
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">
              {new Date(selectedDateStr).toLocaleDateString("id-ID", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </h3>
          </div>

          {/* Agenda Events on this day */}
          <div className="space-y-3">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Jadwal &amp; Meeting ({selectedDateEvents.length})</span>
              <button
                onClick={() => {
                  setNewDate(selectedDateStr);
                  setShowAddModal(true);
                }}
                className="text-xs text-[#526600] dark:text-[#D2F27C] font-extrabold hover:underline cursor-pointer"
              >
                + Tambah
              </button>
            </span>

            {selectedDateEvents.map((ev) => (
              <div
                key={ev.id}
                className={`p-3.5 rounded-2xl border ${
                  CATEGORY_COLORS[ev.category]?.bg || "bg-slate-100"
                } ${CATEGORY_COLORS[ev.category]?.border || "border-slate-200"} flex items-start justify-between gap-2`}
              >
                <div
                  className="flex-1 cursor-pointer"
                  onClick={() => openEditModal(ev)}
                  title="Klik untuk mengedit agenda"
                >
                  <span className="font-extrabold text-xs text-slate-900 block leading-tight">
                    {ev.title}
                  </span>
                  <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-700 font-medium">
                    <Clock className="w-3 h-3 text-slate-600" />
                    <span>
                      {ev.start_time} - {ev.end_time}
                    </span>
                    {ev.project_nama && (
                      <span className="px-1.5 py-0.2 rounded-md bg-white/60 text-[10px] font-semibold">
                        {ev.project_nama}
                      </span>
                    )}
                  </div>
                  {ev.description && (
                    <p className="text-[11px] text-slate-600 mt-1 leading-snug">{ev.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEditModal(ev)}
                    className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 transition cursor-pointer"
                    title="Edit Jadwal"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteEvent(ev.id)}
                    className="text-slate-400 hover:text-red-600 p-1 transition cursor-pointer"
                    title="Hapus Jadwal"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {selectedDateEvents.length === 0 && (
              <div className="py-6 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4">
                Tidak ada agenda terjadwal pada tanggal ini.
              </div>
            )}
          </div>

          {/* Realisasi Tasks Logged on this day */}
          <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Tugas Tercatat ({selectedDateTasks.length})</span>
              <button
                onClick={onGoInput}
                className="text-xs text-[#526600] dark:text-[#D2F27C] font-extrabold hover:underline cursor-pointer"
              >
                + Catat Baru
              </button>
            </span>

            {selectedDateTasks.map((t) => (
              <div
                key={t.id}
                className="p-3 rounded-2xl bg-slate-100/70 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between"
              >
                <div>
                  <span className="font-bold text-xs text-slate-900 dark:text-white block">
                    {t.aktivitas}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {t.nama} · {t.realisasi}/{t.target} {t.satuan}
                  </span>
                </div>
                <span
                  className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${
                    t.persentase >= 100
                      ? "bg-[#D2F27C] text-slate-900"
                      : "bg-[#DCD4FB] text-slate-900"
                  }`}
                >
                  {t.persentase}%
                </span>
              </div>
            ))}

            {selectedDateTasks.length === 0 && (
              <div className="py-4 text-center text-xs text-slate-400">
                Belum ada laporan realisasi tugas di tanggal ini.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Event Modal with Custom Morph Dropdowns */}
      <AnimatePresence>
        {showAddModal && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowAddModal(false)}
          >
            <m.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md dashboard-card p-6 sm:p-8 shadow-2xl dark:text-slate-100"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-slate-700 mb-5">
                <div>
                  <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                    Tambah Jadwal Agenda
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Sinkronkan jadwal meeting atau aktivitas tim
                  </p>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateEvent} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Nama Agenda / Aktivitas
                  </label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Contoh: Rapat Sinkronisasi Konten Kreatif"
                    className="w-full px-4 py-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Tanggal
                    </label>
                    <input
                      type="date"
                      required
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Kategori
                    </label>
                    <CustomSelect
                      value={newCategory}
                      onChange={(v) => setNewCategory(v as CalendarEventType["category"])}
                      options={categoryOptions}
                      variant="form"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Jam Mulai
                    </label>
                    <input
                      type="time"
                      required
                      value={newStartTime}
                      onChange={(e) => setNewStartTime(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Jam Selesai
                    </label>
                    <input
                      type="time"
                      required
                      value={newEndTime}
                      onChange={(e) => setNewEndTime(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition cursor-pointer"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Proyek Terkait
                  </label>
                  <CustomSelect
                    value={newProjId}
                    onChange={setNewProjId}
                    options={modalProjectOptions}
                    variant="form"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Catatan Tambahan (Opsional)
                  </label>
                  <textarea
                    rows={2}
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Link Google Meet atau poin pembahasan..."
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition resize-none"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full min-h-[46px] rounded-full bg-[#1C1D21] hover:bg-black text-white font-semibold text-sm shadow-md active:scale-[0.98] transition flex items-center justify-center gap-2 cursor-pointer dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                  >
                    <span>{submitting ? "Menyimpan Jadwal..." : "Simpan ke Kalender"}</span>
                  </button>
                </div>
              </form>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>

      {/* Edit Event Modal with Custom Morph Dropdowns */}
      <AnimatePresence>
        {editingEvent && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setEditingEvent(null)}
          >
            <m.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md dashboard-card p-6 sm:p-8 shadow-2xl dark:text-slate-100"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-slate-700 mb-5">
                <div>
                  <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                    Edit Jadwal Agenda
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Perbarui rincian meeting, aktivitas, atau kategori kegiatan
                  </p>
                </div>
                <button
                  onClick={() => setEditingEvent(null)}
                  className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleUpdateEvent} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Nama Agenda / Aktivitas
                  </label>
                  <input
                    type="text"
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Contoh: Rapat Sinkronisasi Konten Kreatif"
                    className="w-full px-4 py-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Tanggal
                    </label>
                    <input
                      type="date"
                      required
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Kategori
                    </label>
                    <CustomSelect
                      value={editCategory}
                      onChange={(v) => setEditCategory(v as CalendarEventType["category"])}
                      options={categoryOptions}
                      variant="form"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Jam Mulai
                    </label>
                    <input
                      type="time"
                      required
                      value={editStartTime}
                      onChange={(e) => setEditStartTime(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Jam Selesai
                    </label>
                    <input
                      type="time"
                      required
                      value={editEndTime}
                      onChange={(e) => setEditEndTime(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition cursor-pointer"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Proyek Terkait
                  </label>
                  <CustomSelect
                    value={editProjId}
                    onChange={setEditProjId}
                    options={modalProjectOptions}
                    variant="form"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Catatan Tambahan (Opsional)
                  </label>
                  <textarea
                    rows={2}
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    placeholder="Link Google Meet atau poin pembahasan..."
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition resize-none"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={updating}
                    className="w-full min-h-[46px] rounded-full bg-[#1C1D21] hover:bg-black text-white font-semibold text-sm shadow-md active:scale-[0.98] transition flex items-center justify-center gap-2 cursor-pointer dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                  >
                    <span>{updating ? "Menyimpan Perubahan..." : "Simpan Perubahan Jadwal"}</span>
                  </button>
                </div>
              </form>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={deleteTargetId !== null}
        title="Hapus Agenda Kalender"
        message="Yakin ingin menghapus jadwal agenda ini dari kalender tim?"
        confirmLabel="Hapus Agenda"
        loading={deleting}
        onConfirm={executeDeleteEvent}
        onCancel={() => !deleting && setDeleteTargetId(null)}
      />
    </div>
  );
}
