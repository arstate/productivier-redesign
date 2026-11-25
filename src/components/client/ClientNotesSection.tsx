"use client";

import React, { useState, useEffect } from "react";
import {
  MessageSquareQuote,
  Send,
  CheckCircle2,
  Clock,
  HelpCircle,
  Sparkles,
  RefreshCw,
  User,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { ProjectClientNoteType } from "@/types";

interface ClientNotesSectionProps {
  projectId: number;
  shareToken?: string;
  initialNotes?: ProjectClientNoteType[];
}

const CATEGORIES = [
  { id: "feedback", label: "Feedback Desain", icon: MessageSquareQuote, color: "bg-blue-100 text-blue-800" },
  { id: "revisi", label: "Request Revisi", icon: AlertCircle, color: "bg-amber-100 text-amber-800" },
  { id: "pertanyaan", label: "Pertanyaan", icon: HelpCircle, color: "bg-purple-100 text-purple-800" },
  { id: "apresiasi", label: "Apresiasi", icon: Sparkles, color: "bg-emerald-100 text-emerald-800" },
] as const;

function formatSafeDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const iso = dateStr.includes(" ") && !dateStr.includes("T") ? dateStr.replace(" ", "T") + "Z" : dateStr;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString("id-ID", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "Asia/Jakarta",
    });
  } catch {
    return dateStr;
  }
}

