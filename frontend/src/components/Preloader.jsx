import { useState, useEffect, useRef } from 'react';

export default function Preloader({ onComplete }) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState(0); // 0=loading, 1=done, 2=exit
  const done = useRef(false);

  useEffect(() => {
    let t = 0;
    const iv = setInterval(() => {
      t += Math.random() * 18 + 6;
      const clamped = Math.min(t, 100);
      setProgress(clamped);
      if (clamped >= 100 && !done.current) {
        done.current = true;
        clearInterval(iv);
        setTimeout(() => setPhase(1), 400);
        setTimeout(() => setPhase(2), 1200);
        setTimeout(() => onComplete?.(), 2000);
      }
    }, 120);
    return () => clearInterval(iv);
  }, [onComplete]);

  const circumference = 2 * Math.PI * 52;
  const offset = circumference - (Math.min(progress, 100) / 100) * circumference;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: '#030b17',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      opacity: phase >= 2 ? 0 : 1,
      transform: phase >= 2 ? 'scale(1.15)' : 'scale(1)',
      transition: 'opacity 0.8s cubic-bezier(0.16,1,0.3,1), transform 0.8s cubic-bezier(0.16,1,0.3,1)',
      pointerEvents: phase >= 2 ? 'none' : 'all',
    }}>
      {/* Ambient glow orbs */}
      <div style={{
        position: 'absolute', top: '30%', left: '40%',
        width: 300, height: 300, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,243,255,0.06) 0%, transparent 70%)',
        filter: 'blur(60px)', animation: 'breatheGlow 4s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', top: '50%', right: '30%',
        width: 250, height: 250, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,255,136,0.04) 0%, transparent 70%)',
        filter: 'blur(60px)', animation: 'breatheGlow 4s ease-in-out infinite 1s',
      }} />

      {/* Energy Ring */}
      <svg width="140" height="140" viewBox="0 0 120 120" style={{ marginBottom: 40 }}>
        <defs>
          <linearGradient id="pl-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00f3ff" />
            <stop offset="50%" stopColor="#00d4ff" />
            <stop offset="100%" stopColor="#00ff88" />
          </linearGradient>
          <filter id="pl-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {/* Track */}
        <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1.5" />
        {/* Progress arc */}
        <circle cx="60" cy="60" r="52" fill="none"
          stroke="url(#pl-grad)" strokeWidth="2" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          transform="rotate(-90 60 60)" filter="url(#pl-glow)"
          style={{ transition: 'stroke-dashoffset 0.4s cubic-bezier(0.16,1,0.3,1)' }}
        />
        {/* Percentage */}
        <text x="60" y="56" textAnchor="middle" fill="rgba(255,255,255,0.6)"
          fontSize="20" fontFamily="'Inter', sans-serif" fontWeight="200"
          letterSpacing="0.05em" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {Math.min(Math.round(progress), 100)}
        </text>
        <text x="60" y="72" textAnchor="middle" fill="rgba(255,255,255,0.2)"
          fontSize="7" fontFamily="'Inter', sans-serif" fontWeight="500"
          letterSpacing="0.3em" textTransform="uppercase">
          PERCENT
        </text>
      </svg>

      {/* Brand */}
      <div style={{ textAlign: 'center' }}>
        <h1 style={{
          fontSize: 16, letterSpacing: '0.5em', textTransform: 'uppercase',
          color: phase >= 1 ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)',
          fontWeight: 300, fontFamily: "'Inter', sans-serif",
          transition: 'color 0.6s ease', marginBottom: 8,
        }}>
          SyncSpace
        </h1>
        <p style={{
          fontSize: 10, letterSpacing: '0.35em', textTransform: 'uppercase',
          color: 'rgba(0,243,255,0.4)', fontFamily: "'Inter', sans-serif",
          fontWeight: 500,
        }}>
          Initializing Energy Systems
        </p>
      </div>

      {/* Bottom progress bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: 2, background: 'rgba(255,255,255,0.02)',
      }}>
        <div style={{
          height: '100%', width: `${Math.min(progress, 100)}%`,
          background: 'linear-gradient(90deg, #00f3ff, #00ff88)',
          transition: 'width 0.3s ease',
          boxShadow: '0 0 20px rgba(0,243,255,0.3)',
        }} />
      </div>
    </div>
  );
}
