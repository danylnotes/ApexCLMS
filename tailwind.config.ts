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
        lime: { DEFAULT: token("lime"), 600: token("lime-600") },
        lavender: token("lavender"),
        peach: token("peach"),
        mint: token("mint"),
        sky: token("sky"),
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
        sans: ["var(--font-jakarta)", "var(--font-arabic)", "system-ui", "sans-serif"],
        body: ["var(--font-jakarta)", "var(--font-arabic)", "system-ui", "sans-serif"],
        serif: ["var(--font-jakarta)", "var(--font-arabic)", "system-ui", "sans-serif"],
      },
      fontSize: {
        "2xs": ["0.75rem", { lineHeight: "1rem", letterSpacing: "0.02em" }],
      },
      borderRadius: { DEFAULT: "10px", md: "14px", lg: "18px", xl: "22px", "2xl": "26px", "3xl": "30px" },
      boxShadow: {
        panel: "0 1px 2px rgb(24 26 31 / 0.03)",
        pop: "0 16px 40px rgb(24 26 31 / 0.14)",
        lift: "0 10px 30px rgb(24 26 31 / 0.06)",
      },
      maxWidth: { content: "1360px" },
    },
  },
  plugins: [],
} satisfies Config;
