/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class', // Light by default; Dark via Settings (src/lib/theme.js)
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans Thai"', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
        },
      },
      keyframes: {
        'sheet-up': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        'fade-in': { from: { opacity: 0 }, to: { opacity: 1 } },
        'tap': { '0%,100%': { transform: 'scale(1)' }, '50%': { transform: 'scale(0.85)' } },
        'slide-up-loop': { '0%': { transform: 'translateY(100%)' }, '30%,80%': { transform: 'translateY(0)' }, '100%': { transform: 'translateY(100%)' } },
      },
      animation: {
        'sheet-up': 'sheet-up 0.25s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        tap: 'tap 1.6s ease-in-out infinite',
        'slide-up-loop': 'slide-up-loop 3.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
