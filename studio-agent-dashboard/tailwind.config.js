export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        brand: {
          primary: '#10B981',
          'primary-light': '#D1FAE5',
          'primary-dark': '#059669',
          secondary: '#3B82F6',
          'secondary-light': '#DBEAFE',
        },
      },
    },
  },
  plugins: [],
};
