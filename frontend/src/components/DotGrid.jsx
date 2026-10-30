import { useEffect, useRef } from 'react';

export default function DotGrid() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationId;
    let mouse = { x: -1000, y: -1000 };

    const DOT_SPACING = 35;
    const DOT_RADIUS = 1;
    const INFLUENCE_RADIUS = 120;
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.scale(dpr, dpr);
    };

    const handleMouseMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    const handleMouseLeave = () => {
      mouse.x = -1000;
      mouse.y = -1000;
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

      const cols = Math.ceil(window.innerWidth / DOT_SPACING) + 1;
      const rows = Math.ceil(window.innerHeight / DOT_SPACING) + 1;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = col * DOT_SPACING;
          const y = row * DOT_SPACING;

          const dx = mouse.x - x;
          const dy = mouse.y - y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          let radius = DOT_RADIUS;
          let alpha = 0.08;

          if (dist < INFLUENCE_RADIUS) {
            const intensity = 1 - dist / INFLUENCE_RADIUS;
            const ease = intensity * intensity; // quadratic ease
            radius = DOT_RADIUS + ease * 3;
            alpha = 0.08 + ease * 0.5;

            // Cyan tint near cursor
            const r = 0;
            const g = Math.round(255 * 0.08 + ease * 243 * 0.6);
            const b = Math.round(255 * 0.08 + ease * 255 * 0.6);
            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
          } else {
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
          }

          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      animationId = requestAnimationFrame(draw);
    };

    resize();
    draw();

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <div className="dot-grid-bg">
      <canvas ref={canvasRef} />
    </div>
  );
}
