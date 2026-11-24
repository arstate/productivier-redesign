"use client";

import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles,
  X,
  Send,
  Mic,
  Shield,
  Check,
  AlertCircle,
  Minimize2,
  Maximize2,
  Move,
  RefreshCw,
  Clock,
  Layers,
  ChevronDown,
  ChevronUp,
  Brain,
  Zap,
  Microscope,
  Compass,
} from "lucide-react";
import { UserType, AIMessageType, AIActionRequestType } from "@/types";
import ProductivierLogo from "@/components/ui/ProductivierLogo";
import MarkdownText from "@/components/ui/MarkdownText";
import AIMascot from "@/components/ui/AIMascot";

interface FloatingAIAgentProps {
  user: UserType;
  showToast: (m: string) => void;
  onRefreshData?: () => Promise<void>;
  onNavigateTab?: (tab: string) => void;
}

const QUICK_PROMPTS = [
  "⚡ Rekap Progres Tim",
  "💡 Rekomendasi Prioritas",
  "🧭 Bukain Project Deadline Terdekat",
  "➕ Buat Project Baru: Landing Page MVP",
  "📝 Catat Memo: Ide Konten 3:4",
  "📅 Jadwalkan Rapat Besok Jam 10",
];

export interface AIModelCapability {
  id: string;
  name: string;
  short: string;
  icon: string;
  badge: string;
  supportsReasoning: boolean;
  supportsReasoningEffort: boolean;
}

export const AI_MODELS: readonly AIModelCapability[] = [
  {
    id: "baidu/ernie-5.5-flash-preview:free",
    name: "Baidu ERNIE 5.5 Flash Preview (Free)",
    short: "ERNIE 5.5",
    icon: "🇨🇳",
    badge: "Free",
    supportsReasoning: true,
    supportsReasoningEffort: true,
  },
  {
    id: "nvidia/nemotron-3.5-super-vl:free",
    name: "NVIDIA Nemotron 3.5 Super VL (Free)",
    short: "Nemotron 3.5",
    icon: "🤖",
    badge: "Free",
    supportsReasoning: true,
    supportsReasoningEffort: false,
  },
] as const;

type AIModelId = (typeof AI_MODELS)[number]["id"];

export type ThinkingModeOption = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  sub: string;
};

const EFFORT_THINKING_MODES: ThinkingModeOption[] = [
  { id: "low", label: "Low Thinking", icon: Zap, sub: "Fast (Eksekusi Instan)" },
  { id: "medium", label: "Medium Thinking", icon: Brain, sub: "Balanced (Standar Tim)" },
  { id: "high", label: "High Thinking", icon: Microscope, sub: "Deep (Kritis Forensik)" },
];

const NATIVE_THINKING_MODES: ThinkingModeOption[] = [
  { id: "native", label: "Native Reasoning (Bawaan Model)", icon: Brain, sub: "Penalaran Alami Bawaan Model" },
  { id: "direct", label: "Direct (Tanpa Penalaran)", icon: Zap, sub: "Respon Cepat Tanpa CoT" },
];

