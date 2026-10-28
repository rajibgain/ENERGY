import { useState, useEffect, useRef } from 'react';

// Animated counter that counts up from 0 to target value
export default function AnimatedCounter({ value, prefix = '', suffix = '', decimals = 2, duration = 1200 }) {
  const [display, setDisplay] = useState(0);
  const frameRef = useRef(null);
  const startTimeRef = useRef(null);
  const prevValue = useRef(0);

  useEffect(() => {
    if (value == null || isNaN(value)) return;

    const from = prevValue.current;
    const to = value;
    startTimeRef.current = performance.now();

    const animate = (now) => {
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Cubic ease-out
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = from + (to - from) * ease;

      setDisplay(current);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        prevValue.current = to;
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [value, duration]);

  const formatted = display.toFixed(decimals);

  return (
    <span className="counter-value">
      {prefix}{Number(formatted).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix && <span className="text-text-muted ml-1 text-lg font-medium">{suffix}</span>}
    </span>
  );
}
