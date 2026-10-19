import type { Config } from "tailwindcss";

const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: token("navy"), 700: token("navy-700"), 50: token("navy-50") },
        slate: { DEFAULT: token("slateblue") },
        copper: { DEFAULT: token("copper"), 50: token("copper-50") },
        canvas: token("canvas"),
        surface: token("surface"),
        ink: { DEFAULT: token("ink"), muted: token("ink-muted"), faint: token("ink-faint") },
        line: { DEFAULT: token("line"), strong: token("line-strong") },
        ok: { DEFAULT: token("ok"), 50: token("ok-50") },
        warn: { DEFAULT: token("warn"), 50: token("warn-50") },
        crit: { DEFAULT: token("crit"), 50: token("crit-50") },
        info: { DEFAULT: token("info"), 50: token("info-50") },
        idle: { DEFAULT: token("idle"), 50: token("idle-50") },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        body: ["var(--font-source-sans)", "var(--font-inter)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.02em" }],
      },
      borderRadius: { DEFAULT: "4px", md: "6px", lg: "8px" },
      boxShadow: {
        panel: "0 1px 2px rgb(16 24 40 / 0.04)",
        pop: "0 8px 24px rgb(16 24 40 / 0.12)",
      },
      maxWidth: { content: "1240px" },
    },
  },
  plugins: [],
} satisfies Config;
