"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  FolderKanban,
  Share2,
  ExternalLink,
  Plus,
  Trash2,
  Copy,
  Check,
  CheckSquare,
  Square,
  FileText,
  Layers,
  Sparkles,
  Link2,
  StickyNote,
  MessageSquareQuote,
  Clock,
  CheckCircle2,
  HelpCircle,
  Send,
  RefreshCw,
  User,
  Tag,
  Pin,
  ChevronRight,
  AlertCircle,
  ShieldCheck,
  Calendar,
  Globe,
  X,
  MessageSquare,
  Users,
  UserPlus,
  UserCheck,
  MoreHorizontal,
} from "lucide-react";
import CustomSelect, { CustomSelectOption } from "@/components/ui/CustomSelect";
import ConfirmModal from "@/components/ui/ConfirmModal";
import {
  ProjectType,
  ProjectLinkType,
  ProjectClientNoteType,
  RealisasiType,
  NoteType,
  UserType,
  ProjectMemberType,
  CalendarEventType,
} from "@/types";

interface ProjectDetailViewProps {
  project: ProjectType;
  user: UserType;
  users?: UserType[];
  onBack: () => void;
  onRefreshProjects: () => Promise<void>;
  onGoInput: () => void;
  onGoNotes?: (projectId?: number) => void;
  onGoChat?: (projectId: number) => void;
  onGoCalendar?: (projectId: number) => void;
  showToast: (m: string) => void;
}

const PASTEL_COLORS = [
  { value: "#D2F27C", label: "Fresh Lime", border: "border-[#D2F27C]" },
  { value: "#DCD4FB", label: "Soft Lavender", border: "border-[#DCD4FB]" },
  { value: "#CBD5E1", label: "Clean Slate", border: "border-[#CBD5E1]" },
  { value: "#FFFFFF", label: "Putih Bersih", border: "border-slate-300" },
];

