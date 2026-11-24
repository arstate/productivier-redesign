"use client";

import React, { useState, useMemo } from "react";
import { ArrowUpRight, Flame, TrendingUp } from "lucide-react";

interface FocusDayPoint {
  dayShort: string;
  dayFull: string;
  dateLabel: string;
  score: number; // 0 to 300 Pts
  efficiency: number; // 0 to 100%
  status: string;
  isToday?: boolean;
}

interface PersonalFocusChartProps {
  tren7Hari?: Array<{
    tanggal: string;
    jumlah_laporan: number;
    rata_persen: number;
  }>;
  onGoReports?: () => void;
}

const generateDynamic7Days = (
  tren7Hari?: Array<{
    tanggal: string;
    jumlah_laporan: number;
    rata_persen: number;
  }>
): FocusDayPoint[] => {
  const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  const fullNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const now = new Date();
  const points: FocusDayPoint[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayIdx = d.getDay();
    const dateNum = d.getDate();
    const monthStr = months[d.getMonth()];
    const isToday = i === 0;

    const matched = tren7Hari?.find((t) => t.tanggal === dateStr);
    let eff = matched
      ? Math.min(100, Math.round(matched.rata_persen || 0))
      : isToday
      ? 75
      : 65 + ((6 - i) * 3);
    if (matched && matched.jumlah_laporan === 0) eff = 0;
    const score = Math.round((eff / 100) * 280);
    const status =
      eff >= 85 ? "🔥 Fokus Tinggi" : eff >= 70 ? "⚡ Produktif" : eff > 0 ? "✓ Stabil" : "Belum Ada Laporan";

    points.push({
      dayShort: dayNames[dayIdx],
      dayFull: fullNames[dayIdx],
      dateLabel: `${dateNum} ${monthStr}`,
      score,
      efficiency: eff,
      status,
      isToday,
    });
  }

  return points;
};

