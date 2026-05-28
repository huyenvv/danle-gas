# Design System

Identical `tailwind.config.js` across all apps. MD3 naming. SBM branding.

## Colors

- Primary (navy): `#01458e`, -50 `#e8f0fa`, -100 `#c8ddf2`, -700 `#003370`
- Accent (orange): `#e87a1e`, hover `#d06a12`, light `#fff3e8`
- Surface: bg `#f7f9fc`, lowest `#fff` (cards), low `#f2f4f7` (inputs), container `#eceef1` (hover)
- Text: on-surface `#191c1e`, on-surface-variant `#434655`
- Error: `#ba1a1a`. Outline: `#737686`, variant `#c3c6d7`

## Typography

Be Vietnam Pro (300–800), system-ui fallback. Full Vietnamese diacritics.

## Icons

Material Symbols Outlined. Max ~71 in Google Fonts URL. `sync-icons.js` auto-syncs.

## Shadows

md3-1 (headers), md3-2 (medium), md3-3 (modals), card (blue-tinted).

## Components

- **CTA:** `bg-accent text-white rounded-full px-5 py-2 shadow-md3-1`
- **Secondary:** `bg-surface-container border-outline-variant rounded-xl`
- **Cards:** `bg-white rounded-2xl shadow-card`
- **Modals:** backdrop `bg-black/40`, panel `bg-white rounded-3xl shadow-md3-3`. Edit: no backdrop close. Preview: backdrop close.
- **Tables:** header `bg-surface-container-low`, rows `hover:bg-surface-container-low`
- **Inputs:** `bg-surface-container-low rounded-xl px-3 py-2 text-sm`
- **Role badges:** GĐ=violet, VT=cyan, admin=primary, NV/TP=surface

## New App

Copy tailwind.config.js + index.html (font+icons+favicon) + follow patterns above + register in `_Ứng Dụng`.
