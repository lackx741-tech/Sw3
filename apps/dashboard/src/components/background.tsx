/**
 * Cinematic background:
 *  - radial aurora wash
 *  - floating blurred orbs (violet, cyan, pink)
 *  - subtle SVG grid + noise overlay
 * Pure CSS / SVG — zero JS, GPU-friendly, respects prefers-reduced-motion.
 */
export function Background() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Aurora wash */}
      <div className="absolute inset-0 bg-aurora" />

      {/* Floating orbs */}
      <div className="absolute -top-32 -left-24 h-[520px] w-[520px] rounded-full bg-violet-600/30 blur-[120px] animate-blob" />
      <div className="absolute top-1/3 -right-24 h-[460px] w-[460px] rounded-full bg-cyan-500/25 blur-[110px] animate-float-slow" />
      <div className="absolute bottom-[-160px] left-1/3 h-[520px] w-[520px] rounded-full bg-pink-500/20 blur-[120px] animate-float" />

      {/* Grid */}
      <div
        className="absolute inset-0 opacity-[0.18] mask-fade-b"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />

      {/* Noise */}
      <div className="absolute inset-0 opacity-[0.18] mix-blend-overlay bg-noise" />

      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% -10%, transparent 50%, rgba(3,5,22,0.85) 100%)",
        }}
      />
    </div>
  );
}
