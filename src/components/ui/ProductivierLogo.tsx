"use client";

import React from "react";

interface ProductivierLogoProps {
  size?: number;
  className?: string;
  variant?: "gradient" | "monochrome" | "lime";
}

export default function ProductivierLogo({
  size = 32,
  className = "",
  variant = "gradient",
}: ProductivierLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-label="Productivier Logo"
    >
      <defs>
        {/* Subtle Drop Shadow */}
        <filter id="p-shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#18181B" floodOpacity="0.12" />
        </filter>

        {/* Outer Ring Gradient */}
        <linearGradient id="p-gradient-dark" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1C1D21" />
          <stop offset="100%" stopColor="#0B0C0E" />
        </linearGradient>

        {/* Lime Accent Gradient */}
        <linearGradient id="p-gradient-lime" x1="12" y1="10" x2="38" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E4FA8A" />
          <stop offset="100%" stopColor="#C4EE55" />
        </linearGradient>

        {/* Purple Lavender Gradient */}
        <linearGradient id="p-gradient-lavender" x1="20" y1="20" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E9E3FD" />
          <stop offset="100%" stopColor="#C9BFF9" />
        </linearGradient>
      </defs>

      {/* Outer Rounded Container Squircle */}
      <rect
        x="2"
        y="2"
        width="44"
        height="44"
        rx="14"
        fill={variant === "lime" ? "url(#p-gradient-lime)" : "url(#p-gradient-dark)"}
        stroke={variant === "lime" ? "#FFFFFF" : "rgba(255,255,255,0.15)"}
        strokeWidth="1.5"
      />

      {/* Kinetic Geometric "P" & Infinity Flow Path */}
      {/* Stem of P */}
      <rect
        x="12"
        y="12"
        width="5.5"
        height="24"
        rx="2.75"
        fill={variant === "lime" ? "#18181B" : "#FFFFFF"}
      />

      {/* Upper Loop of P */}
      <path
        d="M 14.75 12 H 26 C 31.5228 12 36 16.4772 36 22 C 36 27.5228 31.5228 32 26 32 H 14.75"
        stroke={variant === "lime" ? "#18181B" : "url(#p-gradient-lime)"}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Central Kinetic Dynamic Catalyst Diamond */}
      <path
        d="M 26 18 L 30 22 L 26 26 L 22 22 Z"
        fill={variant === "lime" ? "#FFFFFF" : "#D2F27C"}
        stroke={variant === "lime" ? "#18181B" : "#000000"}
        strokeWidth="1"
      />

      {/* Secondary Pulse Dot: Clean Slate Precision Indicator */}
      <circle
        cx="33"
        cy="15"
        r="2.5"
        fill={variant === "lime" ? "#18181B" : "#DCD4FB"}
      />
    </svg>
  );
}
