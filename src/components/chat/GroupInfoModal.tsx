"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  Users,
  Shield,
  Crown,
  UserPlus,
  UserMinus,
  Trash2,
  LogOut,
  FolderKanban,
  Edit2,
  Check,
  Calendar,
  ExternalLink,
  FileText,
  AlertTriangle,
  Sparkles,
  Plus,
  Loader2,
} from "lucide-react";
import { UserType, ProjectType, ChatGroupType, ChatGroupMemberType } from "@/types";
import AIMascot from "@/components/ui/AIMascot";
import CustomSelect from "@/components/ui/CustomSelect";

interface GroupInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: ChatGroupType;
  currentUser: UserType;
  projects: ProjectType[];
  showToast: (m: string) => void;
  onGroupUpdated: () => void;
  onGroupDeleted: (deletedGroupId: number) => void;
  onGroupLeft: (groupId: number) => void;
}

export default function GroupInfoModal({
  isOpen,
  onClose,
  group,
  currentUser,
  projects,
  showToast,
  onGroupUpdated,
  onGroupDeleted,
  onGroupLeft,
}: GroupInfoModalProps) {
  const [activeTab, setActiveTab] = useState<"members" | "media">("members");
  const [members, setMembers] = useState<ChatGroupMemberType[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [allUsers, setAllUsers] = useState<UserType[]>([]);

  // Editing Group Name & Description
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(group.name);
  const [editDesc, setEditDesc] = useState(group.description || "");
  const [savingEdit, setSavingEdit] = useState(false);

  // Add Member State
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedUserIdToAdd, setSelectedUserIdToAdd] = useState<string>("");
  const [addingMember, setAddingMember] = useState(false);

  // Multi-Project Connector State
  const [connectedProjects, setConnectedProjects] = useState<Array<{
    id: number;
    nama_proyek: string;
    divisi?: string;
    persentase?: number;
    target_total?: number;
    total_realisasi?: number;
    satuan?: string;
    status?: string;
    deadline?: string | null;
    kendala_count?: number;
  }>>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [selectedProjectIdToConnect, setSelectedProjectIdToConnect] = useState<string>("");
  const [connectingProject, setConnectingProject] = useState(false);
  const [disconnectingProjectId, setDisconnectingProjectId] = useState<number | null>(null);

  // AI Settings State (Strict Creator-only edit access)
  const [selectedAiName, setSelectedAiName] = useState(group.ai_name || "Miu");
  const [selectedAiModel, setSelectedAiModel] = useState(group.ai_model || "nvidia/nemotron-3.5-super-vl:free");
  const [selectedThinkingMode, setSelectedThinkingMode] = useState(group.ai_thinking_mode || "medium");
  const [savingAiSettings, setSavingAiSettings] = useState(false);

  // Confirm Dialog State (Kick, Leave, Delete)
  const [confirmDialog, setConfirmDialog] = useState<{
    type: "kick" | "leave" | "delete";
    targetUserId?: number;
    targetUserName?: string;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Determine current user's role in this group
  const myMemberRecord = members.find((m) => m.user_id === currentUser.id);
  const isGroupAdmin =
    myMemberRecord?.role === "admin" ||
    group.created_by === currentUser.id ||
    currentUser.role === "admin";
  const isGroupCreator = group.created_by === currentUser.id;

  const loadMembers = async () => {
    setLoadingMembers(true);
    try {
      const res = await fetch(`/api/chat/groups/${group.id}/members`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
      }
    } catch {
      showToast("Gagal memuat anggota grup");
    } finally {
      setLoadingMembers(false);
    }
  };

  const loadAllUsers = async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setAllUsers(data.users || []);
      }
    } catch {
      // Ignore background error
    }
  };

  const loadConnectedProjects = async () => {
    setLoadingProjects(true);
    try {
      const res = await fetch(`/api/chat/groups/${group.id}/projects`);
      if (res.ok) {
        const data = await res.json();
        setConnectedProjects(data.projects || []);
      }
    } catch {
      console.error("Gagal memuat proyek terhubung");
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleConnectProject = async () => {
    if (!selectedProjectIdToConnect) return;
    setConnectingProject(true);
    try {
      const res = await fetch(`/api/chat/groups/${group.id}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: Number(selectedProjectIdToConnect) }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Proyek berhasil dikoneksikan ke grup!");
        setSelectedProjectIdToConnect("");
        await loadConnectedProjects();
        onGroupUpdated();
      } else {
        showToast(data.error || "Gagal menghubungkan proyek");
      }
    } catch {
      showToast("Terjadi kesalahan jaringan");
    } finally {
      setConnectingProject(false);
    }
  };

  const handleDisconnectProject = async (projectId: number) => {
    setDisconnectingProjectId(projectId);
    try {
      const res = await fetch(`/api/chat/groups/${group.id}/projects?project_id=${projectId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Koneksi proyek berhasil diputus");
        await loadConnectedProjects();
        onGroupUpdated();
      } else {
        showToast(data.error || "Gagal memutuskan koneksi proyek");
      }
    } catch {
      showToast("Terjadi kesalahan jaringan");
    } finally {
      setDisconnectingProjectId(null);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => {
      setEditName(group.name);
      setEditDesc(group.description || "");
      setSelectedAiName(group.ai_name || "Miu");
      const currentModel = group.ai_model || "nvidia/nemotron-3.5-super-vl:free";
      setSelectedAiModel(currentModel);
      if (currentModel.includes("nemotron")) {
        setSelectedThinkingMode(group.ai_thinking_mode === "direct" ? "direct" : "native");
      } else {
        setSelectedThinkingMode(["low", "medium", "high"].includes(group.ai_thinking_mode || "") ? group.ai_thinking_mode! : "medium");
      }
      setIsEditing(false);
      setShowAddMember(false);
      setConfirmDialog(null);
      loadMembers();
      loadAllUsers();
      loadConnectedProjects();
    }, 0);
    return () => clearTimeout(t);
  // Efek mount/trigger tunggal: fungsi loader sengaja tidak jadi dependency agar tidak refetch tiap render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, group.id, group.name, group.description, group.ai_name, group.ai_model, group.ai_thinking_mode]);

  if (!isOpen) return null;

  // Users available to add (not yet in group)
  const existingUserIds = new Set(members.map((m) => m.user_id));
  const availableUsersToAdd = allUsers.filter((u) => !existingUserIds.has(u.id));

  // Projects available to connect (not yet connected to this group)
  const connectedProjectIds = new Set(connectedProjects.map((p) => p.id));
  const availableProjectsToConnect = projects.filter((p) => !connectedProjectIds.has(p.id));

  // Linked Project details
  const linkedProject = projects.find((p) => p.id === group.project_id);

  const handleSaveGroupInfo = async () => {
    if (!editName.trim()) {
      showToast("Nama grup tidak boleh kosong");
      return;
    }
    setSavingEdit(true);
    try {
      const res = await fetch("/api/chat/groups", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: group.id,
          name: editName.trim(),
          description: editDesc.trim(),
          user_id: currentUser.id,
          user_role: currentUser.role,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Informasi grup berhasil disimpan!");
        setIsEditing(false);
        onGroupUpdated();
      } else {
        showToast(data.error || "Gagal menyimpan info grup");
      }
    } catch {
      showToast("Terjadi kesalahan jaringan");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSaveAISettings = async () => {
    if (!isGroupCreator) {
      showToast("Hanya Pembuat Grup yang berwenang mengubah Asisten AI");
      return;
    }
    const trimmedAiName = selectedAiName.trim() || "Miu";
    setSavingAiSettings(true);
    try {
      const res = await fetch("/api/chat/groups", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: group.id,
          ai_name: trimmedAiName,
          ai_model: selectedAiModel,
          ai_thinking_mode: selectedThinkingMode,
          user_id: currentUser.id,
          user_role: currentUser.role,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Pengaturan Asisten AI grup berhasil disimpan!");
        onGroupUpdated();
      } else {
        showToast(data.error || "Gagal menyimpan pengaturan AI grup");
      }
    } catch {
      showToast("Terjadi kesalahan jaringan");
    } finally {
      setSavingAiSettings(false);
    }
  };

  const handleAddMember = async () => {
    if (!selectedUserIdToAdd) return;
    setAddingMember(true);
    try {
      const res = await fetch(`/api/chat/groups/${group.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: Number(selectedUserIdToAdd),
          added_by_user_id: currentUser.id,
          role: "member",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Anggota berhasil ditambahkan!");
        setSelectedUserIdToAdd("");
        setShowAddMember(false);
        await loadMembers();
        onGroupUpdated();
      } else {
        showToast(data.error || "Gagal menambahkan anggota");
      }
    } catch {
      showToast("Terjadi kesalahan jaringan");
    } finally {
      setAddingMember(false);
    }
  };

  const handleRoleToggle = async (targetUserId: number, currentRole: "admin" | "member") => {
    const newRole = currentRole === "admin" ? "member" : "admin";
    try {
      const res = await fetch(`/api/chat/groups/${group.id}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_user_id: targetUserId,
          role: newRole,
          updated_by_user_id: currentUser.id,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(
          newRole === "admin"
            ? "Anggota dijadikan Admin Grup!"
            : "Hak Admin Grup telah dicabut"
        );
        await loadMembers();
      } else {
        showToast(data.error || "Gagal mengubah role anggota");
      }
    } catch {
      showToast("Terjadi kesalahan jaringan");
    }
  };

  const handleExecuteKick = async () => {
    if (!confirmDialog?.targetUserId) return;
    setActionLoading(true);
    try {
      const res = await fetch(
        `/api/chat/groups/${group.id}/members?target_user_id=${confirmDialog.targetUserId}&requester_user_id=${currentUser.id}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (res.ok) {
        showToast("Anggota berhasil dikeluarkan");
        setConfirmDialog(null);
        await loadMembers();
        onGroupUpdated();
      } else {
        showToast(data.error || "Gagal mengeluarkan anggota");
      }
    } catch {
      showToast("Terjadi kesalahan jaringan");
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecuteLeave = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(
        `/api/chat/groups/${group.id}/members?target_user_id=${currentUser.id}&requester_user_id=${currentUser.id}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (res.ok) {
        showToast("Anda telah keluar dari grup");
        onClose();
        onGroupLeft(group.id);
      } else {
        showToast(data.error || "Gagal keluar dari grup");
      }
    } catch {
      showToast("Terjadi kesalahan jaringan");
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecuteDelete = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(
        `/api/chat/groups?id=${group.id}&user_id=${currentUser.id}&user_role=${currentUser.role}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (res.ok) {
        showToast("Grup obrolan berhasil dihapus");
        onClose();
        onGroupDeleted(group.id);
      } else {
        showToast(data.error || "Gagal menghapus grup chat");
      }
    } catch {
      showToast("Terjadi kesalahan jaringan");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col h-full min-h-0 relative overflow-hidden"
    >
      {/* Native Top App Bar */}
      <div className="pb-3.5 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between shrink-0 mb-3">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 -ml-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
            title="Kembali ke Obrolan"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Obrolan</span>
          </button>
          <span className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
          <span className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
            Detail Info Grup
          </span>
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-1 pb-6 space-y-5">
          {/* Group Profile Hero Card */}
          <div className="flex flex-col items-center text-center p-5 rounded-2xl bg-gradient-to-b from-slate-50 to-white dark:from-slate-800/50 dark:to-slate-900 border border-slate-200/60 dark:border-slate-800 relative">
            {/* Avatar Pill */}
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-[#D2F27C] via-lime-200 to-[#DCD4FB] text-slate-900 flex items-center justify-center font-black text-2xl shadow-md border-2 border-white dark:border-slate-800 mb-3">
              {group.name.slice(0, 2).toUpperCase()}
            </div>

            {/* Editable or Display Name */}
            {isEditing ? (
              <div className="w-full space-y-3 mt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 text-left uppercase mb-1">
                    Nama Grup
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    placeholder="Nama grup obrolan"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 text-left uppercase mb-1">
                    Deskripsi Grup
                  </label>
                  <textarea
                    rows={2}
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                    placeholder="Deskripsi tujuan grup"
                  />
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    disabled={savingEdit}
                    onClick={handleSaveGroupInfo}
                    className="px-4 py-1.5 rounded-xl bg-[#1C1D21] hover:bg-black text-white dark:bg-white dark:text-slate-900 text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{savingEdit ? "Menyimpan..." : "Simpan Perubahan"}</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-center gap-2">
                  <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
                    {group.name}
                  </h3>
                  {isGroupAdmin && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="w-6 h-6 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 grid place-items-center transition cursor-pointer"
                      title="Edit Nama &amp; Deskripsi"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                  {group.description || "Tidak ada deskripsi grup"}
                </p>

                <div className="flex flex-wrap items-center justify-center gap-2 mt-3 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Dibuat: {group.created_at ? group.created_at.slice(0, 10) : "-"}</span>
                  </span>
                  <span>·</span>
                  <span>Oleh: <strong className="text-slate-700 dark:text-slate-300">{group.creator_nama || "Leader"}</strong></span>
                </div>

                {connectedProjects.length > 0 && (
                  <div className="flex flex-wrap items-center justify-center gap-1.5 mt-3">
                    {connectedProjects.map((cp) => (
                      <span
                        key={cp.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/50 border border-blue-200/60 dark:border-blue-800/50 text-[11px] font-semibold text-blue-900 dark:text-blue-200"
                      >
                        <FolderKanban className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                        <span>{cp.nama_proyek}</span>
                        <span className="font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                          ({cp.persentase}%)
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* KONEKTOR PROYEK TIM (MULTI-PROJECT CONNECTOR) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-blue-50/50 via-white to-slate-50/40 dark:from-blue-950/20 dark:via-slate-800/60 dark:to-slate-900 border border-blue-200/80 dark:border-blue-800/40 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300 grid place-items-center shrink-0">
                  <FolderKanban className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <span>Konektor Proyek Tim</span>
                    <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-[10px] font-bold">
                      {connectedProjects.length} Terhubung
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Proyek yang dipantau {selectedAiName || 'Miu AI'} secara real-time di grup ini
                  </p>
                </div>
              </div>
            </div>

            {/* List of Connected Projects */}
            <div className="space-y-2">
              {loadingProjects && connectedProjects.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Memuat proyek terkoneksi...</span>
                </div>
              ) : connectedProjects.length === 0 ? (
                <div className="p-4 text-center rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-400">
                  Belum ada proyek yang dikoneksikan ke grup ini. Hubungkan proyek di bawah agar AI dapat memantau capaian &amp; kendala tim!
                </div>
              ) : (
                connectedProjects.map((proj) => (
                  <div
                    key={proj.id}
                    className="p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {proj.nama_proyek}
                        </span>
                        <span className="px-1.5 py-0.2 rounded-md bg-[#D2F27C]/40 text-slate-900 text-[10px] font-bold">
                          {proj.divisi}
                        </span>
                        {proj.status && (
                          <span className="px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-medium">
                            {proj.status}
                          </span>
                        )}
                        {(proj.kendala_count ?? 0) > 0 && (
                          <span className="px-1.5 py-0.2 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-bold flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            <span>{proj.kendala_count} Kendala</span>
                          </span>
                        )}
                      </div>

                      {/* Progress bar */}
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                          <div
                            className="h-full bg-blue-600 dark:bg-blue-400 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, proj.persentase || 0)}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-extrabold text-blue-700 dark:text-blue-300 tabular-nums">
                          {proj.persentase || 0}%
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-1">
                        <span>Target: {proj.total_realisasi || 0}/{proj.target_total || 0} {proj.satuan || ''}</span>
                        {proj.deadline && <span>· Deadline: {proj.deadline}</span>}
                      </div>
                    </div>

                    {/* Action: Disconnect Project */}
                    {isGroupAdmin && (
                      <button
                        type="button"
                        disabled={disconnectingProjectId === proj.id}
                        onClick={() => handleDisconnectProject(proj.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer self-end sm:self-center"
                        title="Putuskan koneksi proyek dari grup ini"
                      >
                        {disconnectingProjectId === proj.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Add Project Connection Dropdown (Admins Only) */}
            {isGroupAdmin && (
              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <CustomSelect
                      variant="form"
                      value={selectedProjectIdToConnect}
                      onChange={setSelectedProjectIdToConnect}
                      placeholder="-- Hubungkan Proyek Lain ke Grup Ini --"
                      options={availableProjectsToConnect.map((p) => ({
                        value: String(p.id),
                        label: p.nama_proyek,
                        subLabel: `${p.divisi} · ${p.persentase}%`,
                      }))}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={!selectedProjectIdToConnect || connectingProject}
                    onClick={handleConnectProject}
                    className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    {connectingProject ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    <span>Hubungkan</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* PENGATURAN ASISTEN AI GRUP (STRICT CREATOR-ONLY EDIT) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-purple-50/50 via-white to-slate-50/40 dark:from-purple-950/20 dark:via-slate-800/60 dark:to-slate-900 border border-purple-200/80 dark:border-purple-800/40 shadow-xs space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300 grid place-items-center shrink-0 overflow-hidden">
                  <AIMascot size={22} />
                </div>
                <div>
                  <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>Pengaturan Asisten AI Grup</span>
                    <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Kustomisasi nama, model LLM &amp; tingkat kedalaman berpikir AI grup
                  </p>
                </div>
              </div>

              {/* Creator Status Pill */}
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 flex items-center gap-1 ${
                  isGroupCreator
                    ? "bg-[#D2F27C]/40 text-slate-900 dark:text-[#D2F27C] border border-[#D2F27C]/70"
                    : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                {isGroupCreator ? "Izin: Pembuat Grup" : "Read-Only"}
              </span>
            </div>

            {/* 1. Nama Asisten AI & Trigger Preview */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Nama Asisten AI
                </label>
                <div className="flex items-center gap-1 text-[10px] font-bold text-purple-700 dark:text-purple-300">
                  <span>Trigger:</span>
                  <span className="px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-950/70 border border-purple-200/60 font-mono">
                    @{selectedAiName.trim().replace(/\s+/g, '') || "ai"}
                  </span>
                  <span className="text-slate-400 font-normal">/ @ai</span>
                </div>
              </div>
              <input
                type="text"
                disabled={!isGroupCreator}
                value={selectedAiName}
                onChange={(e) => setSelectedAiName(e.target.value)}
                placeholder="Contoh: Miu, Jarvis, Srikandi..."
                className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            {/* 2. Model Selector */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                Pilih Model LLM
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* NVIDIA Option */}
                <button
                  type="button"
                  disabled={!isGroupCreator}
                  onClick={() => {
                    setSelectedAiModel("nvidia/nemotron-3.5-super-vl:free");
                    if (selectedThinkingMode === "low" || selectedThinkingMode === "high") {
                      setSelectedThinkingMode("native");
                    }
                  }}
                  className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                    selectedAiModel === "nvidia/nemotron-3.5-super-vl:free"
                      ? "bg-white dark:bg-slate-900 border-purple-500 ring-2 ring-purple-500/20 shadow-xs"
                      : "bg-slate-50/80 dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-700 hover:border-slate-300"
                  } ${isGroupCreator ? "cursor-pointer" : "cursor-not-allowed opacity-75"}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-extrabold text-xs text-slate-900 dark:text-white">
                      NVIDIA Nemotron 3.5 Super VL
                    </span>
                    <span className="px-1.5 py-0.2 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[9px] font-bold">
                      Free
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                    Respon analitis cepat, penalaran alami bawaan model
                  </p>
                </button>

                {/* Baidu Option */}
                <button
                  type="button"
                  disabled={!isGroupCreator}
                  onClick={() => {
                    setSelectedAiModel("baidu/ernie-5.5-flash-preview:free");
                    if (selectedThinkingMode === "native" || selectedThinkingMode === "direct") {
                      setSelectedThinkingMode("medium");
                    }
                  }}
                  className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                    selectedAiModel === "baidu/ernie-5.5-flash-preview:free"
                      ? "bg-white dark:bg-slate-900 border-purple-500 ring-2 ring-purple-500/20 shadow-xs"
                      : "bg-slate-50/80 dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-700 hover:border-slate-300"
                  } ${isGroupCreator ? "cursor-pointer" : "cursor-not-allowed opacity-75"}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-extrabold text-xs text-slate-900 dark:text-white">
                      Baidu ERNIE 5.5 Flash Preview
                    </span>
                    <span className="px-1.5 py-0.2 rounded-md bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[9px] font-bold">
                      Free
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                    Model penalaran Baidu dengan effort thinking dinamis (Low/Med/High)
                  </p>
                </button>
              </div>
            </div>

            {/* 3. Thinking Mode */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                Mode Berpikir (Thinking Mode)
              </label>
              {selectedAiModel === "baidu/ernie-5.5-flash-preview:free" ? (
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "low", label: "Low", desc: "Ringkas & Cepat" },
                    { id: "medium", label: "Medium", desc: "Seimbang" },
                    { id: "high", label: "High", desc: "Mendalam" },
                  ].map((tm) => {
                    const isSelected = selectedThinkingMode === tm.id;
                    return (
                      <button
                        key={tm.id}
                        type="button"
                        disabled={!isGroupCreator}
                        onClick={() => setSelectedThinkingMode(tm.id)}
                        className={`py-2 px-2.5 rounded-xl border text-center transition ${
                          isSelected
                            ? "bg-white dark:bg-slate-900 border-purple-500 ring-2 ring-purple-500/20 shadow-xs"
                            : "bg-slate-50/80 dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-700 hover:border-slate-300"
                        } ${isGroupCreator ? "cursor-pointer" : "cursor-not-allowed opacity-75"}`}
                      >
                        <div className="font-extrabold text-xs text-slate-900 dark:text-white">
                          {tm.label}
                        </div>
                        <div className="text-[9px] text-slate-400 mt-0.5">{tm.desc}</div>
                      </button>
                    );
                  })}
                </div>
              ) : selectedAiModel === "nvidia/nemotron-3.5-super-vl:free" ? (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "native", label: "Native Reasoning", desc: "Bawaan Model" },
                    { id: "direct", label: "Direct", desc: "Tanpa Penalaran" },
                  ].map((tm) => {
                    const isSelected =
                      selectedThinkingMode === tm.id ||
                      (tm.id === "native" && (selectedThinkingMode === "medium" || selectedThinkingMode === "native"));
                    return (
                      <button
                        key={tm.id}
                        type="button"
                        disabled={!isGroupCreator}
                        onClick={() => setSelectedThinkingMode(tm.id)}
                        className={`py-2 px-2.5 rounded-xl border text-center transition ${
                          isSelected
                            ? "bg-white dark:bg-slate-900 border-purple-500 ring-2 ring-purple-500/20 shadow-xs"
                            : "bg-slate-50/80 dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-700 hover:border-slate-300"
                        } ${isGroupCreator ? "cursor-pointer" : "cursor-not-allowed opacity-75"}`}
                      >
                        <div className="font-extrabold text-xs text-slate-900 dark:text-white">
                          {tm.label}
                        </div>
                        <div className="text-[9px] text-slate-400 mt-0.5">{tm.desc}</div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs text-center border border-slate-200 dark:border-slate-700">
                  Tidak Didukung (Model ini tidak mendukung fitur penalaran CoT)
                </div>
              )}
            </div>

            {/* Action Save or Creator Notice */}
            <div className="pt-1">
              {isGroupCreator ? (
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] text-slate-400 italic">
                    Perubahan langsung berlaku untuk seluruh obrolan @{selectedAiName.trim() || 'ai'} di grup ini.
                  </p>
                  <button
                    type="button"
                    disabled={savingAiSettings}
                    onClick={handleSaveAISettings}
                    className="px-4 py-2 rounded-xl bg-[#1C1D21] hover:bg-black text-white dark:bg-white dark:text-slate-900 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs disabled:opacity-50 shrink-0"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{savingAiSettings ? "Menyimpan..." : "Simpan Pengaturan AI"}</span>
                  </button>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 text-[11px] text-amber-800 dark:text-amber-300 font-medium flex items-center gap-2">
                  <Shield className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>Hanya Pembuat Grup yang memiliki wewenang untuk mengubah pengaturan Asisten AI.</span>
                </div>
              )}
            </div>
          </div>

          {/* Tab Switcher: Anggota vs Media */}
          <div className="flex rounded-2xl bg-slate-100 dark:bg-slate-800 p-1">
            <button
              onClick={() => setActiveTab("members")}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === "members"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Anggota ({members.length})</span>
            </button>
            <button
              onClick={() => setActiveTab("media")}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === "media"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Media &amp; Tautan Berkas</span>
            </button>
          </div>

          {/* TAB 1: MEMBERS MANAGEMENT */}
          {activeTab === "members" && (
            <div className="space-y-3">
              {/* Add Member Bar (Group Admin Only) */}
              {isGroupAdmin && (
                <div>
                  {!showAddMember ? (
                    <button
                      onClick={() => setShowAddMember(true)}
                      className="w-full py-2.5 px-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200/70 dark:bg-slate-800 dark:hover:bg-slate-700/70 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer border border-dashed border-slate-300 dark:border-slate-600"
                    >
                      <UserPlus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Tambah Anggota ke Grup Ini</span>
                    </button>
                  ) : (
                    <div className="p-3.5 rounded-2xl bg-slate-100/90 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2.5">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200">
                        <span>Pilih Rekan Tim untuk Dimasukkan:</span>
                        <button
                          onClick={() => setShowAddMember(false)}
                          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
                        >
                          Tutup
                        </button>
                      </div>

                      {availableUsersToAdd.length > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <CustomSelect
                              variant="form"
                              value={selectedUserIdToAdd}
                              onChange={setSelectedUserIdToAdd}
                              placeholder="-- Pilih Anggota --"
                              options={availableUsersToAdd.map((u) => ({
                                value: String(u.id),
                                label: u.nama,
                                subLabel: `${u.divisi} · ${u.role}`,
                              }))}
                            />
                          </div>
                          <button
                            disabled={!selectedUserIdToAdd || addingMember}
                            onClick={handleAddMember}
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 transition disabled:opacity-50 cursor-pointer shrink-0"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>{addingMember ? "Menambah..." : "Tambah"}</span>
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">
                          Semua anggota tim yang terdaftar sudah berada di dalam grup ini.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Members List */}
              <div className="space-y-2">
                {/* Dedicated AI Co-Worker Member Card */}
                <div className="p-3 rounded-2xl bg-gradient-to-r from-purple-50/70 via-white to-[#D2F27C]/20 dark:from-purple-950/40 dark:via-slate-800/80 dark:to-lime-950/20 border border-purple-200/80 dark:border-purple-800/60 flex items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-2xl bg-white dark:bg-slate-900 shadow-xs border border-purple-200 dark:border-purple-800 flex items-center justify-center shrink-0 overflow-hidden">
                      <AIMascot size={24} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-extrabold text-xs text-purple-900 dark:text-purple-200 truncate">
                          {selectedAiName.trim() || "Miu"}
                        </span>
                        <span className="px-1.5 py-0.2 rounded-md bg-purple-200/80 dark:bg-purple-900 text-purple-900 dark:text-purple-200 text-[9px] font-black uppercase tracking-wider">
                          AI Co-Worker
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                        @{selectedAiName.trim().replace(/\s+/g, '') || "ai"} · {selectedAiModel.includes("baidu") ? "Baidu ERNIE 5.5" : "NVIDIA Nemotron 3.5"}
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#D2F27C]/50 text-slate-900 border border-[#D2F27C]/80">
                    ⚡ Always Active
                  </span>
                </div>

                {loadingMembers ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    Memuat daftar anggota...
                  </div>
                ) : (
                  members.map((m) => {
                    const isMe = m.user_id === currentUser.id;
                    const isMemberAdmin = m.role === "admin";
                    const isCreator = group.created_by === m.user_id;

                    return (
                      <div
                        key={m.id}
                        className="p-3 rounded-2xl bg-white dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-3 hover:border-slate-300 dark:hover:border-slate-600 transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-slate-200 to-slate-100 dark:from-slate-700 dark:to-slate-800 text-slate-900 dark:text-white font-black text-xs flex items-center justify-center shrink-0 border border-black/5 dark:border-white/5">
                            {m.nama.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                {m.nama}
                              </span>
                              {isMe && (
                                <span className="px-1.5 py-0.2 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[9px] font-bold">
                                  Anda
                                </span>
                              )}
                              {isCreator && (
                                <span className="px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 text-[9px] font-bold">
                                  Pembuat Grup
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 block truncate">
                              {m.divisi} · @{m.username}
                            </span>
                          </div>
                        </div>

                        {/* Right: Role Badge & Admin Action Buttons */}
                        <div className="flex items-center gap-2 shrink-0">
                          {/* Role Badge */}
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                              isMemberAdmin
                                ? "bg-purple-100 text-purple-800 dark:bg-purple-950/70 dark:text-purple-300 border border-purple-200/60"
                                : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                            }`}
                          >
                            {isMemberAdmin && <Crown className="w-3 h-3 text-amber-500 fill-amber-500" />}
                            <span>{isMemberAdmin ? "Admin Grup" : "Anggota"}</span>
                          </span>

                          {/* Admin Controls on other members */}
                          {isGroupAdmin && !isMe && !isCreator && (
                            <div className="flex items-center gap-1">
                              {/* Toggle Role Button */}
                              <button
                                onClick={() => handleRoleToggle(m.user_id, m.role)}
                                className={`px-2 py-1 rounded-xl text-[10px] font-bold transition cursor-pointer ${
                                  isMemberAdmin
                                    ? "bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                                    : "bg-purple-600 hover:bg-purple-700 text-white"
                                }`}
                                title={isMemberAdmin ? "Hapus status Admin Grup" : "Jadikan Admin Grup"}
                              >
                                {isMemberAdmin ? "Demote" : "Jadikan Admin"}
                              </button>

                              {/* Kick Button */}
                              <button
                                onClick={() =>
                                  setConfirmDialog({
                                    type: "kick",
                                    targetUserId: m.user_id,
                                    targetUserName: m.nama,
                                  })
                                }
                                className="p-1.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/40 text-red-500 transition cursor-pointer"
                                title="Keluarkan dari grup"
                              >
                                <UserMinus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 2: MEDIA & BERKAS */}
          {activeTab === "media" && (() => {
            const allLinks = (connectedProjects.length > 0 ? connectedProjects : (linkedProject ? [linkedProject] : [])).flatMap((cp) => {
              const fullP = projects.find((p) => p.id === cp.id);
              return (fullP?.links || []).map((l) => ({ ...l, projectName: cp.nama_proyek }));
            });

            return (
              <div className="space-y-4">
                {allLinks.length > 0 ? (
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                      Tautan Seluruh Proyek Terhubung ({allLinks.length})
                    </h4>
                    <div className="space-y-2">
                      {allLinks.map((link) => (
                        <a
                          key={link.id}
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-3 hover:border-slate-300 transition text-xs group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-7 h-7 rounded-xl bg-slate-200 dark:bg-slate-700 grid place-items-center text-[10px] font-bold uppercase shrink-0">
                              {link.platform.slice(0, 2)}
                            </span>
                            <div className="min-w-0">
                              <span className="font-bold text-slate-900 dark:text-white truncate block">
                                {link.title}
                              </span>
                              <span className="text-[10px] text-slate-400 truncate block">
                                {link.projectName} · {link.platform}
                              </span>
                            </div>
                          </div>
                          <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 shrink-0" />
                        </a>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center text-xs text-slate-400">
                    Belum ada berkas atau tautan khusus yang ditautkan ke grup ini.
                  </div>
                )}
              </div>
            );
          })()}

          {/* Danger Zone Actions */}
          <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800 space-y-2">
            {/* Leave Group Action (for non-creator or if other admins exist) */}
            <button
              onClick={() => setConfirmDialog({ type: "leave" })}
              className="w-full py-2.5 px-4 rounded-2xl bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/60 text-red-600 dark:text-red-400 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer border border-red-200/60 dark:border-red-900/40"
            >
              <LogOut className="w-4 h-4" />
              <span>Keluar dari Grup Obrolan</span>
            </button>

            {/* Delete Group Action (Creator or System Admin only) */}
            {(isGroupCreator || currentUser.role === "admin") && (
              <button
                onClick={() => setConfirmDialog({ type: "delete" })}
                className="w-full py-2.5 px-4 rounded-2xl bg-slate-100 hover:bg-red-50 hover:text-red-600 dark:bg-slate-800 dark:hover:bg-red-950/40 dark:hover:text-red-400 text-slate-600 dark:text-slate-400 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer border border-slate-200/60 dark:border-slate-700"
              >
                <Trash2 className="w-4 h-4" />
                <span>Hapus Grup Obrolan (Khusus Leader/Pembuat)</span>
              </button>
            )}
          </div>
        </div>

        {/* Inline Confirmation Dialog Modal */}
        <AnimatePresence>
          {confirmDialog && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-2xs rounded-3xl flex items-center justify-center p-5 z-20">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-sm w-full space-y-4 text-center shadow-xl"
              >
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 mx-auto grid place-items-center">
                  <AlertTriangle className="w-6 h-6" />
                </div>

                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    {confirmDialog.type === "kick" && `Keluarkan ${confirmDialog.targetUserName}?`}
                    {confirmDialog.type === "leave" && "Yakin ingin keluar dari grup?"}
                    {confirmDialog.type === "delete" && "Hapus permanen grup ini?"}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {confirmDialog.type === "kick" &&
                      "Pengguna ini tidak akan bisa membaca atau mengirim pesan di grup ini lagi."}
                    {confirmDialog.type === "leave" &&
                      "Anda tidak akan menerima pembaruan pesan dari grup ini sampai ditambahkan kembali."}
                    {confirmDialog.type === "delete" &&
                      "Seluruh riwayat obrolan dan keanggotaan grup ini akan dihapus secara permanen."}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    disabled={actionLoading}
                    onClick={() => setConfirmDialog(null)}
                    className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    disabled={actionLoading}
                    onClick={() => {
                      if (confirmDialog.type === "kick") handleExecuteKick();
                      else if (confirmDialog.type === "leave") handleExecuteLeave();
                      else if (confirmDialog.type === "delete") handleExecuteDelete();
                    }}
                    className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                  >
                    {actionLoading ? "Memproses..." : "Ya, Lanjutkan"}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
    </motion.div>
  );
}
