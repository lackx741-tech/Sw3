/**
 * Lightweight SVG donut chart with neon gradient strokes.
 */
type Slice = { label: string; value: number; color: string };

export function Donut({ data, size = 160, thickness = 16 }: { data: Slice[]; size?: number; thickness?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const radius = (size - thickness) / 2;
  const c = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.06)" strokeWidth={thickness} fill="none" />
        {data.map((d, i) => {
          const len = (d.value / total) * c;
          const seg = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={d.color}
              strokeWidth={thickness}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              style={{ filter: "drop-shadow(0 0 8px rgba(124,58,237,0.45))" }}
            />
          );
          offset += len;
          return seg;
        })}
      </svg>
      <ul className="space-y-2 text-[13px]">
        {data.map((d) => (
          <li key={d.label} className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color, boxShadow: `0 0 10px ${d.color}` }} />
            <span className="text-ink-200">{d.label}</span>
            <span className="ml-auto font-mono text-ink-400">{((d.value / total) * 100).toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
