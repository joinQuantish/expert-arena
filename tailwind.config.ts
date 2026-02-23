import type { Config } from "tailwindcss";

export default {
  content: ["./client/index.html", "./client/src/**/*.{tsx,ts}"],
  theme: {
    extend: {},
  },
  plugins: [],
} satisfies Config;
