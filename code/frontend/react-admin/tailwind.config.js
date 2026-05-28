/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        parchment:    '#e8d5b0',
        'parchment-light': '#f2e6c8',
        'brown-deep':  '#1a0a02',
        'brown-dark':  '#2e1508',
        'brown-mid':   '#5c3317',
        'brown-warm':  '#7a4520',
        'brown-light': '#a0622e',
        'brown-tan':   '#c08040',
        gold:          '#c8960a',
        'gold-light':  '#e8b830',
        'gold-shine':  '#ffd700',
        'gold-dark':   '#9a6f08',
        ember:         '#d44a0a',
        ash:           '#8b7355',
        stone:         '#6b5c4a',
        ink:           '#1a0f06',
      },
      fontFamily: {
        display: ['"Cinzel Decorative"', 'serif'],
        heading: ['"Cinzel"', 'serif'],
        body:    ['"Crimson Text"', '"Georgia"', 'serif'],
      },
    },
  },
  plugins: [],
}
