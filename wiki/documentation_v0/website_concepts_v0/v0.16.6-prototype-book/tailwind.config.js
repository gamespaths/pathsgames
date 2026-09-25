/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        parchment: {
          DEFAULT: '#e8d5b0',
          light: '#f2e6c8',
          medium: '#f5e9c2',
          dark: '#c9b48a',
        },
        gold: {
          DEFAULT: '#c8960a',
          light: '#e8b830',
          shine: '#ffd700',
          dark: '#9a6f08',
          deep: '#7a4e00',
        },
        brown: {
          deep: '#1a0a02',
          dark: '#2e1508',
          mid: '#5c3317',
          warm: '#7a4520',
          light: '#a0622e',
          tan: '#c08040',
        }
      },
      fontFamily: {
        display: ['Cinzel Decorative', 'serif'],
        heading: ['Cinzel', 'serif'],
        body: ['Crimson Text', 'serif'],
      },
    },
  },
  plugins: [],
}
