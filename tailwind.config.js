/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        villa: {
          bg: '#0b1020',
          panel: 'rgba(15, 23, 42, 0.88)',
          accent: '#6366f1',
        },
      },
    },
  },
  plugins: [],
};
