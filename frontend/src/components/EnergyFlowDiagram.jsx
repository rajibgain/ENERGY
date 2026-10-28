import { useEffect, useState } from 'react';

export default function EnergyFlowDiagram({ wastedKwh = 0 }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 300);
    return () => clearTimeout(t);
  }, []);

  const isGenerating = wastedKwh < 50;
  const solarColor = '#00ff88';
  const buildingColor = '#00f3ff';
  const gridColor = '#ffb800';

  return (
    <div className="w-full h-full flex flex-col">
      <div className="mb-4">
        <p className="text-[10px] tracking-[0.3em] uppercase text-white/30 mb-1">Live</p>
        <h3 className="text-sm font-extralight text-white/80 tracking-wide uppercase">
          Energy Flow
        </h3>
      </div>

      <div className="flex-1 relative min-h-[180px]">
        <svg viewBox="0 0 400 180" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="flowGradSolar" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={solarColor} stopOpacity="0.6" />
              <stop offset="100%" stopColor={buildingColor} stopOpacity="0.6" />
            </linearGradient>
            <linearGradient id="flowGradGrid" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={buildingColor} stopOpacity="0.6" />
              <stop offset="100%" stopColor={gridColor} stopOpacity="0.6" />
            </linearGradient>

            {/* Animated dot filter */}
            <filter id="dotGlow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* === Node: Solar Panel === */}
          <g style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.8s ease 0.2s' }}>
            <rect x="10" y="55" width="80" height="70" rx="16" fill="rgba(0,255,136,0.06)" stroke="rgba(0,255,136,0.15)" strokeWidth="1" />
            <text x="50" y="84" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="9" fontFamily="inherit" letterSpacing="0.1em">
              ☀️ SOLAR
            </text>
            <text x="50" y="104" textAnchor="middle" fill={solarColor} fontSize="12" fontFamily="inherit" fontWeight="300">
              4.2 kW
            </text>
          </g>

          {/* === Node: Building === */}
          <g style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.8s ease 0.4s' }}>
            <rect x="160" y="55" width="80" height="70" rx="16" fill="rgba(0,243,255,0.06)" stroke="rgba(0,243,255,0.15)" strokeWidth="1" />
            <text x="200" y="84" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="9" fontFamily="inherit" letterSpacing="0.1em">
              🏢 CAMPUS
            </text>
            <text x="200" y="104" textAnchor="middle" fill={buildingColor} fontSize="12" fontFamily="inherit" fontWeight="300">
              6.8 kW
            </text>
          </g>

          {/* === Node: Grid === */}
          <g style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.8s ease 0.6s' }}>
            <rect x="310" y="55" width="80" height="70" rx="16" fill="rgba(255,184,0,0.06)" stroke="rgba(255,184,0,0.15)" strokeWidth="1" />
            <text x="350" y="84" textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="9" fontFamily="inherit" letterSpacing="0.1em">
              ⚡ GRID
            </text>
            <text x="350" y="104" textAnchor="middle" fill={gridColor} fontSize="12" fontFamily="inherit" fontWeight="300">
              2.6 kW
            </text>
          </g>

          {/* === Flow Path: Solar → Building === */}
          <path
            d="M90 90 Q125 90 160 90"
            stroke="url(#flowGradSolar)"
            className="flow-path"
            style={{ opacity: mounted ? 0.4 : 0, transition: 'opacity 0.8s ease 0.5s' }}
          />
          {/* Animated dots */}
          {mounted && [0, 1, 2].map((i) => (
            <circle
              key={`s${i}`}
              r="3"
              fill={solarColor}
              filter="url(#dotGlow)"
              style={{
                offsetPath: 'path("M90 90 Q125 90 160 90")',
                animation: `flowPulse 2.5s linear infinite`,
                animationDelay: `${i * -0.83}s`,
              }}
            />
          ))}

          {/* === Flow Path: Building → Grid (or reverse) === */}
          <path
            d="M240 90 Q275 90 310 90"
            stroke="url(#flowGradGrid)"
            className="flow-path"
            style={{ opacity: mounted ? 0.4 : 0, transition: 'opacity 0.8s ease 0.7s' }}
          />
          {mounted && [0, 1, 2].map((i) => (
            <circle
              key={`g${i}`}
              r="3"
              fill={gridColor}
              filter="url(#dotGlow)"
              style={{
                offsetPath: isGenerating
                  ? 'path("M240 90 Q275 90 310 90")'
                  : 'path("M310 90 Q275 90 240 90")',
                animation: `flowPulse 2.5s linear infinite`,
                animationDelay: `${i * -0.83}s`,
              }}
            />
          ))}

          {/* Direction labels */}
          <text x="125" y="78" textAnchor="middle" fill="rgba(255,255,255,0.15)" fontSize="7" fontFamily="inherit" letterSpacing="0.15em">
            →
          </text>
          <text x="275" y="78" textAnchor="middle" fill="rgba(255,255,255,0.15)" fontSize="7" fontFamily="inherit" letterSpacing="0.15em">
            {isGenerating ? '→' : '←'}
          </text>

          {/* Status */}
          <text x="200" y="165" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="8" fontFamily="inherit" letterSpacing="0.15em">
            {isGenerating ? 'EXPORTING TO GRID' : 'IMPORTING FROM GRID'}
          </text>
        </svg>
      </div>
    </div>
  );
}
