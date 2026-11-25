"use client";

import React from "react";
import { m, AnimatePresence } from "motion/react";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = "Ya, Lanjutkan",
  cancelLabel = "Batal",
  variant = "danger",
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => !loading && onCancel()}
          className="fixed inset-0 z-[85] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <m.div
            initial={{ opacity: 0, scale: 0.94, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 10 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md dashboard-card p-6 shadow-2xl space-y-4 border border-slate-200/80 dark:border-slate-700/80 dark:text-slate-100"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-2xl grid place-items-center shrink-0 ${
                    variant === "danger"
                      ? "bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400"
                      : "bg-[#D2F27C] text-slate-900"
                  }`}
                >
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white leading-snug">
                  {title}
                </h3>
              </div>
              <button
                type="button"
                disabled={loading}
                onClick={onCancel}
                className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 grid place-items-center text-slate-400 cursor-pointer shrink-0"
                aria-label="Tutup dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {message}
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={loading}
                onClick={onCancel}
                className="min-h-[40px] px-4 py-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={onConfirm}
                className={`min-h-[40px] px-5 py-2 rounded-full text-xs font-bold transition active:scale-95 cursor-pointer disabled:opacity-50 ${
                  variant === "danger"
                    ? "bg-red-600 hover:bg-red-700 text-white shadow-sm"
                    : "bg-[#1C1D21] hover:bg-black text-white dark:bg-white dark:text-slate-900"
                }`}
              >
                {loading ? "Memproses..." : confirmLabel}
              </button>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
