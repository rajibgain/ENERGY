import { useState, useEffect, useRef } from 'react';

export default function RadialGauge({
  value = 0,
  max = 100,
  label = '',
  sublabel = '',
  size = 160,
  strokeWidth = 10,
  color = '#00f3ff',
  glowColor,
  icon: Icon,
  delay = 0,
}) {
  const [animatedValue, setAnimatedValue] = useState(0);
  const raf = useRef(null);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.min(value / max, 1);
  const offset = circumference * (1 - percentage);
  const glow = glowColor || color;

  // Animate counter
  useEffect(() => {
    const start = performance.now();
    const dur = 1500;
    const from = 0;
    const to = value;
    const delayMs = delay;

    const timeout = setTimeout(() => {
      const animate = (now) => {
        const t = Math.min((now - start - delayMs) / dur, 1);
        if (t < 0) { raf.current = requestAnimationFrame(animate); return; }
        const ease = 1 - Math.pow(1 - t, 3);
        setAnimatedValue(from + (to - from) * ease);
        if (t < 1) raf.current = requestAnimationFrame(animate);
      };
      raf.current = requestAnimationFrame(animate);
    }, delayMs);

    return () => {
      clearTimeout(timeout);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [value, delay]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-90"
        >
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            className="gauge-track"
            strokeWidth={strokeWidth}
          />
          {/* Colored fill */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            className="gauge-fill"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{
              '--gauge-circumference': circumference,
              '--gauge-offset': offset,
              '--gauge-glow': `${glow}40`,
              animationDelay: `${delay}ms`,
            }}
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {Icon && <Icon size={16} style={{ color }} className="mb-1 opacity-60" strokeWidth={1.5} />}
          <span
            className="text-2xl font-extralight text-white/90"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {Math.round(animatedValue)}
          </span>
          <span className="text-[9px] tracking-[0.15em] uppercase text-white/30">%</span>
        </div>
      </div>

      {/* Label */}
      <div className="text-center">
        <p className="text-[10px] tracking-[0.2em] uppercase text-white/50 font-medium">{label}</p>
        {sublabel && (
          <p className="text-[9px] tracking-[0.1em] text-white/25 mt-0.5">{sublabel}</p>
        )}
      </div>
    </div>
  );
}