export default function ClientNotesSection({ projectId, shareToken = "", initialNotes = [] }: ClientNotesSectionProps) {
  const [notes, setNotes] = useState<ProjectClientNoteType[]>(initialNotes);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>("all");

  // Form states
  const [authorName, setAuthorName] = useState("");
  const [category, setCategory] = useState<ProjectClientNoteType["category"]>("feedback");
  const [message, setMessage] = useState("");
  const [notification, setNotification] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const qs = shareToken ? `?token=${encodeURIComponent(shareToken)}` : "";
      const res = await fetch(`/api/projects/${projectId}/client-notes${qs}`);
      const data = await res.json();
      if (res.ok && data.clientNotes) {
        setNotes(data.clientNotes);
      }
    } catch (e) {
      console.error("Gagal memuat catatan klien:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialNotes.length > 0) return;
    let active = true;
    (async () => {
      try {
        const qs = shareToken ? `?token=${encodeURIComponent(shareToken)}` : "";
        const res = await fetch(`/api/projects/${projectId}/client-notes${qs}`);
        const data = await res.json();
        if (active && res.ok && data.clientNotes) {
          setNotes(data.clientNotes);
        }
      } catch (e) {
        console.error("Gagal memuat catatan klien:", e);
      }
    })();
    return () => {
      active = false;
    };
  }, [projectId, shareToken, initialNotes.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setSubmitting(true);
    setNotification(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/client-notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(shareToken ? { "x-share-token": shareToken } : {}),
        },
        body: JSON.stringify({
          author_name: authorName.trim() || "Klien Tamu",
          author_role: "client",
          message: message.trim(),
          category,
          status: "open",
        }),
      });

      const data = await res.json();

      if (res.ok && data.clientNote) {
        // Optimistic UI insertion
        setNotes((prev) => [data.clientNote, ...prev.filter((n) => n.id !== data.clientNote.id)]);
        setMessage("");
        setNotification({
          type: "success",
          text: "Catatan atau revisi Anda berhasil dikirim ke tim pelaksana!",
        });
        await fetchNotes();
        setTimeout(() => setNotification(null), 4000);
      } else {
        setNotification({
          type: "error",
          text: data.error || "Gagal mengirimkan catatan. Silakan coba lagi.",
        });
      }
    } catch {
      setNotification({
        type: "error",
        text: "Terjadi gangguan jaringan saat mengirim catatan.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: ProjectClientNoteType["status"]) => {
    switch (status) {
      case "resolved":
        return {
          label: "Tuntas / Diterapkan",
          classes: "bg-emerald-100 text-emerald-800 border-emerald-200",
          icon: CheckCircle2,
        };
      case "in_progress":
        return {
          label: "Sedang Dikerjakan Tim",
          classes: "bg-amber-100 text-amber-900 border-amber-200",
          icon: Clock,
        };
      default:
        return {
          label: "Menunggu Review Tim",
          classes: "bg-slate-100 text-slate-800 border-slate-200",
          icon: Clock,
        };
    }
  };

  const getCategoryDetails = (cat: ProjectClientNoteType["category"]) => {
    return (
      CATEGORIES.find((c) => c.id === cat) || {
        label: "Catatan",
        color: "bg-slate-100 text-slate-700",
        icon: MessageSquareQuote,
      }
    );
  };

  const filteredNotes = activeFilter === "all"
    ? notes
    : notes.filter((item) => item.category === activeFilter);

  return (
    <div className="dashboard-card p-5 sm:p-6 bg-white/95 backdrop-blur-md shadow-sm border border-slate-200/80 space-y-5">
      {/* SECTION HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
              Kanal Catatan &amp; Kolaborasi Klien
            </h2>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Kirimkan revisi, masukan desain, atau pertanyaan langsung ke workspace internal tim
          </p>
        </div>

        <button
          onClick={fetchNotes}
          disabled={loading}
          className="self-start sm:self-auto px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
          title="Segarkan daftar feedback"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Segarkan</span>
        </button>
      </div>

      {/* FEEDBACK FORM */}
      <form onSubmit={handleSubmit} className="p-4 sm:p-5 rounded-3xl bg-slate-50 border border-slate-200/80 space-y-3.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
            + Tambah Catatan / Request Revisi
          </span>
          <span className="text-[10px] text-slate-400 font-medium">Terhubung langsung ke tim</span>
        </div>

        {notification && (
          <div
            className={`p-3 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
              notification.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {notification.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            )}
            <span>{notification.text}</span>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Nama Anda / Brand
            </label>
            <input
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="Contoh: Pak Budi (Klien) / Tim Marketing"
              className="w-full px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Kategori Catatan
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map((cat) => {
                const CatIcon = cat.icon;
                const isSelected = category === cat.id;
                return (
                  <button
                    type="button"
                    key={cat.id}
                    onClick={() => setCategory(cat.id)}
                    className={`px-3 py-2.5 rounded-xl text-xs font-bold text-left transition flex items-center gap-2 cursor-pointer ${
                      isSelected
                        ? "bg-[#1C1D21] text-white shadow-xs"
                        : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/80"
                    }`}
                  >
                    <CatIcon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-[#D2F27C]" : "text-slate-400"}`} />
                    <span className="truncate">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1">
            Detail Pesan / Revisi yang Diinginkan
          </label>
          <textarea
            required
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tuliskan catatan, revisi spesifik slide/halaman, atau arahan konten Anda di sini..."
            className="w-full px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition resize-none"
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
          <p className="text-[10px] text-slate-400 font-medium">
            Tim otomatis menerima notifikasi dan memperbarui status pengerjaan.
          </p>
          <button
            type="submit"
            disabled={submitting || !message.trim()}
            className="px-5 py-2.5 rounded-full bg-[#1C1D21] hover:bg-black text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md transition active:scale-95 disabled:opacity-50 cursor-pointer shrink-0"
          >
            <Send className="w-3.5 h-3.5 text-[#D2F27C]" />
            <span>{submitting ? "Mengirim..." : "Kirim Catatan"}</span>
          </button>
        </div>
      </form>

      {/* FEEDBACK STREAM LIST WITH CATEGORY FILTER */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              Riwayat Komunikasi &amp; Feedback ({filteredNotes.length})
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">Urutan terbaru di atas</span>
        </div>

        {/* CATEGORY FILTER TABS */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveFilter("all")}
            className={`px-3 py-1.5 rounded-full font-bold text-xs transition shrink-0 cursor-pointer ${
              activeFilter === "all"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Semua ({notes.length})
          </button>
          {CATEGORIES.map((cat) => {
            const count = notes.filter((n) => n.category === cat.id).length;
            return (
              <button
                type="button"
                key={cat.id}
                onClick={() => setActiveFilter(cat.id)}
                className={`px-3 py-1.5 rounded-full font-bold text-xs transition shrink-0 cursor-pointer flex items-center gap-1 ${
                  activeFilter === cat.id
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <span>{cat.id === "revisi" ? "Revisi" : cat.id === "pertanyaan" ? "Pertanyaan" : cat.id === "apresiasi" ? "Apresiasi" : "Feedback"}</span>
                {count > 0 && <span className="text-[10px] opacity-75">({count})</span>}
              </button>
            );
          })}
        </div>

        {filteredNotes.length > 0 ? (
          <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
            {filteredNotes.map((item) => {
              const cat = getCategoryDetails(item.category);
              const status = getStatusBadge(item.status);
              const StatusIcon = status.icon;
              const isTeam = item.author_role === "team";

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border transition ${
                    isTeam
                      ? "bg-[#D2F27C]/10 border-[#D2F27C]/50 ml-3 sm:ml-6"
                      : "bg-white border-slate-200/80 hover:border-slate-300"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        {isTeam ? (
                          <span className="w-6 h-6 rounded-full bg-[#1C1D21] text-[#D2F27C] flex items-center justify-center font-bold text-[10px] shadow-xs">
                            <ShieldCheck className="w-3.5 h-3.5" />
                          </span>
                        ) : (
                          <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center">
                            <User className="w-3.5 h-3.5" />
                          </span>
                        )}
                        <strong className="text-xs font-extrabold text-slate-900">
                          {item.author_name}
                        </strong>
                      </div>

                      {isTeam && (
                        <span className="px-2 py-0.5 rounded-full bg-[#1C1D21] text-[#D2F27C] text-[10px] font-black uppercase tracking-wider">
                          Tim Productivier
                        </span>
                      )}

                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${cat.color}`}>
                        {cat.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${status.classes}`}
                      >
                        <StatusIcon className="w-3 h-3" />
                        <span>{status.label}</span>
                      </span>

                      <span className="text-[10px] text-slate-400 font-medium" suppressHydrationWarning>
                        {formatSafeDate(item.created_at)}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-800 font-medium leading-relaxed whitespace-pre-wrap pl-1">
                    {item.message}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            {activeFilter === "all"
              ? "Belum ada catatan atau revisi yang dikirimkan. Gunakan form di atas untuk berdiskusi dengan tim."
              : "Belum ada catatan pada kategori ini."}
          </div>
        )}
      </div>
    </div>
  );
}
