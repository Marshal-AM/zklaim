/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "var(--color-background)",
        foreground: "var(--color-foreground)",
        card: "var(--color-card)",
        primary: {
          DEFAULT: "var(--color-primary)",
          foreground: "var(--color-primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--color-secondary)",
          foreground: "var(--color-secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--color-muted)",
          foreground: "var(--color-muted-foreground)",
        },
        accent: "var(--color-accent)",
        destructive: "var(--color-destructive)",
        success: "var(--color-success)",
        border: "var(--color-border)",
        surface: "var(--color-surface)",
        subtle: "var(--color-subtle)",
      },
      fontFamily: {
        sans: ["Haffer", "Haffer XH", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["Haffer Mono", "Haffer SemiMono", "ui-monospace", "monospace"],
      },
      maxWidth: {
        page: "var(--page-max)",
      },
      spacing: {
        gutter: "var(--page-gutter)",
      },
    },
  },
  plugins: [],
};
