import { useState, useEffect } from 'react';
import { ArrowRight, ArrowDown, ChevronUp, Info, X } from 'lucide-react';
import useVideoScrub from '../hooks/useVideoScrub';

const DARK = '#1D3045';
const VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260821_114821_a8ca298f-be2c-4613-a4dd-51b69e16bbde.mp4';

const NAV_LINKS = [
  { label: 'SYNCSPACE AI', active: true },
  { label: 'CAMPUS ENERGY' },
  { label: 'ANALYTICS' },
  { label: 'SMART SYSTEMS' },
  { label: 'DASHBOARD', action: 'dashboard' },
];

/* ---- Stagger animation wrapper ---- */
function Stagger({ visible, delay = 0, children, className = '' }) {
  return (
    <div
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

/* ---- Mobile Menu Overlay ---- */
function MobileMenu({ isOpen, onClose, onDashboard }) {
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  return (
    <div
      className="fixed inset-0 z-[100]"
      style={{
        background: DARK,
        opacity: isOpen ? 1 : 0,
        visibility: isOpen ? 'visible' : 'hidden',
        transition: 'opacity 500ms cubic-bezier(0.4,0,0.2,1), visibility 500ms',
      }}
    >
      <div
        style={{
          transform: isOpen ? 'translateY(0)' : 'translateY(-2rem)',
          transition: 'transform 500ms cubic-bezier(0.4,0,0.2,1)',
        }}
        className="h-full flex flex-col"
      >
        {/* Close button */}
        <div className="flex justify-end px-6 sm:px-8 pt-8 sm:pt-12">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full border border-white/30 flex items-center justify-center hover:border-white transition-colors cursor-pointer"
          >
            <X size={18} color="white" />
          </button>
        </div>

        {/* Links */}
        <div className="flex-1 flex flex-col justify-center px-8 sm:px-12">
          {NAV_LINKS.map((link, i) => (
            <button
              key={link.label}
              onClick={() => {
                if (link.action === 'dashboard') onDashboard();
                onClose();
              }}
              className="py-3 text-left cursor-pointer bg-transparent border-none"
              style={{
                opacity: isOpen ? 1 : 0,
                transform: isOpen ? 'translateY(0)' : 'translateY(20px)',
                transition: `opacity 0.6s cubic-bezier(0.16,1,0.3,1) ${i * 60}ms, transform 0.6s cubic-bezier(0.16,1,0.3,1) ${i * 60}ms`,
              }}
            >
              <span
                className={`text-2xl sm:text-3xl font-light tracking-wide uppercase ${
                  link.active ? 'text-white' : 'text-white/60 hover:text-white'
                } transition-colors`}
              >
                {link.label}
              </span>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="flex gap-8 px-8 sm:px-12 pb-10">
          <span className="text-xs tracking-[0.2em] uppercase text-white/60">NEWS</span>
          <span className="text-xs tracking-[0.2em] uppercase text-white/60">CONTACT</span>
        </div>
      </div>
    </div>
  );
}

/* ===============================================================
   MAIN SCROLL VIDEO SECTION
   =============================================================== */
export default function ScrollVideoSection({ onEnterDashboard }) {
  const { containerRef, videoRef, canvasRef, scrollProgress, canvasLive } =
    useVideoScrub(VIDEO_URL);
  const [menuOpen, setMenuOpen] = useState(false);
  const [navVisible, setNavVisible] = useState(false);

  const p = scrollProgress;
  const isLight = p > 0.55;
  const navColor = isLight ? '#ffffff' : DARK;

  // Section opacities
  const s1 = p < 0.2 ? 1 : Math.max(0, 1 - (p - 0.2) / 0.08);
  const s2 = p < 0.32 ? 0 : p < 0.4 ? (p - 0.32) / 0.08 : p < 0.55 ? 1 : Math.max(0, 1 - (p - 0.55) / 0.08);
  const s3 = p < 0.67 ? 0 : p < 0.75 ? (p - 0.67) / 0.08 : 1;

  // Nav entrance animation
  useEffect(() => {
    const t = setTimeout(() => setNavVisible(true), 200);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <div ref={containerRef} className="relative" style={{ height: '500vh' }}>
        <div className="sticky top-0 w-full h-screen overflow-hidden">
          {/* ---- Video ---- */}
          <video
            ref={videoRef}
            muted
            playsInline
            preload="auto"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ zIndex: 0 }}
          >
            <source src={VIDEO_URL} type="video/mp4" />
          </video>

          {/* ---- Canvas (frame bank overlay) ---- */}
          <canvas
            ref={canvasRef}
            width={1920}
            height={1080}
            className="absolute inset-0 w-full h-full object-cover"
            style={{
              zIndex: 1,
              opacity: canvasLive ? 1 : 0,
              transition: 'opacity 300ms',
            }}
          />

          {/* ---- Overlay (text + nav) ---- */}
          <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 2 }}>
            {/* ======== NAVBAR ======== */}
            <nav className="pointer-events-auto px-6 sm:px-8 md:px-12 pt-8 sm:pt-12 pb-6 flex items-center justify-between relative z-50">
              {/* MOBILE HAMBURGER (<lg) */}
              <button
                onClick={() => setMenuOpen(true)}
                className="lg:hidden flex flex-col gap-[5px] cursor-pointer bg-transparent border-none"
                style={{
                  opacity: navVisible ? 1 : 0,
                  transform: navVisible ? 'translateY(0)' : 'translateY(-12px)',
                  transition: 'opacity 0.6s cubic-bezier(0.16,1,0.3,1) 100ms, transform 0.6s cubic-bezier(0.16,1,0.3,1) 100ms',
                }}
              >
                <span className="block h-[2px] w-6 transition-colors duration-500" style={{ background: navColor }} />
                <span className="block h-[2px] w-6 transition-colors duration-500" style={{ background: navColor }} />
                <span className="block h-[2px] w-4 transition-colors duration-500" style={{ background: navColor }} />
              </button>

              {/* DESKTOP NAV LINKS (lg+) */}
              <div className="hidden lg:flex items-center gap-8 xl:gap-10">
                {NAV_LINKS.map((link, i) => (
                  <button
                    key={link.label}
                    onClick={() => { if (link.action === 'dashboard') onEnterDashboard?.(); }}
                    className="relative bg-transparent border-none cursor-pointer"
                    style={{
                      opacity: navVisible ? 1 : 0,
                      transform: navVisible ? 'translateY(0)' : 'translateY(-12px)',
                      transition: `opacity 0.6s cubic-bezier(0.16,1,0.3,1) ${i * 80 + 100}ms, transform 0.6s cubic-bezier(0.16,1,0.3,1) ${i * 80 + 100}ms`,
                    }}
                  >
                    <span
                      className="text-xs tracking-[0.15em] uppercase font-medium hover:opacity-70 transition-all duration-500"
                      style={{ color: navColor }}
                    >
                      {link.label}
                    </span>
                    {link.active && (
                      <span
                        className="absolute -bottom-3 left-0 w-full h-[2px] transition-colors duration-500"
                        style={{ background: navColor }}
                      />
                    )}
                  </button>
                ))}
              </div>

              {/* RIGHT CLUSTER */}
              <div
                className="hidden sm:flex items-center gap-6"
                style={{
                  opacity: navVisible ? 1 : 0,
                  transform: navVisible ? 'translateY(0)' : 'translateY(-12px)',
                  transition: 'opacity 0.6s cubic-bezier(0.16,1,0.3,1) 500ms, transform 0.6s cubic-bezier(0.16,1,0.3,1) 500ms',
                }}
              >
                {/* NEWS */}
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs tracking-[0.2em] uppercase font-medium transition-colors duration-500"
                    style={{ color: navColor }}
                  >
                    NEWS
                  </span>
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center transition-colors duration-500"
                    style={{ background: navColor }}
                  >
                    <Info size={10} style={{ color: isLight ? DARK : '#ffffff' }} />
                  </span>
                </div>
                {/* MENU (lg+: label, below: button) */}
                <button
                  onClick={() => setMenuOpen(true)}
                  className="bg-transparent border-none cursor-pointer"
                >
                  <span
                    className="text-xs tracking-[0.2em] uppercase font-medium transition-colors duration-500"
                    style={{ color: navColor }}
                  >
                    MENU
                  </span>
                </button>
              </div>
            </nav>

            {/* ======== SECTION 1 — Hero left-aligned ======== */}
            <div
              className="absolute inset-0 flex items-center"
              style={{ opacity: s1, transition: 'opacity 0.1s ease-out' }}
            >
              <div className="px-6 sm:px-8 md:px-20 lg:px-32 w-full">
                <Stagger visible={s1 > 0.3} delay={0}>
                  <h1
                    className="font-light uppercase leading-[1.2]"
                    style={{
                      fontSize: 'clamp(2rem, 5vw, 5rem)',
                      color: DARK,
                    }}
                  >
                    Advancing resources<br />for a cleaner future
                  </h1>
                </Stagger>
                <Stagger visible={s1 > 0.3} delay={150} className="mt-6">
                  <p
                    className="text-sm tracking-[0.3em] uppercase"
                    style={{ color: DARK + '90' }}
                  >
                    Sustainable power with purpose
                  </p>
                </Stagger>
              </div>

              {/* Bottom-right arrow */}
              <Stagger
                visible={s1 > 0.3}
                delay={300}
                className="absolute bottom-12 right-6 sm:right-8 md:right-12"
              >
                <button
                  className="w-12 h-12 rounded-full flex items-center justify-center hover:opacity-70 transition-opacity cursor-pointer bg-transparent"
                  style={{ border: `1px solid ${DARK}80` }}
                >
                  <ArrowRight size={18} style={{ color: DARK }} />
                </button>
              </Stagger>
            </div>

            {/* ======== SECTION 2 — Center ======== */}
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ opacity: s2, transition: 'opacity 0.1s ease-out' }}
            >
              <div className="px-6 sm:px-8 max-w-[900px]">
                <Stagger visible={s2 > 0.3} delay={0}>
                  <h2
                    className="font-extralight tracking-wide leading-[1.3] text-center uppercase"
                    style={{
                      fontSize: 'clamp(1.5rem, 4.5vw, 4.5rem)',
                      color: DARK,
                    }}
                  >
                    We build lasting partnerships with vision{' '}
                    <span style={{ color: DARK + 'cc' }}>and precision</span>{' '}
                    <span style={{ color: DARK + '80' }}>across every frontier</span>
                  </h2>
                </Stagger>
              </div>

              {/* Right column: arrow, dots, chevron */}
              <div className="absolute bottom-16 right-6 sm:right-8 md:right-12 flex flex-col items-center gap-4">
                <Stagger visible={s2 > 0.3} delay={200}>
                  <button
                    className="w-12 h-12 rounded-full flex items-center justify-center bg-transparent cursor-pointer"
                    style={{ border: `1px solid ${DARK}66` }}
                  >
                    <ArrowDown size={18} style={{ color: DARK }} />
                  </button>
                </Stagger>

                <Stagger visible={s2 > 0.3} delay={350} className="flex items-center gap-2 mt-4">
                  <span className="w-2 h-2 rounded-full" style={{ background: DARK }} />
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: DARK + '66' }} />
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: DARK + '66' }} />
                </Stagger>

                <Stagger visible={s2 > 0.3} delay={500} className="mt-2">
                  <button
                    className="w-10 h-10 rounded-full flex items-center justify-center bg-transparent cursor-pointer"
                    style={{ border: `1px solid ${DARK}4d` }}
                  >
                    <ChevronUp size={16} style={{ color: DARK + 'cc' }} />
                  </button>
                </Stagger>
              </div>
            </div>

            {/* ======== SECTION 3 — Right-aligned, white text ======== */}
            <div
              className="absolute inset-0 flex items-center justify-end"
              style={{ opacity: s3, transition: 'opacity 0.1s ease-out' }}
            >
              <div className="px-6 sm:px-8 md:px-20 lg:px-32 max-w-2xl text-left">
                <Stagger visible={s3 > 0.3} delay={0}>
                  <p className="text-white/60 text-lg tracking-wide mb-4">
                    SyncSpace | AI
                  </p>
                </Stagger>
                <Stagger visible={s3 > 0.3} delay={150}>
                  <h2
                    className="font-light text-white leading-[1.2] uppercase tracking-wide mb-8"
                    style={{ fontSize: 'clamp(2rem, 4vw, 4rem)' }}
                  >
                    Fueling ambition,<br />shaping tomorrow.
                  </h2>
                </Stagger>
                <Stagger visible={s3 > 0.3} delay={300} className="flex items-center gap-4 pointer-events-auto">
                  <button
                    onClick={onEnterDashboard}
                    className="text-sm tracking-[0.3em] text-white/80 uppercase bg-transparent border-none cursor-pointer hover:text-white transition-colors"
                  >
                    Enter Dashboard
                  </button>
                  <button
                    onClick={onEnterDashboard}
                    className="w-10 h-10 rounded-full bg-white flex items-center justify-center hover:scale-110 transition-transform duration-300 cursor-pointer border-none"
                  >
                    <ArrowRight size={16} className="text-gray-800" />
                  </button>
                </Stagger>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu overlay */}
      <MobileMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        onDashboard={() => onEnterDashboard?.()}
      />
    </>
  );
}
