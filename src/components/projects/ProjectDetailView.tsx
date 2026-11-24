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
} from "lucide-react";
import {
  ProjectType,
  ProjectLinkType,
  ProjectClientNoteType,
  RealisasiType,
  NoteType,
  UserType,
} from "@/types";

interface ProjectDetailViewProps {
  project: ProjectType;
  user: UserType;
  onBack: () => void;
  onRefreshProjects: () => Promise<void>;
  onGoInput: () => void;
  onGoNotes?: (projectId?: number) => void;
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
  onBack,
  onRefreshProjects,
  onGoInput,
  onGoNotes,
  showToast,
}: ProjectDetailViewProps) {
  // Navigation & Sub-Tabs state for Column Left
  const [activeLeftTab, setActiveLeftTab] = useState<"resources" | "notes" | "realisasi">("resources");

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
  }, [project]);

  // Quick In-Page Progress Input State (Modal & Inline Form)
  const [showQuickInputModal, setShowQuickInputModal] = useState(false);
  const [showInlineInputForm, setShowInlineInputForm] = useState(false);
  const [inputAktivitas, setInputAktivitas] = useState("");
  const [inputTarget, setInputTarget] = useState<number>(1);
  const [inputRealisasi, setInputRealisasi] = useState<number>(1);
  const [inputSatuan, setInputSatuan] = useState(project.satuan || "Tugas");
  const [inputTanggal, setInputTanggal] = useState(new Date().toISOString().slice(0, 10));
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
    const status = pct >= 100 ? "Tercapai" : pct >= 70 ? "Hampir" : "Belum";

    try {
      const res = await fetch("/api/realisasi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: currentProject.id,
          user_id: user.id,
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
        showToast(`Progres tugas "${inputAktivitas.trim()}" berhasil disimpan langsung!`);
        setInputAktivitas("");
        setInputKendala("");
        setInputSolusi("");
        setShowQuickInputModal(false);
        setShowInlineInputForm(false);

        // Reactively update local project stats
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

  // Share portal copy state
  const [copiedShareLink, setCopiedShareLink] = useState(false);

  const clientPortalUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/client/project/${project.id}`
      : `/client/project/${project.id}`;

  const handleToggleProjectStatus = async () => {
    const newStatus = project.status === "selesai" ? "aktif" : "selesai";
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        showToast(newStatus === "selesai" ? "Proyek ditandai selesai!" : "Proyek diaktifkan kembali!");
        await onRefreshProjects();
      } else {
        showToast("Gagal mengubah status proyek");
      }
    } catch {
      showToast("Kesalahan jaringan");
    }
  };

  const handleDeleteProject = async () => {
    if (!confirm(`Hapus permanen proyek "${project.nama_proyek}"? Semua data terkait akan terhapus.`)) return;
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
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
      const res = await fetch(`/api/realisasi?project_id=${project.id}&role=admin`);
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

  useEffect(() => {
    fetchLinks();
    fetchClientNotes();
    fetchInternalNotes();
    fetchProjectRealisasi();
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
  const handleDeleteLink = async (linkId: number) => {
    if (!confirm("Hapus tautan aset ini?")) return;
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
  const handleDeleteNote = async (noteId: number) => {
    if (!confirm("Hapus catatan internal proyek ini?")) return;
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
      <div className="intellecta-card p-6 sm:p-7 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-xs space-y-4">
        {/* Breadcrumb & Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold flex items-center gap-2 transition active:scale-95 cursor-pointer shadow-2xs"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali ke Semua Proyek</span>
            </button>

            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400">
              <span>Proyek</span>
              <span>/</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[200px]">
                {project.nama_proyek}
              </span>
            </div>
          </div>

          {/* Quick Header CTA Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleCopyClientLink}
              className="px-3.5 py-1.5 rounded-full bg-[#1C1D21] hover:bg-black text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 text-xs font-bold flex items-center gap-2 shadow-xs transition active:scale-95 cursor-pointer"
              title="Salin tautan portal klien tanpa password"
            >
              {copiedShareLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#D2F27C] dark:text-slate-900" />
                  <span>Link Tersalin!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Bagikan ke Klien</span>
                </>
              )}
            </button>

            <a
              href={clientPortalUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              title="Buka portal klien di tab baru"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Portal Klien ↗</span>
            </a>

            {onGoNotes && (
              <button
                onClick={() => onGoNotes(project.id)}
                className="px-3 py-1.5 rounded-full bg-[#D2F27C]/30 hover:bg-[#D2F27C]/50 text-slate-900 dark:text-[#D2F27C] border border-[#D2F27C]/60 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                title="Buka di Menu Sidebar Notes dengan filter proyek ini"
              >
                <StickyNote className="w-3.5 h-3.5" />
                <span>Buka di Menu Notes Penuh ↗</span>
              </button>
            )}

            <button
              onClick={handleToggleProjectStatus}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer ${
                project.status === "selesai"
                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              }`}
              title={project.status === "selesai" ? "Kembalikan ke status aktif" : "Tandai proyek telah selesai"}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{project.status === "selesai" ? "Buka Kembali" : "Tandai Selesai"}</span>
            </button>

            <button
              onClick={handleDeleteProject}
              className="px-3 py-1.5 rounded-full bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-950/40 dark:hover:bg-red-900/60 dark:text-red-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
              title="Hapus proyek ini secara permanen"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus</span>
            </button>
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
        <div className="intellecta-card p-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-xs flex flex-col justify-between">
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
        <div className="intellecta-card p-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-xs flex flex-col justify-between">
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
        <div className="intellecta-card p-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-xs flex flex-col justify-between">
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
              className={`flex-1 py-2.5 px-3 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                activeLeftTab === "resources"
                  ? "bg-[#1C1D21] text-white shadow-xs dark:bg-white dark:text-slate-900"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>Aset &amp; Cloud ({links.length})</span>
            </button>

            <button
              onClick={() => setActiveLeftTab("notes")}
              className={`flex-1 py-2.5 px-3 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                activeLeftTab === "notes"
                  ? "bg-[#1C1D21] text-white shadow-xs dark:bg-white dark:text-slate-900"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <StickyNote className="w-3.5 h-3.5" />
              <span>Notes Internal ({internalNotes.length})</span>
            </button>

            <button
              onClick={() => setActiveLeftTab("realisasi")}
              className={`flex-1 py-2.5 px-3 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
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
            <div className="intellecta-card p-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-xs space-y-4">
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

          {/* TAB CONTENT 2: INTERNAL PROJECT NOTES & CHECKLIST (Synced with Sidebar Notes) */}
          {activeLeftTab === "notes" && (
            <div className="intellecta-card p-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-xs space-y-4">
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
            <div className="intellecta-card p-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-xs space-y-4">
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
                  {projectRealisasi.map((r) => (
                    <div key={r.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-slate-900 dark:text-white font-bold">{r.aktivitas}</strong>
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-300 font-semibold">
                            {r.nama} ({r.divisi})
                          </span>
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
                      <span className="font-extrabold text-slate-900 dark:text-white tabular-nums shrink-0 px-2.5 py-1 rounded-full bg-[#D2F27C]/30">
                        {r.persentase}%
                      </span>
                    </div>
                  ))}
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
          {/* CLIENT FEEDBACK & REALTIME COLLABORATION STREAM */}
          <div className="intellecta-card p-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-xs space-y-4">
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
                      <select
                        value={item.status}
                        onChange={(e) =>
                          handleUpdateClientNoteStatus(
                            item.id,
                            e.target.value as "open" | "in_progress" | "resolved"
                          )
                        }
                        className={`text-[10px] font-bold rounded-lg px-2 py-0.5 border cursor-pointer focus:outline-none ${
                          item.status === "resolved"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : item.status === "in_progress"
                            ? "bg-[#D2F27C] text-slate-900 border-[#D2F27C]"
                            : "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300"
                        }`}
                      >
                        <option value="open">Perlu Atensi</option>
                        <option value="in_progress">Sedang Dikerjakan</option>
                        <option value="resolved">Tuntas / Selesai</option>
                      </select>
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
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowQuickInputModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg intellecta-card p-6 sm:p-7 shadow-2xl dark:text-slate-100 max-h-[90vh] overflow-y-auto"
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

                <div className="grid grid-cols-2 gap-3">
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
    </div>
  );
}
