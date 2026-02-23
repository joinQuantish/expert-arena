import type { Config } from "tailwindcss";

export default {
  content: ["./client/index.html", "./client/src/**/*.{tsx,ts}"],
  theme: {
    extend: {
      colors: {
        pn: {
          bg: "#101318",
          surface: "#161A20",
          elevated: "#1C2028",
          border: "#252930",
          accent: "#3B82F6",
          "accent-dim": "#2563EB",
          "text-muted": "#5A6070",
          "text-secondary": "#8B92A0",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
