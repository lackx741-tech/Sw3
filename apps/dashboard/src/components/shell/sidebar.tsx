"use client";

import * as React from "react";
import {
  Activity,
  Boxes,
  Compass,
  Gauge,
  LifeBuoy,
  Network,
  Settings,
  Sparkles,
  Wallet,
  Waypoints,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";

type NavItem = { href: string; label: string; icon: LucideIcon; tag?: string };

const PRIMARY: NavItem[] = [
  { href: "#hero",      label: "Overview",     icon: Compass },
  { href: "#analytics", label: "Analytics",    icon: Gauge,    tag: "live" },
  { href: "#portfolio", label: "Portfolio",    icon: Wallet },
  { href: "#activity",  label: "Activity",     icon: Waypoints },
  { href: "#ai",        label: "Intelligence", icon: Sparkles, tag: "new" },
];

const SECONDARY: NavItem[] = [
  { href: "#contracts", label: "Contracts", icon: Boxes },
  { href: "#status",    label: "Status",    icon: Network },
  { href: "#settings",  label: "Settings",  icon: Settings },
];

export function Sidebar() {
  const [active, setActive] = React.useState("#hero");

  return (
    <aside className="sticky top-0 z-30 hidden h-screen w-[260px] shrink-0 flex-col border-r border-hairline bg-void-900/60 px-4 py-5 backdrop-blur-xl md:flex">
      {/* Brand */}
      <a href="#hero" onClick={() => setActive("#hero")} className="group flex items-center gap-3 px-2 py-2">
        <div className="relative grid h-10 w-10 place-items-center overflow-hidden rounded-xl">
          <span className="absolute inset-0 bg-gradient-primary animate-aurora" />
          <span className="absolute inset-0 bg-black/20" />
          <span className="relative font-mono text-[13px] font-bold text-white">S3</span>
          <span className="pointer-events-none absolute -inset-1 rounded-2xl bg-violet-600/40 opacity-0 blur-xl transition group-hover:opacity-80" />
        </div>
        <div className="leading-tight">
          <p className="font-display text-[15px] font-semibold tracking-tight text-ink-50">SW3</p>
          <p className="mt-0.5 font-mono text-2xs uppercase tracking-widest text-ink-500">operator console</p>
        </div>
      </a>

      <div className="mt-6 flex-1">
        <SectionLabel>Primary</SectionLabel>
        <nav className="mt-2 flex flex-col gap-1">
          {PRIMARY.map((i) => (
            <NavLink key={i.href} item={i} active={active === i.href} onClick={() => setActive(i.href)} />
          ))}
        </nav>

        <SectionLabel className="mt-7">System</SectionLabel>
        <nav className="mt-2 flex flex-col gap-1">
          {SECONDARY.map((i) => (
            <NavLink key={i.href} item={i} active={active === i.href} onClick={() => setActive(i.href)} />
          ))}
        </nav>
      </div>

      {/* Status card */}
      <div className="mt-4 rounded-2xl bg-glass border border-hairline p-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-cyan-400" />
          <span className="font-mono text-2xs uppercase tracking-widest text-ink-400">all systems</span>
          <span className="ml-auto chip chip-ok"><span className="dot dot-ok" /> live</span>
        </div>
        <p className="mt-3 font-mono text-[11px] uppercase tracking-widest text-ink-500">
          rpc <span className="text-ink-200">42ms</span> · executor <span className="text-ink-200">healthy</span>
        </p>
        <button className="btn-ghost mt-3 w-full text-[12px]">
          <LifeBuoy className="h-3.5 w-3.5" /> Open runbook
        </button>
      </div>
    </aside>
  );
}

function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("px-3 font-mono text-2xs uppercase tracking-widest text-ink-500", className)}>
      {children}
    </p>
  );
}

function NavLink({ item, active, onClick }: { item: NavItem; active: boolean; onClick: () => void }) {
  const Icon = item.icon;
  return (
    <a
      href={item.href}
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition",
        active
          ? "bg-white/[0.06] text-white"
          : "text-ink-300 hover:bg-white/[0.04] hover:text-white",
      )}
    >
      <span
        className={cn(
          "absolute left-0 top-1/2 h-5 w-px -translate-y-1/2 rounded-full bg-gradient-violet-cyan transition-opacity",
          active ? "opacity-100" : "opacity-0",
        )}
      />
      <Icon
        className={cn(
          "h-4 w-4 transition",
          active ? "text-cyan-300" : "text-ink-400 group-hover:text-ink-100",
        )}
      />
      <span className="flex-1 font-sans tracking-tight">{item.label}</span>
      {item.tag ? (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest",
            item.tag === "live"
              ? "bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-400/30"
              : "bg-pink-500/15 text-pink-300 ring-1 ring-pink-400/30",
          )}
        >
          {item.tag}
        </span>
      ) : null}
    </a>
  );
}
