/** @type {import('tailwindcss').Config} */
export default {
    content: [
      "./index.html",
      "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
      extend: {
        colors: {
          'tech-black': '#0a0a0a',
          'tech-gray': '#1a1a1a',
          'neon-blue': '#00f3ff',
          'neon-purple': '#bc13fe',
        }
      },
    },
    plugins: [],
  }