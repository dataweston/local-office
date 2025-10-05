import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f6f9ff',
          100: '#e8f0ff',
          200: '#d0e0ff',
          300: '#a5c4ff',
          400: '#6f9bff',
          500: '#3e70ff',
          600: '#264ff0',
          700: '#1d3ccc',
          800: '#1c33a3',
          900: '#1c2f7f'
        }
      }
    }
  },
  plugins: []
};

export default config;
