/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        table: {
          felt: '#154734',
          dark: '#0c2e21',
          border: '#2e7d32',
          wood: '#42220f',
          woodDark: '#291307',
        },
        domino: {
          ivory: '#FAF8F0',
          ivoryDark: '#E8E3D3',
          pip: '#1C1917',
          brass: '#D4AF37',
        },
      },
      boxShadow: {
        tile: '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.3)',
        'tile-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -4px rgba(0, 0, 0, 0.4)',
        glow: '0 0 15px rgba(34, 197, 94, 0.6)',
      },
    },
  },
  plugins: [],
};
