import type { Config } from "tailwindcss";

/**
 * @sw3/dashboard — "Aurora Glass" theme.
 *
 * Luxury Web3 operating system aesthetic:
 *   - Deep space background (#050816 → #0B1120)
 *   - Glassmorphic surfaces (rgba(255,255,255,0.06) + backdrop blur)
 *   - Neon gradient accents: violet #7C3AED · cyan #06B6D4 · pink #EC4899
 *   - Typography pair: Geist Sans (display + body) + Geist Mono (data)
 */
const config: Config = {
  darkMode: "class",
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Background scale
        void: {
          950: "#030516",
          900: "#050816",
          800: "#080d22",
          700: "#0B1120",
          600: "#0f172a",
          500: "#1e293b",
        },
        // Ink (text)
        ink: {
          50:  "#f8fafc",
          100: "#e6e9f5",
          200: "#c8cce0",
          300: "#9fa6c2",
          400: "#7c84a3",
          500: "#5c6480",
          600: "#3f455d",
        },
        // Accents
        violet: {
          400: "#A78BFA",
          500: "#8B5CF6",
          600: "#7C3AED",
          700: "#6D28D9",
        },
        cyan: {
          400: "#22D3EE",
          500: "#06B6D4",
          600: "#0891B2",
        },
        pink: {
          400: "#F472B6",
          500: "#EC4899",
          600: "#DB2777",
        },
        // Signals
        signal: {
          ok:   "#10B981",
          warn: "#F59E0B",
          err:  "#EF4444",
        },
        // Glass tokens
        glass: "rgba(255,255,255,0.06)",
        "glass-strong": "rgba(255,255,255,0.10)",
        hairline: "rgba(255,255,255,0.10)",
        "hairline-strong": "rgba(255,255,255,0.18)",
      },
      fontFamily: {
        sans:    ["var(--font-geist-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-geist-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono:    ["var(--font-geist-mono)", "ui-monospace", "Menlo", "monospace"],
      },
      fontSize: {
        "2xs": ["10px", { lineHeight: "14px", letterSpacing: "0.06em" }],
      },
      letterSpacing: {
        widest: "0.18em",
        ultra:  "0.32em",
      },
      borderRadius: {
        none: "0",
        sm:   "8px",
        DEFAULT: "12px",
        md:   "14px",
        lg:   "18px",
        xl:   "22px",
        "2xl":"26px",
        "3xl":"32px",
      },
      boxShadow: {
        "glow-violet": "0 0 0 1px rgba(124,58,237,0.35), 0 12px 60px -10px rgba(124,58,237,0.55)",
        "glow-cyan":   "0 0 0 1px rgba(6,182,212,0.35),  0 12px 60px -10px rgba(6,182,212,0.50)",
        "glow-pink":   "0 0 0 1px rgba(236,72,153,0.35), 0 12px 60px -10px rgba(236,72,153,0.50)",
        "glass":       "0 1px 0 0 rgba(255,255,255,0.06) inset, 0 30px 60px -30px rgba(0,0,0,0.6)",
        "glass-lg":    "0 1px 0 0 rgba(255,255,255,0.10) inset, 0 50px 100px -40px rgba(0,0,0,0.8)",
      },
      backgroundImage: {
        "aurora":     "radial-gradient(60% 60% at 20% 10%, rgba(124,58,237,0.30) 0%, transparent 60%), radial-gradient(50% 50% at 80% 0%, rgba(6,182,212,0.20) 0%, transparent 55%), radial-gradient(60% 60% at 50% 100%, rgba(236,72,153,0.18) 0%, transparent 65%)",
        "grid":       "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
        "noise":      "url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22140%22 height=%22140%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.85%22 numOctaves=%222%22/><feColorMatrix values=%220 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.06 0%22/></filter><rect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/></svg>')",
        "gradient-primary": "linear-gradient(135deg, #7C3AED 0%, #06B6D4 50%, #EC4899 100%)",
        "gradient-violet-cyan": "linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%)",
        "gradient-cyan-pink":   "linear-gradient(135deg, #06B6D4 0%, #EC4899 100%)",
        "gradient-pink-violet": "linear-gradient(135deg, #EC4899 0%, #7C3AED 100%)",
      },
      keyframes: {
        "fade-up":     { from: { opacity: "0", transform: "translateY(12px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "fade-in":     { from: { opacity: "0" }, to: { opacity: "1" } },
        "scale-in":    { from: { opacity: "0", transform: "scale(0.96)" }, to: { opacity: "1", transform: "scale(1)" } },
        "float":       { "0%,100%": { transform: "translateY(0) translateX(0)" }, "50%": { transform: "translateY(-22px) translateX(8px)" } },
        "float-slow":  { "0%,100%": { transform: "translate(0,0) scale(1)" }, "50%": { transform: "translate(28px,-18px) scale(1.06)" } },
        "aurora-pan":  { "0%,100%": { backgroundPosition: "0% 50%" }, "50%": { backgroundPosition: "100% 50%" } },
        "shimmer":     { from: { backgroundPosition: "-200% 0" }, to: { backgroundPosition: "200% 0" } },
        "pulse-ring": {
          "0%":   { transform: "scale(0.92)", opacity: "0.7" },
          "100%": { transform: "scale(1.4)",  opacity: "0" },
        },
        "glow-pulse": {
          "0%,100%": { opacity: "0.65" },
          "50%":     { opacity: "1" },
        },
        "spin-slow":  { to: { transform: "rotate(360deg)" } },
        "tape-x":     { from: { transform: "translateX(0)" }, to: { transform: "translateX(-50%)" } },
        "border-spin":{ to: { "--angle": "360deg" as unknown as string } },
        "blob": {
          "0%":   { transform: "translate(0,0) scale(1)" },
          "33%":  { transform: "translate(30px,-50px) scale(1.1)" },
          "66%":  { transform: "translate(-20px,20px) scale(0.95)" },
          "100%": { transform: "translate(0,0) scale(1)" },
        },
      },
      animation: {
        "fade-up":    "fade-up 600ms cubic-bezier(0.2, 0.7, 0.2, 1) both",
        "fade-in":    "fade-in 400ms ease-out both",
        "scale-in":   "scale-in 500ms cubic-bezier(0.2, 0.7, 0.2, 1) both",
        "float":      "float 9s ease-in-out infinite",
        "float-slow": "float-slow 14s ease-in-out infinite",
        "aurora":     "aurora-pan 18s ease-in-out infinite",
        "shimmer":    "shimmer 2.4s linear infinite",
        "pulse-ring":"pulse-ring 2.4s ease-out infinite",
        "glow-pulse":"glow-pulse 2.6s ease-in-out infinite",
        "spin-slow":  "spin-slow 14s linear infinite",
        "tape":       "tape-x 90s linear infinite",
        "blob":       "blob 22s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
