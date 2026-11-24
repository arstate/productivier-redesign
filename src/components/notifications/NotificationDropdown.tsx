"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Bell,
  Check,
  X,
  Shield,
  MessageSquare,
  CheckSquare,
  User,
  ExternalLink,
  Trash2,
  Sparkles,
  Clock,
  ChevronRight,
} from "lucide-react";
import { NotificationType, UserType } from "@/types";

interface NotificationDropdownProps {
  user: UserType;
  showToast: (m: string) => void;
  onRefreshData?: () => Promise<void>;
  onNavigateTab?: (tab: string, extra?: any) => void;
}

export default function NotificationDropdown({
  user,
  showToast,
  onRefreshData,
  onNavigateTab,
}: NotificationDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeFilter, setActiveFilter] = useState<"all" | "ai_permission" | "chat" | "task" | "client">("all");
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`/api/notifications?user_id=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unread_count || 0);
      }
    } catch {
      // Ignore background fetch error
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 12000);
    return () => clearInterval(interval);
  }, [user.id]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mark_all_read: true, user_id: user.id }),
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        setUnreadCount(0);
        showToast("Semua notifikasi ditandai telah dibaca");
      }
    } catch {
      showToast("Gagal memperbarui status notifikasi");
    }
  };

  const handleMarkRead = async (id: number) => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Ignore
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/notifications?id=${id}`, { method: "DELETE" });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      showToast("Notifikasi dihapus");
    } catch {
      showToast("Gagal menghapus notifikasi");
    }
  };

  // Instant AI Action Decision from Notification Item
  const handleAIActionDecision = async (
    notif: NotificationType,
    decision: "approved" | "rejected",
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    let actionReqId: number | null = null;
    try {
      const payload = typeof notif.payload_json === "string" ? JSON.parse(notif.payload_json) : notif.payload_json;
      actionReqId = payload?.action_request_id || null;
    } catch {
      actionReqId = null;
    }

    if (!actionReqId) {
      showToast("ID perizinan aksi tidak ditemukan");
      return;
    }

    setProcessingId(notif.id);
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
        await handleMarkRead(notif.id);
        if (decision === "approved") {
          showToast(`✅ Disetujui: ${data.message}`);
          if (onRefreshData) await onRefreshData();
        } else {
          showToast("❌ Aksi AI telah ditolak.");
        }
        await fetchNotifications();
      } else {
        showToast(`Gagal: ${data.error || "Kesalahan server"}`);
      }
    } catch {
      showToast("Gagal memproses perizinan");
    } finally {
      setProcessingId(null);
    }
  };

  const handleNotificationClick = (notif: NotificationType) => {
    handleMarkRead(notif.id);

    if (notif.type === "chat") {
      let groupId: number | null = null;
      try {
        const payload = typeof notif.payload_json === "string" ? JSON.parse(notif.payload_json) : notif.payload_json;
        groupId = payload?.group_id;
      } catch {
        groupId = null;
      }
      if (onNavigateTab) {
        onNavigateTab("chat", { groupId });
      }
      setIsOpen(false);
    } else if (notif.type === "task" || notif.type === "client") {
      if (onNavigateTab) {
        onNavigateTab("projects");
      }
      setIsOpen(false);
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (activeFilter === "all") return true;
    return n.type === activeFilter;
  });

  const getTypeIcon = (type: NotificationType["type"]) => {
    switch (type) {
      case "ai_permission":
        return <Shield className="w-4 h-4 text-amber-500" />;
      case "chat":
        return <MessageSquare className="w-4 h-4 text-purple-500" />;
      case "task":
        return <CheckSquare className="w-4 h-4 text-emerald-500" />;
      case "client":
        return <User className="w-4 h-4 text-blue-500" />;
      default:
        return <Sparkles className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Top Navbar Bell Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        className={`relative p-2 rounded-full transition cursor-pointer ${
          isOpen
            ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
            : "text-slate-600 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-slate-800"
        }`}
        title="Pusat Notifikasi & Izin AI"
      >
        <Bell className="w-4 h-4" />

        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] px-1">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-4 min-w-[16px] px-1 bg-amber-500 text-slate-950 font-black text-[9px] items-center justify-center shadow-xs">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          </span>
        )}
      </button>

      {/* Popover Dropdown Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-[360px] sm:w-[400px] max-w-[calc(100vw-32px)] rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xl overflow-hidden z-50 text-slate-900 dark:text-slate-100"
          >
            {/* Header */}
            <div className="p-4 bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    Pusat Notifikasi
                  </h3>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-extrabold text-[10px]">
                      {unreadCount} Baru
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Izin aksi AI, pesan grup chat, dan progres tim
                </p>
              </div>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-[11px] font-bold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition cursor-pointer"
                >
                  Tandai Dibaca
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 p-2 bg-slate-100/60 dark:bg-slate-800/40 border-b border-slate-200/60 dark:border-slate-700/60 overflow-x-auto text-[11px]">
              {(
                [
                  { id: "all", label: "Semua" },
                  { id: "ai_permission", label: "Izin AI" },
                  { id: "chat", label: "Chat" },
                  { id: "task", label: "Tugas" },
                  { id: "client", label: "Klien" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveFilter(tab.id)}
                  className={`px-3 py-1 rounded-full font-bold whitespace-nowrap transition cursor-pointer ${
                    activeFilter === tab.id
                      ? "bg-[#1C1D21] text-white dark:bg-white dark:text-slate-900 shadow-2xs"
                      : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Notifications Feed */}
            <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredNotifications.length > 0 ? (
                filteredNotifications.map((notif) => {
                  const isAiPermission = notif.type === "ai_permission";

                  return (
                    <div
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`p-3.5 transition cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 flex items-start gap-3 relative ${
                        !notif.is_read
                          ? "bg-amber-50/30 dark:bg-amber-950/20"
                          : ""
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                        {getTypeIcon(notif.type)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <h4
                            className={`text-xs truncate ${
                              !notif.is_read
                                ? "font-extrabold text-slate-900 dark:text-white"
                                : "font-semibold text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            {notif.title}
                          </h4>
                          <span className="text-[10px] text-slate-400 tabular-nums shrink-0">
                            {notif.created_at?.slice(11, 16) || "Tadi"}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2">
                          {notif.message}
                        </p>

                        {/* Interactive Action Card if AI Permission */}
                        {isAiPermission && !notif.is_read && (
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              type="button"
                              disabled={processingId === notif.id}
                              onClick={(e) => handleAIActionDecision(notif, "approved", e)}
                              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-2xs disabled:opacity-50"
                            >
                              <Check className="w-3 h-3" />
                              <span>{processingId === notif.id ? "Memproses..." : "Izinkan"}</span>
                            </button>
                            <button
                              type="button"
                              disabled={processingId === notif.id}
                              onClick={(e) => handleAIActionDecision(notif, "rejected", e)}
                              className="px-3 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-[10px] flex items-center gap-1 transition active:scale-95 cursor-pointer disabled:opacity-50"
                            >
                              <X className="w-3 h-3" />
                              <span>Tolak</span>
                            </button>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleDelete(notif.id, e)}
                        className="text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-300 p-1 transition cursor-pointer"
                        title="Hapus"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="py-10 text-center text-xs text-slate-400">
                  <Bell className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2 opacity-50" />
                  <span>Tidak ada notifikasi di kategori ini.</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200/60 dark:border-slate-700/60 text-center">
              <span className="text-[10px] text-slate-400 font-medium">
                Productivier Realtime Notification Engine
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