export default function PersonalFocusChart({
  tren7Hari,
  onGoReports,
}: PersonalFocusChartProps) {
  const dataPoints: FocusDayPoint[] = useMemo(() => {
    return generateDynamic7Days(tren7Hari);
  }, [tren7Hari]);

  // Default hovered index is today (last point)
  const [activeIdx, setActiveIdx] = useState<number>(dataPoints.length - 1);

  const activePoint = dataPoints[activeIdx] || dataPoints[dataPoints.length - 1];

  // SVG Coordinate System (viewBox: 0 0 600 150)
  // Edge-to-edge horizontally (from x=24 to x=576) with zero dead margins
  const width = 600;
  const height = 150;
  const padX = 24;
  const padTop = 18;
  const padBottom = 14;
  const usableWidth = width - padX * 2;
  const usableHeight = height - padTop - padBottom;
  const maxVal = 300; // Y-axis from 0 (bottom) to 300 (top)

  const coords = useMemo(() => {
    return dataPoints.map((pt, i) => {
      const x = padX + (i / (dataPoints.length - 1)) * usableWidth;
      const clampedScore = Math.max(0, Math.min(maxVal, pt.score));
      const y = padTop + usableHeight - (clampedScore / maxVal) * usableHeight;
      return { x, y, pt };
    });
  }, [dataPoints, usableWidth, usableHeight]);

  // Generate smooth cubic bezier spline path
  const linePath = useMemo(() => {
    if (coords.length === 0) return "";
    if (coords.length === 1) return `M ${coords[0].x} ${coords[0].y}`;

    let d = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const curr = coords[i];
      const next = coords[i + 1];
      const cpX = (curr.x + next.x) / 2;
      d += ` C ${cpX.toFixed(1)} ${curr.y.toFixed(1)}, ${cpX.toFixed(1)} ${next.y.toFixed(1)}, ${next.x.toFixed(1)} ${next.y.toFixed(1)}`;
    }
    return d;
  }, [coords]);

  const areaPath = useMemo(() => {
    if (!linePath || coords.length === 0) return "";
    const last = coords[coords.length - 1];
    const first = coords[0];
    const bottomY = padTop + usableHeight;
    return `${linePath} L ${last.x.toFixed(1)} ${bottomY} L ${first.x.toFixed(1)} ${bottomY} Z`;
  }, [linePath, coords, usableHeight]);

  const activeCoord = coords[activeIdx] || coords[coords.length - 1];

  return (
    <article className="lg:col-span-7 intellecta-card p-6 flex flex-col justify-between min-h-[310px] dark:text-slate-100">
      {/* Header Row with Today's Metric & Trend */}
      <div className="flex items-start justify-between pb-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-bold text-lg text-[#18181B] dark:text-white">
              Summary Energi Diri
            </h2>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#D2F27C]/40 text-slate-900 dark:text-[#D2F27C] text-[10px] font-extrabold">
              <TrendingUp className="w-3 h-3" />
              <span>+14% vs Minggu Lalu</span>
            </span>
          </div>
          <p className="text-xs text-[#71717A] dark:text-slate-400 mt-0.5">
            Skor Fokus Harian (0–300 Pts) ·{" "}
            <strong className="text-slate-900 dark:text-white">
              Hari Ini: {dataPoints[dataPoints.length - 1]?.score || 203} Pts
            </strong>
          </p>
        </div>

        <button
          type="button"
          onClick={onGoReports}
          aria-label="Laporan"
          title="Lihat Laporan Lengkap"
          className="w-9 h-9 rounded-full bg-white dark:bg-slate-800 text-[#18181B] dark:text-white border border-black/5 dark:border-white/10 shadow-xs grid place-items-center hover:bg-gray-50 dark:hover:bg-slate-700 transition cursor-pointer shrink-0"
        >
          <ArrowUpRight className="w-4 h-4" />
        </button>
      </div>

      {/* Interactive Chart Area */}
      <div className="flex-1 flex flex-col justify-end pt-3 relative">
        <div className="flex items-stretch gap-2">
          {/* Y-Axis Labels (Correct Mathematical Order: 300 Top, 150 Mid, 0 Bottom) */}
          <div className="flex flex-col justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500 tabular-nums py-2 select-none shrink-0 w-7 text-right">
            <span>300</span>
            <span>150</span>
            <span>0</span>
          </div>

          {/* Main SVG Canvas + Dynamic Floating Tooltip */}
          <div className="flex-1 relative">
            {/* Dynamic Hover Tooltip */}
            {activeCoord && (
              <div
                className="absolute z-20 pointer-events-none transition-all duration-150 ease-out"
                style={{
                  left: `${(activeCoord.x / width) * 100}%`,
                  top: `${Math.max(0, (activeCoord.y / height) * 100 - 10)}%`,
                  transform:
                    activeIdx === 0
                      ? "translate(-15%, -100%)"
                      : activeIdx === coords.length - 1
                      ? "translate(-85%, -100%)"
                      : "translate(-50%, -100%)",
                }}
              >
                <div className="bg-[#18181B] dark:bg-white text-white dark:text-slate-900 px-3 py-1.5 rounded-xl shadow-lg text-[11px] whitespace-nowrap border border-white/10 dark:border-black/10">
                  <div className="font-extrabold flex items-center gap-1.5">
                    <span>{activePoint.score} Pts</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-md bg-[#D2F27C] text-slate-900">
                      {activePoint.efficiency}%
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-300 dark:text-slate-600 font-medium mt-0.5">
                    {activePoint.dayFull}, {activePoint.dateLabel} · {activePoint.status}
                  </div>
                </div>
              </div>
            )}

            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-36 overflow-visible select-none"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="focusAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#D2F27C" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#D2F27C" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid Lines (0, 150, 300) */}
              <line
                x1={padX}
                y1={padTop}
                x2={width - padX}
                y2={padTop}
                stroke="currentColor"
                strokeOpacity="0.07"
                strokeDasharray="4 4"
              />
              <line
                x1={padX}
                y1={padTop + usableHeight / 2}
                x2={width - padX}
                y2={padTop + usableHeight / 2}
                stroke="currentColor"
                strokeOpacity="0.07"
                strokeDasharray="4 4"
              />
              <line
                x1={padX}
                y1={padTop + usableHeight}
                x2={width - padX}
                y2={padTop + usableHeight}
                stroke="currentColor"
                strokeOpacity="0.12"
              />

              {/* Vertical Guide Line for Active Hovered Point */}
              {activeCoord && (
                <line
                  x1={activeCoord.x}
                  y1={padTop}
                  x2={activeCoord.x}
                  y2={padTop + usableHeight}
                  stroke="currentColor"
                  strokeOpacity="0.18"
                  strokeDasharray="3 3"
                />
              )}

              {/* Gradient Fill Under Curve */}
              <path d={areaPath} fill="url(#focusAreaGrad)" />

              {/* Smooth Spline Curve */}
              <path
                d={linePath}
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                className="text-slate-900 dark:text-[#D2F27C]"
              />

              {/* Data Points + Invisible Wide Hover Hitboxes */}
              {coords.map((c, idx) => {
                const isActive = idx === activeIdx;
                return (
                  <g
                    key={idx}
                    className="cursor-pointer"
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() => setActiveIdx(idx)}
                  >
                    {/* Wide invisible hitbox for easy hovering */}
                    <rect
                      x={c.x - 28}
                      y={0}
                      width={56}
                      height={height}
                      fill="transparent"
                    />
                    {isActive && (
                      <circle
                        cx={c.x}
                        cy={c.y}
                        r="8"
                        fill="#D2F27C"
                        fillOpacity="0.35"
                      />
                    )}
                    <circle
                      cx={c.x}
                      cy={c.y}
                      r={isActive ? "5" : "3.5"}
                      fill={isActive ? "#D2F27C" : "#FFFFFF"}
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-slate-900 dark:text-slate-900 transition-all duration-150"
                    />
                  </g>
                );
              })}
            </svg>

            {/* Structured X-Axis 7 Days Labels */}
            <div className="flex items-center justify-between px-2 pt-1.5">
              {dataPoints.map((pt, idx) => {
                const isActive = idx === activeIdx;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveIdx(idx)}
                    onMouseEnter={() => setActiveIdx(idx)}
                    className={`flex flex-col items-center px-2 py-1 rounded-xl transition cursor-pointer ${
                      isActive
                        ? "bg-[#18181B] text-white dark:bg-white dark:text-slate-900 shadow-xs"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <span className="text-[11px] font-extrabold leading-none">
                      {pt.dayShort}
                    </span>
                    <span className="text-[9px] font-medium opacity-75 mt-0.5 leading-none">
                      {pt.dateLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
