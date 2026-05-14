/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef2f7',
          100: '#d6dfeb',
          200: '#aebed7',
          300: '#7e98ba',
          400: '#4f719b',
          500: '#2e527e',
          600: '#234268',
          700: '#193458', // primary
          800: '#122745',
          900: '#0b1a32',
        },
      },
    },
  },
  plugins: [],
};
