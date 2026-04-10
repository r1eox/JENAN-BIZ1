/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f4ff',
          100: '#e0eaff',
          200: '#c7d7fe',
          300: '#a5bcfd',
          400: '#8098fb',
          500: '#1e3a8a',
          600: '#1a3279',
          700: '#162a67',
          800: '#112255',
          900: '#0d1a42',
        },
        gold: {
          400: '#f0c040',
          500: '#d4a017',
          600: '#b88c14',
        }
      },
      fontFamily: {
        sans: ['Cairo', 'Tajawal', 'sans-serif'],
      }
    }
  },
  plugins: []
};
