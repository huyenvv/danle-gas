import { useState, useEffect } from 'react'
import gasCall from '../../gasClient.js'
import Icon from '../common/Icon.jsx'

export default function FolderPicker({ token, currentFolderId, onSelect, onClose }) {
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [current, setCurrent]       = useState(null)  // { id, name }
  const [folders, setFolders]       = useState([])
  const [breadcrumb, setBreadcrumb] = useState([])     // [{ id, name }, ...]

  useEffect(() => {
    loadFolder(null) // start at root
  }, [])

  async function loadFolder(folderId, folderName) {
    setLoading(true)
    setError('')
    try {
      const res = await gasCall('api_browseDriveFolders', token, folderId || '')
      setCurrent(res.current)
      setFolders(res.folders)

      if (!folderId) {
        // Root
        setBreadcrumb([{ id: res.current.id, name: 'My Drive' }])
      } else {
        setBreadcrumb(prev => {
          const idx = prev.findIndex(b => b.id === folderId)
          if (idx >= 0) {
            // clicking a breadcrumb — trim to that level
            return prev.slice(0, idx + 1)
          }
          // navigating deeper
          return [...prev, { id: folderId, name: folderName || res.current.name }]
        })
      }
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  function handleNavigate(folder) {
    loadFolder(folder.id, folder.name)
  }

  function handleBreadcrumbClick(crumb, idx) {
    if (idx === breadcrumb.length - 1) return // already here
    loadFolder(crumb.id, crumb.name)
  }

  function handleSelect() {
    if (current) onSelect(current)
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-[0_12px_40px_rgba(0,83,219,0.12)] w-full max-w-lg mx-4 flex flex-col max-h-[80vh]"
           onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-surface-container-low px-5 py-4 border-b border-outline-variant flex items-center gap-3 rounded-t-3xl">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Icon name="folder_open" size={20} className="text-primary" />
          </div>
          <h3 className="flex-1 font-semibold text-on-surface">Chọn thư mục Google Drive</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors">
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Breadcrumb */}
        <div className="px-5 py-2 border-b border-outline-variant/50 flex items-center gap-1 text-sm overflow-x-auto">
          {breadcrumb.map((crumb, idx) => (
            <span key={crumb.id} className="flex items-center gap-1 shrink-0">
              {idx > 0 && <span className="text-on-surface-variant/40">/</span>}
              <button
                onClick={() => handleBreadcrumbClick(crumb, idx)}
                className={`hover:text-primary transition-colors ${idx === breadcrumb.length - 1 ? 'text-primary font-medium' : 'text-on-surface-variant'}`}
              >
                {crumb.name}
              </button>
            </span>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-3 min-h-[200px]">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <Icon name="sync" size={24} className="animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="text-sm bg-error-container text-on-error-container rounded-xl px-4 py-3">{error}</div>
          ) : folders.length === 0 ? (
            <div className="text-sm text-on-surface-variant flex items-center justify-center h-32">
              Thư mục này không có thư mục con
            </div>
          ) : (
            <div className="space-y-0.5">
              {folders.map(folder => (
                <button key={folder.id}
                  onDoubleClick={() => handleNavigate(folder)}
                  onClick={() => handleNavigate(folder)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-primary/5 text-left transition-colors group"
                >
                  <Icon name="folder" size={20} className="text-amber-500 shrink-0" />
                  <span className="text-sm text-on-surface group-hover:text-primary transition-colors truncate">{folder.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-outline-variant flex items-center justify-between rounded-b-3xl">
          <div className="text-xs text-on-surface-variant truncate max-w-[55%]">
            {current && (
              <span className="flex items-center gap-1">
                <Icon name="folder" size={14} className="text-amber-500 shrink-0" />
                <strong className="text-on-surface">{current.name}</strong>
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container rounded-full transition-colors">
              Hủy
            </button>
            <button onClick={handleSelect} disabled={!current}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-accent text-white rounded-full font-medium hover:bg-accent-hover transition-colors shadow-md3-1 disabled:opacity-60">
              <Icon name="check" size={16} />
              Chọn thư mục này
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
