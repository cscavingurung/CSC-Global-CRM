/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Driven by CSS variables so the Theme Color switch can restyle the whole portal
        // while staying inside the CSC brand range.
        navy: {
          DEFAULT: 'rgb(var(--navy) / <alpha-value>)',
          light: 'rgb(var(--navy-light) / <alpha-value>)',
          dark: 'rgb(var(--navy-dark) / <alpha-value>)',
        },
        grey: {
          border: '#E5E7EB',
          bg: '#F9FAFB',
        },
      },
      fontFamily: {
        sans: ['Inter', 'IBM Plex Sans', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
