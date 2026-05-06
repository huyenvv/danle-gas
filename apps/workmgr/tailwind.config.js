/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/client/**/*.{js,jsx,ts,tsx,html}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          50:  '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          DEFAULT: '#0053db',
          container: '#e8edff',
          fixed: '#dbe1ff',
          'fixed-dim': '#b4c5ff',
        },
        'on-primary':           '#ffffff',
        'on-primary-container': '#001258',

        secondary:              '#495c95',
        'secondary-container':  '#dde1ff',
        'on-secondary':         '#ffffff',
        'on-secondary-container': '#021160',

        tertiary:               '#943700',
        'tertiary-container':   '#ffdbca',
        'on-tertiary':          '#ffffff',
        'on-tertiary-container': '#311300',

        surface:                    '#f7f9fc',
        'surface-dim':              '#d8dadd',
        'surface-bright':           '#f7f9fc',
        'surface-tint':             '#0053db',
        'surface-variant':          '#e0e3f3',
        'surface-container':            '#eceef1',
        'surface-container-low':        '#f2f4f7',
        'surface-container-lowest':     '#ffffff',
        'surface-container-high':       '#e6e8eb',
        'surface-container-highest':    '#e0e3e6',
        'on-surface':               '#191c1e',
        'on-surface-variant':       '#434655',

        background:                 '#f7f9fc',
        'on-background':            '#191c1e',

        outline:                    '#737686',
        'outline-variant':          '#c3c6d7',

        error:                      '#ba1a1a',
        'error-container':          '#ffdad6',
        'on-error':                 '#ffffff',
        'on-error-container':       '#93000a',

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
