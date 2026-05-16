import {
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  Brain,
  CheckCircle2,
  Clock,
  Coins,
  Cpu,
  Flame,
  Globe2,
  Layers,
  Network,
  Radio,
  Shield,
  Sparkles,
  TrendingUp,
  Vote,
  Wallet,
  Wand2,
  Zap,
} from "lucide-react";
import { Spark } from "../components/widgets/spark";
import { AreaChart } from "../components/widgets/area-chart";
import { Donut } from "../components/widgets/donut";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-16">
      <Hero />
      <Analytics />
      <Portfolio />
      <Activity />
      <Intelligence />
    </div>
  );
}

/* ────────────────────────────── HERO ────────────────────────────── */

function Hero() {
  return (
    <section id="hero" className="relative">
      <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_1fr]">
        <div className="relative animate-fade-up">
          <p className="eyebrow">Operator console · v0.1.0</p>

          <h1
            className="mt-5 font-display font-medium leading-[1.02] tracking-tight text-ink-50 text-balance"
            style={{ fontSize: "var(--fs-hero)" }}
          >
            The <span className="text-gradient">web3 operating system</span>{" "}
            for sweeping at the edge.
          </h1>

          <p className="mt-6 max-w-xl text-pretty text-[15px] leading-relaxed text-ink-300 md:text-[16px]">
            SW3 unifies ERC-20 sweeping, EIP-7702 delegation, simulation, and on-chain
            execution into a single console. Deploy in minutes. Monitor in milliseconds.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href="#analytics" className="btn btn-primary">
              <Zap className="h-4 w-4" /> Launch console
            </a>
            <a href="#ai" className="btn btn-ghost">
              <Sparkles className="h-4 w-4" /> See the intelligence layer
            </a>
            <div className="ml-2 flex items-center gap-2 font-mono text-2xs uppercase tracking-widest text-ink-400">
              <span className="dot dot-live animate-glow-pulse" />
              live across 7 chains
            </div>
          </div>

          <dl className="mt-10 grid max-w-xl grid-cols-3 gap-px overflow-hidden rounded-2xl border border-hairline bg-hairline">
            {[
              { k: "TVL",        v: "$184.2M",   d: "+12.4%" },
              { k: "Sweeps · 24h", v: "12,840",  d: "+8.7%"  },
              { k: "Median exec",  v: "312 ms",  d: "−14 ms" },
            ].map((s) => (
              <div key={s.k} className="bg-void-900 p-5">
                <dt className="font-mono text-2xs uppercase tracking-widest text-ink-500">{s.k}</dt>
                <dd className="mt-2 font-mono text-[22px] font-medium text-ink-50 tabular-nums">
                  {s.v}
                </dd>
                <p className="mt-1 font-mono text-2xs uppercase tracking-widest text-emerald-400">
                  {s.d}
                </p>
              </div>
            ))}
          </dl>
        </div>

        {/* Right visual — floating glass mockup */}
        <HeroMock />
      </div>
    </section>
  );
}

