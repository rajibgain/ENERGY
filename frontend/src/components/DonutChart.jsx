import { useState, useEffect } from 'react';

const DEFAULT_SEGMENTS = [
  { label: 'Solar', value: 42, color: '#00ff88' },
  { label: 'Grid', value: 31, color: '#ffb800' },
  { label: 'Wind', value: 18, color: '#00f3ff' },
  { label: 'Battery', value: 9, color: '#a78bfa' },
];

export default function DonutChart({
  segments = DEFAULT_SEGMENTS,
  size = 200,
  strokeWidth = 24,
}) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const gap = 4; // gap in degrees between segments
  const totalGapDeg = gap * segments.length;
  const availableDeg = 360 - totalGapDeg;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ transform: 'rotate(-90deg)' }}
        >
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.03)"
            strokeWidth={strokeWidth}
          />

          {/* Segments */}
          {segments.map((seg, i) => {
            const segDeg = (seg.value / total) * availableDeg;
            const segLen = (segDeg / 360) * circumference;
            const precedingDegrees = segments.slice(0, i).reduce(
              (sum, item) => sum + (item.value / total) * availableDeg + gap,
              0,
            );

            return (
              <circle
                key={seg.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                className="donut-segment"
                stroke={seg.color}
                strokeWidth={hoveredIndex === i ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={`${segLen} ${circumference - segLen}`}
                strokeDashoffset={-(precedingDegrees / 360) * circumference}
                style={{
                  opacity: mounted ? (hoveredIndex !== null && hoveredIndex !== i ? 0.4 : 1) : 0,
                  transition: `stroke-dashoffset 1.2s cubic-bezier(0.16,1,0.3,1) ${i * 150}ms, opacity 0.3s ease, stroke-width 0.3s ease`,
                  filter: hoveredIndex === i ? `drop-shadow(0 0 8px ${seg.color}60)` : 'none',
                  cursor: 'pointer',
                }}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            );
          })}
        </svg>

        {/* Center */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {hoveredIndex !== null ? (
            <>
              <span className="text-xl font-extralight text-white/90" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {segments[hoveredIndex].value}%
              </span>
              <span className="text-[9px] tracking-[0.15em] uppercase mt-1"
                style={{ color: segments[hoveredIndex].color }}>
                {segments[hoveredIndex].label}
              </span>
            </>
          ) : (
            <>
              <span className="text-xl font-extralight text-white/90" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {total}%
              </span>
              <span className="text-[9px] tracking-[0.15em] uppercase text-white/30 mt-1">
                Total
              </span>
            </>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 mt-4">
        {segments.map((seg, i) => (
          <div
            key={seg.label}
            className="flex items-center gap-1.5 cursor-pointer"
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: seg.color }}
            />
            <span className="text-[9px] tracking-[0.15em] uppercase text-white/40">
              {seg.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
