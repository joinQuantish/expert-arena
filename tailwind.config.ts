import type { Config } from "tailwindcss";

export default {
  content: ["./client/index.html", "./client/src/**/*.{tsx,ts}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        pn: {
          bg: "var(--pn-bg)",
          surface: "var(--pn-surface)",
          elevated: "var(--pn-elevated)",
          border: "var(--pn-border)",
          accent: "var(--pn-accent)",
          "accent-dim": "var(--pn-accent-dim)",
          text: "var(--pn-text)",
          "text-muted": "var(--pn-text-muted)",
          "text-secondary": "var(--pn-text-secondary)",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
