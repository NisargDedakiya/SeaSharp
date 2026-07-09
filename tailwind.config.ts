import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        cream: {
          50: "#FDFCFA",
          100: "#FAF7F0",
          200: "#F3EDE0",
          300: "#E9DFC9",
          400: "#DACBA8",
        },
        ink: {
          50: "#F7F5F2",
          100: "#EDE9E2",
          400: "#8A8175",
          500: "#6B6255",
          700: "#3D3730",
          800: "#2A251F",
          900: "#1C1815",
        },
        gold: {
          400: "#C7A24B",
          500: "#B8902F",
          600: "#96741F",
        },
      },
      boxShadow: {
        premium:
          "0 1px 2px rgba(28, 24, 21, 0.04), 0 8px 24px -12px rgba(28, 24, 21, 0.12)",
        "premium-lg":
          "0 2px 4px rgba(28, 24, 21, 0.04), 0 20px 40px -16px rgba(28, 24, 21, 0.16)",
      },
    },
  },
  plugins: [],
};
export default config;
