"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Zap, Check, Users, UserCheck } from "lucide-react";
import { UserType, ProjectType } from "@/types";
import CustomSelect, { CustomSelectOption } from "@/components/ui/CustomSelect";

export default function InputTab({
  user,
  users = [],
  projects,
  onSaved,
  showToast,
}: {
  user: UserType;
  users?: UserType[];
  projects: ProjectType[];
  onSaved: () => Promise<void>;
  showToast?: (m: string) => void;
}) {
  const [projectId, setProjectId] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("productivier_input_project_id");
      if (stored) return stored;
    }
    return projects[0]?.id ? String(projects[0].id) : "";
  });
  const [assignedUserId, setAssignedUserId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const storedDel = sessionStorage.getItem("productivier_input_delegate_user_id");
      if (storedDel) return storedDel;
      if (sessionStorage.getItem("productivier_input_delegate_mode") === "1") {
        const firstTeammate = users.find((u) => u.id !== user.id);
        if (firstTeammate) return String(firstTeammate.id);
      }
    }
    return String(user.id);
  });
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [deadline, setDeadline] = useState("");
  const [aktivitas, setAktivitas] = useState("");
  const [target, setTarget] = useState("10");
  const [realisasi, setRealisasi] = useState(() => {
    if (typeof window !== "undefined") {
      if (
        sessionStorage.getItem("productivier_input_delegate_user_id") ||
        sessionStorage.getItem("productivier_input_delegate_mode") === "1"
      ) {
        return "0";
      }
    }
    return "10";
  });
  const [satuan, setSatuan] = useState("Tugas");
  const [kendala, setKendala] = useState("");
  const [solusi, setSolusi] = useState("");
  const [foto, setFoto] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("productivier_input_project_id");
      sessionStorage.removeItem("productivier_input_delegate_user_id");
      sessionStorage.removeItem("productivier_input_delegate_mode");
    }
  }, []);

  const isDelegating = Number(assignedUserId) !== user.id;

  const calculatedPct = useMemo(() => {
    const t = Number(target) || 1;
    const r = Number(realisasi) || 0;
    return Math.round((r / t) * 100);
  }, [target, realisasi]);

  const projectOptions: CustomSelectOption[] = [
    { value: "", label: "Tanpa Proyek Khusus (Tugas Umum)" },
    ...projects.map((p) => ({
      value: String(p.id),
      label: p.nama_proyek,
      subLabel: `${p.divisi} — Target: ${p.target_total} ${p.satuan}`,
    })),
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aktivitas.trim()) return;
    setErrorMsg("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/realisasi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId ? Number(projectId) : null,
          user_id: Number(assignedUserId) || user.id,
          assigned_to_user_id: Number(assignedUserId) || user.id,
          assigned_by_user_id: isDelegating ? user.id : null,
          deadline: deadline || "",
          nama: user.nama,
          divisi: user.divisi,
          tanggal: tanggal || new Date().toISOString().slice(0, 10),
          aktivitas: aktivitas.trim(),
          target: Number(target),
          realisasi: Number(realisasi),
          satuan: satuan.trim(),
          kendala: kendala.trim(),
          solusi: solusi.trim(),
          bukti_foto_url: foto.trim(),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const msg = errData.error || "Gagal menyimpan laporan realisasi!";
        setErrorMsg(msg);
        showToast?.(msg);
        return;
      }

      setAktivitas("");
      setDeadline("");
      setRealisasi(Number(assignedUserId) !== user.id ? "0" : target);
      setKendala("");
      setSolusi("");
      setFoto("");
      setErrorMsg("");
      await onSaved();
    } catch {
      const msg = "Terjadi kesalahan jaringan saat menyimpan realisasi";
      setErrorMsg(msg);
      showToast?.(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedAssigneeUser = users.find((u) => u.id === Number(assignedUserId));

  return (
    <div className="max-w-2xl mx-auto">
      <div className="dashboard-card p-6 sm:p-10 space-y-6 dark:text-slate-100">
        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800/70 text-xs font-semibold text-red-700 dark:text-red-300">
            {errorMsg}
          </div>
        )}
        {/* Header with Lightning Badge */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-slate-700/80">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold shadow-xs ${
                isDelegating ? "bg-[#DCD4FB] text-purple-900" : "bg-[#D2F27C] text-slate-900"
              }`}
            >
              {isDelegating ? <Users className="w-5 h-5" /> : <Zap className="w-5 h-5 fill-slate-900" />}
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {isDelegating ? "Delegasikan Tugas Tim" : "Input Realisasi Harian"}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
                {isDelegating
                  ? `Berikan penugasan ke ${selectedAssigneeUser?.nama || "anggota tim"} & pantau progresnya`
                  : "Catat pencapaian kerja harian untuk sinkronisasi otomatis"}
              </p>
            </div>
          </div>

          {/* Live Progress Pill */}
          <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              {isDelegating ? "Status Awal:" : "Capaian:"}
            </span>
            <span
              className={`text-xs font-extrabold tabular-nums px-2 py-0.5 rounded-full ${
                calculatedPct >= 100
                  ? "bg-[#D2F27C] text-slate-900"
                  : calculatedPct >= 75
                  ? "bg-[#DCD4FB] text-slate-900"
                  : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
              }`}
            >
              {calculatedPct}%
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Penerima Tugas Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Pelaksana / Penerima Tugas
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setAssignedUserId(String(user.id));
                  setRealisasi(target || "10");
                }}
                className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                  !isDelegating
                    ? "bg-[#D2F27C]/30 border-[#D2F27C] text-slate-900 dark:text-[#D2F27C]"
                    : "bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                }`}
              >
                <span>Tugas Saya Sendiri ({user.nama})</span>
                {!isDelegating && <Check className="w-4 h-4 text-slate-900 dark:text-[#D2F27C]" />}
              </button>

              <div className="relative">
                <CustomSelect
                  variant="form"
                  value={isDelegating ? assignedUserId : ""}
                  onChange={(val) => {
                    if (val) {
                      setAssignedUserId(val);
                      setRealisasi("0");
                    }
                  }}
                  placeholder="Delegasikan ke Rekan Tim..."
                  options={[
                    { value: "", label: "Delegasikan ke Rekan Tim..." },
                    ...users
                      .filter((u) => u.id !== user.id)
                      .map((u) => ({
                        value: String(u.id),
                        label: `${u.nama} (${u.divisi})`,
                        subLabel: `@${u.username}`,
                      })),
                  ]}
                />
              </div>
            </div>

            {isDelegating && (
              <p className="text-[11px] text-purple-700 dark:text-purple-300 font-semibold mt-1.5 flex items-center gap-1.5 bg-purple-50 dark:bg-purple-950/40 p-2 rounded-xl border border-purple-200 dark:border-purple-800/60">
                <UserCheck className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Tugas ini akan tercatat untuk <strong>{selectedAssigneeUser?.nama}</strong> dan notifikasi lonceng otomatis dikirimkan.
                </span>
              </p>
            )}
          </div>

          {/* Custom Morph Proyek Dropdown & Tanggal Picker */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Pilih Proyek Terkait
              </label>
              <CustomSelect
                value={projectId}
                onChange={setProjectId}
                options={projectOptions}
                variant="form"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Tanggal Realisasi
              </label>
              <input
                type="date"
                required
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="w-full px-4 py-3.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition cursor-pointer"
              />
            </div>
          </div>

          {/* Aktivitas */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Deskripsi Aktivitas Kerja
            </label>
            <input
              type="text"
              required
              value={aktivitas}
              onChange={(e) => setAktivitas(e.target.value)}
              placeholder="Contoh: Selesaikan redesign dashboard & implementasi styling"
              className="w-full px-4 py-3.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 transition"
            />
          </div>

          {/* 3 Col: Target, Realisasi, Satuan */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Target Harian
              </label>
              <input
                type="number"
                step="any"
                required
                min={0.1}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Realisasi Awal
              </label>
              <input
                type="number"
                step="any"
                required
                min={0}
                value={realisasi}
                onChange={(e) => setRealisasi(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Satuan
              </label>
              <input
                type="text"
                required
                value={satuan}
                onChange={(e) => setSatuan(e.target.value)}
                placeholder="Tugas / Modul / Desain"
                className="w-full px-4 py-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition"
              />
            </div>
          </div>

          {/* Deadline field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Tenggat Waktu / Deadline Tugas (Opsional)
            </label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition cursor-pointer"
            />
          </div>

          {/* Kendala & Solusi Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Kendala (Opsional)
              </label>
              <input
                type="text"
                value={kendala}
                onChange={(e) => setKendala(e.target.value)}
                placeholder="Hambatan teknis jika ada"
                className="w-full px-4 py-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Solusi / Mitigasi
              </label>
              <input
                type="text"
                value={solusi}
                onChange={(e) => setSolusi(e.target.value)}
                placeholder="Langkah perbaikan"
                className="w-full px-4 py-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition"
              />
            </div>
          </div>

          {/* Bukti Foto URL */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Link Bukti Foto / Dokumen (Opsional)
            </label>
            <input
              type="url"
              value={foto}
              onChange={(e) => setFoto(e.target.value)}
              placeholder="https://res.cloudinary.com/... atau link dokumen kerja"
              className="w-full px-4 py-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition"
            />
          </div>

          {/* Submit Action */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[50px] rounded-full bg-[#1C1D21] hover:bg-black text-white font-semibold text-sm shadow-lg shadow-black/10 active:scale-[0.98] transition flex items-center justify-center gap-2 cursor-pointer dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>
                {submitting
                  ? "Menyimpan Data..."
                  : isDelegating
                  ? "Kirim Delegasi Tugas & Notifikasi"
                  : "Simpan & Sinkronkan Realisasi"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
