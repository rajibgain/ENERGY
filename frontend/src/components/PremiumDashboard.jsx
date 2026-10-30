import { useState, useRef, useEffect, useMemo } from 'react';
import {
  ArrowUpRight, ArrowDownRight, UploadCloud, Activity,
  Zap, DollarSign, Wind, ChevronRight, FileUp,
  CheckCircle2, AlertCircle, Leaf,
  Bell, Search, Clock,
  Shield, Lightbulb, Target, Cpu, Gauge,
  X, Download, RefreshCw,
  Layers, Sparkles, BatteryCharging
} from 'lucide-react';
import { fetchRoomAnalysis, uploadScheduleCSV } from '../services/api';

/* ================================================================
   CONSTANTS & THEME
   ================================================================ */
const CHART_COLORS = {
  harvested: '#5ee7c4',
  consumption: '#6b8db5',
  waste: '#e07a6e',
};

/* ================================================================
   SPARKLINE — Tiny inline SVG chart for metric cards
   ================================================================ */
function Sparkline({ data = [], color = '#5ee7c4', width = 100, height = 32 }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const linePath = `M${points.join(' L')}`;
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <defs>
        <linearGradient id={`spk-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#spk-${color.replace('#', '')})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={width} cy={parseFloat(points[points.length - 1]?.split(',')[1] || 0)}
        r="2.5" fill={color} opacity="0.9">
        <animate attributeName="r" values="2.5;4;2.5" dur="2s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

/* ================================================================
   RADIAL GAUGE — Animated SVG efficiency gauge
   ================================================================ */
function EfficiencyGauge({ value = 0, size = 180 }) {
  const [animated, setAnimated] = useState(0);
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(animated, 100) / 100;
  const offset = circumference * (1 - progress * 0.75); // 270° arc

  useEffect(() => {
    let start = null;
    const duration = 1800;
    const animate = (ts) => {
      if (!start) start = ts;
      const t = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 4);
      setAnimated(value * ease);
      if (t < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value]);

  const getColor = (v) => {
    if (v >= 75) return '#5ee7c4';
    if (v >= 50) return '#ffb800';
    return '#e07a6e';
  };
  const color = getColor(animated);

  return (
    <div className="flex flex-col items-center justify-center">
      <svg width={size} height={size * 0.7} viewBox={`0 0 ${size} ${size * 0.7}`}>
        <defs>
          <linearGradient id="gauge-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#5ee7c4" />
            <stop offset="50%" stopColor="#00d4ff" />
            <stop offset="100%" stopColor="#00f3ff" />
          </linearGradient>
          <filter id="gauge-glow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <g transform={`translate(${size / 2}, ${size * 0.6})`}>
          {/* Track */}
          <circle r={radius} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="8"
            strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
            strokeLinecap="round" transform="rotate(-225)" />
          {/* Fill */}
          <circle r={radius} fill="none" stroke={color} strokeWidth="8"
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round" transform="rotate(-225)"
            filter="url(#gauge-glow)"
            style={{ transition: 'stroke 0.5s ease' }} />
        </g>
        {/* Value */}
        <text x={size / 2} y={size * 0.52} textAnchor="middle"
          fill="rgba(255,255,255,0.9)" fontSize="28" fontWeight="200"
          fontFamily="'Inter', sans-serif" letterSpacing="-0.02em"
          style={{ fontVariantNumeric: 'tabular-nums' }}>
          {Math.round(animated)}%
        </text>
        <text x={size / 2} y={size * 0.65} textAnchor="middle"
          fill="rgba(255,255,255,0.3)" fontSize="8" fontWeight="500"
          fontFamily="'Inter', sans-serif" letterSpacing="0.25em">
          EFFICIENCY
        </text>
      </svg>
    </div>
  );
}

/* ================================================================
   GENERATE MOCK DATA
   ================================================================ */
function generateChartData(wastedKwh = 0) {
  const data = [];
  const now = new Date();
  for (let i = 23; i >= 0; i--) {
    const hour = new Date(now.getTime() - i * 3600000);
    const h = hour.getHours();
    const base = 40 + 30 * Math.sin(((h - 6) / 24) * Math.PI * 2);
    const consumption = Math.max(5, base + (Math.random() - 0.5) * 15);
    const harvested = Math.max(0, (h >= 6 && h <= 18)
      ? consumption * (0.6 + Math.random() * 0.3)
      : consumption * (0.05 + Math.random() * 0.1));
    const waste = Math.max(0, consumption - harvested) * (wastedKwh > 0 ? 0.3 : 0.15);
    data.push({
      time: `${String(h).padStart(2, '0')}:00`,
      consumption: +consumption.toFixed(1),
      harvested: +harvested.toFixed(1),
      waste: +waste.toFixed(1),
    });
  }
  return data;
}

function generateSparkline(seed = 0) {
  const points = [];
  let val = 20 + seed * 10;
  for (let i = 0; i < 20; i++) {
    val += (Math.random() - 0.45) * 8;
    val = Math.max(2, val);
    points.push(val);
  }
  return points;
}

/* ================================================================
   CUSTOM SVG AREA CHART — Enhanced with tooltips & smooth curves
   ================================================================ */
function AreaChart({ data, width = 820, height = 320 }) {
  const [hoverIdx, setHoverIdx] = useState(-1);
  const padding = { top: 24, right: 24, bottom: 40, left: 52 };
  const w = width - padding.left - padding.right;
  const h = height - padding.top - padding.bottom;

  const allVals = data.flatMap(d => [d.consumption, d.harvested, d.waste]);
  const maxVal = Math.max(...allVals, 1);
  const yTicks = Array.from({ length: 5 }, (_, i) => Math.round(maxVal * (i / 4)));

  const xScale = (i) => padding.left + (i / (data.length - 1)) * w;
  const yScale = (v) => padding.top + h - (v / maxVal) * h;

  // Smooth curve (monotone cubic)
  const makeSmoothPath = (key) => {
    const pts = data.map((d, i) => ({ x: xScale(i), y: yScale(d[key]) }));
    if (pts.length < 2) return '';
    let path = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const cx = (pts[i].x + pts[i + 1].x) / 2;
      path += ` C${cx.toFixed(1)},${pts[i].y.toFixed(1)} ${cx.toFixed(1)},${pts[i + 1].y.toFixed(1)} ${pts[i + 1].x.toFixed(1)},${pts[i + 1].y.toFixed(1)}`;
    }
    return path;
  };

  const makeSmoothArea = (key) => {
    const line = makeSmoothPath(key);
    return `${line} L${xScale(data.length - 1).toFixed(1)},${yScale(0).toFixed(1)} L${xScale(0).toFixed(1)},${yScale(0).toFixed(1)} Z`;
  };

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet"
      onMouseLeave={() => setHoverIdx(-1)}>
      <defs>
        <linearGradient id="gH2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={CHART_COLORS.harvested} stopOpacity="0.2" />
          <stop offset="100%" stopColor={CHART_COLORS.harvested} stopOpacity="0.01" />
        </linearGradient>
        <linearGradient id="gC2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={CHART_COLORS.consumption} stopOpacity="0.12" />
          <stop offset="100%" stopColor={CHART_COLORS.consumption} stopOpacity="0.01" />
        </linearGradient>
        <linearGradient id="gW2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={CHART_COLORS.waste} stopOpacity="0.12" />
          <stop offset="100%" stopColor={CHART_COLORS.waste} stopOpacity="0.01" />
        </linearGradient>
        <filter id="chart-glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Grid */}
      {yTicks.map((t) => (
        <g key={t}>
          <line x1={padding.left} x2={width - padding.right}
            y1={yScale(t)} y2={yScale(t)}
            stroke="rgba(255,255,255,0.03)" strokeDasharray="2 4" />
          <text x={padding.left - 10} y={yScale(t) + 3}
            textAnchor="end" fill="rgba(255,255,255,0.15)" fontSize="9"
            fontFamily="'Inter', sans-serif" fontWeight="400">{t}</text>
        </g>
      ))}

      {/* X Labels */}
      {data.map((d, i) =>
        i % 4 === 0 && (
          <text key={i} x={xScale(i)} y={height - 10}
            textAnchor="middle" fill="rgba(255,255,255,0.15)" fontSize="9"
            fontFamily="'Inter', sans-serif" letterSpacing="0.1em">{d.time}</text>
        )
      )}

      {/* Areas */}
      <path d={makeSmoothArea('harvested')} fill="url(#gH2)" />
      <path d={makeSmoothArea('consumption')} fill="url(#gC2)" />
      <path d={makeSmoothArea('waste')} fill="url(#gW2)" />

      {/* Lines */}
      <path d={makeSmoothPath('harvested')} fill="none" stroke={CHART_COLORS.harvested} strokeWidth="2" />
      <path d={makeSmoothPath('consumption')} fill="none" stroke={CHART_COLORS.consumption} strokeWidth="2" opacity="0.7" />
      <path d={makeSmoothPath('waste')} fill="none" stroke={CHART_COLORS.waste} strokeWidth="1.5" strokeDasharray="4 3" opacity="0.6" />

      {/* Dots on last point */}
      {Object.entries(CHART_COLORS).map(([key, color]) => (
        <circle key={key} cx={xScale(data.length - 1)} cy={yScale(data[data.length - 1][key])}
          r="3.5" fill={color} fillOpacity="0.9" filter="url(#chart-glow)" />
      ))}

      {/* Hover columns */}
      {data.map((d, i) => (
        <g key={`hover-${i}`} onMouseEnter={() => setHoverIdx(i)} style={{ cursor: 'crosshair' }}>
          <rect x={xScale(i) - w / data.length / 2} y={padding.top}
            width={w / data.length} height={h}
            fill="transparent" />
          {hoverIdx === i && (
            <>
              <line x1={xScale(i)} x2={xScale(i)} y1={padding.top} y2={padding.top + h}
                stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
              <circle cx={xScale(i)} cy={yScale(d.harvested)} r="4" fill={CHART_COLORS.harvested} />
              <circle cx={xScale(i)} cy={yScale(d.consumption)} r="4" fill={CHART_COLORS.consumption} />
              {/* Tooltip */}
              <g transform={`translate(${Math.min(xScale(i), width - 130)}, ${padding.top + 10})`}>
                <rect x="0" y="0" width="110" height="66" rx="8"
                  fill="rgba(5,18,36,0.95)" stroke="rgba(255,255,255,0.08)" />
                <text x="10" y="18" fill="rgba(255,255,255,0.5)" fontSize="8" letterSpacing="0.15em"
                  fontFamily="'Inter', sans-serif">{d.time}</text>
                <text x="10" y="33" fill={CHART_COLORS.harvested} fontSize="9"
                  fontFamily="'Inter', sans-serif">▸ Harvest: {d.harvested}</text>
                <text x="10" y="46" fill={CHART_COLORS.consumption} fontSize="9"
                  fontFamily="'Inter', sans-serif">▸ Usage: {d.consumption}</text>
                <text x="10" y="59" fill={CHART_COLORS.waste} fontSize="9"
                  fontFamily="'Inter', sans-serif">▸ Waste: {d.waste}</text>
              </g>
            </>
          )}
        </g>
      ))}
    </svg>
  );
}

/* ================================================================
   ANIMATED COUNTER
   ================================================================ */
function AnimValue({ value, prefix = '', suffix = '', decimals = 2 }) {
  const [display, setDisplay] = useState(0);
  const raf = useRef(null);
  const prev = useRef(0);

  useEffect(() => {
    if (value == null || isNaN(value)) return;
    const from = prev.current;
    const to = value;
    const start = performance.now();
    const dur = 1400;
    const animate = (now) => {
      const t = Math.min((now - start) / dur, 1);
      const ease = 1 - Math.pow(1 - t, 4);
      setDisplay(from + (to - from) * ease);
      if (t < 1) raf.current = requestAnimationFrame(animate);
      else prev.current = to;
    };
    raf.current = requestAnimationFrame(animate);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [value]);

  if (value == null) return <span className="text-white/20">—</span>;
  const f = Number(display.toFixed(decimals)).toLocaleString('en-IN', {
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  });
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
      {prefix}{f}
      {suffix && <span className="text-base font-light text-white/25 ml-1">{suffix}</span>}
    </span>
  );
}

/* ================================================================
   AI INSIGHT CARD
   ================================================================ */
function InsightItem({ icon: Icon, title, desc, color, delay = 0 }) {
  return (
    <div className="flex gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.08] transition-all duration-400 group"
      style={{ opacity: 0, animation: `fadeInUp 0.6s cubic-bezier(0.16,1,0.3,1) ${delay}ms forwards` }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
        style={{ background: `${color}10`, border: `1px solid ${color}20` }}>
        <Icon size={14} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-white/70 mb-0.5 group-hover:text-white/90 transition-colors">{title}</p>
        <p className="text-[10px] leading-relaxed text-white/30">{desc}</p>
      </div>
    </div>
  );
}

/* ================================================================
   LIVE CLOCK
   ================================================================ */
function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const iv = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);
  const timeStr = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const dateStr = time.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  return { timeStr, dateStr, hour: time.getHours() };
}

function getGreeting(hour) {
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

/* ================================================================
   NOTIFICATION BELL
   ================================================================ */
function NotificationBell() {
  const [open, setOpen] = useState(false);
  const notifs = [
    { id: 1, text: 'Room 303 exceeded energy threshold', time: '2m ago', type: 'warning' },
    { id: 2, text: 'New schedule uploaded for Lab A1', time: '15m ago', type: 'success' },
    { id: 3, text: 'System maintenance at 2:00 AM', time: '1h ago', type: 'info' },
  ];

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="relative w-9 h-9 rounded-lg border border-white/[0.08] flex items-center justify-center hover:border-white/15 hover:bg-white/[0.03] transition-all cursor-pointer bg-transparent">
        <Bell size={14} className="text-white/40" />
        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-cyan-500/80 flex items-center justify-center">
          <span className="text-[7px] text-white font-bold">{notifs.length}</span>
        </span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full right-0 mt-2 w-72 bg-[#0a1420]/95 backdrop-blur-xl border border-white/[0.08] rounded-xl overflow-hidden z-50 shadow-2xl"
            style={{ animation: 'fadeInUp 0.3s cubic-bezier(0.16,1,0.3,1) forwards' }}>
            <div className="px-4 py-3 border-b border-white/[0.06]">
              <p className="text-[10px] tracking-[0.25em] uppercase text-white/40 font-medium">Notifications</p>
            </div>
            {notifs.map(n => (
              <div key={n.id} className="px-4 py-3 border-b border-white/[0.04] hover:bg-white/[0.03] transition-colors">
                <p className="text-xs text-white/70 leading-relaxed">{n.text}</p>
                <p className="text-[9px] text-white/25 mt-1">{n.time}</p>
              </div>
            ))}
            <div className="px-4 py-2.5 text-center">
              <span className="text-[9px] tracking-[0.15em] uppercase text-cyan-400/50 cursor-pointer hover:text-cyan-400/80 transition-colors">
                View All
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ================================================================
   PREMIUM DASHBOARD — MAIN COMPONENT
   ================================================================ */
export default function PremiumDashboard({ dashboard, rooms, loading, isOnline, onUploadSuccess }) {
  const [selectedRoom, setSelectedRoom] = useState('');
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState(null);
  const [analyzingId, setAnalyzingId] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [chartFilter, setChartFilter] = useState('24H');
  const [searchOpen, setSearchOpen] = useState(false);
  const fileInputRef = useRef(null);

  const { timeStr, dateStr, hour } = LiveClock();
  const greeting = getGreeting(hour);

  const chartData = useMemo(
    () => generateChartData(dashboard?.campus_wasted_energy_kwh),
    [dashboard?.campus_wasted_energy_kwh]
  );

  const sparklines = useMemo(() => ({
    energy: generateSparkline(1),
    cost: generateSparkline(2),
    carbon: generateSparkline(3),
  }), []);

  const efficiencyScore = useMemo(() => {
    if (!dashboard) return 0;
    if (dashboard.campus_efficiency_score != null) return dashboard.campus_efficiency_score;
    const waste = dashboard.campus_wasted_energy_kwh || 0;
    const total = waste + 100;
    return Math.round(((total - waste) / total) * 100);
  }, [dashboard]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4500);
  };

  const handleAnalyze = async (room) => {
    setAnalyzingId(room.id);
    try {
      const data = await fetchRoomAnalysis(room.id);
      setAnalysis({ ...data, roomName: room.name });
    } catch { setAnalysis(null); }
    finally { setAnalyzingId(null); }
  };

  const handleDrop = (e) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files.length > 0) setFile(e.dataTransfer.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRoom) return showToast('Select a zone first.', 'error');
    if (!file) return showToast('Choose a CSV file.', 'error');
    setUploading(true);
    try {
      const data = await uploadScheduleCSV(selectedRoom, file);
      showToast(data.message || 'Schedule uploaded.', 'success');
      setFile(null); setSelectedRoom('');
      if (onUploadSuccess) onUploadSuccess();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Upload failed.', 'error');
    } finally { setUploading(false); }
  };

  const metrics = [
    {
      icon: Zap, label: 'Wasted Energy',
      value: dashboard?.campus_wasted_energy_kwh, suffix: 'kWh',
      trend: 'down', trendLabel: '−12%', trendColor: '#5ee7c4',
      sparkData: sparklines.energy, sparkColor: '#5ee7c4',
      bg: 'from-emerald-500/[0.06] to-transparent',
    },
    {
      icon: DollarSign, label: 'Financial Loss',
      value: dashboard?.campus_financial_loss_inr, prefix: '₹', suffix: '', decimals: 0,
      trend: 'up', trendLabel: '+3.2%', trendColor: '#e07a6e',
      sparkData: sparklines.cost, sparkColor: '#e07a6e',
      bg: 'from-rose-500/[0.06] to-transparent',
    },
    {
      icon: Wind, label: 'CO₂ Emissions',
      value: dashboard?.campus_carbon_footprint_kg, suffix: 'kg',
      trend: 'down', trendLabel: '−8%', trendColor: '#5ee7c4',
      sparkData: sparklines.carbon, sparkColor: '#6b8db5',
      bg: 'from-blue-500/[0.06] to-transparent',
    },
  ];

  const aiInsights = useMemo(() => {
    const insights = [
      { icon: Lightbulb, title: 'Smart Scheduling', desc: 'Room 203 shows 4.2hrs of idle time daily. Auto-schedule shutdown could save ₹1,200/month.', color: '#ffb800' },
      { icon: Target, title: 'Peak Optimization', desc: 'Shift Lab A1 usage to off-peak hours (6PM-8AM) for 18% cost reduction.', color: '#5ee7c4' },
      { icon: Shield, title: 'Carbon Target', desc: 'You\'re 23% away from your monthly CO₂ reduction goal. Reduce AC usage in Block B.', color: '#00f3ff' },
      { icon: BatteryCharging, title: 'Energy Recovery', desc: 'Solar panels in Block A are underperforming by 12%. Schedule maintenance check.', color: '#e07a6e' },
    ];
    return insights;
  }, []);

  return (
    <div className="min-h-screen relative" style={{ background: 'linear-gradient(165deg, #030b17 0%, #0a1825 40%, #0d1f33 100%)' }}>

      {/* ======== NAVBAR ======== */}
      <nav className="sticky top-0 z-50 border-b border-white/[0.05]"
        style={{ background: 'rgba(3,11,23,0.75)', backdropFilter: 'blur(24px) saturate(1.2)' }}>
        <div className="max-w-[1480px] mx-auto px-6 sm:px-8 h-16 flex items-center justify-between">
          {/* Left */}
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center border border-white/10 bg-gradient-to-br from-cyan-500/10 to-transparent">
              <Activity size={14} className="text-cyan-400/80" strokeWidth={1.5} />
            </div>
            <span className="text-sm tracking-[0.18em] uppercase font-medium text-white/90">SyncSpace</span>
            <span className="hidden sm:inline text-[9px] tracking-[0.2em] uppercase px-2.5 py-1 rounded-full border border-white/[0.08] text-white/35 font-medium bg-white/[0.02]">
              Control Center
            </span>
          </div>

          {/* Right */}
          <div className="flex items-center gap-3">
            {/* Search */}
            <button onClick={() => setSearchOpen(!searchOpen)}
              className="w-9 h-9 rounded-lg border border-white/[0.08] flex items-center justify-center hover:border-white/15 hover:bg-white/[0.03] transition-all cursor-pointer bg-transparent">
              <Search size={14} className="text-white/40" />
            </button>

            {/* Notifications */}
            <NotificationBell />

            {/* Status */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/[0.06] bg-white/[0.02]">
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-rose-400'}`}
                style={{ boxShadow: isOnline ? '0 0 8px rgba(94,231,196,0.5)' : '0 0 8px rgba(224,122,110,0.5)' }} />
              <span className="text-[9px] tracking-[0.2em] uppercase text-white/35 font-medium">
                {isOnline ? 'Live' : 'Offline'}
              </span>
            </div>

            {/* Clock */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/[0.06] bg-white/[0.02]">
              <Clock size={11} className="text-white/25" />
              <span className="text-[9px] tracking-[0.15em] uppercase text-white/35 font-mono">{timeStr}</span>
            </div>
          </div>
        </div>
      </nav>

      {/* ======== CONTENT ======== */}
      <div className="max-w-[1480px] mx-auto px-6 sm:px-8 py-8 sm:py-10">

        {/* ======== GREETING ======== */}
        <div className="mb-10 flex flex-col sm:flex-row sm:items-end justify-between gap-4"
          style={{ opacity: 0, animation: 'fadeInUp 0.8s cubic-bezier(0.16,1,0.3,1) 100ms forwards' }}>
          <div>
            <p className="text-[10px] tracking-[0.35em] uppercase text-white/25 mb-2 flex items-center gap-2">
              <Sparkles size={10} className="text-cyan-400/40" />
              Dashboard Overview
            </p>
            <h1 className="text-2xl sm:text-3xl font-extralight text-white/90 tracking-wide leading-tight">
              {greeting}, <span className="text-white/60">Admin</span>
            </h1>
            <p className="text-[11px] tracking-[0.15em] text-white/25 mt-1.5 font-light">{dateStr}</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-4 py-2 rounded-lg border border-white/[0.08] text-[10px] tracking-[0.2em] uppercase text-white/40 hover:text-white/70 hover:border-white/15 hover:bg-white/[0.03] transition-all cursor-pointer bg-transparent flex items-center gap-2">
              <Download size={12} /> Export
            </button>
            <button onClick={onUploadSuccess}
              className="px-4 py-2 rounded-lg border border-white/[0.08] text-[10px] tracking-[0.2em] uppercase text-white/40 hover:text-white/70 hover:border-white/15 hover:bg-white/[0.03] transition-all cursor-pointer bg-transparent flex items-center gap-2">
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
        </div>

        {/* ======== METRICS ROW ======== */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-8">
          {metrics.map((m, i) => (
            <div key={m.label}
              className={`relative bg-gradient-to-br ${m.bg} backdrop-blur-md border border-white/[0.06] rounded-2xl p-6 overflow-hidden group hover:border-white/12 transition-all duration-500 hover:-translate-y-0.5`}
              style={{ opacity: 0, animation: `fadeInUp 0.7s cubic-bezier(0.16,1,0.3,1) ${150 + i * 100}ms forwards` }}>
              {/* Top glow */}
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg border border-white/[0.06] flex items-center justify-center bg-white/[0.02]">
                    <m.icon size={14} className="text-white/35" strokeWidth={1.5} />
                  </div>
                  <span className="text-[9px] tracking-[0.25em] uppercase text-white/40 font-medium">{m.label}</span>
                </div>
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium tracking-wider`}
                  style={{ color: m.trendColor, background: `${m.trendColor}10` }}>
                  {m.trend === 'down' ? <ArrowDownRight size={10} /> : <ArrowUpRight size={10} />}
                  {m.trendLabel}
                </div>
              </div>

              <div className="text-3xl font-extralight text-white leading-tight mb-4">
                <AnimValue value={m.value} prefix={m.prefix || ''} suffix={m.suffix} decimals={m.decimals ?? 2} />
              </div>

              {/* Sparkline */}
              <div className="opacity-60 group-hover:opacity-100 transition-opacity duration-500">
                <Sparkline data={m.sparkData} color={m.sparkColor} width={160} height={28} />
              </div>
            </div>
          ))}

          {/* Efficiency Score Card */}
          <div className="relative bg-gradient-to-br from-cyan-500/[0.06] to-transparent backdrop-blur-md border border-white/[0.06] rounded-2xl p-6 overflow-hidden group hover:border-white/12 transition-all duration-500 hover:-translate-y-0.5 flex flex-col items-center justify-center"
            style={{ opacity: 0, animation: `fadeInUp 0.7s cubic-bezier(0.16,1,0.3,1) ${150 + 3 * 100}ms forwards` }}>
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
            <div className="flex items-center gap-2 mb-3">
              <Gauge size={12} className="text-white/30" />
              <span className="text-[9px] tracking-[0.25em] uppercase text-white/40 font-medium">Efficiency</span>
            </div>
            <EfficiencyGauge value={efficiencyScore} size={160} />
          </div>
        </div>

        {/* ======== ANALYTICS SPLIT ======== */}
        <div className="grid grid-cols-12 gap-4 sm:gap-5 mb-8">

          {/* CHART PANEL (8 cols) */}
          <div className="col-span-12 lg:col-span-8 bg-white/[0.015] backdrop-blur-md border border-white/[0.06] rounded-2xl p-6 sm:p-7 overflow-hidden"
            style={{ opacity: 0, animation: 'fadeInUp 0.7s cubic-bezier(0.16,1,0.3,1) 550ms forwards' }}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
              <div>
                <p className="text-[9px] tracking-[0.3em] uppercase text-white/25 mb-1">Real-Time Analytics</p>
                <h2 className="text-base font-extralight text-white/80 tracking-wide">
                  Energy Performance
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {/* Time Filters */}
                {['1H', '6H', '24H', '7D'].map(f => (
                  <button key={f} onClick={() => setChartFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-[9px] tracking-[0.15em] uppercase font-medium transition-all cursor-pointer border-none ${
                      chartFilter === f
                        ? 'bg-white/[0.08] text-white/70'
                        : 'bg-transparent text-white/25 hover:text-white/50 hover:bg-white/[0.03]'
                    }`}>
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-5 mb-4">
              {Object.entries({ Harvested: CHART_COLORS.harvested, Consumption: CHART_COLORS.consumption, Waste: CHART_COLORS.waste }).map(([label, color]) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="w-2.5 h-1 rounded-full" style={{ background: color }} />
                  <span className="text-[9px] tracking-[0.15em] uppercase text-white/30">{label}</span>
                </div>
              ))}
            </div>

            <div className="h-[320px]">
              <AreaChart data={chartData} />
            </div>
          </div>

          {/* ACTIVE ZONES (4 cols) */}
          <div className="col-span-12 lg:col-span-4 bg-white/[0.015] backdrop-blur-md border border-white/[0.06] rounded-2xl p-6 sm:p-7 flex flex-col"
            style={{ opacity: 0, animation: 'fadeInUp 0.7s cubic-bezier(0.16,1,0.3,1) 650ms forwards' }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[9px] tracking-[0.3em] uppercase text-white/25 mb-1">Monitoring</p>
                <h2 className="text-base font-extralight text-white/80 tracking-wide">Active Zones</h2>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/[0.08] border border-emerald-500/15">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[8px] tracking-[0.2em] uppercase text-emerald-400/70 font-medium">{rooms.length} Active</span>
              </div>
            </div>

            {loading ? (
              <div className="space-y-3 flex-1">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-14 rounded-xl bg-white/[0.02] animate-pulse" />
                ))}
              </div>
            ) : rooms.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                <Layers size={28} className="text-white/10 mb-3" />
                <p className="text-xs text-white/25 tracking-wide">No zones configured</p>
                <p className="text-[10px] text-white/15 mt-1">Upload a schedule to get started</p>
              </div>
            ) : (
              <div className="flex-1 space-y-1 overflow-y-auto max-h-[400px] custom-scrollbar">
                {rooms.map((room, i) => (
                  <button key={room.id} onClick={() => handleAnalyze(room)}
                    disabled={analyzingId === room.id}
                    className="w-full text-left py-3 px-3 rounded-xl flex items-center justify-between group bg-transparent hover:bg-white/[0.03] transition-all duration-300 disabled:opacity-40 border-none"
                    style={{ opacity: 0, animation: `fadeInUp 0.5s cubic-bezier(0.16,1,0.3,1) ${i * 60}ms forwards` }}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                        <span className="w-2 h-2 rounded-full bg-emerald-400/80" style={{
                          boxShadow: '0 0 6px rgba(94,231,196,0.4)',
                          animation: `pulse-dot 2.5s ease-in-out infinite ${i * 300}ms`,
                        }} />
                      </div>
                      <div>
                        <p className="text-sm font-light text-white/70 group-hover:text-white/90 transition-colors">{room.name}</p>
                        <p className="text-[9px] tracking-[0.15em] uppercase text-white/25">{room.block}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[8px] tracking-[0.1em] uppercase text-white/20 font-medium">
                        {room.appliances?.length || 0} devices
                      </span>
                      <ChevronRight size={12} className="text-white/15 group-hover:text-white/40 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Analysis Result */}
            {analysis && (
              <div className="mt-4 pt-4 border-t border-white/[0.06]"
                style={{ animation: 'fadeInUp 0.5s cubic-bezier(0.16,1,0.3,1) forwards' }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[9px] tracking-[0.25em] uppercase text-white/35">
                    Analysis — <span className="text-cyan-400/60">{analysis.roomName}</span>
                  </p>
                  <button onClick={() => setAnalysis(null)}
                    className="w-6 h-6 rounded-full bg-white/[0.03] hover:bg-white/[0.06] flex items-center justify-center transition-colors cursor-pointer border-none">
                    <X size={10} className="text-white/30" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { l: 'Wasted', v: `${analysis.wasted_energy_kwh?.toFixed(1)} kWh`, c: '#5ee7c4' },
                    { l: 'Cost', v: `₹${analysis.financial_loss_inr?.toFixed(0)}`, c: '#e07a6e' },
                    { l: 'CO₂', v: `${analysis.carbon_footprint_kg?.toFixed(1)} kg`, c: '#6b8db5' },
                    { l: 'Idle Time', v: analysis.total_empty_hours != null ? `${analysis.total_empty_hours.toFixed(1)} hrs` : 'N/A', c: '#a088c8' },
                  ].map((s) => (
                    <div key={s.l} className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-3 hover:bg-white/[0.04] transition-colors">
                      <p className="text-[8px] tracking-[0.2em] uppercase text-white/25 mb-1">{s.l}</p>
                      <p className="text-sm font-light" style={{ color: s.c }}>{s.v}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ======== AI INSIGHTS + UPLOAD SPLIT ======== */}
        <div className="grid grid-cols-12 gap-4 sm:gap-5 mb-8">

          {/* AI INSIGHTS (5 cols) */}
          <div className="col-span-12 lg:col-span-5 relative rounded-2xl overflow-hidden"
            style={{ opacity: 0, animation: 'fadeInUp 0.7s cubic-bezier(0.16,1,0.3,1) 750ms forwards' }}>
            {/* Gradient border effect */}
            <div className="absolute inset-0 rounded-2xl p-px bg-gradient-to-br from-cyan-500/20 via-transparent to-emerald-500/10">
              <div className="w-full h-full rounded-2xl" style={{ background: 'linear-gradient(165deg, #060e1a, #0a1825)' }} />
            </div>
            <div className="relative p-6 sm:p-7">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/15 to-emerald-500/10 border border-cyan-500/15 flex items-center justify-center">
                    <Cpu size={14} className="text-cyan-400/70" />
                  </div>
                  <div>
                    <p className="text-[9px] tracking-[0.3em] uppercase text-white/25 mb-0.5">AI Engine</p>
                    <h2 className="text-base font-extralight text-white/80 tracking-wide">Smart Insights</h2>
                  </div>
                </div>
                <span className="text-[8px] tracking-[0.15em] uppercase text-cyan-400/40 px-2 py-1 rounded-full bg-cyan-400/[0.06] border border-cyan-400/10 flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-cyan-400/60 animate-pulse" /> Live
                </span>
              </div>

              <div className="space-y-2.5">
                {aiInsights.map((insight, i) => (
                  <InsightItem key={insight.title} {...insight} delay={800 + i * 120} />
                ))}
              </div>
            </div>
          </div>

          {/* UPLOAD ZONE (7 cols) */}
          <div className="col-span-12 lg:col-span-7 bg-white/[0.015] backdrop-blur-md border border-white/[0.06] rounded-2xl p-6 sm:p-7"
            style={{ opacity: 0, animation: 'fadeInUp 0.7s cubic-bezier(0.16,1,0.3,1) 850ms forwards' }}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
              <div>
                <p className="text-[9px] tracking-[0.3em] uppercase text-white/25 mb-1">Data Import</p>
                <h2 className="text-base font-extralight text-white/80 tracking-wide">Schedule Upload</h2>
              </div>
              {rooms.length > 0 && (
                <div className="relative">
                  <select value={selectedRoom} onChange={(e) => setSelectedRoom(e.target.value)}
                    className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-2.5 text-xs text-white/60 outline-none focus:border-white/15 transition-all appearance-none cursor-pointer min-w-[200px] pr-8 hover:bg-white/[0.05]"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='rgba(255,255,255,0.25)' viewBox='0 0 16 16'%3E%3Cpath d='M4.5 6l3.5 4 3.5-4z'/%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 0.75rem center',
                    }}>
                    <option value="" style={{ background: '#0a1420' }}>— Select Zone —</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id} style={{ background: '#0a1420' }}>{r.name} ({r.block})</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit}>
              <div onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-2xl py-14 px-8 text-center cursor-pointer transition-all duration-400 relative overflow-hidden ${
                  isDragging
                    ? 'border-cyan-400/40 bg-cyan-400/[0.04]'
                    : 'border-white/[0.08] hover:border-white/20 bg-white/[0.01] hover:bg-white/[0.02]'
                }`}>
                {isDragging && (
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/[0.05] to-emerald-500/[0.02]" />
                )}
                <input ref={fileInputRef} type="file" accept=".csv"
                  onChange={(e) => e.target.files.length > 0 && setFile(e.target.files[0])} hidden />
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-5">
                    <UploadCloud size={24} className={`${isDragging ? 'text-cyan-400/60' : 'text-white/15'} transition-colors`} strokeWidth={1} />
                  </div>
                  <p className="text-sm font-light tracking-[0.2em] uppercase text-white/35 mb-1.5">
                    {isDragging ? 'Drop file here' : 'Drag & Drop CSV Schedule'}
                  </p>
                  <p className="text-[10px] tracking-[0.15em] uppercase text-white/15">or click to browse files</p>
                  {file && (
                    <div className="flex items-center justify-center gap-2 mt-4 px-4 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06] mx-auto w-fit">
                      <FileUp size={12} className="text-cyan-400/50" />
                      <span className="text-xs font-light text-white/60">{file.name}</span>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); }}
                        className="w-5 h-5 rounded-full bg-white/[0.05] flex items-center justify-center hover:bg-white/[0.1] transition-colors cursor-pointer border-none ml-1">
                        <X size={8} className="text-white/40" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {(file && selectedRoom) && (
                <div className="mt-5 flex justify-end">
                  <button type="submit" disabled={uploading}
                    className="px-7 py-3 rounded-xl text-[10px] tracking-[0.2em] uppercase font-medium transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2.5 border-none bg-gradient-to-r from-cyan-500/15 to-emerald-500/10 text-white/70 hover:text-white hover:from-cyan-500/25 hover:to-emerald-500/15">
                    {uploading ? (
                      <><span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" /> Processing</>
                    ) : (
                      <><UploadCloud size={13} strokeWidth={1.5} /> Upload Schedule</>
                    )}
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* ======== FOOTER ======== */}
        <div className="mt-12 pt-8 border-t border-white/[0.04] flex flex-col sm:flex-row items-center justify-between pb-8 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-md flex items-center justify-center border border-white/[0.06]">
              <Activity size={10} className="text-white/20" />
            </div>
            <p className="text-[10px] tracking-[0.2em] uppercase text-white/20">© 2026 SyncSpace AI</p>
          </div>
          <div className="flex items-center gap-6">
            <span className="text-[10px] tracking-[0.15em] uppercase text-white/15 hover:text-white/30 transition-colors cursor-pointer">Privacy</span>
            <span className="text-[10px] tracking-[0.15em] uppercase text-white/15 hover:text-white/30 transition-colors cursor-pointer">Terms</span>
            <span className="text-[10px] tracking-[0.15em] uppercase text-white/15 hover:text-white/30 transition-colors cursor-pointer">Documentation</span>
          </div>
          <p className="text-[10px] tracking-[0.15em] uppercase text-white/15">
            <Leaf size={10} className="inline mr-1" /> Building a sustainable campus
          </p>
        </div>
      </div>

      {/* ---- Toast ---- */}
      {toast && (
        <div className={`fixed bottom-8 right-8 z-[200] px-5 py-3.5 rounded-xl backdrop-blur-xl border text-xs tracking-[0.1em] uppercase font-medium flex items-center gap-2.5 shadow-2xl ${
          toast.type === 'success'
            ? 'bg-emerald-950/50 border-emerald-500/20 text-emerald-400/80'
            : 'bg-rose-950/50 border-rose-500/20 text-rose-400/80'
        }`} style={{ animation: 'fadeInUp 0.4s cubic-bezier(0.16,1,0.3,1) forwards' }}>
          {toast.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          {toast.msg}
          <button onClick={() => setToast(null)}
            className="ml-2 w-5 h-5 rounded-full bg-white/[0.05] flex items-center justify-center hover:bg-white/[0.1] transition-colors cursor-pointer border-none">
            <X size={8} className="text-current" />
          </button>
        </div>
      )}
    </div>
  );
}
