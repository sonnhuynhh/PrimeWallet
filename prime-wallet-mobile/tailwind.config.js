/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "#131313",
        foreground: "#ffffff",
        card: "#1b1b1b",
        surface: {
          1: "#1b1b1b",
          2: "#242424",
          3: "#2e2e2e",
        },
        muted: {
          DEFAULT: "#242424",
          foreground: "#9b9b9b",
        },
        border: "rgba(255, 255, 255, 0.08)",
        primary: {
          DEFAULT: "#fc72ff",
          foreground: "#1a001f",
          soft: "rgba(252, 114, 255, 0.14)",
        },
        fiat: {
          DEFAULT: "#21c95e",
          foreground: "#04160b",
          soft: "rgba(33, 201, 94, 0.14)",
        },
        destructive: "#ff5f52",
        success: "#21c95e",
        warning: "#ffbf17",
        accent2: "#4c82fb",
      },
      borderRadius: {
        "2xl": "1.25rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
    },
  },
  plugins: [],
};
