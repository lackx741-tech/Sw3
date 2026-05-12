import type { Config } from "tailwindcss";
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
declare const config: Config;
export default config;
//# sourceMappingURL=tailwind.config.d.ts.map