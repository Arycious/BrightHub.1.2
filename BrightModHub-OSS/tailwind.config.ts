import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bright: {
          bg:       'var(--bright-bg)',
          surface:  'var(--bright-surface)',
          elevated: 'var(--bright-elevated)',
          border:   'var(--bright-border)',
          accent:   'var(--bright-accent)',
          'accent-hover': 'var(--bright-accent-hover)',
          success:  'var(--bright-success)',
          warning:  'var(--bright-warning)',
          danger:   'var(--bright-danger)',
          text:     'var(--bright-text)',
          muted:    'var(--bright-muted)',
          dim:      'var(--bright-dim)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        card: '14px',
        button: '10px',
        badge: '6px',
      },
      boxShadow: {
        'glow-accent': '0 0 20px rgba(99, 102, 241, 0.15)',
        'glow-danger': '0 0 20px rgba(239, 68, 68, 0.15)',
        'glow-success': '0 0 20px rgba(34, 197, 94, 0.15)',
        'card': '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.15)',
        'panel': '0 8px 30px rgba(0,0,0,0.3)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(99, 102, 241, 0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(99, 102, 241, 0.4)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
