# Design System Reference

## Stack

- Tailwind CSS with custom tokens (identical config across all apps)
- Material Design 3 color naming conventions
- SBM company branding
- Font: Be Vietnam Pro (300–800) + system-ui fallback
- Icons: Google Material Symbols Outlined

## Color Palette

### Primary (Navy)
- `primary`: `#01458e` — buttons, links, sidebar
- `primary-50`: `#e8f0fa` — light backgrounds
- `primary-100`: `#c8ddf2` — hover backgrounds
- `primary-700`: `#003370` — dark emphasis

### Accent (Orange)
- `accent`: `#e87a1e` — CTA buttons, active states
- `accent-hover`: `#d06a12`
- `accent-light`: `#fff3e8`

### Surface System (MD3)
- `background`: `#f7f9fc`
- `surface-container-lowest`: `#ffffff` — cards, modals
- `surface-container-low`: `#f2f4f7` — input backgrounds
- `surface-container`: `#eceef1` — hover states
- `on-surface`: `#191c1e` — primary text
- `on-surface-variant`: `#434655` — secondary text

### Semantic
- `error`: `#ba1a1a`, `error-container`: `#ffdad6`
- `outline`: `#737686`, `outline-variant`: `#c3c6d7`

## Elevation (Box Shadows)

| Token | Usage |
|---|---|
| `md3-1` | Headers, toolbars |
| `md3-2` | Medium elevation |
| `md3-3` | Dropdowns, modals |
| `card` | Card containers (blue-tinted) |

## Component Patterns

- **Primary CTA:** `bg-accent text-white rounded-full px-5 py-2 shadow-md3-1`
- **Secondary:** `bg-surface-container border border-outline-variant rounded-xl`
- **Cards:** `bg-white rounded-2xl shadow-card border border-outline-variant/30`
- **Modals:** backdrop `bg-black/40`, panel `bg-white rounded-3xl shadow-md3-3`
  - Edit/create: no close on backdrop click
  - Preview/read-only: close on backdrop click
- **Tables:** header `bg-surface-container-low`, rows `hover:bg-surface-container-low`
- **Form inputs:** `bg-surface-container-low rounded-xl px-3 py-2 text-sm`
- **Role badges:** colored pills per role (Giám đốc=violet, Văn thư=cyan, etc.)

## New App Checklist

1. Copy `tailwind.config.js` from existing app
2. `index.html`: Be Vietnam Pro font, Material Symbols, SBM favicon
3. `index.css`: font-family Be Vietnam Pro
4. Follow component patterns above
5. Register in SSO Portal `_Ứng Dụng` sheet
