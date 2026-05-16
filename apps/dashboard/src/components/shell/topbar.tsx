"use client";

import * as React from "react";
import { Bell, ChevronDown, Command, Menu, Plus, Search } from "lucide-react";

type Chain = { id: number; name: string; testnet: boolean; tint: string };

const CHAINS: readonly Chain[] = [
  { id: 1,        name: "Ethereum",    testnet: false, tint: "from-violet-500 to-cyan-400" },
  { id: 8453,     name: "Base",        testnet: false, tint: "from-cyan-400 to-blue-500"   },
  { id: 42161,    name: "Arbitrum",    testnet: false, tint: "from-cyan-500 to-violet-500" },
  { id: 10,       name: "Optimism",    testnet: false, tint: "from-pink-500 to-rose-400"   },
  { id: 137,      name: "Polygon",     testnet: false, tint: "from-violet-500 to-pink-500" },
  { id: 31337,    name: "Anvil Local", testnet: true,  tint: "from-emerald-400 to-cyan-400"},
  { id: 11155111, name: "Sepolia",     testnet: true,  tint: "from-amber-400 to-pink-400"  },
] as const;

const DEFAULT_CHAIN: Chain = CHAINS[0]!;

export function TopBar() {
  const [chainId, setChainId] = React.useState<number>(DEFAULT_CHAIN.id);
  const [open, setOpen] = React.useState(false);
  const active: Chain = CHAINS.find((c) => c.id === chainId) ?? DEFAULT_CHAIN;
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handler(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-void-900/55 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-3 px-5 md:px-10">
        <button className="btn-icon md:hidden" aria-label="open menu">
          <Menu className="h-4 w-4" />
        </button>

        {/* Search */}
        <label className="group relative hidden h-10 flex-1 max-w-lg items-center gap-2 rounded-xl border border-hairline bg-glass px-3 text-sm text-ink-200 backdrop-blur md:flex focus-within:border-violet-500/50 focus-within:bg-glass-strong">
          <Search className="h-4 w-4 text-ink-400 group-focus-within:text-cyan-300" />
          <input
            type="search"
            placeholder="Search tokens, addresses, txs, proposals…"
            className="w-full bg-transparent outline-none placeholder:text-ink-500"
          />
          <kbd className="ml-auto inline-flex items-center gap-1 rounded-md border border-hairline bg-glass px-1.5 py-0.5 font-mono text-2xs text-ink-400">
            <Command className="h-3 w-3" /> K
          </kbd>
        </label>

        <div className="ml-auto flex items-center gap-2">
          {/* Chain switcher */}
          <div ref={ref} className="relative">
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex h-10 items-center gap-2.5 rounded-xl border border-hairline bg-glass px-3 text-[13px] text-white backdrop-blur transition hover:border-hairline-strong"
            >
              <span className={`h-2.5 w-2.5 rounded-full bg-gradient-to-br ${active.tint} ring-2 ring-white/10`} />
              <span className="font-medium">{active.name}</span>
              <span className="font-mono text-2xs text-ink-400">#{active.id}</span>
              <ChevronDown className="h-3.5 w-3.5 text-ink-400" />
            </button>
            {open ? (
              <div className="absolute right-0 top-12 z-40 w-72 rounded-2xl border border-hairline-strong bg-void-800/90 p-1.5 shadow-glass-lg backdrop-blur-xl animate-scale-in">
                <p className="px-3 py-2 font-mono text-2xs uppercase tracking-widest text-ink-500">
                  Network
                </p>
                {CHAINS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setChainId(c.id); setOpen(false); }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] text-ink-100 transition hover:bg-white/[0.06]"
                  >
                    <span className={`h-2.5 w-2.5 rounded-full bg-gradient-to-br ${c.tint} ring-2 ring-white/10`} />
                    <span className="flex-1">{c.name}</span>
                    {c.testnet ? (
                      <span className="chip chip-warn">testnet</span>
                    ) : (
                      <span className="font-mono text-2xs text-ink-500">#{c.id}</span>
                    )}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <button className="btn-icon relative" aria-label="notifications">
            <Bell className="h-4 w-4" />
            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-pink-500 shadow-[0_0_8px_rgba(236,72,153,0.9)]" />
          </button>

          <button className="btn-primary hidden md:inline-flex">
            <Plus className="h-3.5 w-3.5" /> New sweep
          </button>

          {/* Wallet */}
          <button className="relative flex h-10 items-center gap-2 overflow-hidden rounded-xl border border-hairline bg-glass px-3 text-[13px] text-white backdrop-blur transition hover:border-hairline-strong">
            <span className="relative grid place-items-center">
              <span className="absolute h-3 w-3 rounded-full bg-cyan-500/60 animate-pulse-ring" />
              <span className="relative h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.9)]" />
            </span>
            <span className="font-mono text-[12px]">0xf39F…2266</span>
          </button>
        </div>
      </div>
    </header>
  );
}