function HeroMock() {
  return (
    <div className="relative mx-auto flex w-full max-w-md items-center justify-center lg:max-w-none">
      <div className="absolute -inset-10 -z-10 bg-aurora opacity-80 blur-2xl" />

      {/* Card stack */}
      <div className="relative h-[460px] w-full">
        {/* Back gradient card */}
        <div className="absolute right-0 top-6 h-[340px] w-[78%] rotate-[6deg] rounded-3xl bg-gradient-to-br from-violet-600/40 via-cyan-500/30 to-pink-500/40 shadow-glow-violet animate-float-slow" />

        {/* Mid card */}
        <div
          className="absolute left-0 top-2 h-[380px] w-[80%] rounded-3xl border border-hairline-strong bg-void-800/70 backdrop-blur-xl shadow-glass-lg"
          style={{ rotate: "-4deg" }}
        >
          <div className="flex items-center gap-2 border-b border-hairline px-5 py-4">
            <span className="dot dot-live" />
            <span className="font-mono text-2xs uppercase tracking-widest text-ink-400">
              live · base mainnet
            </span>
            <span className="chip chip-cyan ml-auto">delegated</span>
          </div>
          <div className="grid grid-cols-2 gap-3 p-5">
            {[
              { l: "Owner",      v: "0xa12c…77fe" },
              { l: "Token",      v: "USDC" },
              { l: "Amount",     v: "12,480.00" },
              { l: "Fee BPS",    v: "30" },
              { l: "Permit2",    v: "1d expires" },
              { l: "EIP-7702",   v: "authorized" },
            ].map((r) => (
              <div key={r.l} className="rounded-xl bg-glass p-3">
                <p className="font-mono text-2xs uppercase tracking-widest text-ink-500">{r.l}</p>
                <p className="mt-1 font-mono text-[13px] text-ink-100">{r.v}</p>
              </div>
            ))}
          </div>
          <div className="border-t border-hairline px-5 py-4">
            <Spark seed="hero-mid" width={290} height={48} fill="auto" className="w-full" />
          </div>
        </div>

        {/* Front glass card */}
        <div
          className="absolute bottom-0 right-2 h-[260px] w-[64%] rounded-3xl border border-hairline-strong bg-void-700/75 backdrop-blur-2xl shadow-glass-lg animate-float"
          style={{ rotate: "4deg" }}
        >
          <div className="flex items-start justify-between border-b border-hairline px-5 py-4">
            <div>
              <p className="font-mono text-2xs uppercase tracking-widest text-ink-400">
                Sweep · sw_8f3a
              </p>
              <p className="mt-1 font-display text-2xl font-medium text-ink-50">
                $12,480.<span className="text-ink-400">00</span>
              </p>
            </div>
            <span className="chip chip-ok"><span className="dot dot-ok" /> confirmed</span>
          </div>
          <div className="p-5">
            <div className="flex items-center gap-3">
              <Wallet className="h-4 w-4 text-cyan-300" />
              <p className="text-[13px] text-ink-200">EIP-7702 delegated batch</p>
            </div>
            <div className="mt-3 flex items-center gap-2 text-2xs font-mono uppercase tracking-widest text-ink-500">
              <CheckCircle2 className="h-3 w-3 text-emerald-400" /> tx 0x9c3a…ab10
            </div>
            <div className="mt-4 flex items-center justify-between font-mono text-2xs uppercase tracking-widest text-ink-400">
              <span>gas <span className="text-ink-100">0.43 gwei</span></span>
              <span>block <span className="text-ink-100">#19,482,113</span></span>
            </div>
          </div>
        </div>

        {/* Sparkle accents */}
        <div className="absolute left-[-22px] top-[44%] h-3 w-3 rounded-full bg-pink-500 shadow-glow-pink animate-glow-pulse" />
        <div className="absolute right-[-12px] top-[8%]  h-2 w-2 rounded-full bg-cyan-400 shadow-glow-cyan animate-glow-pulse" />
        <div className="absolute right-[26%] bottom-[-10px] h-3 w-3 rounded-full bg-violet-500 shadow-glow-violet animate-glow-pulse" />
      </div>
    </div>
  );
}

/* ───────────────────────────── ANALYTICS ───────────────────────────── */

