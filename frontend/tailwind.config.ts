import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        // Cosmic neon theme — committed dark palette regardless of OS
        // light/dark preference (a "pick one bold look" choice, not a
        // conditional one). Token names kept stable from the previous
        // theme so component classNames didn't need touching, only the
        // values changed.
        paper: "#eef0ff",
        ink: "#eef0ff",
        clay: "#ff3d81",
        clayDark: "#d61f66",
        sand: "#2e2a52",
        moss: "#22d3ee",
        glass: "#16122b",
        night: "#0a0818",
        nightRaised: "#16122b",
        nightElevated: "#241d47",
      },
      boxShadow: {
        soft: "0 2px 12px rgba(0, 0, 0, 0.35)",
        card: "0 4px 24px rgba(0, 0, 0, 0.4)",
        elevated: "0 20px 60px -10px rgba(0, 0, 0, 0.6)",
        glow: "0 0 24px rgba(255, 61, 129, 0.35)",
        glowCyan: "0 0 24px rgba(34, 211, 238, 0.35)",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        aurora: {
          "0%, 100%": { transform: "translate(0%, 0%) scale(1)" },
          "33%": { transform: "translate(6%, -8%) scale(1.12)" },
          "66%": { transform: "translate(-8%, 6%) scale(0.95)" },
        },
        drift: {
          "0%, 100%": { transform: "translate(0%, 0%) scale(1)" },
          "50%": { transform: "translate(-10%, 10%) scale(1.08)" },
        },
        popIn: {
          "0%": { opacity: "0", transform: "scale(0.7)" },
          "60%": { opacity: "1", transform: "scale(1.05)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        shimmer: "shimmer 1.6s ease-in-out infinite",
        aurora: "aurora 18s ease-in-out infinite",
        drift: "drift 22s ease-in-out infinite",
        popIn: "popIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
