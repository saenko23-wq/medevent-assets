import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#009C9A",
          dark: "#007F7D",
          soft: "#E6F7F7"
        }
      },
      boxShadow: {
        soft: "0 14px 34px rgba(15, 23, 42, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
