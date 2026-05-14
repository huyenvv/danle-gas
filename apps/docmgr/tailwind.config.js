/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/client/**/*.{js,jsx,ts,tsx,html}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Be Vietnam Pro', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          50:  '#e8f0fa',
          100: '#c8ddf2',
          500: '#0567b8',
          600: '#01458e',
          700: '#003370',
          DEFAULT: '#01458e',
          container: '#dce8f5',
          fixed: '#c8ddf2',
          'fixed-dim': '#8ab4da',
        },
        'on-primary':           '#ffffff',
        'on-primary-container': '#002040',

        secondary:              '#3d5a80',
        'secondary-container':  '#d6e4f0',
        'on-secondary':         '#ffffff',
        'on-secondary-container': '#0a1929',

        tertiary:               '#e87a1e',
        'tertiary-container':   '#fff3e8',
        'on-tertiary':          '#ffffff',
        'on-tertiary-container': '#4a2800',

        accent: {
          DEFAULT: '#e87a1e',
          hover:   '#d06a12',
          light:   '#fff3e8',
          glow:    'rgba(232,122,30,0.15)',
        },

        surface:                    '#f5f7fa',
        'surface-dim':              '#d8dadd',
        'surface-bright':           '#f5f7fa',
        'surface-tint':             '#01458e',
        'surface-variant':          '#e0e3f3',
        'surface-container':            '#eceef1',
        'surface-container-low':        '#f2f4f7',
        'surface-container-lowest':     '#ffffff',
        'surface-container-high':       '#e6e8eb',
        'surface-container-highest':    '#e0e3e6',
        'on-surface':               '#191c1e',
        'on-surface-variant':       '#434655',

        // Background
        background:                 '#f7f9fc',
        'on-background':            '#191c1e',

        // Outline
        outline:                    '#737686',
        'outline-variant':          '#c3c6d7',

        // Error
        error:                      '#ba1a1a',
        'error-container':          '#ffdad6',
        'on-error':                 '#ffffff',
        'on-error-container':       '#93000a',

        // Inverse
        'inverse-surface':          '#2d3133',
        'inverse-on-surface':       '#eff1f4',
        'inverse-primary':          '#b4c5ff',
      },
      boxShadow: {
        'md3-1': '0 1px 2px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.1)',
        'md3-2': '0 2px 6px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
        'md3-3': '0 4px 12px rgba(0,0,0,0.10), 0 2px 4px rgba(0,0,0,0.06)',
        'card':  '0 2px 8px rgba(0,83,219,0.06), 0 1px 2px rgba(0,0,0,0.05)',
      },
    },
  },
  plugins: [],
}