export default function ProjectDetailView({
  project,
  user,
  users = [],
  onBack,
  onRefreshProjects,
  onGoInput,
  onGoNotes,
  onGoChat,
  onGoCalendar,
  showToast,
}: ProjectDetailViewProps) {
  // Navigation & Sub-Tabs state for Column Left: resources | calendar | notes | realisasi
  const [activeLeftTab, setActiveLeftTab] = useState<"resources" | "calendar" | "notes" | "realisasi">("resources");

  // Project Members State
  const [members, setMembers] = useState<ProjectMemberType[]>(project.members || []);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [selectedNewUserId, setSelectedNewUserId] = useState<string>("");
  const [addingMember, setAddingMember] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    action: () => Promise<void>;
  } | null>(null);

  // Calendar & Milestone State
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventType[]>([]);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [showAddEventForm, setShowAddEventForm] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState(new Date().toISOString().slice(0, 10));
  const [eventStartTime, setEventStartTime] = useState("09:00");
  const [eventEndTime, setEventEndTime] = useState("10:00");
  const [eventCategory, setEventCategory] = useState<CalendarEventType["category"]>("milestone");
  const [eventDescription, setEventDescription] = useState("");
  const [savingEvent, setSavingEvent] = useState(false);

  // Links State
  const [links, setLinks] = useState<ProjectLinkType[]>(project.links || []);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [showAddLinkForm, setShowAddLinkForm] = useState(false);
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkPlatform, setLinkPlatform] = useState<ProjectLinkType["platform"]>("drive");
  const [savingLink, setSavingLink] = useState(false);

  // Client Notes & Feedback Stream State
  const [clientNotes, setClientNotes] = useState<ProjectClientNoteType[]>([]);
  const [loadingClientNotes, setLoadingClientNotes] = useState(false);
  const [clientFilterStatus, setClientFilterStatus] = useState<"all" | "open" | "in_progress" | "resolved">("all");
  const [teamReplyMessage, setTeamReplyMessage] = useState("");
  const [replyCategory, setReplyCategory] = useState<ProjectClientNoteType["category"]>("feedback");
  const [submittingReply, setSubmittingReply] = useState(false);

  // Internal Notes State (connected to notes table)
  const [internalNotes, setInternalNotes] = useState<NoteType[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [showAddNoteForm, setShowAddNoteForm] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteTags, setNoteTags] = useState("");
  const [noteColor, setNoteColor] = useState("#D2F27C");
  const [noteChecklist, setNoteChecklist] = useState<Array<{ id: string; text: string; done: boolean }>>([]);
  const [newChecklistText, setNewChecklistText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Realisasi Log State
  const [projectRealisasi, setProjectRealisasi] = useState<RealisasiType[]>([]);
  const [loadingRealisasi, setLoadingRealisasi] = useState(false);

  // Reactive Project State
  const [currentProject, setCurrentProject] = useState<ProjectType>(project);
  useEffect(() => {
    setCurrentProject(project);
    if (project.members) {
      setMembers(project.members);
    }
  }, [project]);

  // Quick In-Page Progress Input State (Modal & Inline Form)
  const [showQuickInputModal, setShowQuickInputModal] = useState(false);
  const [showInlineInputForm, setShowInlineInputForm] = useState(false);
  const [inputAktivitas, setInputAktivitas] = useState("");
  const [inputTarget, setInputTarget] = useState<number>(1);
  const [inputRealisasi, setInputRealisasi] = useState<number>(1);
  const [inputSatuan, setInputSatuan] = useState(project.satuan || "Tugas");
  const [inputTanggal, setInputTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [inputAssignedUserId, setInputAssignedUserId] = useState<string>(String(user.id));
  const [inputDeadline, setInputDeadline] = useState<string>("");
  const [inputKendala, setInputKendala] = useState("");
  const [inputSolusi, setInputSolusi] = useState("");
  const [submittingProgress, setSubmittingProgress] = useState(false);

  const handleQuickSubmitProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputAktivitas.trim() || submittingProgress) return;

    setSubmittingProgress(true);
    const targetVal = Number(inputTarget) || 1;
    const realisasiVal = Number(inputRealisasi) || 0;
    const pct = targetVal > 0 ? Math.round((realisasiVal / targetVal) * 100) : 100;
    const isDelegation = Number(inputAssignedUserId) !== user.id;
    const status = isDelegation && realisasiVal === 0 ? "Belum" : pct >= 100 ? "Tercapai" : pct >= 70 ? "Hampir" : "Belum";

    try {
      const res = await fetch("/api/realisasi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: currentProject.id,
          user_id: Number(inputAssignedUserId) || user.id,
          assigned_to_user_id: Number(inputAssignedUserId) || user.id,
          assigned_by_user_id: isDelegation ? user.id : null,
          deadline: inputDeadline || currentProject.deadline || "",
          nama: user.nama,
          divisi: user.divisi,
          tanggal: inputTanggal,
          aktivitas: inputAktivitas.trim(),
          target: targetVal,
          realisasi: realisasiVal,
          satuan: inputSatuan.trim() || currentProject.satuan,
          persentase: pct,
          status,
          kendala: inputKendala.trim(),
          solusi: inputSolusi.trim(),
        }),
      });

      if (res.ok) {
        showToast(
          isDelegation
            ? `Tugas berhasil didelegasikan ke anggota tim & notifikasi lonceng dikirim!`
            : `Progres tugas "${inputAktivitas.trim()}" berhasil disimpan langsung!`
        );
        setInputAktivitas("");
        setInputKendala("");
        setInputSolusi("");
        setShowQuickInputModal(false);
        setShowInlineInputForm(false);

        // Reactively update local project stats if worked
        const newTotal = currentProject.total_realisasi + realisasiVal;
        const newPct = Math.min(100, Math.round((newTotal / currentProject.target_total) * 100));
        setCurrentProject((prev) => ({
          ...prev,
          total_realisasi: newTotal,
          persentase: newPct,
          jumlah_laporan: prev.jumlah_laporan + 1,
        }));

        await fetchProjectRealisasi();
        await onRefreshProjects();
      } else {
        const data = await res.json();
        showToast(data.error || "Gagal menyimpan progres tugas");
      }
    } catch {
      showToast("Terjadi kesalahan jaringan");
    } finally {
      setSubmittingProgress(false);
    }
  };

  // Share portal copy & header menu state
  const [copiedShareLink, setCopiedShareLink] = useState(false);
  const [showHeaderActionsMenu, setShowHeaderActionsMenu] = useState(false);

  const clientPortalPath = currentProject.share_token
    ? `/client/project/${currentProject.id}?token=${encodeURIComponent(currentProject.share_token)}`
    : `/client/project/${currentProject.id}`;

  const clientPortalUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${clientPortalPath}`
      : clientPortalPath;

  const handleToggleProjectStatus = async () => {
    const newStatus = currentProject.status === "selesai" ? "aktif" : "selesai";
    try {
      const res = await fetch(`/api/projects/${currentProject.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setCurrentProject((prev) => ({ ...prev, status: newStatus }));
        showToast(newStatus === "selesai" ? "Proyek ditandai selesai!" : "Proyek diaktifkan kembali!");
        await onRefreshProjects();
      } else {
        showToast("Gagal mengubah status proyek");
      }
    } catch {
      showToast("Kesalahan jaringan");
    }
  };

  const handleDeleteProject = () => {
    const projectId = currentProject.id;
    setPendingConfirm({
      title: "Hapus Proyek Permanen",
      message: `Hapus permanen proyek "${currentProject.nama_proyek}"? Semua data terkait akan terhapus.`,
      confirmLabel: "Hapus Proyek",
      action: async () => {
        try {
          const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
          if (res.ok) {
            showToast("Proyek berhasil dihapus");
            await onRefreshProjects();
            onBack();
          } else {
            showToast("Gagal menghapus proyek");
          }
        } catch {
          showToast("Kesalahan jaringan");
        }
      },
    });
  };

  // 1. Fetch Links
  const fetchLinks = async () => {
    setLoadingLinks(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/links`);
      const data = await res.json();
      if (res.ok && data.links) {
        setLinks(data.links);
      }
    } catch (e) {
      console.error("Gagal memuat link proyek", e);
    } finally {
      setLoadingLinks(false);
    }
  };

  // 2. Fetch Client Notes
  const fetchClientNotes = async () => {
    setLoadingClientNotes(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/client-notes`);
      const data = await res.json();
      if (res.ok && data.clientNotes) {
        setClientNotes(data.clientNotes);
      }
    } catch (e) {
      console.error("Gagal memuat feedback klien", e);
    } finally {
      setLoadingClientNotes(false);
    }
  };

  // 3. Fetch Internal Notes for this Project
  const fetchInternalNotes = async () => {
    setLoadingNotes(true);
    try {
      const res = await fetch(`/api/notes?project_id=${project.id}`);
      const data = await res.json();
      if (res.ok && data.notes) {
        setInternalNotes(data.notes);
      }
    } catch (e) {
      console.error("Gagal memuat catatan internal proyek", e);
    } finally {
      setLoadingNotes(false);
    }
  };

  // 4. Fetch Realisasi Logs
  const fetchProjectRealisasi = async () => {
    setLoadingRealisasi(true);
    try {
      const res = await fetch(`/api/realisasi?project_id=${project.id}&user_id=${user.id}&role=${user.role}`);
      const data = await res.json();
      if (res.ok && data.realisasi) {
        const filtered = data.realisasi.filter((r: RealisasiType) => r.project_id === project.id);
        setProjectRealisasi(filtered);
      }
    } catch (e) {
      console.error("Gagal memuat realisasi tugas", e);
    } finally {
      setLoadingRealisasi(false);
    }
  };

  // 5. Fetch Project Members
  const fetchMembers = async () => {
    setLoadingMembers(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/members`);
      const data = await res.json();
      if (res.ok && data.members) {
        setMembers(data.members);
      }
    } catch (e) {
      console.error("Gagal memuat anggota tim proyek", e);
    } finally {
      setLoadingMembers(false);
    }
  };

  // 6. Fetch Calendar Events & Milestones
  const fetchCalendarEvents = async () => {
    setLoadingCalendar(true);
    try {
      const res = await fetch(`/api/calendar?project_id=${project.id}`);
      const data = await res.json();
      if (res.ok && data.events) {
        setCalendarEvents(data.events);
      }
    } catch (e) {
      console.error("Gagal memuat jadwal proyek", e);
    } finally {
      setLoadingCalendar(false);
    }
  };

  const handleAddMember = async (userIdToAdd: number) => {
    if (!userIdToAdd || addingMember) return;
    setAddingMember(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userIdToAdd, role: "member" }),
      });
      const data = await res.json();
      if (res.ok && data.members) {
        setMembers(data.members);
        setShowAddMemberModal(false);
        showToast("Anggota berhasil ditambahkan ke proyek & grup chat!");
        await onRefreshProjects();
      } else {
        showToast(data.error || "Gagal menambahkan anggota");
      }
    } catch {
      showToast("Terjadi kesalahan jaringan");
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = (userIdToRemove: number) => {
    setPendingConfirm({
      title: "Keluarkan Anggota Proyek",
      message: "Keluarkan anggota ini dari akses tim proyek?",
      confirmLabel: "Keluarkan",
      action: async () => {
        try {
          const res = await fetch(`/api/projects/${project.id}/members?user_id=${userIdToRemove}`, {
            method: "DELETE",
          });
          if (res.ok) {
            setMembers((prev) => prev.filter((m) => m.user_id !== userIdToRemove));
            showToast("Anggota dikeluarkan dari proyek");
            await onRefreshProjects();
          } else {
            showToast("Gagal mengeluarkan anggota");
          }
        } catch {
          showToast("Terjadi kesalahan jaringan");
        }
      },
    });
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim() || savingEvent) return;
    setSavingEvent(true);
    try {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          project_id: project.id,
          title: eventTitle.trim(),
          description: eventDescription.trim(),
          date: eventDate,
          start_time: eventStartTime,
          end_time: eventEndTime,
          category: eventCategory,
          color: eventCategory === "deadline" ? "#F87171" : eventCategory === "milestone" ? "#D2F27C" : "#DCD4FB",
        }),
      });
      if (res.ok) {
        setEventTitle("");
        setEventDescription("");
        setShowAddEventForm(false);
        showToast("Milestone / Jadwal proyek berhasil dibuat!");
        await fetchCalendarEvents();
      } else {
        showToast("Gagal menyimpan jadwal proyek");
      }
    } catch {
      showToast("Terjadi kesalahan jaringan");
    } finally {
      setSavingEvent(false);
    }
  };

  useEffect(() => {
    fetchLinks();
    fetchClientNotes();
    fetchInternalNotes();
    fetchProjectRealisasi();
    fetchMembers();
    fetchCalendarEvents();
  }, [project.id]);

  // Handle Add Link
  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkTitle.trim() || !linkUrl.trim()) return;
    setSavingLink(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: linkTitle.trim(),
          url: linkUrl.trim(),
          platform: linkPlatform,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setLinkTitle("");
        setLinkUrl("");
        setShowAddLinkForm(false);
        showToast("Tautan aset berhasil ditambahkan!");
        await fetchLinks();
        await onRefreshProjects();
      } else {
        showToast(data.error || "Gagal menambahkan tautan");
      }
    } catch {
      showToast("Terjadi gangguan jaringan");
    } finally {
      setSavingLink(false);
    }
  };

  // Handle Delete Link
  const handleDeleteLink = (linkId: number) => {
    setPendingConfirm({
      title: "Hapus Tautan Aset",
      message: "Hapus tautan aset proyek ini secara permanen?",
      confirmLabel: "Hapus Tautan",
      action: async () => {
        try {
          const res = await fetch(`/api/projects/${project.id}/links?link_id=${linkId}`, {
            method: "DELETE",
          });
          if (res.ok) {
            showToast("Tautan aset dihapus");
            await fetchLinks();
            await onRefreshProjects();
          } else {
            showToast("Gagal menghapus tautan");
          }
        } catch {
          showToast("Terjadi kesalahan jaringan");
        }
      },
    });
  };

  // Handle Status Update for Client Note
  const handleUpdateClientNoteStatus = async (
    noteId: number,
    newStatus: "open" | "in_progress" | "resolved"
  ) => {
    // Optimistic UI update
    setClientNotes((prev) =>
      prev.map((n) => (n.id === noteId ? { ...n, status: newStatus } : n))
    );

    try {
      const res = await fetch(`/api/projects/${project.id}/client-notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note_id: noteId,
          status: newStatus,
        }),
      });
      if (res.ok) {
        showToast(`Status catatan diubah menjadi: ${newStatus}`);
      } else {
        showToast("Gagal memperbarui status catatan");
        await fetchClientNotes();
      }
    } catch {
      showToast("Terjadi gangguan jaringan");
      await fetchClientNotes();
    }
  };

  // Handle Team Reply submission
  const handleSendTeamReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamReplyMessage.trim()) return;

    setSubmittingReply(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/client-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          author_name: user.nama,
          author_role: "team",
          message: teamReplyMessage.trim(),
          category: replyCategory,
          status: "in_progress",
        }),
      });

      const data = await res.json();
      if (res.ok && data.clientNote) {
        setTeamReplyMessage("");
        showToast("Respon tim berhasil dikirimkan ke portal klien!");
        await fetchClientNotes();
      } else {
        showToast(data.error || "Gagal mengirim respon tim");
      }
    } catch {
      showToast("Terjadi kesalahan jaringan");
    } finally {
      setSubmittingReply(false);
    }
  };

  // Internal Notes Checklist Toggle
  const handleToggleChecklist = async (note: NoteType, itemId: string) => {
    const updatedChecklist = (note.checklist || []).map((item) =>
      item.id === itemId ? { ...item, done: !item.done } : item
    );

    setInternalNotes((prev) =>
      prev.map((n) => (n.id === note.id ? { ...n, checklist: updatedChecklist } : n))
    );

    try {
      await fetch(`/api/notes/${note.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checklist: updatedChecklist }),
      });
    } catch {
      showToast("Gagal memperbarui checklist catatan");
    }
  };

  // Internal Notes Pin Toggle
  const handleTogglePinNote = async (note: NoteType) => {
    const newPinned = !note.pinned;
    setInternalNotes((prev) =>
      prev.map((n) => (n.id === note.id ? { ...n, pinned: newPinned } : n))
    );

    try {
      await fetch(`/api/notes/${note.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: newPinned }),
      });
      showToast(newPinned ? "Catatan disematkan di atas" : "Semat catatan dilepas");
      await fetchInternalNotes();
    } catch {
      showToast("Gagal mengubah sematan");
    }
  };

  // Internal Note Delete
  const handleDeleteNote = (noteId: number) => {
    setPendingConfirm({
      title: "Hapus Catatan Internal",
      message: "Hapus catatan internal proyek ini secara permanen?",
      confirmLabel: "Hapus Catatan",
      action: async () => {
        try {
          const res = await fetch(`/api/notes/${noteId}`, { method: "DELETE" });
          if (res.ok) {
            showToast("Catatan internal dihapus");
            await fetchInternalNotes();
          } else {
            showToast("Gagal menghapus catatan");
          }
        } catch {
          showToast("Terjadi kesalahan jaringan");
        }
      },
    });
  };

  // Create Internal Note
  const handleCreateInternalNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim()) return;

    setSavingNote(true);
    const tagsArray = noteTags
      .split(",")
      .map((t) => t.trim().replace(/^#/, ""))
      .filter(Boolean);

    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          title: noteTitle.trim(),
          content: noteContent.trim(),
          tags: tagsArray,
          pinned: false,
          color: noteColor,
          project_id: project.id,
          checklist: noteChecklist,
        }),
      });

      if (res.ok) {
        setNoteTitle("");
        setNoteContent("");
        setNoteTags("");
        setNoteChecklist([]);
        setShowAddNoteForm(false);
        showToast("Catatan proyek baru berhasil disimpan & terhubung ke Sidebar Notes!");
        await fetchInternalNotes();
      } else {
        showToast("Gagal menyimpan catatan proyek");
      }
    } catch {
      showToast("Terjadi kesalahan jaringan");
    } finally {
      setSavingNote(false);
    }
  };

  const handleAddChecklistItem = () => {
    if (!newChecklistText.trim()) return;
    setNoteChecklist((prev) => [
      ...prev,
      { id: Date.now().toString(), text: newChecklistText.trim(), done: false },
    ]);
    setNewChecklistText("");
  };

  const handleCopyClientLink = () => {
    navigator.clipboard.writeText(clientPortalUrl);
    setCopiedShareLink(true);
    showToast("Link Portal Klien berhasil disalin ke clipboard!");
    setTimeout(() => setCopiedShareLink(false), 3000);
  };

  const getPlatformBadge = (platform: ProjectLinkType["platform"]) => {
    switch (platform) {
      case "drive":
        return { label: "Google Drive", color: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300" };
      case "notion":
        return { label: "Notion", color: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200" };
      case "figma":
        return { label: "Figma", color: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300" };
      case "github":
        return { label: "GitHub / Web", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300" };
      case "sheets":
        return { label: "Google Sheets", color: "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300" };
      default:
        return { label: "Tautan Aset", color: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300" };
    }
  };

  // Filtered client notes
  const filteredClientNotes = useMemo(() => {
    if (clientFilterStatus === "all") return clientNotes;
    return clientNotes.filter((n) => n.status === clientFilterStatus);
  }, [clientNotes, clientFilterStatus]);

  const openClientNotesCount = useMemo(() => {
    return clientNotes.filter((n) => n.status === "open").length;
  }, [clientNotes]);

  const isComplete = project.persentase >= 100;

  return (
    <div className="space-y-6">
      {/* 1. TOP DEDICATED HEADER & ACTION BAR */}
      <div className="dashboard-card p-6 sm:p-7 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-xs space-y-4">
        {/* Breadcrumb & Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onBack}
              className="px-3.5 py-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold flex items-center gap-2 transition active:scale-95 cursor-pointer shadow-2xs whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              <span>Semua Proyek</span>
            </button>

            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 min-w-0">
              <span>Proyek</span>
              <span>/</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                {currentProject.nama_proyek}
              </span>
            </div>
          </div>

          {/* Primary Actions + Overflow Dropdown (No cramped wrapping buttons) */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
            {onGoChat && (
              <button
                onClick={() => {
                  if (typeof window !== "undefined") {
                    sessionStorage.setItem("productivier_chat_project_id", String(currentProject.id));
                  }
                  onGoChat(currentProject.id);
                }}
                className="px-3.5 py-2 rounded-full bg-[#DCD4FB] hover:bg-[#cbbcf8] text-purple-950 dark:bg-purple-900/60 dark:hover:bg-purple-900 dark:text-purple-200 text-xs font-bold flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer whitespace-nowrap"
                title="Buka ruang diskusi grup tim proyek ini di tab Chat"
              >
                <MessageSquare className="w-3.5 h-3.5 text-purple-700 dark:text-purple-300" />
                <span>Diskusi Tim</span>
              </button>
            )}

            <button
              onClick={handleCopyClientLink}
              className="px-3.5 py-2 rounded-full bg-[#1C1D21] hover:bg-black text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 text-xs font-bold flex items-center gap-2 shadow-xs transition active:scale-95 cursor-pointer whitespace-nowrap"
              title="Salin tautan portal klien bertoken"
            >
              {copiedShareLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#D2F27C] dark:text-emerald-600" />
                  <span>Tersalin</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Bagikan ke Klien</span>
                </>
              )}
            </button>

            <button
              onClick={handleToggleProjectStatus}
              className={`px-3.5 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer whitespace-nowrap ${
                currentProject.status === "selesai"
                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              }`}
              title={currentProject.status === "selesai" ? "Kembalikan ke status aktif" : "Tandai proyek telah selesai"}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{currentProject.status === "selesai" ? "Buka Kembali" : "Tandai Selesai"}</span>
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowHeaderActionsMenu((prev) => !prev)}
                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 grid place-items-center transition cursor-pointer shrink-0"
                title="Aksi Lainnya"
                aria-label="Aksi Proyek Lainnya"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>

              {showHeaderActionsMenu && (
                <div
                  onMouseLeave={() => setShowHeaderActionsMenu(false)}
                  className="absolute right-0 mt-2 w-52 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl p-1.5 z-[70] space-y-1 text-xs"
                >
                  <a
                    href={clientPortalUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setShowHeaderActionsMenu(false)}
                    className="w-full px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-2 transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Buka Portal Klien</span>
                  </a>
                  {onGoNotes && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowHeaderActionsMenu(false);
                        onGoNotes(currentProject.id);
                      }}
                      className="w-full px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-2 transition text-left cursor-pointer"
                    >
                      <StickyNote className="w-3.5 h-3.5" />
                      <span>Notes Proyek Penuh</span>
                    </button>
                  )}
                  <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
                  <button
                    type="button"
                    onClick={() => {
                      setShowHeaderActionsMenu(false);
                      handleDeleteProject();
                    }}
                    className="w-full px-3 py-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 font-bold flex items-center gap-2 transition text-left cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Proyek</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Project Title and Meta Info */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs tracking-wide">
                {project.divisi}
              </span>
              <span
                className={`px-3 py-1 rounded-full font-extrabold text-xs uppercase tracking-wider ${
                  project.status === "aktif"
                    ? "bg-[#D2F27C]/40 text-slate-900 dark:text-[#D2F27C] border border-[#D2F27C]/60"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                }`}
              >
                {project.status === "aktif" ? "Proyek Aktif" : "Selesai"}
              </span>
              {project.deadline && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-100/70 text-red-800 dark:bg-red-950/40 dark:text-red-300 text-xs font-semibold">
                  <Clock className="w-3 h-3" />
                  <span>Deadline: {project.deadline}</span>
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
              {project.nama_proyek}
            </h1>

            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
              Penanggung Jawab Proyek (PIC):{" "}
              <strong className="text-slate-800 dark:text-slate-200">
                {project.pic_nama || user.nama}
              </strong>{" "}
              · Target Satuan: <strong className="text-slate-800 dark:text-slate-200">{project.satuan}</strong>
            </p>
          </div>

          <button
            onClick={() => setShowQuickInputModal(true)}
            className="px-5 py-2.5 rounded-full bg-[#1C1D21] hover:bg-black text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 text-xs font-bold flex items-center gap-2 shadow-md transition active:scale-95 self-start md:self-center cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#D2F27C] dark:text-slate-900" />
            <span>Catat Tugas Proyek Ini</span>
          </button>
        </div>
      </div>

      {/* 2. BENTO ROW 1 — KEY PERFORMANCE METRICS (3 Asymmetric Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Progress & Target Velocity */}
        <div className="dashboard-card p-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Capaian &amp; Progres Pengerjaan
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                currentProject.persentase >= 100
                  ? "bg-[#D2F27C] text-slate-900"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              }`}
            >
              {currentProject.persentase >= 100 ? "Target Tuntas" : "Sedang Berjalan"}
            </span>
          </div>

          <div className="my-4">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tabular-nums">
                {currentProject.persentase}%
              </span>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {currentProject.total_realisasi} / {currentProject.target_total} {currentProject.satuan}
              </span>
            </div>

            <div className="w-full h-3.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden relative shadow-inner">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(100, Math.max(5, currentProject.persentase))}%`,
                  backgroundColor: currentProject.persentase >= 100 ? "#D2F27C" : "#1C1D21",
                }}
              />
            </div>
          </div>

          <div className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center justify-between pt-1">
            <span>{currentProject.jumlah_laporan} aktivitas diverifikasi</span>
            <span>Sisa: {Math.max(0, currentProject.target_total - currentProject.total_realisasi)} {currentProject.satuan}</span>
          </div>
        </div>

        {/* Card 2: Cloud Workspace Launcher */}
        <div className="dashboard-card p-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Cloud Resource Hub
            </span>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
              {links.length} Tautan Aset
            </span>
          </div>

          <div className="my-3 flex flex-wrap gap-2">
            {links.length > 0 ? (
              links.slice(0, 5).map((l) => {
                const badge = getPlatformBadge(l.platform);
                return (
                  <a
                    key={l.id}
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition hover:scale-105 active:scale-95 shadow-2xs ${badge.color}`}
                    title={l.title}
                  >
                    <span className="truncate max-w-[110px]">{l.title}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                );
              })
            ) : (
              <p className="text-xs text-slate-400 italic py-2">
                Belum ada link cloud aset. Tambahkan di bawah.
              </p>
            )}
          </div>

          <button
            onClick={() => {
              setActiveLeftTab("resources");
              setShowAddLinkForm(true);
            }}
            className="text-xs font-bold text-slate-800 dark:text-slate-200 hover:underline flex items-center gap-1.5 pt-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-[#D2F27C]" />
            <span>Kelola &amp; Tambah Link Dokumen</span>
          </button>
        </div>

        {/* Card 3: Client Feedback Status & Portal Hub */}
        <div className="dashboard-card p-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Kanal Feedback Klien
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-extrabold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Portal Live</span>
            </span>
          </div>

          <div className="my-3 flex items-center justify-between">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tabular-nums">
                  {clientNotes.length}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                  Total Respon
                </span>
              </div>
              <p className="text-[11px] text-amber-600 dark:text-amber-400 font-bold mt-0.5">
                {openClientNotesCount > 0
                  ? `${openClientNotesCount} masukan baru perlu ditinjau tim`
                  : "Semua masukan telah ditindaklanjuti"}
              </p>
            </div>

            <button
              onClick={handleCopyClientLink}
              className="p-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white transition cursor-pointer"
              title="Salin Link Portal Klien"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-between pt-1">
            <a
              href={clientPortalUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-bold text-slate-900 dark:text-white hover:underline flex items-center gap-1"
            >
              <span>Pratinjau Halaman Publik ↗</span>
            </a>
            <span className="text-[11px] text-slate-400">Akses tanpa login</span>
          </div>
        </div>
      </div>

      {/* 3. BENTO ROW 2 — ASYMMETRIC MULTI-COLUMN WORKSPACE HUB (7:5 Split) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ================= LEFT COLUMN (7 Cols) ================= */}
        <div className="lg:col-span-7 space-y-5">
          {/* Sub-Tab Navigation Header */}
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-1.5 rounded-3xl border border-slate-200/80 dark:border-slate-800 flex items-center gap-1 shadow-xs">
            <button
              onClick={() => setActiveLeftTab("resources")}
              className={`flex-1 py-2.5 px-3 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeLeftTab === "resources"
                  ? "bg-[#1C1D21] text-white shadow-xs dark:bg-white dark:text-slate-900"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>Aset ({links.length})</span>
            </button>

            <button
              onClick={() => setActiveLeftTab("calendar")}
              className={`flex-1 py-2.5 px-3 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeLeftTab === "calendar"
                  ? "bg-[#1C1D21] text-white shadow-xs dark:bg-white dark:text-slate-900"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Kalender ({calendarEvents.length})</span>
            </button>

            <button
              onClick={() => setActiveLeftTab("notes")}
              className={`flex-1 py-2.5 px-3 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeLeftTab === "notes"
                  ? "bg-[#1C1D21] text-white shadow-xs dark:bg-white dark:text-slate-900"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <StickyNote className="w-3.5 h-3.5" />
              <span>Notes ({internalNotes.length})</span>
            </button>

            <button
              onClick={() => setActiveLeftTab("realisasi")}
              className={`flex-1 py-2.5 px-3 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeLeftTab === "realisasi"
                  ? "bg-[#1C1D21] text-white shadow-xs dark:bg-white dark:text-slate-900"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Log Tugas ({projectRealisasi.length})</span>
            </button>
          </div>

          {/* TAB CONTENT 1: CLOUD RESOURCE HUB */}
          {activeLeftTab === "resources" && (
            <div className="dashboard-card p-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-800">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Hub Tautan Aset &amp; Dokumen Proyek
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Akses terpusat ke Google Drive, Notion, Figma, GitHub, dan spreadsheet
                  </p>
                </div>

                <button
                  onClick={() => setShowAddLinkForm(!showAddLinkForm)}
                  className="px-3 py-1.5 rounded-full bg-[#1C1D21] hover:bg-black text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{showAddLinkForm ? "Tutup Form" : "Tambah Tautan"}</span>
                </button>
              </div>

              {/* Add Link Inline Form */}
              {showAddLinkForm && (
                <form
                  onSubmit={handleAddLink}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-xs space-y-3"
                >
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                    Koneksikan Tautan Aset Baru:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Judul Tautan
                      </label>
                      <input
                        type="text"
                        required
                        value={linkTitle}
                        onChange={(e) => setLinkTitle(e.target.value)}
                        placeholder="Contoh: Folder Drive Final"
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none transition"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                        URL Tautan (Drive / Notion / Figma / Sheets / dll)
                      </label>
                      <input
                        type="url"
                        required
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        placeholder="https://drive.google.com/..."
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none transition"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddLinkForm(false)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-700"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={savingLink}
                      className="px-4 py-1.5 rounded-xl bg-[#1C1D21] hover:bg-black text-white text-xs font-bold transition active:scale-95 cursor-pointer dark:bg-white dark:text-slate-900"
                    >
                      {savingLink ? "Menyimpan..." : "Simpan Tautan"}
                    </button>
                  </div>
                </form>
              )}

              {/* Links Grid List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {links.map((lnk) => {
                  const badge = getPlatformBadge(lnk.platform);
                  return (
                    <div
                      key={lnk.id}
                      className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200/70 dark:border-slate-700 flex items-center justify-between gap-3 shadow-2xs hover:border-slate-300 dark:hover:border-slate-600 transition group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider ${badge.color}`}
                          >
                            {badge.label}
                          </span>
                        </div>
                        <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {lnk.title}
                        </h4>
                        <span className="text-[11px] text-slate-400 truncate block mt-0.5">
                          {lnk.url}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <a
                          href={lnk.url}
                          target="_blank"
                          rel="noreferrer"
                          className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 flex items-center justify-center text-slate-700 dark:text-slate-200 transition"
                          title="Buka Tautan di Tab Baru"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        {user.role === "admin" && (
                          <button
                            onClick={() => handleDeleteLink(lnk.id)}
                            className="w-8 h-8 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-400 hover:text-red-600 flex items-center justify-center transition cursor-pointer"
                            title="Hapus Tautan"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {links.length === 0 && (
                  <div className="col-span-full py-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-400">
                    Belum ada tautan aset. Klik tombol &quot;Tambah Tautan&quot; untuk menghubungkan aset proyek.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB CONTENT: CALENDAR & MILESTONE (NEW) */}
          {activeLeftTab === "calendar" && (
            <div className="dashboard-card p-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                      Milestone &amp; Kalender Proyek
                    </h3>
                    {currentProject.deadline && (
                      <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300 text-[10px] font-extrabold flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Deadline: {currentProject.deadline}</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Target milestone, sprint review, dan tenggat waktu pengerjaan proyek ini
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAddEventForm(!showAddEventForm)}
                    className="px-3 py-1.5 rounded-full bg-[#1C1D21] hover:bg-black text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{showAddEventForm ? "Tutup Form" : "Tambah Jadwal"}</span>
                  </button>

                  {onGoCalendar && (
                    <button
                      onClick={() => onGoCalendar(project.id)}
                      className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                      title="Buka tampilan Kalender Utama"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Kalender Penuh ↗</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Add Calendar Event Form */}
              {showAddEventForm && (
                <form
                  onSubmit={handleCreateEvent}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3"
                >
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                    Tambah Jadwal / Milestone Proyek:
                  </span>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Judul Agenda / Milestone
                    </label>
                    <input
                      type="text"
                      required
                      value={eventTitle}
                      onChange={(e) => setEventTitle(e.target.value)}
                      placeholder="Contoh: Sprint Review & Demo Klien"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Tanggal
                      </label>
                      <input
                        type="date"
                        required
                        value={eventDate}
                        onChange={(e) => setEventDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Jam Mulai
                      </label>
                      <input
                        type="time"
                        value={eventStartTime}
                        onChange={(e) => setEventStartTime(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Kategori
                      </label>
                      <CustomSelect
                        variant="form"
                        value={eventCategory}
                        onChange={(v) => setEventCategory(v as CalendarEventType["category"])}
                        options={[
                          { value: "milestone", label: "Milestone Proyek" },
                          { value: "deadline", label: "Deadline Penting" },
                          { value: "meeting", label: "Rapat Koordinasi" },
                          { value: "activity", label: "Aktivitas Tim" },
                        ]}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Keterangan (Opsional)
                    </label>
                    <input
                      type="text"
                      value={eventDescription}
                      onChange={(e) => setEventDescription(e.target.value)}
                      placeholder="Detail atau catatan agenda..."
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setShowAddEventForm(false)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={savingEvent}
                      className="px-4 py-1.5 rounded-xl bg-[#1C1D21] hover:bg-black text-white text-xs font-bold transition active:scale-95 cursor-pointer dark:bg-white dark:text-slate-900"
                    >
                      {savingEvent ? "Menyimpan..." : "Simpan Jadwal"}
                    </button>
                  </div>
                </form>
              )}

              {/* Events & Milestones List */}
              {loadingCalendar ? (
                <div className="py-8 text-center text-xs text-slate-400 animate-pulse">
                  Memuat jadwal &amp; milestone proyek...
                </div>
              ) : calendarEvents.length > 0 || currentProject.deadline ? (
                <div className="space-y-2.5">
                  {currentProject.deadline && (
                    <div className="p-3.5 rounded-2xl bg-red-50/80 dark:bg-red-950/30 border border-red-200/80 dark:border-red-900/50 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-900/50 flex items-center justify-center text-red-600 dark:text-red-400 font-bold shrink-0">
                          <Clock className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-xs text-slate-900 dark:text-white">
                              Tenggat Akhir Proyek (Deadline Resmi)
                            </span>
                            <span className="px-2 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-red-200 text-red-900 dark:bg-red-900 dark:text-red-200">
                              Final
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                            Target tuntas seluruh {currentProject.target_total} {currentProject.satuan}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-extrabold text-xs text-red-700 dark:text-red-300 block">
                          {currentProject.deadline}
                        </span>
                        <span className="text-[10px] text-slate-400">Target Proyek</span>
                      </div>
                    </div>
                  )}

                  {calendarEvents.map((evt) => (
                    <div
                      key={evt.id}
                      className="p-3 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700 flex items-center justify-between gap-3 shadow-2xs hover:border-slate-300 dark:hover:border-slate-600 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          style={{ backgroundColor: `${evt.color}30` }}
                          className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-slate-900 shrink-0"
                        >
                          <Calendar className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">
                              {evt.title}
                            </h4>
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                              {evt.category}
                            </span>
                          </div>
                          {evt.description && (
                            <p className="text-[11px] text-slate-500 truncate mt-0.5">{evt.description}</p>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                          {evt.date}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {evt.start_time} - {evt.end_time}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-400">
                  Belum ada jadwal milestone untuk proyek ini. Klik &quot;Tambah Jadwal&quot; untuk membuat agenda.
                </div>
              )}
            </div>
          )}

          {/* TAB CONTENT 2: INTERNAL PROJECT NOTES & CHECKLIST (Synced with Sidebar Notes) */}
          {activeLeftTab === "notes" && (
            <div className="dashboard-card p-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                      Catatan &amp; SOP Internal Proyek
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-[#D2F27C]/30 text-slate-900 dark:text-[#D2F27C] text-[10px] font-extrabold">
                      Tersinkron ke Sidebar Notes
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Catatan, SOP, dan checklist di sini otomatis terhubung ke menu Sidebar Notes
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAddNoteForm(!showAddNoteForm)}
                    className="px-3 py-1.5 rounded-full bg-[#1C1D21] hover:bg-black text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{showAddNoteForm ? "Tutup Form" : "Tambah Catatan"}</span>
                  </button>

                  {onGoNotes && (
                    <button
                      onClick={() => onGoNotes(project.id)}
                      className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                      title="Buka di Menu Sidebar Notes dengan filter proyek ini"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Sidebar ↗</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Add Note Form */}
              {showAddNoteForm && (
                <form
                  onSubmit={handleCreateInternalNote}
                  className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-xs space-y-3.5"
                >
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                    Buat Catatan / Checklist Proyek Baru:
                  </span>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Judul Catatan / SOP
                    </label>
                    <input
                      type="text"
                      required
                      value={noteTitle}
                      onChange={(e) => setNoteTitle(e.target.value)}
                      placeholder="Contoh: Checklist QC Final Desain &amp; Export"
                      className="w-full px-3.5 py-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Deskripsi / Arahan
                    </label>
                    <textarea
                      rows={2}
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      placeholder="Detail arahan, spesifikasi teknis, atau catatan penting..."
                      className="w-full px-3.5 py-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:outline-none transition resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Tags (pisahkan koma)
                      </label>
                      <input
                        type="text"
                        value={noteTags}
                        onChange={(e) => setNoteTags(e.target.value)}
                        placeholder="sop, desain, qc"
                        className="w-full px-3.5 py-2 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:outline-none transition"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Warna Pastel Kartu
                      </label>
                      <div className="flex items-center gap-2 pt-1">
                        {PASTEL_COLORS.map((c) => (
                          <button
                            type="button"
                            key={c.value}
                            onClick={() => setNoteColor(c.value)}
                            style={{ backgroundColor: c.value }}
                            className={`w-6 h-6 rounded-full border-2 transition cursor-pointer ${
                              noteColor === c.value
                                ? "ring-2 ring-slate-900 dark:ring-white scale-110"
                                : "border-slate-300 dark:border-slate-600"
                            }`}
                            title={c.label}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Checklist Sub-Items */}
                  <div className="space-y-2 pt-1">
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                      Item Checklist Interaktif (Opsional)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newChecklistText}
                        onChange={(e) => setNewChecklistText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddChecklistItem();
                          }
                        }}
                        placeholder="Ketik tugas dan tekan Tambah..."
                        className="flex-1 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleAddChecklistItem}
                        className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-white text-xs font-bold transition cursor-pointer"
                      >
                        + Tambah
                      </button>
                    </div>

                    {noteChecklist.length > 0 && (
                      <div className="space-y-1 pt-1 max-h-32 overflow-y-auto">
                        {noteChecklist.map((c) => (
                          <div
                            key={c.id}
                            className="flex items-center justify-between text-xs py-1 px-2.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200/60 dark:border-slate-700"
                          >
                            <span className="truncate">{c.text}</span>
                            <button
                              type="button"
                              onClick={() =>
                                setNoteChecklist(noteChecklist.filter((x) => x.id !== c.id))
                              }
                              className="text-slate-400 hover:text-red-500 ml-2"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setShowAddNoteForm(false)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={savingNote}
                      className="px-4 py-1.5 rounded-xl bg-[#1C1D21] hover:bg-black text-white text-xs font-bold transition active:scale-95 cursor-pointer dark:bg-white dark:text-slate-900"
                    >
                      {savingNote ? "Menyimpan..." : "Simpan Catatan"}
                    </button>
                  </div>
                </form>
              )}

              {/* Notes Grid Display */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {internalNotes.map((note) => {
                  const cardBg = note.color || "#FFFFFF";
                  return (
                    <div
                      key={note.id}
                      style={{ backgroundColor: cardBg }}
                      className="p-4 rounded-2xl border border-slate-300/80 dark:border-slate-700 text-slate-900 shadow-2xs flex flex-col justify-between transition hover:shadow-md"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="font-extrabold text-sm text-slate-900 leading-snug line-clamp-2">
                            {note.title}
                          </h4>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleTogglePinNote(note)}
                              className={`p-1 rounded-lg transition cursor-pointer ${
                                note.pinned
                                  ? "text-slate-900 bg-black/10"
                                  : "text-slate-400 hover:text-slate-700"
                              }`}
                              title={note.pinned ? "Lepas semat" : "Sematkan di atas"}
                            >
                              <Pin className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteNote(note.id)}
                              className="p-1 rounded-lg text-slate-400 hover:text-red-600 transition cursor-pointer"
                              title="Hapus catatan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {note.content && (
                          <p className="text-xs text-slate-800 font-medium leading-relaxed mb-3 whitespace-pre-wrap">
                            {note.content}
                          </p>
                        )}

                        {/* Interactive Checklist inside note */}
                        {note.checklist && note.checklist.length > 0 && (
                          <div className="space-y-1.5 mb-3 pt-2 border-t border-black/10">
                            {note.checklist.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => handleToggleChecklist(note, item.id)}
                                className="w-full flex items-start gap-2 text-left text-xs font-semibold hover:opacity-80 transition cursor-pointer group"
                              >
                                {item.done ? (
                                  <CheckSquare className="w-3.5 h-3.5 text-slate-900 shrink-0 mt-0.5" />
                                ) : (
                                  <Square className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5 group-hover:text-slate-900" />
                                )}
                                <span
                                  className={`truncate ${
                                    item.done
                                      ? "line-through text-slate-500"
                                      : "text-slate-900"
                                  }`}
                                >
                                  {item.text}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Footer tags & author */}
                      <div className="flex items-center justify-between pt-2 border-t border-black/10 text-[10px] text-slate-600">
                        <div className="flex items-center gap-1 flex-wrap">
                          {note.tags?.slice(0, 3).map((t, i) => (
                            <span key={i} className="px-1.5 py-0.5 rounded bg-black/10 font-bold">
                              #{t}
                            </span>
                          ))}
                        </div>
                        <span className="font-semibold">{note.author_nama || "Tim"}</span>
                      </div>
                    </div>
                  );
                })}

                {internalNotes.length === 0 && (
                  <div className="col-span-full py-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-400">
                    Belum ada catatan internal untuk proyek ini. Klik tombol &quot;Tambah Catatan&quot; untuk membuat memo atau SOP.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB CONTENT 3: REALISASI TASK LOGS */}
          {activeLeftTab === "realisasi" && (
            <div className="dashboard-card p-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-800">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Riwayat Realisasi &amp; Progres Tim ({projectRealisasi.length})
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Laporan aktivitas harian yang dikerjakan oleh anggota tim untuk proyek ini
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowInlineInputForm(!showInlineInputForm)}
                  className="px-3.5 py-1.5 rounded-full bg-[#1C1D21] hover:bg-black text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{showInlineInputForm ? "Tutup Form" : "+ Catat Tugas Langsung"}</span>
                </button>
              </div>

              {/* Inline Form Card */}
              {showInlineInputForm && (
                <form
                  onSubmit={handleQuickSubmitProgress}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#1C1D21] dark:text-[#D2F27C]" />
                      <span>Input Cepat Progres Tugas Proyek Ini</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowInlineInputForm(false)}
                      className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Deskripsi Aktivitas / Tugas *
                    </label>
                    <input
                      type="text"
                      required
                      value={inputAktivitas}
                      onChange={(e) => setInputAktivitas(e.target.value)}
                      placeholder="Contoh: Selesaikan revisi slide 3 & export WebP"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none transition"
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Target
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={inputTarget}
                        onChange={(e) => setInputTarget(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Realisasi
                      </label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={inputRealisasi}
                        onChange={(e) => setInputRealisasi(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Satuan
                      </label>
                      <input
                        type="text"
                        value={inputSatuan}
                        onChange={(e) => setInputSatuan(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Tanggal
                      </label>
                      <input
                        type="date"
                        value={inputTanggal}
                        onChange={(e) => setInputTanggal(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Kendala (Opsional)
                      </label>
                      <input
                        type="text"
                        value={inputKendala}
                        onChange={(e) => setInputKendala(e.target.value)}
                        placeholder="Jika ada hambatan kerja..."
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                        Solusi (Opsional)
                      </label>
                      <input
                        type="text"
                        value={inputSolusi}
                        onChange={(e) => setInputSolusi(e.target.value)}
                        placeholder="Solusi yang diterapkan..."
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setShowInlineInputForm(false)}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={submittingProgress || !inputAktivitas.trim()}
                      className="px-4 py-1.5 rounded-xl bg-[#1C1D21] hover:bg-black text-white text-xs font-bold transition active:scale-95 cursor-pointer dark:bg-white dark:text-slate-900 disabled:opacity-50"
                    >
                      {submittingProgress ? "Menyimpan..." : "Simpan Progres Langsung"}
                    </button>
                  </div>
                </form>
              )}

              {loadingRealisasi ? (
                <div className="py-8 text-center text-xs text-slate-400 animate-pulse">
                  Memuat data riwayat tugas tim...
                </div>
              ) : projectRealisasi.length > 0 ? (
                <div className="divide-y divide-slate-100 dark:divide-slate-800/80 max-h-96 overflow-y-auto pr-1">
                  {projectRealisasi.map((r) => {
                    const isDelegated = Boolean(r.assigned_by_user_id && r.assigned_by_user_id !== (r.assigned_to_user_id || r.user_id));
                    const canQuickComplete =
                      r.persentase < 100 &&
                      (user.role === "admin" || r.user_id === user.id || r.assigned_to_user_id === user.id);

                    return (
                      <div key={r.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <strong className="text-slate-900 dark:text-white font-bold">{r.aktivitas}</strong>
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-300 font-semibold">
                              {r.nama} ({r.divisi})
                            </span>
                            {isDelegated && (
                              <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-[10px] text-purple-700 dark:text-purple-300 font-bold">
                                Delegasi Tim
                              </span>
                            )}
                            {r.deadline && (
                              <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-[10px] text-amber-700 dark:text-amber-300 font-semibold">
                                DL: {r.deadline}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 block mt-0.5">
                            {r.tanggal} · Capaian: {r.realisasi} / {r.target} {r.satuan}
                          </span>
                          {r.kendala && (
                            <span className="text-[11px] text-amber-600 dark:text-amber-400 block mt-0.5">
                              Kendala: {r.kendala}
                            </span>
                          )}
                          {r.solusi && (
                            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 block mt-0.5">
                              Solusi: {r.solusi}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {canQuickComplete && (
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const res = await fetch(`/api/realisasi/${r.id}`, {
                                    method: "PATCH",
                                    headers: {
                                      "Content-Type": "application/json",
                                      "x-user-id": String(user.id),
                                    },
                                    body: JSON.stringify({
                                      realisasi: r.target,
                                      status: "Tercapai",
                                    }),
                                  });
                                  if (res.ok) {
                                    showToast(`Tugas "${r.aktivitas}" ditandai selesai 100%!`);
                                    await fetchProjectRealisasi();
                                    await onRefreshProjects();
                                  } else {
                                    const err = await res.json().catch(() => ({}));
                                    showToast(err.error || "Gagal menandai tugas selesai");
                                  }
                                } catch {
                                  showToast("Kesalahan jaringan");
                                }
                              }}
                              className="px-2 py-1 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold transition cursor-pointer"
                              title="Tandai Selesai 100%"
                            >
                              ✓ Selesai
                            </button>
                          )}
                          <span className="font-extrabold text-slate-900 dark:text-white tabular-nums px-2.5 py-1 rounded-full bg-[#D2F27C]/30">
                            {r.persentase}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-2xl">
                  Belum ada laporan realisasi tugas yang dicatat untuk proyek ini.
                </div>
              )}
            </div>
          )}
        </div>

        {/* ================= RIGHT COLUMN (5 Cols) ================= */}
        <div className="lg:col-span-5 space-y-5">
          {/* TEAM COLLABORATORS WIDGET (NEW) */}
          <div className="dashboard-card p-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Tim Kolaborator Proyek ({members.length})
                  </h3>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Anggota yang bertugas &amp; terhubung ke ruang diskusi chat
                </p>
              </div>

              {(user.role === "admin" || user.id === currentProject.pic_id) && (
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(true)}
                  className="px-3 py-1.5 rounded-full bg-[#1C1D21] hover:bg-black text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-2xs"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ Tambah Anggota</span>
                </button>
              )}
            </div>

            {/* Members List */}
            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {members.map((m) => {
                const isPic = m.user_id === currentProject.pic_id || m.role === "leader";
                return (
                  <div
                    key={m.id || m.user_id}
                    className="p-3 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700 flex items-center justify-between gap-3 shadow-2xs hover:border-slate-300 dark:hover:border-slate-600 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 text-white flex items-center justify-center font-bold text-xs uppercase shadow-xs shrink-0">
                        {m.nama ? m.nama.slice(0, 2) : "U"}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-xs text-slate-900 dark:text-white truncate">
                            {m.nama}
                          </span>
                          {isPic ? (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-[#D2F27C] text-slate-900">
                              Leader PIC
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                              Kolaborator
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 block truncate">
                          @{m.username || "user"} · {m.divisi || "Umum"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Delegate Quick CTA */}
                      <button
                        type="button"
                        onClick={() => {
                          setInputAssignedUserId(String(m.user_id));
                          setInputRealisasi(m.user_id === user.id ? 1 : 0);
                          setShowQuickInputModal(true);
                        }}
                        className="px-2.5 py-1 rounded-full bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-[11px] font-bold transition active:scale-95 cursor-pointer"
                        title={`Delegasikan tugas ke ${m.nama}`}
                      >
                        + Tugaskan
                      </button>

                      {/* Remove Member CTA (for admin/leader, except PIC) */}
                      {!isPic && (user.role === "admin" || user.id === currentProject.pic_id) && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(m.user_id)}
                          className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-400 hover:text-red-600 transition cursor-pointer"
                          title="Keluarkan dari proyek"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {members.length === 0 && (
                <div className="py-6 text-center text-xs text-slate-400">
                  Belum ada anggota tim terdaftar pada proyek ini.
                </div>
              )}
            </div>
          </div>

          {/* CLIENT FEEDBACK & REALTIME COLLABORATION STREAM */}
          <div className="dashboard-card p-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200/80 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Feedback &amp; Catatan Klien
                  </h3>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Masukan langsung dari klien di portal publik
                </p>
              </div>

              <button
                onClick={fetchClientNotes}
                disabled={loadingClientNotes}
                className="self-start sm:self-auto p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                title="Segarkan data masukan klien"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingClientNotes ? "animate-spin" : ""}`} />
              </button>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {(
                [
                  { id: "all", label: "Semua" },
                  { id: "open", label: "Perlu Atensi" },
                  { id: "in_progress", label: "Dikerjakan" },
                  { id: "resolved", label: "Tuntas" },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  onClick={() => setClientFilterStatus(f.id)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition cursor-pointer ${
                    clientFilterStatus === f.id
                      ? "bg-[#1C1D21] text-white dark:bg-white dark:text-slate-900"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Client Notes Stream Feed */}
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {filteredClientNotes.map((item) => {
                const isTeam = item.author_role === "team";
                return (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-2xl border transition text-xs space-y-2 ${
                      isTeam
                        ? "bg-[#D2F27C]/15 border-[#D2F27C]/60 dark:bg-[#D2F27C]/10 ml-3"
                        : "bg-slate-50 dark:bg-slate-800/80 border-slate-200/70 dark:border-slate-700"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        {isTeam ? (
                          <span className="w-5 h-5 rounded-full bg-[#1C1D21] text-[#D2F27C] flex items-center justify-center font-bold text-[9px]">
                            <ShieldCheck className="w-3 h-3" />
                          </span>
                        ) : (
                          <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center">
                            <User className="w-3 h-3" />
                          </span>
                        )}
                        <strong className="font-extrabold text-slate-900 dark:text-white">
                          {item.author_name}
                        </strong>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          {item.category}
                        </span>
                      </div>

                      {/* Status Dropdown/Selector */}
                      <div className="min-w-[165px]">
                        <CustomSelect
                          variant="pill"
                          value={item.status}
                          onChange={(v) =>
                            handleUpdateClientNoteStatus(
                              item.id,
                              v as "open" | "in_progress" | "resolved"
                            )
                          }
                          options={[
                            { value: "open", label: "Perlu Atensi" },
                            { value: "in_progress", label: "Sedang Dikerjakan" },
                            { value: "resolved", label: "Tuntas / Selesai" },
                          ]}
                        />
                      </div>
                    </div>

                    <p className="text-slate-800 dark:text-slate-200 font-medium leading-relaxed whitespace-pre-wrap">
                      {item.message}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                      <span>
                        {new Date(item.created_at).toLocaleString("id-ID", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>
                      {isTeam && <span className="font-semibold text-slate-700 dark:text-slate-300">Respon Internal Tim</span>}
                    </div>
                  </div>
                );
              })}

              {filteredClientNotes.length === 0 && (
                <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                  Tidak ada catatan feedback dalam kategori ini.
                </div>
              )}
            </div>

            {/* Team Reply Form */}
            <form
              onSubmit={handleSendTeamReply}
              className="pt-3 border-t border-slate-200/80 dark:border-slate-800 space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Kirim Respon Tim ke Portal Klien:
                </span>
                <span className="text-[10px] text-slate-400">Oleh: {user.nama}</span>
              </div>

              <textarea
                required
                rows={2}
                value={teamReplyMessage}
                onChange={(e) => setTeamReplyMessage(e.target.value)}
                placeholder="Tuliskan respon tim, update pengerjaan revisi, atau konfirmasi..."
                className="w-full px-3 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition resize-none"
              />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  {(["feedback", "revisi", "apresiasi"] as const).map((c) => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => setReplyCategory(c)}
                      className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase transition cursor-pointer ${
                        replyCategory === c
                          ? "bg-[#1C1D21] text-white dark:bg-white dark:text-slate-900"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={submittingReply || !teamReplyMessage.trim()}
                  className="px-4 py-1.5 rounded-full bg-[#1C1D21] hover:bg-black text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 text-xs font-bold flex items-center gap-1.5 shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-3 h-3 text-[#D2F27C] dark:text-slate-900" />
                  <span>{submittingReply ? "Mengirim..." : "Kirim Respon"}</span>
                </button>
              </div>
            </form>
          </div>

          {/* MINI CLIENT LIVE PREVIEW CARD */}
          <div className="p-5 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-black text-white dark:from-white dark:via-slate-100 dark:to-slate-200 dark:text-slate-900 shadow-md space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#D2F27C] dark:text-emerald-700">
                Pratinjau Portal Klien
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 dark:text-emerald-700 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Publik Aktif</span>
              </span>
            </div>

            <div>
              <h4 className="font-extrabold text-sm text-white dark:text-slate-900 truncate">
                {project.nama_proyek}
              </h4>
              <p className="text-[11px] text-slate-300 dark:text-slate-600 mt-0.5">
                Klien dapat melihat progres capaian {project.persentase}%, mengakses berkas deliverable, dan mengirim catatan revisi tanpa kata sandi.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleCopyClientLink}
                className="flex-1 py-2 px-3 rounded-xl bg-white text-slate-900 dark:bg-slate-900 dark:text-white text-xs font-extrabold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Salin Tautan</span>
              </button>

              <a
                href={clientPortalUrl}
                target="_blank"
                rel="noreferrer"
                className="py-2 px-3 rounded-xl bg-white/10 dark:bg-slate-800/10 hover:bg-white/20 text-white dark:text-slate-900 text-xs font-bold flex items-center justify-center gap-1 transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Buka</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* QUICK IN-PAGE PROGRESS INPUT MODAL (Zero-Navigation) */}
      <AnimatePresence>
        {showQuickInputModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowQuickInputModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg dashboard-card p-6 sm:p-7 shadow-2xl dark:text-slate-100 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-200/80 dark:border-slate-700 mb-4">
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Catat Progres Tugas Langsung
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Proyek: <strong className="text-slate-800 dark:text-slate-200">{currentProject.nama_proyek}</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowQuickInputModal(false)}
                  className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Reactive Projected Progress Preview */}
              <div className="p-3.5 rounded-2xl bg-[#D2F27C]/20 border border-[#D2F27C]/60 mb-4">
                <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white mb-1.5">
                  <span>Proyeksi Capaian Proyek:</span>
                  <span className="tabular-nums">
                    {Math.min(100, Math.round(((currentProject.total_realisasi + (Number(inputRealisasi) || 0)) / currentProject.target_total) * 100))}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-200/80 dark:bg-slate-700 overflow-hidden">
                  <div
                    className="h-full bg-slate-900 dark:bg-[#D2F27C] rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, Math.round(((currentProject.total_realisasi + (Number(inputRealisasi) || 0)) / currentProject.target_total) * 100))}%`,
                    }}
                  />
                </div>
                <span className="text-[10px] text-slate-600 dark:text-slate-300 block mt-1">
                  Saat ini: {currentProject.total_realisasi} + input baru: {Number(inputRealisasi) || 0} = {currentProject.total_realisasi + (Number(inputRealisasi) || 0)} / {currentProject.target_total} {currentProject.satuan}
                </span>
              </div>

              <form onSubmit={handleQuickSubmitProgress} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Penerima / Pelaksana Tugas
                  </label>
                  <CustomSelect
                    variant="form"
                    value={inputAssignedUserId}
                    onChange={(v) => {
                      setInputAssignedUserId(v);
                      if (v !== String(user.id)) {
                        setInputRealisasi(0);
                      }
                    }}
                    options={[
                      { value: String(user.id), label: `${user.nama} (Saya Sendiri)` },
                      ...users
                        .filter((u) => u.id !== user.id)
                        .map((u) => ({
                          value: String(u.id),
                          label: `${u.nama} (${u.divisi})`,
                          subLabel: "Delegasikan",
                        })),
                    ]}
                  />
                  {inputAssignedUserId !== String(user.id) && (
                    <p className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold mt-1">
                      ℹ️ Tugas akan didelegasikan dan notifikasi lonceng otomatis dikirim ke penerima.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Aktivitas / Tugas yang Dikerjakan *
                  </label>
                  <input
                    type="text"
                    required
                    value={inputAktivitas}
                    onChange={(e) => setInputAktivitas(e.target.value)}
                    placeholder="Contoh: Slicing UI Header & Responsive Navigation"
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Target Kuantitas
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={inputTarget}
                      onChange={(e) => setInputTarget(Number(e.target.value))}
                      className="w-full px-4 py-2.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Realisasi Capaian
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={inputRealisasi}
                      onChange={(e) => setInputRealisasi(Number(e.target.value))}
                      className="w-full px-4 py-2.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Satuan
                    </label>
                    <input
                      type="text"
                      value={inputSatuan}
                      onChange={(e) => setInputSatuan(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Tanggal Laporan
                    </label>
                    <input
                      type="date"
                      value={inputTanggal}
                      onChange={(e) => setInputTanggal(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                      Deadline (Opsional)
                    </label>
                    <input
                      type="date"
                      value={inputDeadline}
                      onChange={(e) => setInputDeadline(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Kendala (Opsional)
                  </label>
                  <input
                    type="text"
                    value={inputKendala}
                    onChange={(e) => setInputKendala(e.target.value)}
                    placeholder="Misal: Aset video belum siap dari klien"
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Solusi (Opsional)
                  </label>
                  <input
                    type="text"
                    value={inputSolusi}
                    onChange={(e) => setInputSolusi(e.target.value)}
                    placeholder="Misal: Menggunakan mockup sementara"
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowQuickInputModal(false)}
                    className="px-4 py-2 rounded-full text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submittingProgress || !inputAktivitas.trim()}
                    className="px-6 py-2.5 rounded-full bg-[#1C1D21] hover:bg-black text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 text-xs font-bold shadow-md transition active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    {submittingProgress ? "Menyimpan..." : "Simpan Progres Langsung"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ADD MEMBER MODAL */}
      <AnimatePresence>
        {showAddMemberModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowAddMemberModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md dashboard-card p-6 shadow-2xl dark:text-slate-100"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-700 mb-4">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Tambah Kolaborator Proyek
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Pilih Anggota Tim
                  </label>
                  <CustomSelect
                    variant="form"
                    value={selectedNewUserId}
                    onChange={setSelectedNewUserId}
                    placeholder="-- Pilih Anggota Tim --"
                    options={[
                      { value: "", label: "-- Pilih Anggota Tim --" },
                      ...users
                        .filter((u) => !members.some((m) => m.user_id === u.id))
                        .map((u) => ({
                          value: String(u.id),
                          label: `${u.nama} · ${u.divisi}`,
                          subLabel: `@${u.username}`,
                        })),
                    ]}
                  />
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  💡 Anggota baru akan otomatis diundang ke grup chat diskusi proyek dan menerima notifikasi lonceng tugas.
                </p>

                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setShowAddMemberModal(false)}
                    className="px-4 py-2 rounded-full text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={!selectedNewUserId || addingMember}
                    onClick={() => handleAddMember(Number(selectedNewUserId))}
                    className="px-5 py-2.5 rounded-full bg-[#1C1D21] hover:bg-black text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 text-xs font-bold shadow-md transition active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    {addingMember ? "Menambahkan..." : "Tambahkan ke Proyek"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={pendingConfirm !== null}
        title={pendingConfirm?.title || ""}
        message={pendingConfirm?.message || ""}
        confirmLabel={pendingConfirm?.confirmLabel || "Konfirmasi"}
        loading={confirmLoading}
        onConfirm={async () => {
          if (!pendingConfirm) return;
          setConfirmLoading(true);
          try {
            await pendingConfirm.action();
            setPendingConfirm(null);
          } finally {
            setConfirmLoading(false);
          }
        }}
        onCancel={() => !confirmLoading && setPendingConfirm(null)}
      />
    </div>
  );
}
