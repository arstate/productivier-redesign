import React from "react";

interface AIMascotProps {
  size?: number;
  className?: string;
  alt?: string;
}

/**
 * AIMascot renders the official vector mascot with guaranteed 1:1 aspect ratio,
 * preventing any squishing, warping, or distortion across all devices and themes.
 */
export const AIMascot: React.FC<AIMascotProps> = ({
  size = 24,
  className = "",
  alt = "Miu AI Mascot",
}) => {
  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 overflow-hidden select-none ${className}`}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        aspectRatio: "1 / 1",
      }}
    >
      {/* SVG statis: next/image tidak memberi manfaat optimasi di sini. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/mascot-ai.svg"
        alt={alt}
        width={size}
        height={size}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          aspectRatio: "1 / 1",
        }}
        className="select-none pointer-events-none drop-shadow-xs"
        loading="eager"
        decoding="async"
      />
    </span>
  );
};

export default AIMascot;
