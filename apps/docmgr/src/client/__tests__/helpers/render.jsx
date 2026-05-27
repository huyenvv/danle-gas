import { render } from '@testing-library/react'
import { ToastProvider } from '../../context/ToastContext.jsx'
import { ConfirmProvider } from '../../context/ConfirmContext.jsx'

/**
 * Render with ToastProvider + ConfirmProvider.
 * Use this for all component tests that may call useToast() or useConfirm().
 */
export function renderWithProviders(ui) {
  return render(
    <ToastProvider>
      <ConfirmProvider>{ui}</ConfirmProvider>
    </ToastProvider>
  )
}
