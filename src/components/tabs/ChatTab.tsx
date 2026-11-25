"use client";

import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  MessageSquare,
  Users,
  Plus,
  Send,
  Sparkles,
  Search,
  X,
  Shield,
  Clock,
  FolderKanban,
  CheckCircle2,
  Reply,
  Brain,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Info,
} from "lucide-react";
import { UserType, ProjectType, ChatGroupType, ChatMessageType } from "@/types";
import CustomSelect, { CustomSelectOption } from "@/components/ui/CustomSelect";
import GroupInfoModal from "@/components/chat/GroupInfoModal";
import MarkdownText from "@/components/ui/MarkdownText";
import { stripThinkTags } from "@/lib/markdown";
import AIMascot from "@/components/ui/AIMascot";

const SPRING = { type: "spring" as const, stiffness: 420, damping: 32 };

interface ChatTabProps {
  user: UserType;
  projects: ProjectType[];
  showToast: (m: string) => void;
}

export default function ChatTab({ user, projects, showToast }: ChatTabProps) {
  const [groups, setGroups] = useState<ChatGroupType[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [aiTyping, setAiTyping] = useState(false);
  const [searchGroupQuery, setSearchGroupQuery] = useState("");
  const [replyingToMessage, setReplyingToMessage] = useState<ChatMessageType | null>(null);
  const [expandedReasoningIds, setExpandedReasoningIds] = useState<Record<number, boolean>>({});

  // Modal State for New Group (Leader Only)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [newGroupProjectId, setNewGroupProjectId] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Modal State for WhatsApp-style Group Info
  const [showGroupInfoModal, setShowGroupInfoModal] = useState(false);
  const [mobilePane, setMobilePane] = useState<"list" | "chat">("chat");

  // Slash Tag Dropup State (/project or /pro)
  const [slashQuery, setSlashQuery] = useState("");
  const [isSlashOpen, setIsSlashOpen] = useState(false);
  const [slashDismissed, setSlashDismissed] = useState(false);
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);
  const dropupListRef = useRef<HTMLDivElement | null>(null);
  const composerContainerRef = useRef<HTMLDivElement | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Close dropup when user clicks or taps outside composer
  useEffect(() => {
    if (!isSlashOpen) return;
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (
        composerContainerRef.current &&
        !composerContainerRef.current.contains(e.target as Node)
      ) {
        setIsSlashOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
    };
  }, [isSlashOpen]);

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.style.scrollBehavior = "auto";
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  };

  useLayoutEffect(() => {
    scrollToBottom();
  }, [messages, activeGroupId, aiTyping]);

  useEffect(() => {
    scrollToBottom();
    const raf = requestAnimationFrame(() => {
      scrollToBottom();
      requestAnimationFrame(scrollToBottom);
    });
    return () => cancelAnimationFrame(raf);
  }, [messages.length, activeGroupId, aiTyping]);

  const loadGroups = async () => {
    try {
      const res = await fetch("/api/chat/groups");
      const data = await res.json();
      const loadedGroups = data.groups || [];
      setGroups(loadedGroups);
      if (loadedGroups.length > 0) {
        const storedGroupId = typeof window !== "undefined"
          ? sessionStorage.getItem("productivier_chat_group_id") || new URLSearchParams(window.location.search).get("group") || new URLSearchParams(window.location.search).get("group_id")
          : null;
        const storedProjId = typeof window !== "undefined" ? sessionStorage.getItem("productivier_chat_project_id") : null;
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("productivier_chat_group_id");
          sessionStorage.removeItem("productivier_chat_project_id");
        }
        let chosenGroupId = loadedGroups[0].id;
        if (storedGroupId) {
          const gIdNum = Number(storedGroupId);
          const matchingByGroup = loadedGroups.find((g: any) => g.id === gIdNum);
          if (matchingByGroup) {
            chosenGroupId = matchingByGroup.id;
            setMobilePane("chat");
          }
        } else if (storedProjId) {
          const pIdNum = Number(storedProjId);
          const matchingGroup = loadedGroups.find(
            (g: any) =>
              g.project_id === pIdNum ||
              g.connected_projects?.some((cp: any) => cp.id === pIdNum)
          );
          if (matchingGroup) {
            chosenGroupId = matchingGroup.id;
            setMobilePane("chat");
          }
        }
        if (storedGroupId || storedProjId || !activeGroupId || !loadedGroups.some((g: any) => g.id === activeGroupId)) {
          setActiveGroupId(chosenGroupId);
        }
      } else {
        setActiveGroupId(null);
        setMessages([]);
      }
    } catch (e) {
      console.error("Gagal memuat grup chat", e);
    }
  };

  const loadMessages = async (groupId: number) => {
    try {
      const res = await fetch(`/api/chat/messages?group_id=${groupId}`);
      const data = await res.json();
      setMessages(data.messages || []);
      scrollToBottom();
      requestAnimationFrame(scrollToBottom);
    } catch (e) {
      console.error("Gagal memuat pesan", e);
    }
  };

  // Background silent polling to fetch new messages & AI replies in real-time
  const loadMessagesSilently = async (groupId: number) => {
    try {
      const res = await fetch(`/api/chat/messages?group_id=${groupId}`);
      const data = await res.json();
      const freshMessages: ChatMessageType[] = data.messages || [];
      if (freshMessages.length > 0) {
        setMessages((prev) => {
          const prevLast = prev[prev.length - 1];
          const freshLast = freshMessages[freshMessages.length - 1];
          const changed =
            prev.length !== freshMessages.length ||
            (prevLast && freshLast && (prevLast.id !== freshLast.id || prevLast.message !== freshLast.message));

          if (changed) {
            const isNearBottom =
              chatContainerRef.current &&
              chatContainerRef.current.scrollHeight - chatContainerRef.current.scrollTop - chatContainerRef.current.clientHeight < 140;
            if (isNearBottom) {
              scrollToBottom();
            }
            if (freshLast?.is_ai) {
              setAiTyping(false);
            }
            return freshMessages;
          }
          return prev;
        });
      }
    } catch {
      // Silent error handling for background polling
    }
  };

  useEffect(() => {
    loadGroups();
    const handleRefresh = () => {
      loadGroups();
    };
    window.addEventListener("productivier:refresh_data", handleRefresh);
    return () => {
      window.removeEventListener("productivier:refresh_data", handleRefresh);
    };
  }, []);

  useEffect(() => {
    if (activeGroupId) {
      setReplyingToMessage(null);
      loadMessages(activeGroupId);

      // Start 4s background polling interval while active group is selected
      const interval = setInterval(() => {
        loadMessagesSilently(activeGroupId);
      }, 4000);
      return () => clearInterval(interval);
    }
  }, [activeGroupId]);

  const activeGroup = groups.find((g) => g.id === activeGroupId) || null;
  const aiTrigger = activeGroup?.ai_name?.trim() ? activeGroup.ai_name.trim().replace(/\s+/g, '') : 'Miu';
  const displayAiName = activeGroup?.ai_name?.trim() || 'Miu';

  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(searchGroupQuery.toLowerCase()) ||
    (g.project_nama && g.project_nama.toLowerCase().includes(searchGroupQuery.toLowerCase()))
  );

  // Auto-fill draft and deep-link group/project from other tabs or notifications
  useEffect(() => {
    if (typeof window !== "undefined") {
      const draft = sessionStorage.getItem("productivier_chat_draft");
      const targetGroupId = sessionStorage.getItem("productivier_chat_group_id");
      const targetProjId = sessionStorage.getItem("productivier_chat_project_id");
      if (draft) {
        setInputText(draft);
        sessionStorage.removeItem("productivier_chat_draft");
      }
      if (targetGroupId && groups.length > 0) {
        const gIdNum = Number(targetGroupId);
        const matchingByGroup = groups.find((g) => g.id === gIdNum);
        if (matchingByGroup) {
          setActiveGroupId(matchingByGroup.id);
          setMobilePane("chat");
        }
        sessionStorage.removeItem("productivier_chat_group_id");
      } else if (targetProjId && groups.length > 0) {
        const pIdNum = Number(targetProjId);
        const matchingGroup = groups.find(
          (g) =>
            g.project_id === pIdNum ||
            g.connected_projects?.some((cp) => cp.id === pIdNum)
        );
        if (matchingGroup) {
          setActiveGroupId(matchingGroup.id);
          setMobilePane("chat");
          sessionStorage.removeItem("productivier_chat_project_id");
        } else {
          sessionStorage.removeItem("productivier_chat_project_id");
          const targetProj = projects.find((p) => p.id === pIdNum);
          if (targetProj) {
            fetch("/api/chat/groups", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: `Project ${targetProj.nama_proyek}`,
                description: `Ruang koordinasi otomatis proyek ${targetProj.nama_proyek}`,
                project_id: pIdNum,
                member_ids: targetProj.member_ids || [user.id],
              }),
            })
              .then((r) => r.json())
              .then((d) => {
                if (d?.id) {
                  setActiveGroupId(d.id);
                  setMobilePane("chat");
                  loadGroups();
                }
              })
              .catch(() => {});
          }
        }
      }
    }
  }, [groups]);

  useEffect(() => {
    const handleOpenGroup = (e: Event) => {
      const customEvent = e as CustomEvent<{ groupId: number }>;
      const targetId = customEvent.detail?.groupId;
      if (targetId && groups.some((g) => g.id === Number(targetId))) {
        setActiveGroupId(Number(targetId));
      }
    };
    window.addEventListener("productivier:open_chat_group", handleOpenGroup);
    return () => {
      window.removeEventListener("productivier:open_chat_group", handleOpenGroup);
    };
  }, [groups]);

  // Priority order: Connected to active group first, then other projects
  const connectedProjectIds = useMemo(() => {
    const ids = new Set<number>();
    if (activeGroup?.project_id) ids.add(activeGroup.project_id);
    (activeGroup?.connected_projects || []).forEach((cp) => ids.add(cp.id));
    return ids;
  }, [activeGroup]);

  const allProjectsWithConnection = useMemo(() => {
    const list = projects.map((p) => ({
      ...p,
      isConnected: connectedProjectIds.has(p.id),
    }));

    return list.sort((a, b) => {
      if (a.isConnected && !b.isConnected) return -1;
      if (!a.isConnected && b.isConnected) return 1;
      return a.nama_proyek.localeCompare(b.nama_proyek);
    });
  }, [projects, connectedProjectIds]);

  const filteredSlashProjects = useMemo(() => {
    if (!isSlashOpen) return [];
    if (!slashQuery.trim()) return allProjectsWithConnection;
    const q = slashQuery.trim().toLowerCase();
    return allProjectsWithConnection.filter(
      (p) =>
        p.nama_proyek.toLowerCase().includes(q) ||
        p.divisi.toLowerCase().includes(q)
    );
  }, [isSlashOpen, slashQuery, allProjectsWithConnection]);

  useEffect(() => {
    if (isSlashOpen && dropupListRef.current) {
      const activeEl = dropupListRef.current.children[slashSelectedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [slashSelectedIndex, isSlashOpen]);

  const handleSelectProject = (project: ProjectType) => {
    const regex = /(?:^|\s)\/(?:pro|project)(?:(?:\s+)[^\n"]*)?$/i;
    const match = inputText.match(regex);
    let newText = "";
    if (match) {
      const matchIndex = match.index || 0;
      const leadingSpace = inputText.slice(matchIndex, matchIndex + (match[0].startsWith(" ") ? 1 : 0));
      const textBefore = inputText.slice(0, matchIndex) + leadingSpace;
      newText = `${textBefore}/project "${project.nama_proyek}" `;
    } else {
      newText = inputText.trim() ? `${inputText.trim()} /project "${project.nama_proyek}" ` : `/project "${project.nama_proyek}" `;
    }

    setInputText(newText);
    setIsSlashOpen(false);
    setSlashQuery("");

    if (inputRef.current) {
      inputRef.current.value = newText;
      inputRef.current.focus();
      inputRef.current.setSelectionRange(newText.length, newText.length);
    }
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newText.length, newText.length);
      }
    }, 10);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);
    setSlashDismissed(false);

    const match = val.match(/(?:^|\s)\/(?:pro|project)(?:(?:\s+)([^\n"]*))?$/i);
    if (match) {
      setIsSlashOpen(true);
      setSlashQuery(match[1] !== undefined ? match[1] : "");
      setSlashSelectedIndex(0);
    } else {
      setIsSlashOpen(false);
      setSlashQuery("");
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isSlashOpen && !slashDismissed) {
      if (e.key === "Escape") {
        e.preventDefault();
        setSlashDismissed(true);
        setIsSlashOpen(false);
        return;
      }
      if (filteredSlashProjects.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSlashSelectedIndex((prev) => (prev + 1) % filteredSlashProjects.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setSlashSelectedIndex((prev) => (prev - 1 + filteredSlashProjects.length) % filteredSlashProjects.length);
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          const selectedProj = filteredSlashProjects[slashSelectedIndex];
          if (selectedProj) {
            handleSelectProject(selectedProj);
          }
          return;
        }
      }
    }
  };

  const handleSendMessage = async (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const textToSend = customText !== undefined ? customText : inputText;
    if (!textToSend.trim() || !activeGroupId || sending) return;

    setIsSlashOpen(false);
    setSlashQuery("");
    setSlashDismissed(false);

    const trimmed = textToSend.trim();
    const cleanAiTrigger = aiTrigger.toLowerCase();
    const trimmedLower = trimmed.toLowerCase();
    const mentionsAi =
      /@ai(?:\b|\s|$)/i.test(trimmed) ||
      /^\/ai(?:\b|\s|$)/i.test(trimmed) ||
      /(?:^|\s)\/(?:project|pro)\b/i.test(trimmed) ||
      (cleanAiTrigger && (trimmedLower.includes(`@${cleanAiTrigger}`) || trimmedLower.includes(`@${displayAiName.toLowerCase()}`)));
    const tempId = -Date.now();
    const nowIso = new Date().toISOString();
    const currentReply = replyingToMessage;

    const optimisticMsg: ChatMessageType = {
      id: tempId,
      group_id: activeGroupId,
      user_id: user.id,
      sender_name: user.nama,
      message: trimmed,
      is_ai: false,
      reply_to_id: currentReply ? currentReply.id : null,
      reply_to_sender: currentReply ? currentReply.sender_name : null,
      reply_to_text: currentReply ? currentReply.message : null,
      created_at: nowIso,
    };

    setSending(true);
    if (mentionsAi) setAiTyping(true);
    setMessages((prev) => [...prev, optimisticMsg]);
    setInputText("");
    setReplyingToMessage(null);
    scrollToBottom();
    requestAnimationFrame(scrollToBottom);

    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          group_id: activeGroupId,
          user_id: user.id,
          sender_name: user.nama,
          message: trimmed,
          reply_to_id: currentReply ? currentReply.id : null,
        }),
      });

      if (res.ok) {
        await loadMessages(activeGroupId);
        await loadGroups();
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        showToast("Gagal mengirim pesan");
        setInputText(trimmed);
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      showToast("Terjadi kesalahan jaringan");
      setInputText(trimmed);
    } finally {
      setSending(false);
      setAiTyping(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    if (user.role !== "admin") {
      showToast("Hanya Leader yang dapat membuat grup chat");
      return;
    }

    setCreatingGroup(true);
    try {
      const res = await fetch("/api/chat/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newGroupName.trim(),
          description: newGroupDesc.trim(),
          project_id: newGroupProjectId ? Number(newGroupProjectId) : null,
          user_id: user.id,
          user_role: user.role,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast("Grup obrolan baru berhasil dibuat!");
        setNewGroupName("");
        setNewGroupDesc("");
        setNewGroupProjectId("");
        setShowCreateModal(false);
        await loadGroups();
        if (data.id) {
          setActiveGroupId(data.id);
        }
      } else {
        showToast(data.error || "Gagal membuat grup chat");
      }
    } catch {
      showToast("Terjadi kesalahan jaringan");
    } finally {
      setCreatingGroup(false);
    }
  };

  const projectModalOptions: CustomSelectOption[] = [
    { value: "", label: "Tanpa Proyek Khusus (Umum)" },
    ...projects.map((p) => ({
      value: String(p.id),
      label: p.nama_proyek,
      subLabel: p.divisi,
    })),
  ];

  return (
    <div className="space-y-4">
      {/* Tab Header Banner (Hidden on mobile chat detail pane so composer stays unobstructed above dock) */}
      <div className={`${mobilePane === "chat" ? "hidden lg:flex" : "flex"} flex-col sm:flex-row sm:items-center justify-between gap-4`}>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Chat Tim &amp; Kolaborasi
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-[#D2F27C]/40 text-slate-900 dark:text-[#D2F27C] font-bold text-[11px] uppercase tracking-wider border border-[#D2F27C]/60 whitespace-nowrap shrink-0">
              Live Team Channel
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            Ruang komunikasi terpusat per divisi &amp; proyek dengan integrasi Asisten AI
          </p>
        </div>

        {/* Action: Create Group (Leader Only) */}
        <div>
          {user.role === "admin" ? (
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-[#1C1D21] hover:bg-black text-white px-5 py-2.5 rounded-full font-semibold text-xs sm:text-sm flex items-center gap-2 shadow-md transition active:scale-95 cursor-pointer dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Grup Chat</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-semibold border border-slate-200 dark:border-slate-700">
              <Shield className="w-3.5 h-3.5 text-slate-400" />
              <span>Grup dikelola Leader</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Workspace Grid (Master-Detail Responsive) */}
      <div
        className={`grid grid-cols-1 lg:grid-cols-12 gap-5 ${
          mobilePane === "chat"
            ? "h-[calc(100dvh-195px)] min-h-[340px]"
            : "h-[calc(100dvh-310px)] min-h-[340px]"
        } lg:h-[calc(100vh-220px)] lg:min-h-[560px]`}
      >
        {/* Left Column: Group Channels Directory (4 Cols) */}
        <div className={`${mobilePane === "list" ? "flex" : "hidden lg:flex"} lg:col-span-4 dashboard-card p-4 flex-col justify-between overflow-hidden min-h-0`}>
          <div>
            {/* Search Box */}
            <div className="relative mb-3">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari grup obrolan..."
                value={searchGroupQuery}
                onChange={(e) => setSearchGroupQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>

            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-2">
              Saluran Grup ({filteredGroups.length})
            </div>

            {/* Groups List */}
            <div className="space-y-1.5 overflow-y-auto max-h-[calc(100vh-340px)] pr-1">
              {filteredGroups.map((g) => {
                const isActive = g.id === activeGroupId;
                return (
                  <button
                    key={g.id}
                    onClick={() => {
                      setActiveGroupId(g.id);
                      setShowGroupInfoModal(false);
                      setMobilePane("chat");
                    }}
                    className={`w-full text-left p-3 rounded-2xl transition flex items-start gap-3 cursor-pointer ${
                      isActive
                        ? "bg-[#18181B] text-white shadow-sm dark:bg-white dark:text-slate-900"
                        : "hover:bg-slate-100/90 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 text-sm font-bold ${
                        isActive
                          ? "bg-white/20 text-white dark:bg-slate-900/10 dark:text-slate-900"
                          : "bg-[#D2F27C]/30 text-slate-900"
                      }`}
                    >
                      <Users className="w-5 h-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-extrabold text-xs truncate block">
                          {g.name}
                        </span>
                        {g.last_message_time && (
                          <span
                            className={`text-[9px] tabular-nums shrink-0 ${
                              isActive ? "text-white/70 dark:text-slate-500" : "text-slate-400"
                            }`}
                          >
                            {g.last_message_time.slice(11, 16)}
                          </span>
                        )}
                      </div>

                      <p
                        className={`text-[11px] truncate mt-0.5 ${
                          isActive ? "text-white/80 dark:text-slate-600" : "text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {g.last_message || g.description || "Belum ada pesan"}
                      </p>

                      {g.project_nama && (
                        <span
                          className={`inline-block text-[9px] font-semibold px-2 py-0.5 rounded-full mt-1.5 ${
                            isActive
                              ? "bg-white/15 text-white dark:bg-slate-900/10 dark:text-slate-800"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          {g.project_nama}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}

              {filteredGroups.length === 0 && (
                <div className="py-8 text-center text-xs text-slate-400">
                  Tidak ada grup chat yang sesuai.
                </div>
              )}
            </div>
          </div>

          {/* Quick Info Leader Footer */}
          <div className="pt-3 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[11px] text-slate-400">
            <span>Login: {user.nama}</span>
            <span className="font-semibold capitalize text-slate-600 dark:text-slate-300">
              {user.role}
            </span>
          </div>
        </div>

        {/* Right Column: Chat Room & Message Feed (8 Cols) */}
        <div className={`${mobilePane === "chat" ? "flex" : "hidden lg:flex"} lg:col-span-8 dashboard-card p-4 sm:p-5 flex-col justify-between overflow-hidden min-h-0 relative`}>
          {activeGroup ? (
            <AnimatePresence mode="wait">
              {showGroupInfoModal ? (
                <GroupInfoModal
                  key={`group-info-${activeGroup.id}`}
                  isOpen={showGroupInfoModal}
                  onClose={() => setShowGroupInfoModal(false)}
                  group={activeGroup}
                  currentUser={user}
                  projects={projects}
                  showToast={showToast}
                  onGroupUpdated={loadGroups}
                  onGroupDeleted={(deletedId) => {
                    setShowGroupInfoModal(false);
                    setGroups((prev) => {
                      const remaining = prev.filter((g) => g.id !== deletedId);
                      if (activeGroupId === deletedId) {
                        setActiveGroupId(remaining.length > 0 ? remaining[0].id : null);
                      }
                      return remaining;
                    });
                  }}
                  onGroupLeft={(leftId) => {
                    setShowGroupInfoModal(false);
                    loadGroups();
                    if (activeGroupId === leftId) {
                      const remaining = groups.filter((g) => g.id !== leftId);
                      setActiveGroupId(remaining.length > 0 ? remaining[0].id : null);
                    }
                  }}
                />
              ) : (
                <motion.div
                  key={`chat-room-${activeGroup.id}`}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="flex flex-col justify-between h-full overflow-hidden"
                >
              {/* Chat Room Top Bar (Clickable WhatsApp Style + Mobile Back + Explicit Info Icon) */}
              <div className="flex items-center justify-between gap-2 pb-3.5 border-b border-black/[0.06] dark:border-white/[0.08] mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={() => setMobilePane("list")}
                    className="lg:hidden min-h-[38px] px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                    title="Kembali ke Daftar Saluran"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Saluran</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowGroupInfoModal(true)}
                    className="flex items-center gap-3 min-w-0 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 p-1.5 -ml-1.5 rounded-2xl transition cursor-pointer group"
                    title="Klik untuk melihat Detail Grup &amp; Anggota"
                  >
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#D2F27C] to-[#DCD4FB] text-slate-900 flex items-center justify-center font-black text-sm shrink-0 group-hover:scale-105 transition">
                    {activeGroup.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white truncate group-hover:text-purple-700 dark:group-hover:text-[#D2F27C] transition">
                        {activeGroup.name}
                      </h3>
                      {activeGroup.members_count !== undefined && (
                        <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold shrink-0">
                          {activeGroup.members_count} Anggota
                        </span>
                      )}
                    </div>
                    {activeGroup.connected_projects && activeGroup.connected_projects.length > 0 ? (
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        {activeGroup.connected_projects.slice(0, 3).map((cp) => (
                          <span
                            key={cp.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[9px] font-bold border border-blue-200/50"
                          >
                            <FolderKanban className="w-2.5 h-2.5" />
                            <span>{cp.nama_proyek}</span>
                            <span className="tabular-nums">({cp.persentase}%)</span>
                          </span>
                        ))}
                        {activeGroup.connected_projects.length > 3 && (
                          <span className="text-[9px] text-slate-400 font-semibold">
                            +{activeGroup.connected_projects.length - 3} lainnya
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {activeGroup.description || "Saluran obrolan koordinasi tim"}
                      </p>
                    )}
                  </div>
                  </button>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-50 dark:bg-purple-950/60 border border-purple-200/60 dark:border-purple-800/60 text-[11px] font-bold text-purple-700 dark:text-purple-300">
                    <AIMascot size={16} />
                    <span>{displayAiName} (@{aiTrigger})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSendMessage(undefined, `@${aiTrigger} Bantu rangkum poin pembahasan penting di grup ini`)}
                    className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#D2F27C]/30 hover:bg-[#D2F27C]/50 text-slate-900 dark:text-white font-bold text-xs border border-[#D2F27C]/60 transition cursor-pointer"
                    title={`Panggil ${displayAiName} untuk Rangkuman`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Rangkum Diskusi</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowGroupInfoModal(true)}
                    className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 grid place-items-center transition cursor-pointer shrink-0"
                    title="Info &amp; Pengaturan Grup"
                    aria-label="Info Grup"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Messages Feed */}
              <div ref={chatContainerRef} style={{ scrollBehavior: "auto" }} className="flex-1 overflow-y-auto space-y-3.5 pr-2 py-2">
                {messages.map((m) => {
                  const isMe = m.user_id === user.id && !m.is_ai;
                  const isAi = m.is_ai;

                  return (
                    <motion.div
                      key={m.id}
                      id={`msg-${m.id}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.15 }}
                      className={`flex flex-col group/msg transition-all duration-300 rounded-2xl ${isMe ? "items-end" : "items-start"}`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 text-[10px] text-slate-400">
                        {isAi ? (
                          <span className="flex items-center gap-1.5 font-extrabold text-purple-700 dark:text-purple-300">
                            <AIMascot size={18} />
                            <span>{m.sender_name || displayAiName}</span>
                            <span className="px-1.5 py-0.2 rounded-full bg-purple-100 dark:bg-purple-950/70 text-[9px] font-bold text-purple-800 dark:text-purple-300 border border-purple-200/60">
                              AI
                            </span>
                          </span>
                        ) : (
                          <span className="font-bold text-slate-700 dark:text-slate-300">
                            {m.sender_name}
                          </span>
                        )}
                        <span>·</span>
                        <span className="tabular-nums">{m.created_at?.slice(11, 16) || "Baru saja"}</span>

                        {/* Quick Reply Action Button on Hover/Tap */}
                        <button
                          type="button"
                          onClick={() => {
                            setReplyingToMessage(m);
                            setTimeout(() => inputRef.current?.focus(), 50);
                          }}
                          className="opacity-70 sm:opacity-0 sm:group-hover/msg:opacity-100 transition-opacity ml-1.5 px-1.5 py-0.5 rounded-md hover:bg-slate-200/80 dark:hover:bg-slate-700 text-[10px] font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 cursor-pointer"
                          title="Balas pesan ini"
                        >
                          <Reply className="w-3 h-3 rotate-180" />
                          <span>Balas</span>
                        </button>
                      </div>

                      <div
                        className={`min-w-0 max-w-[85%] sm:max-w-[75%] px-4 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed relative ${
                          isAi
                            ? "bg-gradient-to-r from-[#DCD4FB]/40 via-purple-50/50 to-white/90 dark:from-purple-950/60 dark:via-slate-900/90 dark:to-slate-800/90 border border-[#DCD4FB]/80 dark:border-purple-800/50 text-slate-900 dark:text-slate-100 shadow-xs"
                            : isMe
                            ? "bg-[#18181B] text-white dark:bg-white dark:text-slate-900 shadow-sm rounded-tr-xs"
                            : "bg-slate-100/90 dark:bg-slate-800 text-slate-900 dark:text-white rounded-tl-xs"
                        }`}
                      >
                        {/* WhatsApp/Telegram-style Quote Card */}
                        {m.reply_to_id && (m.reply_to_sender || m.reply_to_text) && (
                          <div
                            onClick={() => {
                              const targetEl = document.getElementById(`msg-${m.reply_to_id}`);
                              if (targetEl) {
                                targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
                                targetEl.classList.add("ring-2", "ring-purple-400");
                                setTimeout(() => targetEl.classList.remove("ring-2", "ring-purple-400"), 1500);
                              }
                            }}
                            className={`mb-2 p-2 px-2.5 rounded-xl border-l-[3px] text-xs transition cursor-pointer select-none ${
                              isMe
                                ? "bg-white/10 border-white/70 text-white/95 hover:bg-white/15 dark:bg-black/5 dark:border-slate-800 dark:text-slate-800 dark:hover:bg-black/10"
                                : isAi
                                ? "bg-purple-100/70 dark:bg-purple-900/40 border-purple-600 dark:border-purple-400 text-slate-800 dark:text-purple-200 hover:bg-purple-200/50"
                                : "bg-black/5 dark:bg-white/5 border-slate-400 dark:border-slate-500 text-slate-700 dark:text-slate-300 hover:bg-black/10"
                            }`}
                            title="Klik untuk melihat pesan yang dibalas"
                          >
                            <div className="flex items-center gap-1 font-bold text-[11px] mb-0.5">
                              <Reply className="w-3 h-3 text-purple-600 dark:text-purple-400 rotate-180 shrink-0" />
                              <span className="truncate">{m.reply_to_sender || "Pesan"}</span>
                            </div>
                            <p className="text-[11px] line-clamp-2 italic opacity-90">
                              {m.reply_to_text || "Pesan"}
                            </p>
                          </div>
                        )}

                        {/* Collapsible Native Thinking Box for AI Message */}
                        {isAi && Boolean(m.reasoning_text && m.reasoning_text.trim()) && (
                          <div className="mb-2">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedReasoningIds((prev) => ({
                                  ...prev,
                                  [m.id]: !prev[m.id],
                                }))
                              }
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-100/80 hover:bg-purple-200/80 dark:bg-purple-950/60 dark:hover:bg-purple-900/60 text-purple-900 dark:text-purple-200 text-[11px] font-bold border border-purple-200/70 dark:border-purple-800/60 transition cursor-pointer select-none"
                            >
                              <Brain className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                              <span>Reasoning</span>
                              {expandedReasoningIds[m.id] ? (
                                <ChevronUp className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                              ) : (
                                <ChevronDown className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                              )}
                            </button>

                            {expandedReasoningIds[m.id] && (
                              <div className="mt-1.5 p-2.5 rounded-xl bg-purple-50/90 dark:bg-purple-950/40 border border-purple-200/60 dark:border-purple-800/50 text-[11px] font-mono whitespace-pre-wrap text-slate-800 dark:text-slate-200 leading-relaxed max-h-60 overflow-y-auto">
                                {stripThinkTags(m.reasoning_text || "")}
                              </div>
                            )}
                          </div>
                        )}

                        <MarkdownText content={m.message} inverted={isMe} />
                      </div>
                    </motion.div>
                  );
                })}
                {aiTyping && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-start space-y-1"
                  >
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-100/80 dark:bg-purple-950/70 border border-purple-200/80 dark:border-purple-800 text-purple-900 dark:text-purple-200 text-xs font-bold shadow-2xs">
                      <AIMascot size={18} className="animate-pulse shrink-0" />
                      <span>Reasoning...</span>
                      <span className="flex gap-1 items-center ml-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce" />
                      </span>
                    </div>
                  </motion.div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Composer Footer */}
              <div className="pt-3 border-t border-black/[0.06] dark:border-white/[0.08] mt-2">
                {/* Pinned Reply Banner */}
                <AnimatePresence>
                  {replyingToMessage && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 6 }}
                      className="mb-2 p-2.5 px-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/90 border-l-4 border-purple-500 dark:border-purple-400 flex items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Reply className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 rotate-180 shrink-0" />
                        <div className="text-xs min-w-0">
                          <span className="font-bold text-slate-900 dark:text-white mr-1.5">
                            Membalas {replyingToMessage.sender_name}:
                          </span>
                          <span className="text-slate-500 dark:text-slate-400 truncate inline-block max-w-[200px] sm:max-w-md align-bottom italic">
                            &ldquo;{replyingToMessage.message}&rdquo;
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setReplyingToMessage(null)}
                        className="w-5 h-5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 grid place-items-center transition cursor-pointer shrink-0"
                        title="Batal membalas"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* AI & Slash Shortcut Chips */}
                <div className="flex items-center gap-1.5 mb-2 overflow-x-auto pb-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setInputText((prev) => `${prev} @${aiTrigger} `)}
                    className="px-2.5 py-1 rounded-full bg-purple-100/70 dark:bg-purple-950/50 hover:bg-purple-200 text-purple-900 dark:text-purple-300 font-bold shrink-0 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <AIMascot size={15} />
                    <span>@{aiTrigger}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInputText((prev) => prev.trim() ? `${prev.trim()} /project ` : `/project `);
                      setIsSlashOpen(true);
                      setSlashQuery("");
                      setSlashDismissed(false);
                      setTimeout(() => inputRef.current?.focus(), 50);
                    }}
                    className="px-2.5 py-1 rounded-full bg-blue-100/80 dark:bg-blue-950/60 hover:bg-blue-200 text-blue-900 dark:text-blue-300 font-bold shrink-0 transition flex items-center gap-1.5 cursor-pointer border border-blue-200/60"
                    title="Tag Proyek (/project)"
                  >
                    <FolderKanban className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>/project</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendMessage(undefined, `@${aiTrigger} Berikan 3 rekomendasi prioritas tugas untuk tim hari ini`)}
                    className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 font-semibold shrink-0 transition cursor-pointer"
                  >
                    💡 Rekomendasi Kerja
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendMessage(undefined, `@${aiTrigger} Cek kepatuhan dan progres seluruh anggota tim`)}
                    className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 font-semibold shrink-0 transition cursor-pointer"
                  >
                    📊 Cek Status Tim
                  </button>
                </div>

                {/* Relative Wrapper for Dropup Autocomplete Menu & Input Form */}
                <div ref={composerContainerRef} className="relative">
                  {/* Interactive Dropup Autocomplete Menu for /project and /pro */}
                  <AnimatePresence>
                    {isSlashOpen && !slashDismissed && (
                      <motion.div
                        initial={{ opacity: 0, y: 12, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.98 }}
                        transition={{ duration: 0.15 }}
                        className="absolute bottom-full mb-3 left-0 right-0 sm:left-1 sm:right-auto sm:w-[480px] dashboard-card p-3 rounded-2xl shadow-2xl z-40 border border-slate-300 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md"
                      >
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200/80 dark:border-slate-800">
                          <div className="flex items-center gap-2">
                            <FolderKanban className="w-4 h-4 text-purple-600 dark:text-[#D2F27C]" />
                            <span className="font-extrabold text-xs text-slate-900 dark:text-white">
                              Tag Proyek ke Chat &amp; AI
                            </span>
                            <span className="px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-400">
                              {filteredSlashProjects.length}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                            <span className="hidden sm:inline">Navigasi [↑][↓]</span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-mono font-bold text-slate-600 dark:text-slate-300">Enter / Tab</span>
                          </div>
                        </div>

                        <div ref={dropupListRef} className="space-y-1 max-h-56 overflow-y-auto pr-1">
                          {filteredSlashProjects.map((p, idx) => {
                            const isSelected = idx === slashSelectedIndex;
                            return (
                              <div
                                key={p.id}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => handleSelectProject(p)}
                                onMouseEnter={() => setSlashSelectedIndex(idx)}
                                className={`p-2.5 rounded-xl transition flex items-center justify-between gap-2.5 cursor-pointer select-none ${
                                  isSelected
                                    ? "bg-purple-50 dark:bg-purple-950/60 border border-purple-300 dark:border-purple-700/60"
                                    : "hover:bg-slate-100/80 dark:hover:bg-slate-800/60 border border-transparent"
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div
                                    className={`w-7 h-7 rounded-lg grid place-items-center shrink-0 ${
                                      isSelected
                                        ? "bg-purple-600 text-white"
                                        : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                                    }`}
                                  >
                                    <FolderKanban className="w-3.5 h-3.5" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <strong className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                        {p.nama_proyek}
                                      </strong>
                                      {p.isConnected && (
                                        <span className="px-1.5 py-0.2 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[9px] font-black">
                                          ⭐ Terhubung
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[10px] text-slate-400 block truncate">
                                      {p.divisi} · Target: {p.total_realisasi}/{p.target_total} {p.satuan}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="px-2 py-0.5 rounded-full bg-[#D2F27C]/50 text-slate-900 text-[10px] font-extrabold tabular-nums">
                                    {p.persentase}%
                                  </span>
                                  {isSelected && (
                                    <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400">
                                      ↵
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}

                          {filteredSlashProjects.length === 0 && (
                            <div className="py-6 text-center text-xs text-slate-400">
                              Tidak ada proyek yang cocok dengan &quot;{slashQuery}&quot;
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <form onSubmit={(e) => handleSendMessage(e)} className="flex items-center gap-2">
                    <div className="relative flex-1 flex items-center">
                      <input
                        ref={inputRef}
                        type="text"
                        value={inputText}
                        onChange={handleInputChange}
                        onKeyDown={handleInputKeyDown}
                        placeholder={`Tulis pesan... ketik /project atau /pro untuk tag proyek, @${aiTrigger} untuk bantuan`}
                        className="w-full pl-4 pr-16 py-3 rounded-full bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition shadow-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setInputText((prev) => prev.includes(`@${aiTrigger}`) || prev.includes("@ai") ? prev : `@${aiTrigger} ${prev}`)}
                        className="absolute right-2 px-2.5 py-1 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 text-[11px] font-bold hover:bg-purple-200 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                        title={`Panggil ${displayAiName}`}
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>@{aiTrigger}</span>
                      </button>
                    </div>
                    <button
                      type="submit"
                      disabled={sending || !inputText.trim()}
                      className="w-11 h-11 rounded-full bg-[#1C1D21] hover:bg-black text-white flex items-center justify-center transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0 shadow-md dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                      title="Kirim Pesan"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </div>
                </motion.div>
              )}
            </AnimatePresence>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <MessageSquare className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
              <h4 className="font-bold text-base text-slate-800 dark:text-slate-200">
                Pilih Grup Obrolan
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                Pilih saluran tim di kolom kiri atau buat grup baru untuk memulai koordinasi kerja.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Create New Group (Leader Only) */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md dashboard-card p-6 sm:p-8 shadow-2xl dark:text-slate-100"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-slate-700 mb-5">
                <div>
                  <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                    Buat Grup Chat Tim
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Hanya Leader yang dapat mengatur saluran obrolan kerja
                  </p>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateGroup} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Nama Grup
                  </label>
                  <input
                    type="text"
                    required
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Contoh: Koordinasi Harian Sprint UI"
                    className="w-full px-4 py-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Deskripsi / Tujuan Grup
                  </label>
                  <textarea
                    rows={2}
                    value={newGroupDesc}
                    onChange={(e) => setNewGroupDesc(e.target.value)}
                    placeholder="Jelaskan topik koordinasi atau agenda kerja..."
                    className="w-full px-4 py-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Kaitkan ke Proyek (Opsional)
                  </label>
                  <CustomSelect
                    value={newGroupProjectId}
                    onChange={setNewGroupProjectId}
                    options={projectModalOptions}
                    variant="form"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={creatingGroup}
                    className="w-full min-h-[46px] rounded-full bg-[#1C1D21] hover:bg-black text-white font-semibold text-sm shadow-md active:scale-[0.98] transition flex items-center justify-center gap-2 cursor-pointer dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                  >
                    <span>{creatingGroup ? "Membuat Grup..." : "Konfirmasi Buat Grup"}</span>
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
