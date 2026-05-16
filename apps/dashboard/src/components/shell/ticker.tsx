"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

type Tick = { sym: string; px: string; ch: number };

const SEED: Tick[] = [
  { sym: "ETH",   px: "3,824.12", ch: +2.41 },
  { sym: "BTC",   px: "67,210.50", ch: +1.08 },
  { sym: "SOL",   px: "184.62",   ch: +4.92 },
  { sym: "MATIC", px: "0.892",    ch: -1.21 },
  { sym: "ARB",   px: "1.214",    ch: +3.10 },
  { sym: "OP",    px: "2.34",     ch: -0.85 },
  { sym: "LINK",  px: "18.92",    ch: +5.62 },
  { sym: "UNI",   px: "11.48",    ch: +0.93 },
  { sym: "AAVE",  px: "162.45",   ch: -2.10 },
  { sym: "MKR",   px: "2,184.10", ch: +1.84 },
  { sym: "LDO",   px: "2.92",     ch: +6.40 },
  { sym: "USDC",  px: "1.0001",   ch: +0.01 },
  { sym: "BASE",  px: "0.844",    ch: +9.20 },
];

export function Ticker() {
  const ticks = React.useMemo(() => [...SEED, ...SEED], []);
  return (
    <div className="relative h-9 overflow-hidden border-b border-hairline bg-void-900/55 backdrop-blur">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-28 bg-gradient-to-r from-void-900 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-28 bg-gradient-to-l from-void-900 to-transparent" />
      <div className="flex h-full w-max items-center gap-10 whitespace-nowrap pl-6 animate-tape">
        {ticks.map((t, i) => (
          <span key={i} className="inline-flex items-center gap-2 font-mono text-[11px]">
            <span className="uppercase tracking-widest text-ink-400">{t.sym}</span>
            <span className="text-ink-100 tabular-nums">${t.px}</span>
            <span
              className={`inline-flex items-center gap-0.5 ${
                t.ch >= 0 ? "text-emerald-400" : "text-pink-400"
              }`}
            >
              {t.ch >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(t.ch).toFixed(2)}%
            </span>
            <span className="text-ink-600">•</span>
          </span>
        ))}
      </div>
    </div>
  );
}
