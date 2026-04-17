import { createContext, useContext, useState, useCallback, useRef } from 'react'

const ConfirmContext = createContext(null)

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null) // { message, resolve }
  const resolveRef = useRef(null)

  const confirm = useCallback((message) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve
      setDialog({ message })
    })
  }, [])

  function handleConfirm() {
    setDialog(null)
    resolveRef.current && resolveRef.current(true)
  }

  function handleCancel() {
    setDialog(null)
    resolveRef.current && resolveRef.current(false)
  }

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {dialog && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
          <div className="bg-white rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.18)] w-full max-w-sm p-6 flex flex-col gap-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-error-container flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-error" style={{ fontSize: 20 }}>delete</span>
              </div>
              <p className="text-sm text-on-surface leading-relaxed pt-2">{dialog.message}</p>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={handleCancel}
                className="px-4 py-2 rounded-xl text-sm font-medium text-on-surface-variant hover:bg-surface-container transition-colors">
                Huỷ
              </button>
              <button onClick={handleConfirm}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-error text-on-error hover:opacity-90 transition-opacity">
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  return useContext(ConfirmContext).confirm
}
