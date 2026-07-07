import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--color-bg)",
        surface: "var(--color-surface)",
        text: "var(--color-text)",
        muted: "var(--color-text-muted)",
        accent: "var(--color-accent)",
        line: "var(--color-line)",
      },
      fontFamily: {
        heading: "var(--font-heading)",
        body: "var(--font-body)",
      },
      borderRadius: {
        theme: "var(--radius)",
        soft: "var(--radius-sm)",
      },
      boxShadow: {
        theme: "var(--shadow)",
        lift: "var(--shadow-lift)",
      },
    },
  },
  plugins: [],
} satisfies Config;
