/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#1e3a5f',
        steel: '#5b7a9d',
        teal: '#2a9d8f',
      },
    },
  },
  plugins: [],
};
