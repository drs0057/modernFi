/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#FAFAFA',
        ink: '#1A1A1A',
        'ink-muted': '#4D4D4D',
        electric: '#00A19C',
        'electric-dark': '#008E89',
        'brand-teal': '#367D8B',
        hairline: 'rgba(26,26,26,0.1)',
        'error-bg': '#FEF3F2',
        'error-text': '#B42318',
        success: '#62C554',
      },
      fontFamily: {
        // ModernFi's site uses licensed fonts (Messina Sans, HW Cigars) we
        // can't embed here — Inter and JetBrains Mono are the closest free
        // substitutes with a similar geometric, modern feel.
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        cta: '0 1px 2px rgba(0,161,156,0.18), 0 4px 12px -2px rgba(0,161,156,0.18)',
        'cta-hover': '0 2px 6px rgba(0,161,156,0.22), 0 10px 24px -4px rgba(0,161,156,0.28)',
      },
    },
  },
  plugins: [],
};
