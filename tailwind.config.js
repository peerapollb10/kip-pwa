/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class', // Light by default; Dark via Settings (src/lib/theme.js)
  theme: {
    extend: {
      // Type scale ~1–2px larger than Tailwind's default for legibility (spacing untouched).
      fontSize: {
        xs: ['0.8125rem', { lineHeight: '1.125rem' }], // 13px
        sm: ['0.9375rem', { lineHeight: '1.375rem' }], // 15px
        base: ['1.0625rem', { lineHeight: '1.625rem' }], // 17px
        lg: ['1.1875rem', { lineHeight: '1.75rem' }], // 19px
        xl: ['1.3125rem', { lineHeight: '1.875rem' }], // 21px
        '2xl': ['1.5625rem', { lineHeight: '2.125rem' }], // 25px
        '3xl': ['1.9375rem', { lineHeight: '2.375rem' }], // 31px
      },
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
