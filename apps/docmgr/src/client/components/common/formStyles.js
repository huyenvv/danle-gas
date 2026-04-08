/**
 * Shared form style constants for consistent M3 styling across all forms.
 * Import the constants you need and apply as className strings.
 */

export const inputCls =
  'w-full bg-surface-container-low border border-outline-variant rounded-xl px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors'

export const selectCls =
  'w-full bg-surface-container-low border border-outline-variant rounded-xl px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors'

export const textareaCls =
  'w-full bg-surface-container-low border border-outline-variant rounded-xl px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors resize-none'

export const labelCls =
  'block text-xs font-medium text-on-surface-variant mb-1'

export const fieldCls =
  'space-y-1'

export const btnPrimary =
  'flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-full text-sm font-medium hover:bg-primary-700 transition-colors shadow-md3-1 disabled:opacity-50'

export const btnOutline =
  'flex items-center gap-2 border border-outline-variant text-on-surface-variant px-4 py-2 rounded-full text-sm font-medium hover:bg-surface-container transition-colors disabled:opacity-50'

export const btnDanger =
  'flex items-center gap-2 border border-error/30 text-error px-4 py-2 rounded-full text-sm font-medium hover:bg-error-container hover:text-on-error-container transition-colors disabled:opacity-50'

export const btnIcon =
  'w-8 h-8 flex items-center justify-center rounded-full transition-colors'

export const btnIconPrimary = btnIcon + ' text-primary hover:bg-primary/10'
export const btnIconDanger  = btnIcon + ' text-error hover:bg-error-container'
