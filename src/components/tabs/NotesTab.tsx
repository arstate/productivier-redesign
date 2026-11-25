"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  StickyNote,
  Plus,
  Search,
  Pin,
  Trash2,
  Copy,
  CheckSquare,
  Square,
  X,
  Sparkles,
  Tag,
  Check,
  FolderKanban,
  Pencil,
} from "lucide-react";
import { UserType, ProjectType, NoteType } from "@/types";
import CustomSelect, { CustomSelectOption } from "@/components/ui/CustomSelect";
import ConfirmModal from "@/components/ui/ConfirmModal";

const SPRING = { type: "spring" as const, stiffness: 420, damping: 32 };

const PASTEL_COLORS = [
  { value: "#FFFFFF", label: "Putih Bersih", border: "border-slate-200" },
  { value: "#D2F27C", label: "Fresh Lime", border: "border-[#D2F27C]" },
  { value: "#DCD4FB", label: "Soft Lavender", border: "border-[#DCD4FB]" },
  { value: "#CBD5E1", label: "Clean Slate", border: "border-[#CBD5E1]" },
];

interface NotesTabProps {
  user: UserType;
  projects: ProjectType[];
  showToast: (m: string) => void;
}

export default function NotesTab({ user, projects, showToast }: NotesTabProps) {
  const [notes, setNotes] = useState<NoteType[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("project_id") || sessionStorage.getItem("productivier_notes_project_id");
      if (p) {
        sessionStorage.removeItem("productivier_notes_project_id");
        return p;
      }
    }
    return "all";
  });

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
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingNote, setEditingNote] = useState<NoteType | null>(null);

  // Form State (Add / Edit)
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [selectedColor, setSelectedColor] = useState("#D2F27C");
  const [isPinned, setIsPinned] = useState(false);
  const [projId, setProjId] = useState("");
  const [checklistItems, setChecklistItems] = useState<Array<{ id: string; text: string; done: boolean }>>([]);
  const [newChecklistText, setNewChecklistText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openEditModal = (note: NoteType) => {
    setEditingNote(note);
    setTitle(note.title);
    setContent(note.content);
    setTagInput((note.tags || []).join(", "));
    setSelectedColor(note.color || "#FFFFFF");
    setIsPinned(Boolean(note.pinned));
    setProjId(note.project_id ? String(note.project_id) : "");
    setChecklistItems(note.checklist || []);
    setNewChecklistText("");
  };

  const loadNotes = async () => {
    try {
      let url = "/api/notes?";
      if (selectedProjectId !== "all") url += `project_id=${selectedProjectId}&`;
      const res = await fetch(url);
      const data = await res.json();
      setNotes(data.notes || []);
    } catch (e) {
      console.error("Gagal memuat catatan", e);
    }
  };

  useEffect(() => {
    let active = true;
    let url = "/api/notes?";
    if (selectedProjectId !== "all") url += `project_id=${selectedProjectId}&`;
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        if (active) setNotes(data.notes || []);
      })
      .catch((e) => console.error("Gagal memuat catatan", e));

    const handleRefresh = () => {
      loadNotes();
    };
    window.addEventListener("productivier:refresh_data", handleRefresh);
    return () => {
      active = false;
      window.removeEventListener("productivier:refresh_data", handleRefresh);
    };
  }, [selectedProjectId]);

  // Extract all unique tags
  const allTags = useMemo(() => {
    const set = new Set<string>();
    notes.forEach((n) => {
      n.tags?.forEach((t) => set.add(t));
    });
    return Array.from(set);
  }, [notes]);

  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      const matchSearch =
        n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchTag = selectedTag === "all" || n.tags?.some((t) => t.toLowerCase() === selectedTag.toLowerCase());
      return matchSearch && matchTag;
    });
  }, [notes, searchQuery, selectedTag]);

  const handleAddChecklistItem = () => {
    if (!newChecklistText.trim()) return;
    setChecklistItems([
      ...checklistItems,
      { id: String(Date.now()), text: newChecklistText.trim(), done: false },
    ]);
    setNewChecklistText("");
  };

  const handleRemoveChecklistItem = (id: string) => {
    setChecklistItems(checklistItems.filter((item) => item.id !== id));
  };

  const handleUpdateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNote || !title.trim()) return;
    setSubmitting(true);

    const tagsArray = tagInput
      .split(",")
      .map((t) => t.trim().replace(/^#/, ""))
      .filter(Boolean);

    try {
      const res = await fetch(`/api/notes/${editingNote.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          tags: tagsArray,
          pinned: isPinned,
          color: selectedColor,
          project_id: projId ? Number(projId) : null,
          checklist: checklistItems,
        }),
      });

      if (res.ok) {
        showToast("Catatan berhasil diperbarui!");
        setEditingNote(null);
        await loadNotes();
      } else {
        showToast("Gagal memperbarui catatan");
      }
    } catch {
      showToast("Terjadi kesalahan jaringan");
    } finally {
      setSubmitting(false);
    }
  };
  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);

    const tagsArray = tagInput
      .split(",")
      .map((t) => t.trim().replace(/^#/, ""))
      .filter(Boolean);

    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          title: title.trim(),
          content: content.trim(),
          tags: tagsArray,
          pinned: isPinned,
          color: selectedColor,
          project_id: projId ? Number(projId) : null,
          checklist: checklistItems,
        }),
      });

      if (res.ok) {
        showToast("Catatan baru berhasil dibuat!");
        setTitle("");
        setContent("");
        setTagInput("");
        setChecklistItems([]);
        setShowAddModal(false);
        await loadNotes();
      } else {
        showToast("Gagal menyimpan catatan");
      }
    } catch {
      showToast("Terjadi kesalahan jaringan");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleChecklist = async (note: NoteType, itemId: string) => {
    const updatedChecklist = (note.checklist || []).map((item) =>
      item.id === itemId ? { ...item, done: !item.done } : item
    );

    // Optimistic UI update
    setNotes(notes.map((n) => (n.id === note.id ? { ...n, checklist: updatedChecklist } : n)));

    try {
      await fetch(`/api/notes/${note.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checklist: updatedChecklist }),
      });
    } catch {
      showToast("Gagal memperbarui checklist");
    }
  };

  const handleTogglePin = async (note: NoteType) => {
    const newPinned = !note.pinned;
    setNotes(notes.map((n) => (n.id === note.id ? { ...n, pinned: newPinned } : n)));

    try {
      await fetch(`/api/notes/${note.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: newPinned }),
      });
      showToast(newPinned ? "Catatan disematkan ke atas" : "Semat catatan dilepas");
      await loadNotes();
    } catch {
      showToast("Gagal mengubah sematan");
    }
  };

  const handleDeleteNote = (id: number) => {
    setDeleteTargetId(id);
  };

  const executeDeleteNote = async () => {
    if (deleteTargetId === null) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/notes/${deleteTargetId}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Catatan telah dihapus");
        setDeleteTargetId(null);
        await loadNotes();
      } else {
        showToast("Gagal menghapus catatan");
      }
    } catch {
      showToast("Terjadi kesalahan jaringan");
    } finally {
      setDeleting(false);
    }
  };

  const handleCopyNote = (n: NoteType) => {
    const checkText = n.checklist?.map((c) => `[${c.done ? "x" : " "}] ${c.text}`).join("\n") || "";
    const text = `*${n.title}*\n${n.content}${checkText ? "\n\nChecklist:\n" + checkText : ""}`;
    navigator.clipboard.writeText(text);
    showToast("Isi catatan disalin ke clipboard!");
  };

  const projectOptions: CustomSelectOption[] = [
    { value: "all", label: `Semua Proyek (${projects.length})` },
    ...projects.map((p) => ({
      value: String(p.id),
      label: p.nama_proyek,
      subLabel: p.divisi,
    })),
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
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Catatan &amp; Quick Memo
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-[#DCD4FB]/40 text-purple-900 dark:text-[#DCD4FB] font-bold text-[10px] uppercase tracking-wider border border-[#DCD4FB]/60">
              Interactive Checklist
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            Simpan SOP, ide strategi konten, rangkuman rapat, dan to-do checklist harian
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Project Filter with Animated CustomSelect */}
          <div className="w-full sm:w-64">
            <CustomSelect
              value={selectedProjectId}
              onChange={setSelectedProjectId}
              options={projectOptions}
              variant="pill"
            />
          </div>

          {/* Add Note Button */}
          <button
            onClick={() => {
              if (selectedProjectId !== "all") {
                setProjId(selectedProjectId);
              }
              setShowAddModal(true);
            }}
            className="bg-[#1C1D21] hover:bg-black text-white px-5 py-2.5 rounded-full font-semibold text-xs sm:text-sm flex items-center gap-2 shadow-md transition active:scale-95 cursor-pointer dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Catatan</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar: Search & Tag Pills (Single Clean Row with Horizontal Scroll) */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 pt-1">
        {/* Search */}
        <div className="relative w-full md:w-72 shrink-0">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari judul, kata kunci, tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-white/60 dark:border-white/10 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 shadow-xs"
          />
        </div>

        {/* Tag Pills: Single line horizontal scroll */}
        <div className="flex-1 flex items-center gap-1.5 overflow-x-auto pb-1 min-w-0">
          <button
            onClick={() => setSelectedTag("all")}
            className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition cursor-pointer ${
              selectedTag === "all"
                ? "bg-[#18181B] text-white dark:bg-white dark:text-slate-900 shadow-xs"
                : "bg-white/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            Semua ({notes.length})
          </button>
          {allTags.map((t) => (
            <button
              key={t}
              onClick={() => setSelectedTag(t)}
              className={`px-3 py-1 rounded-full text-xs font-semibold capitalize shrink-0 transition cursor-pointer ${
                selectedTag === t
                  ? "bg-[#18181B] text-white dark:bg-white dark:text-slate-900 shadow-xs"
                  : "bg-white/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              #{t}
            </button>
          ))}
        </div>
      </div>

      {/* Responsive Masonry Grid for Notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredNotes.map((n) => {
          const isLime = n.color === "#D2F27C";
          const isLavender = n.color === "#DCD4FB";
          const isSlate = n.color === "#CBD5E1";

          return (
            <motion.div
              key={n.id}
              layout
              initial={{ opacity: 1, y: 0 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={SPRING}
              className={`dashboard-card p-6 flex flex-col justify-between hover:shadow-md transition relative group border border-black/5 dark:border-white/10 ${
                n.pinned ? "ring-2 ring-slate-900/15 dark:ring-white/20" : ""
              }`}
              style={{
                backgroundColor: n.color || "#FFFFFF",
                color: "#18181B",
              }}
            >
              <div>
                {/* Top Action Row: Pinned Tag & Icons */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {n.pinned && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#18181B] text-white text-[10px] font-bold">
                        <Pin className="w-2.5 h-2.5 fill-white" />
                        <span>Pinned</span>
                      </span>
                    )}
                    {n.project_nama && (
                      <span className="px-2.5 py-0.5 rounded-full bg-white/70 text-slate-800 text-[10px] font-semibold border border-black/5">
                        {n.project_nama}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(n)}
                      className="p-1.5 rounded-full hover:bg-black/5 text-slate-500 hover:text-slate-900 transition cursor-pointer"
                      title="Edit catatan"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleTogglePin(n)}
                      className={`p-1.5 rounded-full hover:bg-black/5 transition cursor-pointer ${
                        n.pinned ? "text-slate-900" : "text-slate-400"
                      }`}
                      title={n.pinned ? "Lepas pin" : "Pin ke atas"}
                    >
                      <Pin className={`w-3.5 h-3.5 ${n.pinned ? "fill-slate-900" : ""}`} />
                    </button>
                    <button
                      onClick={() => handleCopyNote(n)}
                      className="p-1.5 rounded-full hover:bg-black/5 text-slate-500 hover:text-slate-900 transition cursor-pointer"
                      title="Salin isi memo"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteNote(n.id)}
                      className="p-1.5 rounded-full hover:bg-red-100 text-slate-400 hover:text-red-600 transition cursor-pointer"
                      title="Hapus memo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Note Title */}
                <h3 className="font-extrabold text-base text-slate-900 leading-snug mb-2">
                  {n.title}
                </h3>

                {/* Note Content */}
                <p className="text-xs text-slate-700 font-normal leading-relaxed whitespace-pre-wrap">
                  {n.content}
                </p>

                {/* Interactive Checklist (If present) */}
                {n.checklist && n.checklist.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-black/5 space-y-1.5">
                    {n.checklist.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleToggleChecklist(n, item.id)}
                        className="flex items-start gap-2 text-xs cursor-pointer group/item select-none"
                      >
                        <button
                          type="button"
                          className="mt-0.5 text-slate-800 shrink-0"
                        >
                          {item.done ? (
                            <CheckSquare className="w-3.5 h-3.5 stroke-[2.5]" />
                          ) : (
                            <Square className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <span
                          className={`leading-tight transition ${
                            item.done ? "line-through text-slate-400 font-medium" : "text-slate-800 font-semibold"
                          }`}
                        >
                          {item.text}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom Tags & Date Row */}
              <div className="mt-5 pt-3 border-t border-black/5 flex items-center justify-between gap-2 text-[10px] text-slate-500">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {n.tags?.map((t) => (
                    <span
                      key={t}
                      className="px-2 py-0.5 rounded-md bg-white/60 text-slate-700 font-semibold"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
                <span className="shrink-0 tabular-nums">
                  {n.created_at?.slice(0, 10) || "Hari ini"}
                </span>
              </div>
            </motion.div>
          );
        })}

        {filteredNotes.length === 0 && (
          <div className="col-span-full py-16 text-center dashboard-card p-8">
            <StickyNote className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h4 className="font-bold text-base text-slate-800 dark:text-slate-200">
              Belum Ada Catatan
            </h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Tulis catatan pertama Anda, simpan SOP tim, atau minta Asisten AI untuk membuatkannya langsung dari chat!
            </p>
          </div>
        )}
      </div>

      {/* Add Note Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg dashboard-card p-6 sm:p-8 shadow-2xl dark:text-slate-100"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-slate-700 mb-5">
                <div>
                  <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                    Buat Catatan Baru
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Tulis memo cepat atau daftar checklist to-do
                  </p>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateNote} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Judul Catatan
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Contoh: Checklist QC Konten Instagram"
                    className="w-full px-4 py-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Isi Catatan / Ringkasan
                  </label>
                  <textarea
                    rows={3}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Tulis deskripsi, poin SOP, atau instruksi kerja..."
                    className="w-full px-4 py-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition resize-none"
                  />
                </div>

                {/* Checklist Builder */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Daftar Checklist (Opsional)
                  </label>
                  <div className="flex items-center gap-2 mb-2">
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
                      placeholder="Ketik poin to-do lalu tekan Tambah / Enter"
                      className="flex-1 px-3.5 py-2 rounded-xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddChecklistItem}
                      className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold hover:opacity-90 transition cursor-pointer"
                    >
                      + Tambah
                    </button>
                  </div>

                  {checklistItems.length > 0 && (
                    <div className="space-y-1.5 max-h-32 overflow-y-auto p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/50">
                      {checklistItems.map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-xs px-2 py-1">
                          <span className="text-slate-800 dark:text-slate-200">☐ {item.text}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveChecklistItem(item.id)}
                            className="text-slate-400 hover:text-red-500"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Proyek Terkait
                    </label>
                    <CustomSelect
                      value={projId}
                      onChange={setProjId}
                      options={modalProjectOptions}
                      variant="form"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Tags (Pisahkan koma)
                    </label>
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      placeholder="desain, sop, q4"
                      className="w-full px-4 py-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition"
                    />
                  </div>
                </div>

                {/* Color Palette Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                    Warna Kartu Pastel
                  </label>
                  <div className="flex items-center gap-3">
                    {PASTEL_COLORS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setSelectedColor(c.value)}
                        className={`w-9 h-9 rounded-2xl border-2 transition-all flex items-center justify-center cursor-pointer ${
                          selectedColor === c.value
                            ? "ring-2 ring-slate-900 scale-110 shadow-sm"
                            : "hover:scale-105"
                        }`}
                        style={{ backgroundColor: c.value }}
                        title={c.label}
                      >
                        {selectedColor === c.value && (
                          <Check className="w-4 h-4 text-slate-900 stroke-[3]" />
                        )}
                      </button>
                    ))}

                    <label className="flex items-center gap-2 ml-auto text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isPinned}
                        onChange={(e) => setIsPinned(e.target.checked)}
                        className="w-4 h-4 rounded text-slate-900 focus:ring-0 cursor-pointer"
                      />
                      <span>Pin ke atas</span>
                    </label>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full min-h-[46px] rounded-full bg-[#1C1D21] hover:bg-black text-white font-semibold text-sm shadow-md active:scale-[0.98] transition flex items-center justify-center gap-2 cursor-pointer dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                  >
                    <span>{submitting ? "Menyimpan Catatan..." : "Simpan Catatan"}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {/* Edit Note Modal */}
        {editingNote && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setEditingNote(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg dashboard-card p-6 sm:p-8 shadow-2xl dark:text-slate-100"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-slate-700 mb-5">
                <div>
                  <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                    Edit Catatan
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Perbarui judul, ringkasan, checklist to-do, atau proyek
                  </p>
                </div>
                <button
                  onClick={() => setEditingNote(null)}
                  className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleUpdateNote} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Judul Catatan
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Judul catatan"
                    className="w-full px-4 py-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Isi Catatan / Ringkasan
                  </label>
                  <textarea
                    rows={3}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Tulis deskripsi, poin SOP, atau instruksi kerja..."
                    className="w-full px-4 py-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition resize-none"
                  />
                </div>

                {/* Checklist Builder */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Daftar Checklist (To-Do)
                  </label>
                  <div className="flex items-center gap-2 mb-2">
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
                      placeholder="Ketik poin to-do lalu tekan Tambah / Enter"
                      className="flex-1 px-3.5 py-2 rounded-xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddChecklistItem}
                      className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold hover:opacity-90 transition cursor-pointer"
                    >
                      + Tambah
                    </button>
                  </div>

                  {checklistItems.length > 0 && (
                    <div className="space-y-1.5 max-h-32 overflow-y-auto p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/50">
                      {checklistItems.map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-xs px-2 py-1">
                          <span className={`text-slate-800 dark:text-slate-200 ${item.done ? "line-through text-slate-400" : ""}`}>
                            {item.done ? "☑" : "☐"} {item.text}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveChecklistItem(item.id)}
                            className="text-slate-400 hover:text-red-500"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Proyek Terkait
                    </label>
                    <CustomSelect
                      value={projId}
                      onChange={setProjId}
                      options={modalProjectOptions}
                      variant="form"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Tags (Pisahkan koma)
                    </label>
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      placeholder="desain, sop, q4"
                      className="w-full px-4 py-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition"
                    />
                  </div>
                </div>

                {/* Color Palette Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                    Warna Kartu Pastel
                  </label>
                  <div className="flex items-center gap-3">
                    {PASTEL_COLORS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setSelectedColor(c.value)}
                        className={`w-9 h-9 rounded-2xl border-2 transition-all flex items-center justify-center cursor-pointer ${
                          selectedColor === c.value
                            ? "ring-2 ring-slate-900 scale-110 shadow-sm"
                            : "hover:scale-105"
                        }`}
                        style={{ backgroundColor: c.value }}
                        title={c.label}
                      >
                        {selectedColor === c.value && (
                          <Check className="w-4 h-4 text-slate-900 stroke-[3]" />
                        )}
                      </button>
                    ))}

                    <label className="flex items-center gap-2 ml-auto text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isPinned}
                        onChange={(e) => setIsPinned(e.target.checked)}
                        className="w-4 h-4 rounded text-slate-900 focus:ring-0 cursor-pointer"
                      />
                      <span>Pin ke atas</span>
                    </label>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full min-h-[46px] rounded-full bg-[#1C1D21] hover:bg-black text-white font-semibold text-sm shadow-md active:scale-[0.98] transition flex items-center justify-center gap-2 cursor-pointer dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                  >
                    <span>{submitting ? "Memperbarui Catatan..." : "Simpan Perubahan"}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={deleteTargetId !== null}
        title="Hapus Catatan"
        message="Catatan beserta daftar checklist di dalamnya akan dihapus permanen."
        confirmLabel="Hapus Catatan"
        loading={deleting}
        onConfirm={executeDeleteNote}
        onCancel={() => !deleting && setDeleteTargetId(null)}
      />
    </div>
  );
}