function Analytics() {
  const kpis = [
    { k: "Total Value Locked", v: "$184.2M", d: "+12.4%",     intent: "ok",   icon: Coins,      seed: "tvl"  },
    { k: "Wallet activity",    v: "84,201",  d: "+5.8% MAU",  intent: "ok",   icon: Wallet,     seed: "wal"  },
    { k: "Net revenue · 24h",  v: "$48,210", d: "+18.2%",     intent: "ok",   icon: TrendingUp, seed: "rev"  },
    { k: "Avg token perf",     v: "+6.42%",  d: "vs index",   intent: "ok",   icon: Flame,      seed: "perf" },
  ] as const;

  return (
    <section id="analytics" className="relative">
      <SectionHeader
        eyebrow="Analytics · live"
        title="Capital flow at a glance"
        description="Cross-chain TVL, wallet activity, and protocol revenue — streamed from the indexer-service every block."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k, i) => {
          const Icon = k.icon;
          return (
            <article
              key={k.k}
              className="lift glass p-5 hover:border-hairline-strong hover:shadow-glass-lg"
              style={{ animation: `fade-up 600ms ${i * 80}ms both` }}
            >
              <div className="flex items-center justify-between">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-violet-cyan text-white shadow-glow-violet">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="chip chip-ok">
                  <ArrowUpRight className="h-3 w-3" /> {k.d}
                </span>
              </div>
              <p className="mt-4 font-mono text-2xs uppercase tracking-widest text-ink-500">{k.k}</p>
              <p className="mt-1 font-display text-[28px] font-medium text-ink-50 data-num tracking-tight">{k.v}</p>
              <Spark seed={k.seed} width={260} height={36} fill="auto" className="mt-3 w-full" />
            </article>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <article className="glass p-6 lg:p-8 animate-fade-up">
          <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Net flow</p>
              <h3 className="mt-2 font-display text-xl font-medium text-ink-50">
                Cross-chain capital flow · 24h
              </h3>
            </div>
            <div className="flex items-center gap-1.5">
              {["1H", "24H", "7D", "30D"].map((t, i) => (
                <button
                  key={t}
                  className={
                    i === 1
                      ? "rounded-lg bg-glass-strong px-3 py-1.5 font-mono text-2xs uppercase tracking-widest text-white ring-1 ring-violet-500/40"
                      : "rounded-lg px-3 py-1.5 font-mono text-2xs uppercase tracking-widest text-ink-400 hover:text-ink-100"
                  }
                >
                  {t}
                </button>
              ))}
            </div>
          </header>
          <AreaChart seed="tvl-trend" height={240} />
        </article>

        <article className="glass p-6 lg:p-8 animate-fade-up">
          <p className="eyebrow">Allocation</p>
          <h3 className="mt-2 font-display text-xl font-medium text-ink-50">Token mix</h3>
          <div className="mt-6">
            <Donut
              data={[
                { label: "USDC", value: 38, color: "#7C3AED" },
                { label: "WETH", value: 26, color: "#22D3EE" },
                { label: "DAI",  value: 16, color: "#EC4899" },
                { label: "USDT", value: 12, color: "#A78BFA" },
                { label: "Other",value:  8, color: "#67E8F9" },
              ]}
            />
          </div>
        </article>
      </div>
    </section>
  );
}

/* ───────────────────────────── PORTFOLIO ───────────────────────────── */

function Portfolio() {
  const assets = [
    { sym: "ETH",  name: "Ether",     bal: "12.4821",   usd: "$47,720", ch: +2.41, seed: "eth"  },
    { sym: "USDC", name: "USD Coin",  bal: "184,212.10", usd: "$184,212", ch: +0.01, seed: "usdc" },
    { sym: "WBTC", name: "Wrapped BTC", bal: "0.9120",   usd: "$61,304", ch: +1.08, seed: "wbtc" },
    { sym: "ARB",  name: "Arbitrum",  bal: "21,400.00",  usd: "$25,980", ch: +3.10, seed: "arb"  },
    { sym: "LINK", name: "Chainlink", bal: "1,240.00",   usd: "$23,460", ch: +5.62, seed: "link" },
    { sym: "OP",   name: "Optimism",  bal: "8,910.00",   usd: "$20,849", ch: -0.85, seed: "op"   },
  ];
  const nfts = [
    { col: "MIRROR-ID #1248",  tag: "1/1",  tint: "from-violet-500 to-cyan-400" },
    { col: "OBSIDIAN PASS #02", tag: "key", tint: "from-cyan-400 to-pink-500"   },
    { col: "AURORA SHARD #77", tag: "rare", tint: "from-pink-500 to-violet-500" },
  ];

  return (
    <section id="portfolio">
      <SectionHeader
        eyebrow="Portfolio"
        title="Assets, positions, and on-chain yield"
        description="Unified view of liquid assets, staking commitments, and active yield strategies across connected wallets."
      />

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        {/* Assets */}
        <article className="glass overflow-hidden animate-fade-up">
          <header className="flex items-center justify-between border-b border-hairline px-6 py-4">
            <div>
              <p className="eyebrow">Crypto assets</p>
              <h3 className="mt-2 font-display text-lg font-medium text-ink-50">Holdings</h3>
            </div>
            <button className="btn btn-ghost text-[12px]">View all <ArrowUpRight className="h-3 w-3" /></button>
          </header>
          <div className="divide-y divide-hairline">
            {assets.map((a) => (
              <div key={a.sym} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-6 py-3.5">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-violet-cyan font-mono text-[11px] font-bold text-white">
                    {a.sym}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[14px] text-ink-100">{a.name}</p>
                    <p className="font-mono text-2xs uppercase tracking-widest text-ink-500">{a.sym}</p>
                  </div>
                </div>
                <Spark seed={a.seed} width={80} height={28} className="opacity-90" />
                <div className="min-w-[120px] text-right">
                  <p className="data-num text-[14px] text-ink-100">{a.bal}</p>
                  <p className="data-num text-2xs text-ink-500">{a.usd}</p>
                </div>
                <span className={`inline-flex items-center gap-0.5 font-mono text-2xs ${a.ch >= 0 ? "text-emerald-400" : "text-pink-400"}`}>
                  {a.ch >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {Math.abs(a.ch).toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </article>

        {/* Right column */}
        <div className="flex flex-col gap-4">
          {/* NFT preview */}
          <article className="glass p-6 animate-fade-up">
            <p className="eyebrow">Collectibles</p>
            <h3 className="mt-2 font-display text-lg font-medium text-ink-50">NFT preview</h3>
            <div className="mt-4 grid grid-cols-3 gap-2.5">
              {nfts.map((n) => (
                <div key={n.col} className={`relative aspect-square overflow-hidden rounded-xl bg-gradient-to-br ${n.tint}`}>
                  <div className="absolute inset-0 bg-black/15" />
                  <div className="absolute inset-x-0 bottom-0 p-2">
                    <p className="font-mono text-[9px] uppercase tracking-widest text-white/90">{n.col}</p>
                    <p className="mt-0.5 font-mono text-[8px] uppercase tracking-widest text-white/70">{n.tag}</p>
                  </div>
                </div>
              ))}
            </div>
          </article>

          {/* Staking */}
          <article className="glass p-6 animate-fade-up">
            <div className="flex items-center justify-between">
              <p className="eyebrow">Staking</p>
              <span className="chip chip-violet">active · 4 positions</span>
            </div>
            <div className="mt-4 space-y-3">
              {[
                { p: "Lido stETH",  apr: "3.21%", val: "$12,210" },
                { p: "Rocket rETH", apr: "3.04%", val: "$8,420"  },
                { p: "Aave aUSDC",  apr: "4.12%", val: "$24,800" },
              ].map((s) => (
                <div key={s.p} className="flex items-center justify-between rounded-xl bg-glass p-3.5">
                  <div>
                    <p className="text-[13px] text-ink-100">{s.p}</p>
                    <p className="mt-0.5 font-mono text-2xs uppercase tracking-widest text-emerald-400">
                      APR {s.apr}
                    </p>
                  </div>
                  <p className="data-num text-[14px] text-ink-100">{s.val}</p>
                </div>
              ))}
            </div>
          </article>

          {/* Yield farm */}
          <article className="glass p-6 animate-fade-up">
            <p className="eyebrow">Yield farming</p>
            <h3 className="mt-2 font-display text-lg font-medium text-ink-50">Open strategies</h3>
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-ink-200">USDC / ETH 0.05%</span>
                <span className="chip chip-cyan">Uniswap v4</span>
              </div>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-glass">
                <div className="h-full w-[68%] rounded-full bg-gradient-primary shadow-glow-violet" />
              </div>
              <div className="mt-2 flex justify-between font-mono text-2xs uppercase tracking-widest text-ink-500">
                <span>in range · 68%</span>
                <span>est. APY <span className="text-emerald-400">11.42%</span></span>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────── ACTIVITY ───────────────────────────── */

function Activity() {
  const txs = [
    { k: "Sweep · USDC", a: "0xa12c…77fe", v: "$12,480", t: "12s",  ic: Zap,     tone: "violet" },
    { k: "Permit2 sign", a: "0x77b1…0c2d", v: "—",       t: "44s",  ic: Shield,  tone: "cyan"   },
    { k: "Sweep · WETH", a: "0x3e98…aa10", v: "$3,210",  t: "1m",   ic: Zap,     tone: "violet" },
    { k: "Delegation",   a: "0x5b04…fe7c", v: "EIP-7702",t: "2m",   ic: Wand2,   tone: "pink"   },
    { k: "Sweep · DAI",  a: "0xc019…11a4", v: "$9,200",  t: "3m",   ic: Zap,     tone: "violet" },
    { k: "RPC failover", a: "router-01",   v: "auto",    t: "5m",   ic: Network, tone: "cyan"   },
  ] as const;

  const proposals = [
    { n: "SW3-IP-024", t: "Adjust fee tier to 25 bps", st: "voting", end: "2d" },
    { n: "SW3-IP-023", t: "Add Linea to chain registry", st: "passed", end: "—" },
    { n: "SW3-IP-022", t: "Treasury diversification",  st: "queued", end: "5d" },
  ];

  return (
    <section id="activity">
      <SectionHeader
        eyebrow="Ecosystem"
        title="Ecosystem activity feed"
        description="Live transactions, governance proposals, and wallet notifications — sourced from the indexer + RPC mempool listener."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <article className="glass overflow-hidden animate-fade-up lg:col-span-2">
          <header className="flex items-center justify-between border-b border-hairline px-6 py-4">
            <div>
              <p className="eyebrow">Transactions timeline</p>
              <h3 className="mt-2 font-display text-lg font-medium text-ink-50">Recent on-chain activity</h3>
            </div>
            <span className="chip chip-cyan"><span className="dot dot-live" /> streaming</span>
          </header>
          <ol className="relative px-6 py-5">
            <span className="absolute bottom-5 left-[36px] top-5 w-px bg-gradient-to-b from-violet-500/40 via-cyan-500/40 to-pink-500/40" />
            {txs.map((tx, i) => {
              const Icon = tx.ic;
              const ring =
                tx.tone === "violet"
                  ? "bg-violet-500/15 ring-violet-400/40 text-violet-200"
                  : tx.tone === "cyan"
                    ? "bg-cyan-500/15 ring-cyan-400/40 text-cyan-200"
                    : "bg-pink-500/15 ring-pink-400/40 text-pink-200";
              return (
                <li key={i} className="relative grid grid-cols-[40px_1fr_auto_auto] items-center gap-3 py-3.5">
                  <span className={`grid h-9 w-9 place-items-center rounded-xl ring-1 ${ring}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[14px] text-ink-100">{tx.k}</p>
                    <p className="font-mono text-2xs uppercase tracking-widest text-ink-500">{tx.a}</p>
                  </div>
                  <span className="data-num text-[14px] text-ink-100">{tx.v}</span>
                  <span className="inline-flex items-center gap-1 font-mono text-2xs uppercase tracking-widest text-ink-500">
                    <Clock className="h-3 w-3" /> {tx.t}
                  </span>
                </li>
              );
            })}
          </ol>
        </article>

        <article className="glass p-6 animate-fade-up">
          <header className="mb-4 flex items-center justify-between">
            <div>
              <p className="eyebrow">Governance</p>
              <h3 className="mt-2 font-display text-lg font-medium text-ink-50">DAO proposals</h3>
            </div>
            <Vote className="h-4 w-4 text-violet-400" />
          </header>
          <ul className="space-y-3">
            {proposals.map((p) => (
              <li key={p.n} className="rounded-xl bg-glass p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-2xs uppercase tracking-widest text-violet-300">{p.n}</span>
                  <span className={`chip ${p.st === "voting" ? "chip-cyan" : p.st === "passed" ? "chip-ok" : "chip-warn"}`}>
                    {p.st}
                  </span>
                </div>
                <p className="mt-2 text-[13px] text-ink-100">{p.t}</p>
                <p className="mt-1 font-mono text-2xs uppercase tracking-widest text-ink-500">ends in · {p.end}</p>
              </li>
            ))}
          </ul>

          <div className="mt-5 rounded-2xl bg-glass-strong p-4">
            <p className="eyebrow">Wallet notifications</p>
            <ul className="mt-3 space-y-2.5 text-[13px]">
              <li className="flex items-center gap-2 text-ink-200">
                <span className="dot dot-ok" /> stETH yield credited <span className="ml-auto font-mono text-2xs text-ink-500">2m</span>
              </li>
              <li className="flex items-center gap-2 text-ink-200">
                <span className="dot dot-warn" /> Permit2 expires in 12h <span className="ml-auto font-mono text-2xs text-ink-500">10m</span>
              </li>
              <li className="flex items-center gap-2 text-ink-200">
                <span className="dot dot-live" /> Sweep authorized · Base <span className="ml-auto font-mono text-2xs text-ink-500">1h</span>
              </li>
            </ul>
          </div>
        </article>
      </div>
    </section>
  );
}

/* ─────────────────────────── INTELLIGENCE ─────────────────────────── */

function Intelligence() {
  return (
    <section id="ai" className="relative">
      <SectionHeader
        eyebrow="Intelligence"
        title="AI · Web3 insights"
        description="Smart recommendations and market sentiment, computed against your wallet history and on-chain regimes."
      />

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        {/* AI Brief */}
        <article className="gradient-border relative overflow-hidden rounded-3xl bg-void-800/60 backdrop-blur-xl animate-fade-up">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-violet-600/30 blur-3xl" />
          <div className="absolute -bottom-20 left-1/3 h-64 w-64 rounded-full bg-cyan-500/20 blur-3xl" />

          <div className="relative p-7 lg:p-9">
            <div className="flex items-center gap-3">
              <span className="relative grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary shadow-glow-violet">
                <Brain className="h-5 w-5 text-white" />
                <span className="absolute -inset-1 rounded-2xl bg-gradient-primary opacity-40 blur-md animate-glow-pulse" />
              </span>
              <div>
                <p className="eyebrow">SW3 Copilot</p>
                <h3 className="mt-1 font-display text-xl font-medium text-ink-50">Today's brief</h3>
              </div>
              <span className="ml-auto chip chip-violet">v2 · neural</span>
            </div>

            <ul className="mt-6 space-y-4 text-[15px] leading-relaxed text-ink-200">
              <li className="flex gap-3">
                <Sparkles className="mt-1 h-4 w-4 shrink-0 text-violet-300" />
                <p>
                  Gas on <strong className="text-ink-50">Base</strong> is trading 38% below
                  its 7-day average. Consider front-loading scheduled sweeps for the next
                  <strong className="text-cyan-300"> 2h 14m</strong>.
                </p>
              </li>
              <li className="flex gap-3">
                <Bot className="mt-1 h-4 w-4 shrink-0 text-cyan-300" />
                <p>
                  Your <strong className="text-ink-50">stETH</strong> position is approaching the
                  oracle deviation band. Auto-hedge proposal is queued; one-click to execute.
                </p>
              </li>
              <li className="flex gap-3">
                <Globe2 className="mt-1 h-4 w-4 shrink-0 text-pink-300" />
                <p>
                  3 new EIP-7702 delegations were detected on your watchlist wallets in the last hour.
                </p>
              </li>
            </ul>

            <div className="mt-7 flex flex-wrap items-center gap-2">
              <button className="btn btn-primary"><Wand2 className="h-4 w-4" /> Apply recommendations</button>
              <button className="btn btn-ghost">Save brief</button>
            </div>
          </div>
        </article>

        {/* Sentiment + trend */}
        <div className="flex flex-col gap-4">
          <article className="glass p-6 animate-fade-up">
            <p className="eyebrow">Market sentiment</p>
            <h3 className="mt-2 font-display text-lg font-medium text-ink-50">Greed · 78</h3>

            <div className="mt-5">
              <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-glass">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-pink-500 via-violet-500 to-cyan-400 shadow-[0_0_20px_rgba(124,58,237,0.6)]"
                  style={{ width: "78%" }}
                />
                <div className="absolute top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.9)]" style={{ left: "calc(78% - 2px)" }} />
              </div>
              <div className="mt-2 flex justify-between font-mono text-2xs uppercase tracking-widest text-ink-500">
                <span>fear</span><span>neutral</span><span className="text-cyan-300">greed</span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3 text-center">
              {[
                { l: "BTC dom",  v: "52.4%", d: "+0.4%" },
                { l: "Funding",  v: "0.011", d: "+0.002" },
                { l: "Vol·24h",  v: "$84B",  d: "+12%"   },
              ].map((m) => (
                <div key={m.l} className="rounded-xl bg-glass p-3">
                  <p className="font-mono text-2xs uppercase tracking-widest text-ink-500">{m.l}</p>
                  <p className="mt-1 data-num text-[14px] text-ink-100">{m.v}</p>
                  <p className="font-mono text-2xs text-emerald-400">{m.d}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="glass p-6 animate-fade-up">
            <p className="eyebrow">Trend predictions · next 24h</p>
            <ul className="mt-4 space-y-3">
              {[
                { sym: "ETH",  call: "bullish", prob: 71, color: "from-violet-500 to-cyan-400" },
                { sym: "ARB",  call: "bullish", prob: 64, color: "from-cyan-500 to-emerald-400" },
                { sym: "MATIC",call: "bearish", prob: 58, color: "from-pink-500 to-rose-400"   },
              ].map((p) => (
                <li key={p.sym}>
                  <div className="mb-1.5 flex items-center justify-between font-mono text-2xs uppercase tracking-widest text-ink-400">
                    <span className="text-ink-100">{p.sym}</span>
                    <span className={p.call === "bullish" ? "text-emerald-400" : "text-pink-400"}>{p.call}</span>
                    <span className="text-ink-500">conf {p.prob}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-glass">
                    <div className={`h-full rounded-full bg-gradient-to-r ${p.color}`} style={{ width: `${p.prob}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </div>

      {/* System ribbon */}
      <article id="status" className="mt-6 glass p-6 animate-fade-up">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-cyan-pink shadow-glow-cyan">
              <Radio className="h-4 w-4 text-white" />
            </span>
            <div>
              <p className="eyebrow">Service mesh · 8 / 8 healthy</p>
              <h3 className="mt-1 font-display text-lg font-medium text-ink-50">Infrastructure status</h3>
            </div>
          </div>
          <span className="chip chip-ok"><span className="dot dot-ok" /> all systems nominal</span>
        </div>
        <ul className="mt-5 grid grid-cols-2 gap-2.5 md:grid-cols-4">
          {[
            { n: "api-gateway",       i: Globe2,   p: ":8000" },
            { n: "auth-service",      i: Shield,   p: ":8001" },
            { n: "execution-engine",  i: Cpu,      p: ":8080" },
            { n: "simulation-engine", i: Layers,   p: ":8082" },
            { n: "rpc-router",        i: Radio,    p: ":9091" },
            { n: "indexer",           i: Layers,   p: "worker" },
            { n: "postgres",          i: Layers,   p: ":5432" },
            { n: "clickhouse",        i: Layers,   p: ":8123" },
          ].map((s) => {
            const Icon = s.i;
            return (
              <li key={s.n} className="flex items-center gap-3 rounded-xl bg-glass p-3.5">
                <Icon className="h-3.5 w-3.5 text-cyan-300" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-ink-100">{s.n}</p>
                  <p className="font-mono text-2xs uppercase tracking-widest text-ink-500">{s.p}</p>
                </div>
                <span className="dot dot-ok" />
              </li>
            );
          })}
        </ul>
      </article>
    </section>
  );
}

/* ───────────────────────────── helpers ───────────────────────────── */

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-8 animate-fade-up">
      <p className="eyebrow">{eyebrow}</p>
      <h2
        className="mt-3 font-display font-medium leading-[1.05] tracking-tight text-ink-50 text-balance"
        style={{ fontSize: "var(--fs-h1)" }}
      >
        {title}
      </h2>
      {description ? (
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-400 text-pretty">{description}</p>
      ) : null}
    </div>
  );
}
