import { useEffect, useRef, useState } from 'react';

export default function CustomCursor() {
  const dotRef = useRef(null);
  const ringRef = useRef(null);
  const trailRef = useRef(null);
  const mouse = useRef({ x: -100, y: -100 });
  const ringPos = useRef({ x: -100, y: -100 });
  const trailPos = useRef({ x: -100, y: -100 });
  const [hovering, setHovering] = useState(false);
  const [clicking, setClicking] = useState(false);
  const [visible, setVisible] = useState(false);
  const isTouch = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    isTouch.current = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouch.current) return;

    // Hide default cursor globally
    document.body.style.cursor = 'none';
    const style = document.createElement('style');
    style.id = 'custom-cursor-style';
    style.textContent = '*, *::before, *::after { cursor: none !important; }';
    document.head.appendChild(style);

    const onMove = (e) => {
      mouse.current = { x: e.clientX, y: e.clientY };
      if (!visible) setVisible(true);
      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${e.clientX - 4}px, ${e.clientY - 4}px)`;
      }
    };

    const onDown = () => setClicking(true);
    const onUp = () => setClicking(false);

    const onOver = (e) => {
      const interactive = e.target.closest('button, a, [role="button"], select, input, textarea, .cursor-pointer, label');
      setHovering(!!interactive);
    };

    const onLeave = () => { setVisible(false); };
    const onEnter = () => { setVisible(true); };

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('mouseover', onOver, { passive: true });
    document.addEventListener('mouseleave', onLeave);
    document.addEventListener('mouseenter', onEnter);

    // Smooth ring + trail follow
    let raf;
    const tick = () => {
      const mx = mouse.current.x;
      const my = mouse.current.y;
      // Ring (fast follow)
      ringPos.current.x += (mx - ringPos.current.x) * 0.18;
      ringPos.current.y += (my - ringPos.current.y) * 0.18;
      // Trail (slow follow)
      trailPos.current.x += (mx - trailPos.current.x) * 0.08;
      trailPos.current.y += (my - trailPos.current.y) * 0.08;

      if (ringRef.current) {
        const s = hovering ? 60 : 40;
        ringRef.current.style.transform = `translate(${ringPos.current.x - s / 2}px, ${ringPos.current.y - s / 2}px)`;
        ringRef.current.style.width = `${s}px`;
        ringRef.current.style.height = `${s}px`;
      }
      if (trailRef.current) {
        trailRef.current.style.transform = `translate(${trailPos.current.x - 80}px, ${trailPos.current.y - 80}px)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('mouseover', onOver);
      document.removeEventListener('mouseleave', onLeave);
      document.removeEventListener('mouseenter', onEnter);
      cancelAnimationFrame(raf);
      document.body.style.cursor = '';
      const s = document.getElementById('custom-cursor-style');
      if (s) s.remove();
    };
  }, [hovering, visible]);

  if (typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0)) return null;

  return (
    <>
      {/* Glow trail */}
      <div ref={trailRef} style={{
        position: 'fixed', top: 0, left: 0, zIndex: 99996,
        pointerEvents: 'none', width: 160, height: 160, borderRadius: '50%',
        background: hovering
          ? 'radial-gradient(circle, rgba(0,243,255,0.06) 0%, transparent 70%)'
          : 'radial-gradient(circle, rgba(0,243,255,0.03) 0%, transparent 70%)',
        opacity: visible ? 1 : 0,
        transition: 'background 0.4s ease, opacity 0.3s ease',
      }} />
      {/* Outer ring */}
      <div ref={ringRef} style={{
        position: 'fixed', top: 0, left: 0, zIndex: 99998,
        pointerEvents: 'none', width: 40, height: 40, borderRadius: '50%',
        border: `1.5px solid ${hovering ? 'rgba(0,243,255,0.5)' : 'rgba(255,255,255,0.12)'}`,
        opacity: visible ? (clicking ? 0.3 : 0.7) : 0,
        transition: 'border-color 0.3s ease, opacity 0.2s ease, width 0.35s cubic-bezier(0.16,1,0.3,1), height 0.35s cubic-bezier(0.16,1,0.3,1)',
        backdropFilter: hovering ? 'blur(1px)' : 'none',
      }} />
      {/* Inner dot */}
      <div ref={dotRef} style={{
        position: 'fixed', top: 0, left: 0, zIndex: 99999,
        pointerEvents: 'none',
        width: hovering ? 6 : 8, height: hovering ? 6 : 8,
        borderRadius: '50%',
        background: hovering ? '#00f3ff' : 'rgba(255,255,255,0.9)',
        opacity: visible ? (clicking ? 0.5 : 1) : 0,
        transition: 'background 0.3s, opacity 0.2s, width 0.3s, height 0.3s',
        boxShadow: hovering ? '0 0 12px rgba(0,243,255,0.6)' : 'none',
      }} />
    </>
  );
}
