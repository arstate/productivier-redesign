"use client";

import React, { useState, useMemo } from "react";
import { Zap, Check } from "lucide-react";
import { UserType, ProjectType } from "@/types";
import CustomSelect, { CustomSelectOption } from "@/components/ui/CustomSelect";

export default function InputTab({
  user,
  projects,
  onSaved,
}: {
  user: UserType;
  projects: ProjectType[];
  onSaved: () => Promise<void>;
}) {
  const [projectId, setProjectId] = useState(projects[0]?.id ? String(projects[0].id) : "");
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [aktivitas, setAktivitas] = useState("");
  const [target, setTarget] = useState("10");
  const [realisasi, setRealisasi] = useState("10");
  const [satuan, setSatuan] = useState("Tugas");
  const [kendala, setKendala] = useState("");
  const [solusi, setSolusi] = useState("");
  const [foto, setFoto] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
    setSubmitting(true);
    try {
      const res = await fetch("/api/realisasi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId ? Number(projectId) : null,
          user_id: user.id,
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
        alert(errData.error || "Gagal menyimpan laporan realisasi!");
        return;
      }

      setAktivitas("");
      setKendala("");
      setSolusi("");
      setFoto("");
      await onSaved();
    } catch {
      alert("Terjadi kesalahan jaringan saat menyimpan realisasi");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="intellecta-card p-6 sm:p-10 space-y-6 dark:text-slate-100">
        {/* Header with Lightning Badge */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-slate-700/80">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#D2F27C] text-slate-900 flex items-center justify-center font-bold shadow-xs">
              <Zap className="w-5 h-5 fill-slate-900" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                Input Realisasi Harian
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
                Catat pencapaian kerja harian untuk sinkronisasi otomatis
              </p>
            </div>
          </div>

          {/* Live Progress Pill */}
          <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Capaian:</span>
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
              placeholder="Contoh: Selesaikan redesign bento dashboard & implementasi styling"
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
                Realisasi
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
              <span>{submitting ? "Menyimpan Realisasi..." : "Simpan & Sinkronkan Realisasi"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
