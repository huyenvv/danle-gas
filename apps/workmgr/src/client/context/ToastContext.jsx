import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  const icons = { success: 'check_circle', error: 'error', warning: 'warning', info: 'info' }
  const colors = {
    success: 'bg-green-600',
    error: 'bg-error',
    warning: 'bg-orange-500',
    info: 'bg-primary',
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm">
        {toasts.map(t => (
          <div key={t.id} className={`${colors[t.type] || colors.info} text-white px-4 py-3 rounded-xl shadow-md3-3 flex items-center gap-3 animate-slide-up text-sm`}>
            <span className="material-symbols-outlined text-lg icon-filled">{icons[t.type] || 'info'}</span>
            <span className="flex-1">{t.message}</span>
            <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} className="opacity-70 hover:opacity-100">
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