export default function FloatingAIAgent({
  user,
  showToast,
  onRefreshData,
  onNavigateTab,
}: FloatingAIAgentProps) {
  const isFemale = user.gender === "female" || user.username === "fifa" || user.nama.toLowerCase().includes("fifa");
  const sapaan = isFemale ? "Bestie" : "Bro";
  const firstName = user.nama.split(" ")[0];

  const [isOpen, setIsOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AIModelId>("nvidia/nemotron-3.5-super-vl:free");
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [thinkingMode, setThinkingMode] = useState<string>("native");
  const [thinkingDropdownOpen, setThinkingDropdownOpen] = useState(false);
  const [expandedThinkingIds, setExpandedThinkingIds] = useState<Record<string, boolean>>({});

  const currentModelConfig = AI_MODELS.find((m) => m.id === selectedModel);
  const availableThinkingModes = !currentModelConfig || !currentModelConfig.supportsReasoning
    ? []
    : currentModelConfig.supportsReasoningEffort
    ? EFFORT_THINKING_MODES
    : NATIVE_THINKING_MODES;

  const handleModelSelect = (mId: AIModelId) => {
    setSelectedModel(mId);
    setModelDropdownOpen(false);
    const targetModel = AI_MODELS.find((m) => m.id === mId);
    if (!targetModel || !targetModel.supportsReasoning) {
      setThinkingMode("direct");
    } else if (targetModel.supportsReasoningEffort) {
      // Switched to model supporting effort (e.g. ERNIE):
      if (thinkingMode === "native" || thinkingMode === "direct" || !["low", "medium", "high"].includes(thinkingMode)) {
        setThinkingMode("medium");
      }
    } else {
      // Switched to model with native reasoning only (e.g. Nemotron):
      if (["low", "medium", "high"].includes(thinkingMode)) {
        setThinkingMode("native");
      }
    }
    showToast(`Model AI aktif: ${targetModel?.name || mId}`);
  };

  const [messages, setMessages] = useState<AIMessageType[]>([
    {
      id: "welcome",
      role: "assistant",
      content: isFemale
        ? `Hai ${firstName}, ${sapaan}! ✨ Gw Miu AI personal agent lu dengan full system controlling. Siap buat proyek baru, delegasikan tugas, catat memo di Notes, atur jadwal Kalender, atau navigasi halaman otomatis. Setiap aksi mutasi data selalu terjaga Human-in-the-Loop 100%, Sis! 🚀`
        : `Yo ${firstName}! Gw Miu AI personal agent lu dengan full system controlling. Siap buat proyek baru, delegasikan tugas, catat memo di Notes, atur jadwal Kalender, atau navigasi halaman otomatis. Setiap aksi mutasi data selalu terjaga Human-in-the-Loop 100%, Bro! 🚀`,
      timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      suggestions: [
        "Bukain Project Deadline Terdekat",
        "Rekap Progres Proyek",
        "Cek Pantauan Tim Hari Ini",
        "Buat Project Baru: Sprint Q4",
      ],
    },
  ]);
  const [inputMsg, setInputMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isCompacted, setIsCompacted] = useState(false);
  const [compactCount, setCompactCount] = useState(0);
  const [pendingActionsCount, setPendingActionsCount] = useState(0);
  const [actionStatuses, setActionStatuses] = useState<Record<number, "pending" | "approved" | "rejected">>({});
  const [processingActionId, setProcessingActionId] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.style.scrollBehavior = "auto";
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  useLayoutEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [isOpen, messages, loading]);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      const raf = requestAnimationFrame(() => {
        scrollToBottom();
        requestAnimationFrame(scrollToBottom);
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [isOpen, messages.length, loading]);

  // Check pending actions count periodically
  const fetchPendingActions = async () => {
    try {
      const res = await fetch(`/api/ai/actions?user_id=${user.id}&status=pending`);
      if (res.ok) {
        const data = await res.json();
        setPendingActionsCount((data.requests || []).length);
      }
    } catch {
      // Ignore background fetch error
    }
  };

  useEffect(() => {
    fetchPendingActions();
    const interval = setInterval(fetchPendingActions, 15000);
    return () => clearInterval(interval);
  }, [user.id]);

  const toggleThinkingBox = (msgId: string) => {
    setExpandedThinkingIds((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputMsg).trim();
    if (!text || loading) return;

    const userMessage: AIMessageType = {
      id: String(Date.now()),
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!textToSend) setInputMsg("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          user_id: user.id,
          user_nama: user.nama,
          user_divisi: user.divisi,
          user_role: user.role,
          user_gender: user.gender || (isFemale ? "female" : "male"),
          thinking_mode: thinkingMode,
          selected_model: selectedModel,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menghubungi model AI");
      }

      const aiMsgId = String(Date.now() + 1);
      const aiMsg: AIMessageType = {
        id: aiMsgId,
        role: "assistant",
        content: data.content,
        timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        actionResult: data.actionResult,
        actionPending: data.actionPending,
        uiAction: data.uiAction,
        thinkingProcess: data.thinking_process,
        thinkingTime: data.thinking_time,
        thinkingMode: data.thinking_mode,
        model: data.model || data.selected_model || selectedModel,
        suggestions: data.suggestions,
      };

      setMessages((prev) => [...prev, aiMsg]);

      // Expand thinking process by default in high mode or native mode, or keep closed in low/direct
      if ((thinkingMode === "high" || thinkingMode === "native") && data.thinking_process) {
        setExpandedThinkingIds((prev) => ({ ...prev, [aiMsgId]: true }));
      }

      setIsCompacted(Boolean(data.compacted));
      setCompactCount(data.compactCount || 0);

      if (data.actionPending) {
        setPendingActionsCount((prev) => prev + 1);
        setActionStatuses((prev) => ({
          ...prev,
          [data.actionPending.id]: "pending",
        }));
        showToast("⚠️ Izin Diperlukan: AI meminta persetujuan untuk mengubah data.");
      }

      // Execute Real Web Automation & UI Navigation
      if (data.uiAction) {
        const { tab, projectId, projectName } = data.uiAction;
        if (tab && onNavigateTab) {
          onNavigateTab(tab);
        }
        if (projectId) {
          window.dispatchEvent(
            new CustomEvent("productivier:open_project", {
              detail: { projectId: Number(projectId) },
            })
          );
        }
        showToast(`⚡ AI Agent Automation: Mengalihkan tampilan ke ${tab.toUpperCase()}${projectName ? ` (${projectName})` : ""}...`);
      }

      if (data.actionResult && onRefreshData) {
        await onRefreshData();
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Terjadi kesalahan";
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          role: "assistant",
          content: `Maaf ${sapaan}, ada gangguan saat menghubungi AI (${errorMsg}). Sistem tetap aman! Coba lagi ya.`,
          timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Handle Human-in-the-Loop Permission Decision
  const handleActionDecision = async (actionReqId: number, decision: "approved" | "rejected") => {
    setProcessingActionId(actionReqId);
    try {
      const res = await fetch("/api/ai/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action_request_id: actionReqId,
          status: decision,
          user_id: user.id,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setActionStatuses((prev) => ({
          ...prev,
          [actionReqId]: decision,
        }));
        setPendingActionsCount((prev) => Math.max(0, prev - 1));

        if (decision === "approved") {
          showToast(`✅ Aksi AI disetujui: ${data.message}`);
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("productivier:refresh_data"));
          }
          if (onRefreshData) {
            await onRefreshData();
          }
        } else {
          showToast("❌ Aksi AI telah dibatalkan.");
        }
      } else {
        showToast(`Gagal memproses aksi: ${data.error || "Kesalahan server"}`);
      }
    } catch {
      showToast("Gagal memproses perizinan aksi");
    } finally {
      setProcessingActionId(null);
    }
  };

  // Voice Input (Web Speech API)
  const handleVoiceInput = () => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      showToast("Browser Anda belum mendukung input suara.");
      return;
    }

    if (isRecording) {
      setIsRecording(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "id-ID";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsRecording(true);
        showToast("Mendengarkan suara Anda...");
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputMsg(transcript);
          handleSend(transcript);
        }
      };

      recognition.onerror = () => {
        setIsRecording(false);
        showToast("Suara tidak terdeteksi, silakan ketik.");
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.start();
    } catch {
      setIsRecording(false);
      showToast("Izin mikrofon diperlukan.");
    }
  };

  return (
    <div className="fixed z-50 pointer-events-none inset-0 overflow-hidden select-none">
      {/* 1. COLLAPSED FLOATING ORB */}
      {!isOpen && (
        <motion.div
          drag
          dragMomentum={false}
          role="button"
          aria-label="Buka Miu AI Agent"
          className="absolute bottom-6 right-6 pointer-events-auto cursor-grab active:cursor-grabbing z-50"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(true)}
        >
          <div className="relative group flex items-center justify-center">
            {/* Ambient Breathing Glow */}
            <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-[#D2F27C] via-purple-400 to-[#1C1D21] opacity-75 blur-md group-hover:opacity-100 transition duration-700 animate-pulse" />

            {/* Floating Orb Bubble */}
            <div className="relative w-14 h-14 rounded-full bg-[#1C1D21] dark:bg-white text-white dark:text-slate-900 shadow-2xl flex items-center justify-center border-2 border-[#D2F27C]/80">
              <AIMascot size={32} />

              {/* Pending Action Badge */}
              {pendingActionsCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-5 w-5 bg-amber-500 text-slate-950 font-black text-[10px] items-center justify-center shadow-xs">
                    {pendingActionsCount}
                  </span>
                </span>
              )}
            </div>

            {/* Hover Tooltip */}
            <div className="absolute right-16 px-3 py-1.5 rounded-full bg-slate-900/95 text-white text-xs font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 transition shadow-lg pointer-events-none border border-slate-700">
              <span>Miu AI · Autonomous Full Controlling</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* 2. EXPANDED DRAGGABLE AI WORKSPACE */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            drag
            dragMomentum={false}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 20 }}
            className="absolute bottom-6 right-6 pointer-events-auto w-[410px] sm:w-[440px] max-w-[calc(100vw-24px)] h-[620px] max-h-[calc(100vh-80px)] rounded-3xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-black/10 dark:border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.25)] flex flex-col overflow-hidden z-50 text-slate-900 dark:text-slate-100"
          >
            {/* Header with Drag Handle */}
            <div className="ai-drag-header px-4 py-3 bg-[#1C1D21] text-white flex items-center justify-between cursor-move shrink-0 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#D2F27C] text-slate-900 flex items-center justify-center font-black overflow-hidden">
                  <AIMascot size={26} />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-xs tracking-wide">Miu Autonomous Agent</span>
                    <span className="w-2 h-2 rounded-full bg-[#D2F27C] animate-pulse" />
                  </div>
                  <span className="text-[10px] text-slate-400 block -mt-0.5">
                    Universal Co-Worker · Full Controlling
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center text-slate-300 hover:text-white transition cursor-pointer"
                  title="Minimize"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="w-7 h-7 rounded-full hover:bg-red-500/20 hover:text-red-400 flex items-center justify-center text-slate-300 transition cursor-pointer"
                  title="Tutup"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Model & Thinking Budget Selector Bar */}
            <div className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800/80 border-b border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between text-[10px] shrink-0 relative gap-1.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* 1. Model Selector Dropdown Trigger */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setModelDropdownOpen(!modelDropdownOpen);
                      setThinkingDropdownOpen(false);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold border border-slate-200 dark:border-slate-700 transition cursor-pointer shadow-2xs"
                  >
                    <span>{AI_MODELS.find((m) => m.id === selectedModel)?.icon || "🤖"}</span>
                    <span>{AI_MODELS.find((m) => m.id === selectedModel)?.short || "Model"}</span>
                    <ChevronDown className="w-3 h-3 text-slate-400" />
                  </button>

                  {/* Model Dropdown Menu */}
                  {modelDropdownOpen && (
                    <div className="absolute top-7 left-0 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-1.5 z-50 space-y-1">
                      {AI_MODELS.map((m) => {
                        const active = selectedModel === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => handleModelSelect(m.id)}
                            className={`w-full text-left px-2.5 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer ${
                              active
                                ? "bg-[#1C1D21] text-white dark:bg-white dark:text-slate-900"
                                : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200"
                            }`}
                          >
                            <span className="text-base shrink-0">{m.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-bold text-[11px] block leading-tight truncate">{m.short}</span>
                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
                                  active
                                    ? "bg-white/20 text-white dark:bg-black/10 dark:text-slate-900"
                                    : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                }`}>
                                  {m.badge}
                                </span>
                              </div>
                              <span className={`text-[9px] block leading-tight truncate ${active ? "opacity-80" : "text-slate-400"}`}>
                                {m.name}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 2. Thinking Mode Dropdown Trigger */}
                <div className="relative">
                  <button
                    type="button"
                    disabled={!currentModelConfig?.supportsReasoning}
                    onClick={() => {
                      if (!currentModelConfig?.supportsReasoning) return;
                      setThinkingDropdownOpen(!thinkingDropdownOpen);
                      setModelDropdownOpen(false);
                    }}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold border transition shadow-2xs ${
                      !currentModelConfig?.supportsReasoning
                        ? "bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-60"
                        : "bg-white dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-700 cursor-pointer"
                    }`}
                  >
                    {!currentModelConfig?.supportsReasoning ? (
                      <>
                        <AlertCircle className="w-3 h-3 text-slate-400" />
                        <span>Tidak Didukung</span>
                      </>
                    ) : currentModelConfig.supportsReasoningEffort ? (
                      <>
                        {thinkingMode === "low" && <Zap className="w-3 h-3 text-amber-500" />}
                        {thinkingMode === "medium" && <Brain className="w-3 h-3 text-purple-500" />}
                        {thinkingMode === "high" && <Microscope className="w-3 h-3 text-emerald-500" />}
                        <span className="capitalize">
                          {thinkingMode === "low" ? "Low Thinking" : thinkingMode === "high" ? "High Thinking" : "Medium Thinking"}
                        </span>
                        <ChevronDown className="w-3 h-3 text-slate-400" />
                      </>
                    ) : (
                      <>
                        {thinkingMode === "direct" ? (
                          <Zap className="w-3 h-3 text-slate-400" />
                        ) : (
                          <Brain className="w-3 h-3 text-purple-500" />
                        )}
                        <span>
                          {thinkingMode === "direct" ? "Direct (Tanpa Penalaran)" : "Native Reasoning"}
                        </span>
                        <ChevronDown className="w-3 h-3 text-slate-400" />
                      </>
                    )}
                  </button>

                  {/* Thinking Dropdown Menu */}
                  {thinkingDropdownOpen && availableThinkingModes.length > 0 && (
                    <div className="absolute top-7 left-0 w-60 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-1.5 z-50 space-y-1">
                      {availableThinkingModes.map((tm) => {
                        const Icon = tm.icon;
                        const active =
                          thinkingMode === tm.id ||
                          (tm.id === "native" && (thinkingMode === "medium" || thinkingMode === "native"));
                        return (
                          <button
                            key={tm.id}
                            type="button"
                            onClick={() => {
                              setThinkingMode(tm.id);
                              setThinkingDropdownOpen(false);
                              showToast(`Mode Penalaran diubah ke: ${tm.label}`);
                            }}
                            className={`w-full text-left px-2.5 py-1.5 rounded-xl transition flex items-center gap-2 cursor-pointer ${
                              active
                                ? "bg-[#1C1D21] text-white dark:bg-white dark:text-slate-900"
                                : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200"
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5 shrink-0" />
                            <div>
                              <span className="font-bold text-[11px] block leading-tight">{tm.label}</span>
                              <span className={`text-[9px] block leading-tight ${active ? "opacity-80" : "text-slate-400"}`}>
                                {tm.sub}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Status Indicator */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                  <Shield className="w-3 h-3 text-emerald-500" />
                  <span>HITL</span>
                </span>
                {isCompacted && compactCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/70 text-purple-900 dark:text-purple-300 font-extrabold border border-purple-200 dark:border-purple-800 text-[9px]">
                    Auto-Compacted ({compactCount})
                  </span>
                )}
              </div>
            </div>

            {/* Chat Conversation Scroll Area */}
            <div ref={chatContainerRef} style={{ scrollBehavior: "auto" }} className="flex-1 p-4 overflow-y-auto space-y-3.5 text-xs select-text">
              {messages.map((m) => {
                const isUser = m.role === "user";
                const pendingAction = m.actionPending;
                const actionStatus = pendingAction
                  ? actionStatuses[pendingAction.id] || pendingAction.status
                  : null;
                const isThinkingOpen = expandedThinkingIds[m.id];

                return (
                  <div key={m.id} className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
                    <div className="flex items-center gap-1.5 mb-1 text-[10px] text-slate-400">
                      {!isUser && <AIMascot size={16} />}
                      <span className="font-bold text-slate-600 dark:text-slate-300">
                        {isUser ? user.nama : "Miu AI"}
                      </span>
                      <span>·</span>
                      <span className="tabular-nums">{m.timestamp}</span>
                    </div>

                    {/* Thinking Process Accordion (Rendered above AI response bubble) */}
                    {!isUser && m.thinkingProcess && (
                      <div className="w-full max-w-[90%] mb-1.5">
                        <div className="rounded-xl border border-purple-200/60 dark:border-purple-800/50 bg-purple-50/50 dark:bg-purple-950/20 overflow-hidden text-[10px]">
                          <button
                            type="button"
                            onClick={() => toggleThinkingBox(m.id)}
                            className="w-full px-2.5 py-1.5 flex items-center justify-between text-purple-900 dark:text-purple-300 font-bold hover:bg-purple-100/50 dark:hover:bg-purple-900/30 transition cursor-pointer"
                          >
                            <div className="flex items-center gap-1.5">
                              <Brain className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                              <span>
                                {m.thinkingProcess.startsWith("[Log Eksekusi Sistem]")
                                  ? "Log Eksekusi Sistem"
                                  : `Penalaran Asli ${
                                      (m.model && (m.model.includes("ernie") ? "ERNIE 5.5" : m.model.includes("nemotron") ? "Nemotron 3.5" : AI_MODELS.find((mod) => mod.id === m.model)?.short)) ||
                                      (m.model ? m.model.split("/").pop()?.split(":")[0] : (selectedModel.includes("ernie") ? "ERNIE 5.5" : "Nemotron 3.5"))
                                    } (${m.thinkingTime || 1.2}s · ${
                                      m.thinkingMode === "native"
                                        ? "Bawaan"
                                        : m.thinkingMode === "direct"
                                        ? "Direct"
                                        : m.thinkingMode || "medium"
                                    })`}
                              </span>
                            </div>
                            {isThinkingOpen ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            )}
                          </button>

                          {isThinkingOpen && (
                            <div className="px-3 py-2 border-t border-purple-200/50 dark:border-purple-800/40 text-slate-700 dark:text-slate-300 font-mono whitespace-pre-wrap leading-relaxed bg-white/40 dark:bg-slate-900/40">
                              {m.thinkingProcess}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div
                      className={`max-w-[88%] px-3.5 py-2.5 rounded-2xl leading-relaxed ${
                        isUser
                          ? "bg-[#1C1D21] text-white dark:bg-white dark:text-slate-900 rounded-tr-xs"
                          : "bg-slate-100/90 dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-tl-xs border border-slate-200/50 dark:border-slate-700/50"
                      }`}
                    >
                      <MarkdownText content={m.content} />

                      {/* Result Card if action executed */}
                      {m.actionResult && (
                        <div className="mt-2.5 pt-2 border-t border-black/10 dark:border-white/10 text-[11px]">
                          <div className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                            <Check className="w-3.5 h-3.5" />
                            <span>{m.actionResult.title}</span>
                          </div>
                          {m.actionResult.details && (
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {m.actionResult.details}
                            </p>
                          )}
                        </div>
                      )}

                      {/* UI Automation Glow Card */}
                      {m.uiAction && (
                        <div className="mt-2.5 p-2.5 rounded-xl bg-gradient-to-r from-[#D2F27C]/20 via-emerald-100/30 to-[#DCD4FB]/20 border border-[#D2F27C]/60 text-[11px] flex items-center justify-between gap-2 shadow-2xs">
                          <div className="flex items-center gap-2">
                            <Compass className="w-4 h-4 text-emerald-600 dark:text-[#D2F27C] animate-spin" />
                            <div>
                              <span className="font-extrabold text-slate-900 dark:text-white block">
                                Navigasi Otomatis: {m.uiAction.tab.toUpperCase()}
                              </span>
                              <span className="text-[10px] text-slate-600 dark:text-slate-300">
                                {m.uiAction.reason || "Layar dialihkan seketika"}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (onNavigateTab) onNavigateTab(m.uiAction!.tab);
                              if (m.uiAction!.projectId) {
                                window.dispatchEvent(
                                  new CustomEvent("productivier:open_project", {
                                    detail: { projectId: Number(m.uiAction!.projectId) },
                                  })
                                );
                              }
                            }}
                            className="px-2.5 py-1 rounded-full bg-[#1C1D21] dark:bg-white text-white dark:text-slate-900 font-bold text-[10px] transition hover:scale-105 active:scale-95 cursor-pointer shrink-0"
                          >
                            Buka Layar
                          </button>
                        </div>
                      )}

                      {/* Human-in-the-Loop Confirmation Card */}
                      {pendingAction && (
                        <div className="mt-3 p-3 rounded-xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-700/60 text-slate-900 dark:text-slate-100 space-y-2">
                          <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-extrabold text-[11px]">
                            <Shield className="w-3.5 h-3.5 shrink-0" />
                            <span>Konfirmasi Izin Aksi Sistem</span>
                          </div>

                          <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                            {pendingAction.description}
                          </p>

                          {actionStatus === "pending" ? (
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                type="button"
                                disabled={processingActionId === pendingAction.id}
                                onClick={() => handleActionDecision(pendingAction.id, "approved")}
                                className="flex-1 py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center justify-center gap-1 transition active:scale-95 cursor-pointer shadow-xs disabled:opacity-50"
                              >
                                <Check className="w-3 h-3" />
                                <span>{processingActionId === pendingAction.id ? "Memproses..." : "Izinkan"}</span>
                              </button>
                              <button
                                type="button"
                                disabled={processingActionId === pendingAction.id}
                                onClick={() => handleActionDecision(pendingAction.id, "rejected")}
                                className="flex-1 py-1.5 px-2.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold text-[11px] flex items-center justify-center gap-1 transition active:scale-95 cursor-pointer disabled:opacity-50"
                              >
                                <X className="w-3 h-3" />
                                <span>Tolak</span>
                              </button>
                            </div>
                          ) : actionStatus === "approved" ? (
                            <div className="pt-1 flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                              <Check className="w-3 h-3" />
                              <span>Aksi Telah Disetujui &amp; Dieksekusi ke Sistem</span>
                            </div>
                          ) : (
                            <div className="pt-1 flex items-center gap-1 text-[10px] font-bold text-red-600 dark:text-red-400">
                              <X className="w-3 h-3" />
                              <span>Aksi Ditolak oleh Pengguna</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Gemini-Style Contextual Suggestion Chips */}
                    {!isUser && m.suggestions && m.suggestions.length > 0 && (
                      <div className="w-full max-w-[88%] mt-2 flex flex-wrap gap-1.5">
                        {m.suggestions.map((chip, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSend(chip)}
                            className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-[#D2F27C]/30 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700 text-[10px] font-medium transition cursor-pointer hover:border-[#D2F27C] active:scale-95 flex items-center gap-1"
                          >
                            <Sparkles className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                            <span>{chip}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {loading && (
                <div className="flex items-center gap-2 text-slate-400 text-xs py-1">
                  <AIMascot size={18} className="animate-pulse" />
                  <span>
                    Miu AI ({AI_MODELS.find((m) => m.id === selectedModel)?.short || "AI"}) sedang berpikir ({thinkingMode === "native" ? "native reasoning" : thinkingMode === "direct" ? "direct mode" : `${thinkingMode} mode`})...
                  </span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Prompts Chips: Only show when latest message has no dynamic contextual suggestions */}
            {(!messages[messages.length - 1]?.suggestions || messages[messages.length - 1].suggestions!.length === 0) && (
              <div className="px-3.5 py-1.5 border-t border-black/[0.04] dark:border-white/[0.06] flex items-center gap-1.5 overflow-x-auto shrink-0 text-[10px]">
                {QUICK_PROMPTS.map((qp, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSend(qp.replace(/^[^\s]+\s/, ""))}
                    className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap shrink-0 transition cursor-pointer"
                  >
                    {qp}
                  </button>
                ))}
              </div>
            )}

            {/* Input Composer Footer */}
            <div className="p-3 bg-slate-50/90 dark:bg-slate-800/90 border-t border-black/[0.06] dark:border-white/[0.08] shrink-0">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex items-center gap-1.5"
              >
                <div className="relative flex-1 flex items-center">
                  <input
                    type="text"
                    value={inputMsg}
                    onChange={(e) => setInputMsg(e.target.value)}
                    placeholder="Minta AI buat project, tugas, buka halaman..."
                    className="w-full pl-3.5 pr-8 py-2.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-white transition"
                  />
                  <button
                    type="button"
                    onClick={handleVoiceInput}
                    className={`absolute right-2 p-1 rounded-full transition cursor-pointer ${
                      isRecording
                        ? "text-red-500 bg-red-100 animate-pulse"
                        : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    }`}
                    title="Input Suara"
                  >
                    <Mic className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading || !inputMsg.trim()}
                  className="w-9 h-9 rounded-full bg-[#1C1D21] hover:bg-black text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 flex items-center justify-center transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0 shadow-xs"
                  title="Kirim"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
