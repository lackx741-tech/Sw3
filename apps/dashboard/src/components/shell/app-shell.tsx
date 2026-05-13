import * as React from "react";
import { Background } from "../background";
import { Sidebar } from "./sidebar";
import { TopBar } from "./topbar";
import { Ticker } from "./ticker";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Background />
      <div className="relative flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <Ticker />
          <main className="flex-1 px-5 pb-24 pt-8 md:px-10">
            <div className="mx-auto w-full max-w-[1360px] animate-fade-up">
              {children}
            </div>
          </main>
          <SiteFooter />
        </div>
      </div>
    </>
  );
}

function SiteFooter() {
  return (
    <footer className="relative mt-8 px-5 pb-10 md:px-10">
      <div className="mx-auto max-w-[1360px]">
        <div className="hr-glow mb-8" />
        <div className="flex flex-col gap-6 text-sm md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-primary shadow-glow-violet">
              <span className="font-mono text-[12px] font-bold text-white">S3</span>
            </div>
            <div className="leading-tight">
              <p className="font-display text-[15px] font-medium text-ink-50">SW3 Console</p>
              <p className="font-mono text-2xs uppercase tracking-widest text-ink-500">
                v0.1.0 · obsidian-build
              </p>
            </div>
          </div>

          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-2xs uppercase tracking-widest text-ink-400">
            <a className="transition hover:text-ink-100" href="#hero">Overview</a>
            <a className="transition hover:text-ink-100" href="#analytics">Analytics</a>
            <a className="transition hover:text-ink-100" href="#portfolio">Portfolio</a>
            <a className="transition hover:text-ink-100" href="#activity">Activity</a>
            <a className="transition hover:text-ink-100" href="#ai">Intelligence</a>
          </nav>

          <div className="flex items-center gap-2">
            {[
              { l: "GH", h: "https://github.com/lackx741-tech/Sw3" },
              { l: "DOC", h: "#" },
              { l: "X",  h: "#" },
              { l: "TG", h: "#" },
            ].map((s) => (
              <a
                key={s.l}
                href={s.h}
                className="btn-icon font-mono text-[10px] uppercase tracking-widest"
                target="_blank"
                rel="noreferrer"
              >
                {s.l}
              </a>
            ))}
          </div>
        </div>
        <p className="mt-6 text-center font-mono text-2xs uppercase tracking-widest text-ink-500">
          © 2026 SW3 Labs · all rights reserved · built on the edge
        </p>
      </div>
    </footer>
  );
}
