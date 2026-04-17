import { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)
let _toastId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'info', duration = 3000) => {
    const id = ++_toastId
    setToasts(prev => [...prev, { id, message, type }])
    if (duration > 0) setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm">
          {toasts.map(t => (
            <div key={t.id} onClick={() => removeToast(t.id)}
              className={`animate-toast-in px-4 py-3 rounded-xl shadow-md3-3 cursor-pointer text-sm font-medium
                ${t.type === 'success' ? 'bg-green-600 text-white' : ''}
                ${t.type === 'error' ? 'bg-error text-on-error' : ''}
                ${t.type === 'info' ? 'bg-primary text-on-primary' : ''}
              `}>{t.message}</div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
