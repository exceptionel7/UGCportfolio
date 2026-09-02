import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Space Grotesk", "sans-serif"],
      },
      colors: {
        ink: "#0a0a0f",
        "ink-2": "#111119",
        "ink-3": "#17171f",
        brand: { 1: "#7c3aed", 2: "#d946ef", 3: "#ec4899" },
        gold: "#e8c57e",
      },
      borderRadius: { xl2: "22px" },
    },
  },
  plugins: [],
};

export default config;
