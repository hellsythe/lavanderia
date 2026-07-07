/* Tailwind preset — Design System LavanderPro
 *
 * Tokens extraídos del source project (LavanderPro / Github Dashboard Design System).
 * Ver ../design-system/DESIGN.md para documentación autoritativa.
 *
 * Aplicar en cada app consumidor:
 *
 *   const preset = require('@lavanderpro/ui/tailwind-preset');
 *
 *   module.exports = {
 *     presets: [preset],
 *     content: [
 *       './app/' + '**' + '/*.{ts,tsx}',
 *       '../../packages/ui/src/' + '**' + '/*.{ts,tsx}',
 *     ],
 *   };
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
    },

    colors: {
      // Neutrals (canvas)
      canvas: 'var(--bg)',
      surface: 'var(--surface)',
      'surface-2': 'var(--surface-2)',

      // Text
      fg: 'var(--fg)',
      muted: 'var(--muted)',

      // Border
      border: 'var(--border)',

      // Brand
      accent: {
        DEFAULT: 'var(--accent)',
        soft: 'var(--accent-soft)',
        fg: 'var(--accent-fg)',
      },

      // Semantic
      success: {
        DEFAULT: 'var(--success)',
        soft: 'var(--success-soft)',
      },
      warning: {
        DEFAULT: 'var(--warning)',
        soft: 'var(--warning-soft)',
      },
      danger: {
        DEFAULT: 'var(--danger)',
        soft: 'var(--danger-soft)',
      },
      info: {
        DEFAULT: 'var(--info)',
        soft: 'var(--info-soft)',
      },
      purple: {
        DEFAULT: 'var(--purple)',
        soft: 'var(--purple-soft)',
      },

      transparent: 'transparent',
      current: 'currentColor',
      inherit: 'inherit',
    },

    fontFamily: {
      sans: ['var(--font-sans)'],
      mono: ['var(--font-mono)'],
    },

    fontSize: {
      // Display
      'display-kpi': ['28px', { lineHeight: '1', letterSpacing: '-0.02em', fontWeight: '700' }],
      'display-revenue': ['30px', { lineHeight: '1', letterSpacing: '-0.03em', fontWeight: '700' }],
      'display-cycle': ['44px', { lineHeight: '1', letterSpacing: '-0.04em', fontWeight: '700' }],

      // Headings
      brand: ['15px', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '700' }],
      title: ['15px', { lineHeight: '1.2', fontWeight: '700' }],
      card: ['13px', { lineHeight: '1.3', fontWeight: '700' }],

      // Body
      nav: ['13.5px', { lineHeight: '1.3', fontWeight: '500' }],
      body: ['13px', { lineHeight: '1.4' }],
      meta: ['11.5px', { lineHeight: '1.3', fontWeight: '500' }],
      caption: ['12px', { lineHeight: '1.3' }],

      // Labels
      label: ['10px', { lineHeight: '1.2', letterSpacing: '0.07em', fontWeight: '700' }],
      'label-kpi': ['10.5px', { lineHeight: '1.2', letterSpacing: '0.09em', fontWeight: '700' }],

      // Badges / misc
      badge: ['11px', { lineHeight: '1.2', fontWeight: '700' }],
      mono: ['12px', { lineHeight: '1.3', fontFamily: 'var(--font-mono)' }],
      bar: ['9.5px', { lineHeight: '1.2' }],
    },

    spacing: {
      '0': '0',
      '0.5': '2px',
      '1': '4px',
      '1.5': '6px',
      '2': '8px',
      '2.5': '10px',
      '3': '12px',
      '3.5': '14px',
      '4': '16px',
      '5': '20px',
      '6': '24px',
      '7': '28px',
      '8': '32px',
      '10': '40px',
      '12': '48px',
      '14': '56px',
      '16': '64px',
      '64': '256px',
    },

    borderRadius: {
      none: '0',
      sm: '7px',
      DEFAULT: '10px',
      md: '10px',
      lg: '14px',
      icon: '8px',
      pill: '999px',
      full: '9999px',
    },

    boxShadow: {
      default: '0 1px 3px rgba(0,0,0,.06), 0 1px 2px rgba(0,0,0,.04)',
      hover: '0 4px 12px rgba(0,0,0,.10), 0 1px 3px rgba(0,0,0,.06)',
      modal: '0 24px 64px rgba(0,0,0,.20)',
      'focus-ring': '0 0 0 3px rgba(15,118,110,.12)',
      none: 'none',
    },

    transitionDuration: {
      fast: '100ms',
      ui: '120ms',
      lift: '150ms',
      slide: '220ms',
      chart: '300ms',
      DEFAULT: '120ms',
    },

    transitionTimingFunction: {
      DEFAULT: 'cubic-bezier(0.4, 0, 0.2, 1)',
      out: 'cubic-bezier(0, 0, 0.2, 1)',
      in: 'cubic-bezier(0.4, 0, 1, 1)',
    },

    extend: {
      gridTemplateColumns: {
        'app': 'var(--sidebar-w) 1fr',
      },
      gridTemplateRows: {
        'app': 'var(--topbar-h) 1fr',
      },
      spacing: {
        'sidebar-w': 'var(--sidebar-w)',
        'topbar-h': 'var(--topbar-h)',
      },
      maxWidth: {
        modal: '680px',
        onboarding: '560px',
        auth: '420px',
      },
    },
  },
  plugins: [],
};