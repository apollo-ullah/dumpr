import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        warm: {
          bg: "#fbf9f4",
          surface: "#ffffff",
          fg: "#37352f",
          muted: "#9b9889",
          border: "#ece8df",
          chip: "#f1ede4",
          sage: "#7d9b76",
          amber: "#c98a55",
        },
      },
      fontFamily: {
        serif: ["Charter", "Georgia", "serif"],
        sans: ["ui-sans-serif", "Inter", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: { warm: "0 1px 2px rgba(15, 15, 15, 0.04)" },
      borderRadius: { warm: "10px" },
      keyframes: {
        progress: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(400%)" },
        },
        statusFade: {
          "0%, 100%": { opacity: "0" },
          "20%, 80%": { opacity: "1" },
        },
      },
      animation: {
        progress: "progress 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
