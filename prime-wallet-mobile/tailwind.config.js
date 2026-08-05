/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eaf7f4",
          100: "#c7efe5",
          200: "#8fe0ca",
          300: "#54c9aa",
          400: "#24b08d",
          500: "#179174",
          600: "#126f5a",
          700: "#115446",
          800: "#103d35",
          900: "#0b2824"
        }
      }
    }
  },
  plugins: []
};
