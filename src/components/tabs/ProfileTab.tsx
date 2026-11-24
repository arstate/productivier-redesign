"use client";

import React, { useState, useMemo } from "react";
import {
  UserPlus,
  Trash2,
  Search,
  CheckCircle2,
  Clock,
  Sparkles,
  ShieldCheck,
  Edit3,
  X,
  TrendingUp,
} from "lucide-react";
import { UserType, MonitoringType } from "@/types";
import CustomSelect, { CustomSelectOption } from "@/components/ui/CustomSelect";

export default function ProfileTab({
  user,
  users,
  monitoring,
  onUserUpdated,
  onRefresh,
  showToast,
}: {
  user: UserType;
  users: UserType[];
  monitoring: MonitoringType | null;
  onUserUpdated: (u: UserType) => void;
  onRefresh: () => Promise<void>;
  showToast: (m: string) => void;
}) {
  const [nama, setNama] = useState(user.nama);
  const [divisi, setDivisi] = useState(user.divisi);
  const [phone, setPhone] = useState(user.phone || "");
  const [gender, setGender] = useState<"female" | "male">(user.gender || "male");
  const [password, setPassword] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [savingMe, setSavingMe] = useState(false);

  // Sync state if user prop updates
  React.useEffect(() => {
    setNama(user.nama);
    setDivisi(user.divisi);
    setPhone(user.phone || "");
    setGender(user.gender || "male");
  }, [user]);

  // Search filter for registered users
  const [userQuery, setUserQuery] = useState("");

  // Admin New User State
  const [newUser, setNewUser] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newNama, setNewNama] = useState("");
  const [newDivisi, setNewDivisi] = useState("Operasional");
  const [newRole, setNewRole] = useState<"karyawan" | "admin">("karyawan");
  const [newPhone, setNewPhone] = useState("");
  const [newGender, setNewGender] = useState<"female" | "male">("male");
  const [creatingUser, setCreatingUser] = useState(false);

  const roleOptions: CustomSelectOption[] = [
    { value: "karyawan", label: "Anggota Tim (Karyawan)" },
    { value: "admin", label: "Admin / Leader" },
  ];

  const genderOptions: CustomSelectOption[] = [
    { value: "male", label: "Laki-laki (Bro / Men / Cuy)" },
    { value: "female", label: "Perempuan (Bestie / Sis / Beb)" },
  ];

  // Self monitoring check
  const selfMonitoring = useMemo(() => {
    return monitoring?.statusTim?.find((m) => m.id === user.id);
  }, [monitoring, user.id]);

  // Team summary counts
  const teamStatusList = monitoring?.statusTim || [];
  const totalTeamCount = teamStatusList.length || users.length;
  const alreadyInputCount = teamStatusList.filter((m) => m.sudah_input).length;
  const teamInputRate = totalTeamCount > 0 ? Math.round((alreadyInputCount / totalTeamCount) * 100) : 0;

  // Filtered users list
  const filteredUsers = useMemo(() => {
    if (!userQuery.trim()) return users;
    const q = userQuery.toLowerCase();
    return users.filter(
      (u) =>
        u.nama.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.divisi.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    );
  }, [users, userQuery]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingMe(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": String(user.id),
        },
        body: JSON.stringify({
          nama: nama.trim(),
          divisi: divisi.trim(),
          phone: phone.trim(),
          gender,
          password: password ? password.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        onUserUpdated(data.user);
        setPassword("");
        setIsEditing(false);
        showToast("Profil berhasil diperbarui & tersimpan di database!");
        await onRefresh();
      } else {
        showToast(data.error || "Gagal memperbarui profil");
      }
    } catch {
      showToast("Terjadi kesalahan jaringan");
    } finally {
      setSavingMe(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.trim() || !newPass.trim() || !newNama.trim()) return;
    setCreatingUser(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUser.trim(),
          password: newPass.trim(),
          nama: newNama.trim(),
          divisi: newDivisi.trim(),
          role: newRole,
          phone: newPhone.trim(),
          gender: newGender,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setNewUser("");
        setNewPass("");
        setNewNama("");
        setNewPhone("");
        showToast("Akun tim baru berhasil dibuat!");
        await onRefresh();
      } else {
        showToast(data.error || "Gagal membuat akun tim");
      }
    } catch {
      showToast("Terjadi kesalahan jaringan");
    } finally {
      setCreatingUser(false);
    }
  };

  const handleDeleteUser = async (id: number, username: string) => {
    if (username === "fifa") {
      showToast("Akun utama Fifa tidak dapat dihapus!");
      return;
    }
    if (!confirm(`Hapus akun @${username}?`)) return;
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "DELETE",
        headers: {
          "x-user-id": String(user.id),
        },
      });
      if (res.ok) {
        showToast("Akun berhasil dihapus");
        await onRefresh();
      } else {
        showToast("Gagal menghapus akun");
      }
    } catch {
      showToast("Terjadi kesalahan jaringan");
    }
  };

  return (
    <div className="w-full max-w-[1550px] mx-auto space-y-6 lg:space-y-7 antialiased select-none">
      {/* =========================================================================
          ROW 1: PERSONAL IDENTITY & LIVE TEAM STATUS (BENTO GRID 2-COLUMN)
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* CARD A: USER PROFILE HERO (lg:col-span-4) */}
        <div className="lg:col-span-4 xl:col-span-4 intellecta-card p-6 sm:p-7 dark:text-slate-100 flex flex-col justify-between gap-5 relative overflow-hidden">
          {/* Subtle Accent Glow */}
          <div className="absolute -top-12 -right-12 w-36 h-36 bg-[#D2F27C]/20 dark:bg-[#D2F27C]/10 rounded-full blur-2xl pointer-events-none" />

          {/* Profile Identity Header */}
          <div className="flex items-start justify-between gap-4 relative z-10">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#D2F27C] via-amber-200 to-[#DCD4FB] text-slate-900 font-black text-xl flex items-center justify-center ring-4 ring-white dark:ring-slate-800 shadow-md flex-shrink-0">
                {user.nama.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight truncate leading-tight">
                    {user.nama}
                  </h2>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="px-2 py-0.5 rounded-full bg-[#1C1D21] text-white dark:bg-white dark:text-slate-900 font-extrabold text-[10px] uppercase tracking-wider">
                    {user.role === "admin" ? "LEADER" : "KARYAWAN"}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                    @{user.username}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsEditing(!isEditing)}
              className="p-2 sm:px-3 sm:py-1.5 rounded-full border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shrink-0"
              title={isEditing ? "Batal Edit" : "Ubah Data Diri"}
            >
              {isEditing ? (
                <>
                  <X className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Batal</span>
                </>
              ) : (
                <>
                  <Edit3 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Ubah</span>
                </>
              )}
            </button>
          </div>

          {/* Division Badge & Meta */}
          <div className="p-3.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Divisi Kerja
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {user.divisi}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Status Hari Ini
              </span>
              <span
                className={`font-bold flex items-center gap-1 ${
                  selfMonitoring?.sudah_input
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-amber-600 dark:text-amber-400"
                }`}
              >
                {selfMonitoring?.sudah_input ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Sudah Input</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-3.5 h-3.5" />
                    <span>Belum Input</span>
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Mini KPI Personal Grid */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Entri Tugas
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                  {selfMonitoring?.jumlah_input ?? 0}
                </span>
                <span className="text-xs text-slate-500 font-semibold">tugas</span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 shadow-2xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Efisiensi Diri
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-extrabold text-slate-900 dark:text-white tabular-nums">
                  {selfMonitoring?.rata_persen ?? 0}%
                </span>
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500 ml-0.5" />
              </div>
            </div>
          </div>

          {/* In-Place Edit Form */}
          {isEditing && (
            <form onSubmit={handleSaveProfile} className="pt-4 border-t border-slate-200/70 dark:border-slate-700/70 space-y-3.5">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Perbarui Informasi Diri:
              </span>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  required
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100/90 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Divisi
                </label>
                <input
                  type="text"
                  required
                  value={divisi}
                  onChange={(e) => setDivisi(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100/90 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Nomor WhatsApp (Colek WA)
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Contoh: 6285196598881"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100/90 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Nomor WA digunakan untuk fitur Colek WA langsung dari dashboard.
                </span>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Gender &amp; Tuning Sapaan AI
                </label>
                <CustomSelect
                  value={gender}
                  onChange={(v) => setGender(v as any)}
                  options={genderOptions}
                  variant="form"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Menentukan gaya panggilan AI (Bestie / Sis untuk wanita, Bro / Men untuk pria).
                </span>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Password Baru (Opsional)
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Kosongkan jika tidak diubah"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100/90 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition"
                />
              </div>

              <button
                type="submit"
                disabled={savingMe}
                className="w-full py-2.5 rounded-xl bg-[#1C1D21] hover:bg-black text-white text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
              >
                {savingMe ? "Menyimpan..." : "Simpan Perubahan ke Database"}
              </button>
            </form>
          )}
        </div>

        {/* CARD B: MONITORING STATUS TIM HARI INI (lg:col-span-8) */}
        <div className="lg:col-span-8 xl:col-span-8 intellecta-card p-6 sm:p-7 space-y-5 dark:text-slate-100">
          {/* Header Row: Title & Team Pulse Progress */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-slate-700/80">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Monitoring Status Tim Hari Ini
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-[#D2F27C]/30 text-slate-900 dark:text-[#D2F27C] text-[10px] font-extrabold uppercase tracking-wider border border-[#D2F27C]/50">
                  LIVE PULSE
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Pantau kepatuhan input realisasi harian setiap anggota tim kerja
              </p>
            </div>

            {/* Team Compliance Pill & Meter */}
            <div className="flex items-center gap-3 bg-slate-100/80 dark:bg-slate-800/80 px-4 py-2 rounded-2xl border border-slate-200/60 dark:border-slate-700/60 self-start sm:self-auto shrink-0">
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Kepatuhan Input
                </span>
                <span className="text-xs font-extrabold text-slate-900 dark:text-white tabular-nums">
                  {alreadyInputCount} / {totalTeamCount} Anggota ({teamInputRate}%)
                </span>
              </div>
              <div className="w-12 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#1C1D21] dark:bg-[#D2F27C] rounded-full transition-all duration-500"
                  style={{ width: `${teamInputRate}%` }}
                />
              </div>
            </div>
          </div>

          {/* Grid Anggota Tim (Responsive Cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5 pt-1">
            {monitoring?.statusTim?.map((m) => (
              <div
                key={m.id}
                className="p-4 rounded-3xl bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700 flex flex-col justify-between gap-3.5 hover:border-slate-300 dark:hover:border-slate-600 transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                      {m.nama}
                    </h4>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate block">
                      {m.divisi}
                    </span>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 shrink-0 ${
                      m.sudah_input
                        ? "bg-[#D2F27C] text-slate-900 font-black shadow-2xs"
                        : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold"
                    }`}
                  >
                    {m.sudah_input ? "✓ Sudah Input" : "Belum Input"}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-xs">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">
                    {m.jumlah_input} entri hari ini
                  </span>
                  <span className="font-black text-slate-900 dark:text-white tabular-nums">
                    {m.rata_persen}%
                  </span>
                </div>
              </div>
            ))}

            {(!monitoring?.statusTim || monitoring.statusTim.length === 0) &&
              users.map((u) => (
                <div
                  key={u.id}
                  className="p-4 rounded-3xl bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700 flex items-center justify-between"
                >
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">{u.nama}</h4>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">{u.divisi}</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-[10px] uppercase">
                    {u.role}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* =========================================================================
          ROW 2: TEAM MANAGEMENT & ONBOARDING (BENTO GRID 2-COLUMN KHUSUS LEADER)
          ========================================================================= */}
      {user.role === "admin" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* CARD C: MANAGE REGISTERED USERS LIST (lg:col-span-7) */}
          <div className="lg:col-span-7 xl:col-span-7 intellecta-card p-6 sm:p-7 space-y-4 dark:text-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80 dark:border-slate-700/80">
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Daftar Akun Terdaftar ({filteredUsers.length})
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Kelola hak akses dan hapus akun staf jika diperlukan
                </p>
              </div>

              {/* Quick Search Staf Input */}
              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Cari anggota tim..."
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:bg-white dark:focus:bg-slate-900 transition"
                />
              </div>
            </div>

            {/* Scrollable Team Directory List */}
            <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 pr-1">
              {filteredUsers.map((u) => (
                <div key={u.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[#1C1D21] dark:bg-white text-white dark:text-slate-900 font-black text-xs flex items-center justify-center shrink-0">
                      {u.nama.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <strong className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {u.nama}
                        </strong>
                        <span className="px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                          @{u.username}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        Divisi: {u.divisi} · Role: {u.role}
                      </span>
                    </div>
                  </div>

                  {u.username !== "fifa" ? (
                    <button
                      onClick={() => handleDeleteUser(u.id, u.username)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/40 text-red-700 dark:text-red-300 font-semibold transition cursor-pointer shrink-0"
                      title={`Hapus akun @${u.username}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus</span>
                    </button>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full bg-[#D2F27C]/30 text-slate-900 dark:text-[#D2F27C] font-black text-[10px] uppercase border border-[#D2F27C]/50 shrink-0">
                      Leader Utama
                    </span>
                  )}
                </div>
              ))}

              {filteredUsers.length === 0 && (
                <div className="py-8 text-center text-xs text-slate-400">
                  Tidak ada anggota tim yang cocok dengan kata kunci &quot;{userQuery}&quot;.
                </div>
              )}
            </div>
          </div>

          {/* CARD D: CREATE TEAM MEMBER ACCOUNT (lg:col-span-5) */}
          <div className="lg:col-span-5 xl:col-span-5 intellecta-card p-6 sm:p-7 space-y-4 dark:text-slate-100">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-200/80 dark:border-slate-700/80">
              <div className="w-10 h-10 rounded-2xl bg-[#D2F27C] text-slate-900 flex items-center justify-center font-bold shrink-0">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Buat Akun Tim
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Daftarkan username &amp; password baru untuk staf
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    value={newUser}
                    onChange={(e) => setNewUser(e.target.value)}
                    placeholder="Contoh: staff_fadhil"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100/90 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    placeholder="Password akun"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100/90 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Nama Lengkap
                  </label>
                  <input
                    type="text"
                    required
                    value={newNama}
                    onChange={(e) => setNewNama(e.target.value)}
                    placeholder="Nama staf"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100/90 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Divisi
                  </label>
                  <input
                    type="text"
                    required
                    value={newDivisi}
                    onChange={(e) => setNewDivisi(e.target.value)}
                    placeholder="Operasional / Kreatif"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100/90 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Role Akun
                  </label>
                  <CustomSelect
                    value={newRole}
                    onChange={(v) => setNewRole(v as any)}
                    options={roleOptions}
                    variant="form"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Gender (Tuning AI)
                  </label>
                  <CustomSelect
                    value={newGender}
                    onChange={(v) => setNewGender(v as any)}
                    options={genderOptions}
                    variant="form"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Nomor WhatsApp
                </label>
                <input
                  type="text"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="Contoh: 6281234567890"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100/90 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition"
                />
              </div>

              <div className="pt-1">
                <button
                  type="submit"
                  disabled={creatingUser}
                  className="w-full py-3 rounded-full bg-[#1C1D21] hover:bg-black text-white text-xs font-bold shadow-lg shadow-black/10 transition active:scale-95 cursor-pointer dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 flex items-center justify-center gap-1.5"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{creatingUser ? "Mendaftarkan..." : "Daftarkan Akun Tim Baru"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
