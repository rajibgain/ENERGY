import { useState, useEffect } from 'react';
import { Activity, Wifi, WifiOff } from 'lucide-react';

export default function StatusBar({ isOnline }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const formattedTime = time.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const formattedDate = time.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="status-bar sticky top-0 z-50 px-6 py-2.5 flex items-center justify-between">
      {/* Left: Campus */}
      <div className="flex items-center gap-3">
        <div className="w-6 h-6 rounded-md flex items-center justify-center border border-white/10">
          <Activity size={12} className="text-white/60" strokeWidth={1.5} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] tracking-[0.2em] uppercase text-white/60 font-medium">
            SyncSpace AI
          </span>
          <span className="text-[8px] px-1.5 py-0.5 rounded border border-white/8 text-white/30 tracking-[0.15em] uppercase">
            Control Center
          </span>
        </div>
      </div>

      {/* Center: Date + Time */}
      <div className="hidden md:flex items-center gap-4">
        <span className="text-[10px] tracking-[0.15em] text-white/30" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {formattedDate}
        </span>
        <span className="text-[10px] tracking-[0.15em] text-white/50 font-medium" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {formattedTime}
        </span>
      </div>

      {/* Right: System Status */}
      <div className="flex items-center gap-4">
        {isOnline ? (
          <div className="flex items-center gap-2">
            <Wifi size={12} className="text-emerald-500/70" strokeWidth={1.5} />
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 animate-pulse" />
            <span className="text-[9px] tracking-[0.2em] uppercase text-emerald-500/50 font-medium">
              Systems Online
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <WifiOff size={12} className="text-rose-500/70" strokeWidth={1.5} />
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500/80" />
            <span className="text-[9px] tracking-[0.2em] uppercase text-rose-500/50 font-medium">
              Offline
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
