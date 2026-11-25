"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  FileText,
  Search,
  TrendingUp,
  LayoutGrid,
  Copy,
  Download,
  ExternalLink,
  Edit3,
  Trash2,
  X,
} from "lucide-react";
import { ProjectType, RealisasiType, UserType } from "@/types";
import CustomSelect, { CustomSelectOption } from "@/components/ui/CustomSelect";
import ConfirmModal from "@/components/ui/ConfirmModal";

export default function ReportsTab({
  realisasi,
  projects,
  user,
  showToast,
  onRefresh,
}: {
  realisasi: RealisasiType[];
  projects: ProjectType[];
  user?: UserType;
  showToast: (m: string) => void;
  onRefresh?: () => void;
}) {
  const [filterQuery, setFilterQuery] = useState("");
  const [selectedDivisi, setSelectedDivisi] = useState<string>("all");

  // Edit Modal State
  const [editingItem, setEditingItem] = useState<RealisasiType | null>(null);
  const [editAktivitas, setEditAktivitas] = useState("");
  const [editTarget, setEditTarget] = useState<number>(1);
  const [editRealisasi, setEditRealisasi] = useState<number>(1);
  const [editKendala, setEditKendala] = useState("");
  const [editSolusi, setEditSolusi] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const divisions = useMemo(() => {
    const set = new Set<string>();
    realisasi.forEach((r) => {
      if (r.divisi) set.add(r.divisi);
    });
    return Array.from(set);
  }, [realisasi]);

  const divisiOptions: CustomSelectOption[] = [
    { value: "all", label: "Semua Divisi" },
    ...divisions.map((d) => ({ value: d, label: d })),
  ];

  const filteredData = useMemo(() => {
    return realisasi.filter((r) => {
      const matchText =
        r.aktivitas.toLowerCase().includes(filterQuery.toLowerCase()) ||
        r.nama.toLowerCase().includes(filterQuery.toLowerCase()) ||
        (r.nama_proyek && r.nama_proyek.toLowerCase().includes(filterQuery.toLowerCase()));
      const matchDivisi = selectedDivisi === "all" || r.divisi === selectedDivisi;
      return matchText && matchDivisi;
    });
  }, [realisasi, filterQuery, selectedDivisi]);

  const averageCapaian = useMemo(() => {
    if (filteredData.length === 0) return 0;
    return Math.round(filteredData.reduce((acc, curr) => acc + curr.persentase, 0) / filteredData.length);
  }, [filteredData]);

  const triggerRefresh = () => {
    window.dispatchEvent(new CustomEvent("productivier:refresh_data"));
    if (onRefresh) onRefresh();
  };

  const openEditModal = (item: RealisasiType) => {
    setEditingItem(item);
    setEditAktivitas(item.aktivitas);
    setEditTarget(item.target);
    setEditRealisasi(item.realisasi);
    setEditKendala(item.kendala || "");
    setEditSolusi(item.solusi || "");
  };

  const handleUpdateRealisasi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/realisasi/${editingItem.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(user?.id ? { "x-user-id": String(user.id) } : {}),
        },
        body: JSON.stringify({
          aktivitas: editAktivitas.trim(),
          target: Number(editTarget),
          realisasi: Number(editRealisasi),
          kendala: editKendala.trim(),
          solusi: editSolusi.trim(),
        }),
      });

      if (res.ok) {
        showToast("Laporan realisasi berhasil diperbarui!");
        setEditingItem(null);
        triggerRefresh();
      } else {
        const data = await res.json();
        showToast(data.error || "Gagal memperbarui realisasi");
      }
    } catch {
      showToast("Terjadi kesalahan jaringan");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRealisasi = (id: number) => {
    setDeleteTargetId(id);
  };

  const executeDeleteRealisasi = async () => {
    if (deleteTargetId === null) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/realisasi/${deleteTargetId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        showToast("Laporan realisasi berhasil dihapus");
        setDeleteTargetId(null);
        triggerRefresh();
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "Gagal menghapus realisasi");
      }
    } catch {
      showToast("Terjadi kesalahan jaringan");
    } finally {
      setDeleting(false);
    }
  };

  const copyWA = () => {
    if (filteredData.length === 0) {
      showToast("Tidak ada data untuk disalin");
      return;
    }
    const lines = filteredData
      .slice(0, 15)
      .map(
        (r) =>
          `- ${r.tanggal} | ${r.nama}: ${r.aktivitas} (${r.realisasi}/${r.target} ${r.satuan} = ${r.persentase}%)`
      );
    const text = `*REKAP REALISASI TIM*\n${lines.join("\n")}`;
    navigator.clipboard.writeText(text);
    showToast("Rekap WA berhasil disalin ke clipboard!");
  };

  const downloadCSV = () => {
    if (filteredData.length === 0) {
      showToast("Tidak ada data untuk diunduh");
      return;
    }
    const headers = [
      "Tanggal",
      "Nama",
      "Divisi",
      "Proyek",
      "Aktivitas",
      "Target",
      "Realisasi",
      "Satuan",
      "Persentase",
      "Status",
      "Kendala",
      "Solusi",
      "Bukti_Foto",
    ];
    const rows = filteredData.map((r) => [
      r.tanggal,
      r.nama,
      r.divisi,
      r.nama_proyek || "-",
      r.aktivitas,
      r.target,
      r.realisasi,
      r.satuan,
      `${r.persentase}%`,
      r.status,
      r.kendala || "-",
      r.solusi || "-",
      r.bukti_foto_url || "-",
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `laporan_productivier_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast("CSV berhasil diunduh");
  };

  return (
    <div className="space-y-6">
      {/* Top Mini KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="dashboard-card p-5 flex items-center justify-between dark:text-slate-100">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
              Total Entri Realisasi
            </span>
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">
              {filteredData.length}
            </span>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="dashboard-card p-5 flex items-center justify-between dark:text-slate-100">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
              Rata-rata Capaian
            </span>
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">
              {averageCapaian}%
            </span>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-[#D2F27C]/30 flex items-center justify-center text-slate-900 dark:text-[#D2F27C]">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="dashboard-card p-5 flex items-center justify-between dark:text-slate-100">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block">
              Proyek Dipantau
            </span>
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums">
              {projects.length}
            </span>
          </div>
          <div className="w-10 h-10 rounded-2xl bg-[#DCD4FB]/30 flex items-center justify-center text-slate-900 dark:text-[#DCD4FB]">
            <LayoutGrid className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="dashboard-card p-6 sm:p-8 space-y-5 dark:text-slate-100">
        {/* Toolbar Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200/80 dark:border-slate-700/80">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">Laporan &amp; Rekap Realisasi</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Arsip data pencapaian tugas harian seluruh anggota tim
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari aktivitas / nama..."
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="pl-8 pr-3 py-2 rounded-full bg-slate-100/80 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:bg-white dark:focus:bg-slate-900 focus:outline-none w-40 sm:w-48"
              />
            </div>

            {/* Custom Morph Division Filter */}
            {divisions.length > 0 && (
              <div className="w-36 sm:w-44">
                <CustomSelect
                  value={selectedDivisi}
                  onChange={setSelectedDivisi}
                  options={divisiOptions}
                  variant="pill"
                />
              </div>
            )}

            {/* Copy WA Button */}
            <button
              onClick={copyWA}
              className="px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy WA</span>
            </button>

            {/* CSV Export Button */}
            <button
              onClick={downloadCSV}
              className="px-5 py-2 rounded-full bg-[#1C1D21] hover:bg-black text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition active:scale-95 cursor-pointer dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              <Download className="w-3.5 h-3.5 text-[#D2F27C] dark:text-slate-900" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <th className="py-3 px-3">Tanggal</th>
                <th className="py-3 px-3">Nama</th>
                <th className="py-3 px-3">Divisi</th>
                <th className="py-3 px-3">Proyek</th>
                <th className="py-3 px-3">Aktivitas</th>
                <th className="py-3 px-3 text-right">Target</th>
                <th className="py-3 px-3 text-right">Realisasi</th>
                <th className="py-3 px-3 text-right">Capaian</th>
                <th className="py-3 px-3 text-center">Bukti</th>
                <th className="py-3 px-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredData.map((r) => {
                const isOver = r.persentase >= 100;
                return (
                  <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-3 px-3 tabular-nums text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
                      {r.tanggal}
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      {r.nama}
                    </td>
                    <td className="py-3 px-3 text-slate-500 dark:text-slate-400">{r.divisi}</td>
                    <td className="py-3 px-3">
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-medium whitespace-nowrap">
                        {r.nama_proyek || "Umum"}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-800 dark:text-slate-200 min-w-[200px]">
                      <div>
                        <span>{r.aktivitas}</span>
                        {(r.assigner_nama || r.deadline) && (
                          <div className="flex items-center gap-1.5 flex-wrap mt-1">
                            {r.assigner_nama && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
                                Didelegasikan oleh {r.assigner_nama}
                              </span>
                            )}
                            {r.deadline && (
                              <span className="text-[10px] text-slate-400">
                                📅 Deadline: {r.deadline}
                              </span>
                            )}
                          </div>
                        )}
                        {(r.kendala || r.solusi) && (
                          <div className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                            {r.kendala && <span>⚠️ Kendala: {r.kendala}</span>}
                            {r.solusi && <span className="ml-2">💡 Solusi: {r.solusi}</span>}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums text-slate-500 dark:text-slate-400">
                      {r.target} {r.satuan}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums font-semibold text-slate-800 dark:text-slate-200">
                      {r.realisasi} {r.satuan}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full font-bold tabular-nums text-xs ${
                          isOver
                            ? "bg-[#D2F27C] text-slate-900"
                            : r.persentase >= 75
                            ? "bg-[#DCD4FB] text-slate-900"
                            : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {r.persentase}%
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {r.bukti_foto_url ? (
                        <a
                          href={r.bukti_foto_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#526600] dark:text-[#D2F27C] hover:underline"
                        >
                          Foto <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => openEditModal(r)}
                          className="p-1.5 rounded-lg hover:bg-slate-200/70 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                          title="Edit Laporan Realisasi"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteRealisasi(r.id)}
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-400 hover:text-red-600 transition cursor-pointer"
                          title="Hapus Laporan Realisasi"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredData.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 text-xs">
                    Belum ada riwayat laporan realisasi yang cocok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Realisasi Modal */}
      <AnimatePresence>
        {editingItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setEditingItem(null)}
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
                    Edit Laporan Realisasi
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Koreksi data aktivitas, capaian target, atau kendala kerja
                  </p>
                </div>
                <button
                  onClick={() => setEditingItem(null)}
                  className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-400 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleUpdateRealisasi} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Nama Aktivitas Kerja
                  </label>
                  <input
                    type="text"
                    required
                    value={editAktivitas}
                    onChange={(e) => setEditAktivitas(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Target ({editingItem.satuan})
                    </label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={editTarget}
                      onChange={(e) => setEditTarget(Number(e.target.value))}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Realisasi ({editingItem.satuan})
                    </label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={editRealisasi}
                      onChange={(e) => setEditRealisasi(Number(e.target.value))}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Kendala / Blocker (Opsional)
                  </label>
                  <textarea
                    rows={2}
                    value={editKendala}
                    onChange={(e) => setEditKendala(e.target.value)}
                    placeholder="Contoh: Render video sempat tertunda karena bug..."
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                    Solusi / Rencana Penanganan (Opsional)
                  </label>
                  <textarea
                    rows={2}
                    value={editSolusi}
                    onChange={(e) => setEditSolusi(e.target.value)}
                    placeholder="Contoh: Optimasi bitrate & cache encode..."
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none transition resize-none"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full min-h-[46px] rounded-full bg-[#1C1D21] hover:bg-black text-white font-semibold text-sm shadow-md active:scale-[0.98] transition flex items-center justify-center gap-2 cursor-pointer dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                  >
                    <span>{saving ? "Menyimpan Perubahan..." : "Simpan Perubahan Laporan"}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={deleteTargetId !== null}
        title="Hapus Laporan Realisasi"
        message="Yakin ingin menghapus catatan laporan realisasi ini? Data progres proyek akan diperbarui otomatis."
        confirmLabel="Hapus Laporan"
        loading={deleting}
        onConfirm={executeDeleteRealisasi}
        onCancel={() => !deleting && setDeleteTargetId(null)}
      />
    </div>
  );
}
