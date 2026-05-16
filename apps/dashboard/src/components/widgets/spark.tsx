/**
 * Pure-SVG sparkline. Deterministic from a seed string so SSR matches CSR.
 */
export function Spark({
  width = 120,
  height = 36,
  seed = "default",
  stroke = "url(#spark-violet)",
  fill,
  className,
}: {
  width?: number;
  height?: number;
  seed?: string;
  stroke?: string;
  fill?: string;
  className?: string;
}) {
  const points = generate(seed, 28);
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const stepX = width / (points.length - 1);
  const path = points
    .map((p, i) => {
      const x = i * stepX;
      const y = height - ((p - min) / range) * (height - 4) - 2;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const areaPath = `${path} L ${width} ${height} L 0 ${height} Z`;

  const gradId = `g-${hash(seed)}`;
  return (
    <svg className={className} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id="spark-violet" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%"   stopColor="#7C3AED" />
          <stop offset="50%"  stopColor="#06B6D4" />
          <stop offset="100%" stopColor="#EC4899" />
        </linearGradient>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%"   stopColor="rgba(124,58,237,0.35)" />
          <stop offset="100%" stopColor="rgba(124,58,237,0)" />
        </linearGradient>
      </defs>
      {fill !== undefined ? (
        <path d={areaPath} fill={fill === "auto" ? `url(#${gradId})` : fill} />
      ) : null}
      <path d={path} className="spark-line" stroke={stroke} />
    </svg>
  );
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

function generate(seed: string, n: number): number[] {
  let s = 0;
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) | 0;
  const out: number[] = [];
  let v = 50;
  for (let i = 0; i < n; i++) {
    s = (s * 9301 + 49297) % 233280;
    const r = s / 233280;
    v += (r - 0.5) * 22;
    v = Math.max(8, Math.min(96, v));
    out.push(v);
  }
  return out;
}
