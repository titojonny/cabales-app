import type { Config } from 'tailwindcss';

/** Limita la generación de utilidades a las vistas mantenidas por Cabales. */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      screens: { xs: '380px' },
      colors: {
        ink: 'var(--color-ink)',
        muted: 'var(--color-muted)',
        accent: 'var(--color-accent)',
        coral: 'var(--color-coral)',
      },
    },
  },
  plugins: [],
} satisfies Config;
