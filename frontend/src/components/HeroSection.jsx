export default function HeroSection({ onEnterDashboard }) {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* ===== FULLSCREEN BACKGROUND VIDEO ===== */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover z-0"
      >
        <source
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4"
          type="video/mp4"
        />
      </video>

      {/* Dark overlay for text readability */}
      <div className="absolute inset-0 bg-black/30 z-[1]" />

      {/* ===== NAVIGATION BAR ===== */}
      <nav className="relative z-10 flex flex-row items-center justify-between px-8 py-6 max-w-7xl mx-auto">
        {/* Logo */}
        <span
          className="text-3xl tracking-tight text-foreground"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          SyncSpace<sup className="text-xs">AI</sup>
        </span>

        {/* Nav Links */}
        <div className="hidden md:flex items-center gap-8">
          <a href="#hero" className="text-sm text-foreground transition-colors">Home</a>
          <a href="#dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Dashboard</a>
          <a href="#rooms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Rooms</a>
          <a href="#upload" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Upload</a>
        </div>

        {/* CTA */}
        <button
          onClick={onEnterDashboard}
          className="liquid-glass rounded-full px-6 py-2.5 text-sm text-foreground hover:scale-[1.03] transition-transform cursor-pointer"
        >
          Enter Dashboard
        </button>
      </nav>

      {/* ===== HERO CONTENT ===== */}
      <section id="hero" className="relative z-10 flex flex-col items-center justify-center text-center px-6 pt-32 pb-40">
        {/* Headline */}
        <h1
          className="text-5xl sm:text-7xl md:text-8xl leading-[0.95] tracking-[-2.46px] max-w-7xl font-normal animate-fade-rise"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          Where <em className="not-italic text-muted-foreground">energy</em> meets{' '}
          <em className="not-italic text-muted-foreground">intelligent sustainability.</em>
        </h1>

        {/* Subtext */}
        <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mt-8 leading-relaxed animate-fade-rise-delay">
          SyncSpace AI analyzes your campus energy usage, detects wasteful patterns,
          and calculates the true cost — in money and carbon. Transform your campus
          into a smarter, greener space.
        </p>

        {/* CTA Button — scrolls to dashboard */}
        <button
          onClick={onEnterDashboard}
          className="liquid-glass rounded-full px-14 py-5 text-base text-foreground mt-12 hover:scale-[1.03] transition-transform cursor-pointer animate-fade-rise-delay-2"
        >
          Enter Dashboard ↓
        </button>
      </section>
    </div>
  );
}
