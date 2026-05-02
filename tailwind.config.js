
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        page: "var(--bg-page)",
        card: "var(--bg-card)",
        header: "var(--bg-header)",
        input: "var(--bg-input)",
        "t-primary": "var(--text-primary)",
        "t-secondary": "var(--text-secondary)",
        "t-hint": "var(--text-hint)",
        "t-muted": "var(--text-muted)",
        "b-light": "var(--border-light)",
        "b-default": "var(--border-default)",
        accent: "var(--accent)",
        "accent-text": "var(--accent-text)",
      },
    },
  },
  plugins: [],
}