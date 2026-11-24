"use client";

import React, { useState } from "react";
import { Share2, Check } from "lucide-react";

interface CopyPortalButtonProps {
  projectName?: string;
  projectId: number;
}

export default function CopyPortalButton({ projectId }: CopyPortalButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (typeof window !== "undefined") {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      // Fallback if clipboard API is restricted
      try {
        const dummy = document.createElement("input");
        document.body.appendChild(dummy);
        dummy.value = window.location.href;
        dummy.select();
        document.execCommand("copy");
        document.body.removeChild(dummy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {
        // Ignored
      }
    }
  };

  return (
    <button
      onClick={handleCopy}
      type="button"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200/80 transition cursor-pointer active:scale-95 shrink-0"
      title="Salin tautan portal proyek ini untuk dibagikan ke manajemen"
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-emerald-600" />
          <span className="text-emerald-700 font-extrabold">Tersalin!</span>
        </>
      ) : (
        <>
          <Share2 className="w-3.5 h-3.5 text-slate-500" />
          <span className="hidden sm:inline">Salin Tautan</span>
        </>
      )}
    </button>
  );
}
