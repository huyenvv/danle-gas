import { createContext, useContext, useState, useCallback } from 'react'

const ConfirmContext = createContext(null)

export function ConfirmProvider({ children }) {
  const [state, setState] = useState({ open: false, title: '', message: '', onConfirm: null, loading: false })

  const confirm = useCallback((title, message) => {
    return new Promise((resolve) => {
      setState({ open: true, title, message, onConfirm: resolve, loading: false })
    })
  }, [])

  const handleConfirm = async () => {
    setState(prev => ({ ...prev, loading: true }))
    state.onConfirm?.(true)
    setState({ open: false, title: '', message: '', onConfirm: null, loading: false })
  }

  const handleCancel = () => {
    state.onConfirm?.(false)
    setState({ open: false, title: '', message: '', onConfirm: null, loading: false })
  }

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state.open && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-md3-3 p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-error-container flex items-center justify-center">
                <span className="material-symbols-outlined text-error">warning</span>
              </div>
              <h3 className="text-lg font-semibold text-on-surface">{state.title}</h3>
            </div>
            <p className="text-sm text-on-surface-variant leading-relaxed">{state.message}</p>
            <div className="flex justify-end gap-2">
              <button onClick={handleCancel} className="px-4 py-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container rounded-full transition-colors">
                Hủy
              </button>
              <button onClick={handleConfirm} disabled={state.loading} className="px-4 py-2 text-sm font-medium bg-error text-on-error rounded-full hover:bg-red-700 transition-colors disabled:opacity-50">
                {state.loading ? 'Đang xóa…' : 'Xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  return useContext(ConfirmContext)
}
