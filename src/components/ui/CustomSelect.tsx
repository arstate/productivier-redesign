"use client";

import React, { useState, useRef, useEffect } from "react";
import { m, AnimatePresence } from "motion/react";
import { ChevronDown, Check } from "lucide-react";

export type CustomSelectOption = {
  value: string;
  label: string;
  subLabel?: string;
  badge?: string;
  badgeColor?: string;
  icon?: React.ReactNode;
};

interface CustomSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
  className?: string;
  align?: "left" | "right";
  variant?: "pill" | "form";
  disabled?: boolean;
}

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Pilih opsi...",
  className = "",
  align = "left",
  variant = "pill",
  disabled = false,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const isPill = variant === "pill";

  return (
    <div ref={containerRef} className={`relative select-none ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2.5 transition-all cursor-pointer outline-none ${
          isPill
            ? "px-3.5 py-1.5 rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border border-white/60 dark:border-white/10 text-xs font-semibold text-slate-800 dark:text-slate-100 shadow-xs hover:bg-white dark:hover:bg-slate-800 focus:ring-2 focus:ring-slate-900/10"
            : "px-4 py-3 rounded-2xl bg-slate-100/80 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-slate-900/10"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <div className="flex items-center gap-2 truncate text-left">
          {selectedOption?.icon && (
            <span className="shrink-0 text-slate-500">{selectedOption.icon}</span>
          )}
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span
              className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                selectedOption.badgeColor || "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
              }`}
            >
              {selectedOption.badge}
            </span>
          )}
        </div>

        {/* Morphing Animated Chevron */}
        <m.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="shrink-0 text-slate-400 dark:text-slate-500"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </m.div>
      </button>

      {/* Morphing Animated Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <m.div
            role="listbox"
            initial={{ opacity: 0, scale: 0.94, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -6 }}
            transition={{ type: "spring", stiffness: 480, damping: 28 }}
            className={`absolute top-full mt-1.5 z-[80] p-1.5 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-black/5 dark:border-white/10 shadow-[0_10px_35px_-5px_rgba(24,24,27,0.12)] ${
              isPill
                ? `min-w-[200px] max-w-xs sm:max-w-sm w-max ${align === "right" ? "right-0" : "left-0"}`
                : "w-full left-0 right-0"
            } max-h-64 overflow-y-auto`}
          >
            <div className="space-y-0.5">
              {options.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-[#18181B] text-white dark:bg-white dark:text-slate-900 font-bold"
                        : "text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800 font-medium"
                    } ${isPill ? "text-xs" : "text-xs sm:text-sm"}`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                      <div className="truncate">
                        <span className="block truncate">{opt.label}</span>
                        {opt.subLabel && (
                          <span
                            className={`block text-[10px] truncate ${
                              isSelected
                                ? "text-slate-300 dark:text-slate-600"
                                : "text-slate-400 dark:text-slate-500"
                            }`}
                          >
                            {opt.subLabel}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {opt.badge && (
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-[11px] font-bold ${
                            isSelected
                              ? "bg-white/20 text-white dark:bg-slate-800 dark:text-white"
                              : opt.badgeColor || "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                          }`}
                        >
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
