/**
 * Cinematic loading screen with three concentric glowing rings.
 * Used as Next.js app-router loading UI.
 */
export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-void-900/85 backdrop-blur-xl">
      <div className="flex flex-col items-center gap-7">
        <div className="relative h-28 w-28">
          <div className="absolute inset-0 rounded-full border border-violet-500/40 animate-spin-slow shadow-glow-violet" />
          <div
            className="absolute inset-2 rounded-full border border-cyan-400/40 animate-spin-slow shadow-glow-cyan"
            style={{ animationDirection: "reverse", animationDuration: "10s" }}
          />
          <div
            className="absolute inset-5 rounded-full border border-pink-500/40 animate-spin-slow shadow-glow-pink"
            style={{ animationDuration: "6s" }}
          />
          <div className="absolute inset-0 grid place-items-center">
            <div className="h-3 w-3 rounded-full bg-gradient-primary shadow-glow-violet animate-glow-pulse" />
          </div>
        </div>
        <p className="font-mono text-2xs uppercase tracking-ultra text-ink-400">
          initializing the operator console…
        </p>
      </div>
    </div>
  );
}
