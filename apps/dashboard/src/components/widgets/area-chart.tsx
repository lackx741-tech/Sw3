"use client";

/**
 * Animated SVG area chart placeholder.
 * Uses Tailwind classes and CSS variables only; no charting library.
 */
export function AreaChart({
  seed = "tvl",
  height = 220,
}: {
  seed?: string;
  height?: number;
}) {
  const w = 760;
  const points = generate(seed, 48);
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const stepX = w / (points.length - 1);
  const path = points
    .map((p, i) => {
      const x = i * stepX;
      const y = height - ((p - min) / range) * (height - 30) - 18;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const areaPath = `${path} L ${w} ${height} L 0 ${height} Z`;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${w} ${height}`} className="w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="area-stroke" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%"   stopColor="#A78BFA" />
            <stop offset="50%"  stopColor="#22D3EE" />
            <stop offset="100%" stopColor="#F472B6" />
          </linearGradient>
          <linearGradient id="area-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%"   stopColor="rgba(124,58,237,0.35)" />
            <stop offset="55%"  stopColor="rgba(6,182,212,0.12)"  />
            <stop offset="100%" stopColor="rgba(236,72,153,0)"    />
          </linearGradient>
          <pattern id="grid-p" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-p)" />
        <path d={areaPath} fill="url(#area-fill)" />
        <path d={path} fill="none" stroke="url(#area-stroke)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Last-point glow */}
        <circle
          cx={(points.length - 1) * stepX}
          cy={height - ((points[points.length - 1]! - min) / range) * (height - 30) - 18}
          r="4"
          fill="#22D3EE"
          className="drop-shadow-[0_0_8px_rgba(34,211,238,0.9)]"
        />
      </svg>

      {/* Axis labels */}
      <div className="mt-2 flex justify-between font-mono text-2xs uppercase tracking-widest text-ink-500">
        {["00:00", "04:00", "08:00", "12:00", "16:00", "20:00", "now"].map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
    </div>
  );
}

function generate(seed: string, n: number): number[] {
  let s = 0;
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) | 0;
  const out: number[] = [];
  let v = 55;
  for (let i = 0; i < n; i++) {
    s = (s * 9301 + 49297) % 233280;
    const r = s / 233280;
    v += (r - 0.45) * 18;
    v = Math.max(10, Math.min(95, v));
    out.push(v);
  }
  return out;
}
