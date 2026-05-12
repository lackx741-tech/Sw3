/**
 * Tailwind CSS configuration for @sw3/ui.
 *
 * The `content` array covers:
 *  - All TSX/JSX files within this package's `src/` directory.
 *  - All app-level TSX/JSX files in the monorepo's `apps/` directory so that
 *    Tailwind can scan for utility classes used by consuming apps.
 *  - Story files from a potential Storybook setup.
 *
 * This config is intended to be used as a base that apps can extend with
 * `presets: [require("@sw3/ui/tailwind.config")]`.
 */
const config = {
    content: [
        // This package
        "./src/**/*.{ts,tsx}",
        // Consuming Next.js / Vite apps in the monorepo
        "../../apps/*/src/**/*.{ts,tsx}",
        "../../apps/*/app/**/*.{ts,tsx}",
        "../../apps/*/pages/**/*.{ts,tsx}",
        "../../apps/*/components/**/*.{ts,tsx}",
        // Other packages that render UI
        "../*/src/**/*.{ts,tsx}",
    ],
    darkMode: "class",
    theme: {
        extend: {
            // ── Brand colours ──────────────────────────────────────────────────────
            colors: {
                brand: {
                    50: "#eef2ff",
                    100: "#e0e7ff",
                    200: "#c7d2fe",
                    300: "#a5b4fc",
                    400: "#818cf8",
                    500: "#6366f1",
                    600: "#4f46e5",
                    700: "#4338ca",
                    800: "#3730a3",
                    900: "#312e81",
                    950: "#1e1b4b",
                },
            },
            // ── Border radius ──────────────────────────────────────────────────────
            borderRadius: {
                "2xl": "1rem",
                "3xl": "1.5rem",
            },
            // ── Animations ────────────────────────────────────────────────────────
            keyframes: {
                "fade-in": {
                    from: { opacity: "0" },
                    to: { opacity: "1" },
                },
                "zoom-in": {
                    from: { transform: "scale(0.95)", opacity: "0" },
                    to: { transform: "scale(1)", opacity: "1" },
                },
                "slide-in-from-top": {
                    from: { transform: "translateY(-8px)", opacity: "0" },
                    to: { transform: "translateY(0)", opacity: "1" },
                },
                "slide-in-from-bottom": {
                    from: { transform: "translateY(8px)", opacity: "0" },
                    to: { transform: "translateY(0)", opacity: "1" },
                },
                shimmer: {
                    from: { backgroundPosition: "200% 0" },
                    to: { backgroundPosition: "-200% 0" },
                },
            },
            animation: {
                "fade-in": "fade-in 150ms ease-out",
                "zoom-in-95": "zoom-in 150ms ease-out",
                "slide-in-from-top-2": "slide-in-from-top 150ms ease-out",
                "slide-in-from-bottom-2": "slide-in-from-bottom 150ms ease-out",
                shimmer: "shimmer 2s linear infinite",
            },
            // ── Typography ────────────────────────────────────────────────────────
            fontFamily: {
                mono: [
                    "ui-monospace",
                    "SFMono-Regular",
                    "Menlo",
                    "Monaco",
                    "Consolas",
                    "'Liberation Mono'",
                    "'Courier New'",
                    "monospace",
                ],
            },
        },
    },
    plugins: [],
};
export default config;
//# sourceMappingURL=tailwind.config.js.map