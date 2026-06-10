import { useState, useEffect } from 'react'
import gasCall from '../../gasClient.js'
import Icon from '../common/Icon.jsx'

// Browsing the owner's Drive via GAS is slow, so cache each folder's listing.
// Two layers: an in-memory Map (fast) backed by localStorage (survives F5 /
// tab close). Key = folderId ('root' for My Drive). The Refresh button bypasses
// the cache for the current folder.
export const _driveBrowseCache = new Map()   // key -> { data, t }

const CACHE_PREFIX = 'driveBrowse:v1:'
const CACHE_TTL    = 30 * 60 * 1000          // 30 min — stale Drive listings refresh after this
const CACHE_MAX    = 50                       // keep at most N folders persisted (LRU by timestamp)

// Sentinel telling the server to start at the app's configured ROOT_FOLDER_ID
// (resolved server-side; the client can't read that config). See api_browseDrive.
const APP_ROOT_SENTINEL = '__APP_ROOT__'

function _lsKey(key) { return CACHE_PREFIX + key }

function _persistedKeys() {
  const out = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.indexOf(CACHE_PREFIX) === 0) out.push(k)
    }
  } catch (e) {}
  return out
}

function _evictOldest(n) {
  const entries = _persistedKeys().map(k => {
    let t = 0
    try { t = JSON.parse(localStorage.getItem(k)).t || 0 } catch (e) {}
    return { k, t }
  }).sort((a, b) => a.t - b.t)
  entries.slice(0, n).forEach(e => { try { localStorage.removeItem(e.k) } catch (_) {} })
}

// Read from memory, falling back to localStorage (hydrating memory). TTL-checked.
function _cacheGet(key) {
  const mem = _driveBrowseCache.get(key)
  if (mem && Date.now() - mem.t < CACHE_TTL) return mem.data
  try {
    const raw = localStorage.getItem(_lsKey(key))
    if (raw) {
      const obj = JSON.parse(raw)
      if (obj && Date.now() - obj.t < CACHE_TTL) {
        _driveBrowseCache.set(key, obj)
        return obj.data
      }
      localStorage.removeItem(_lsKey(key))   // expired
    }
  } catch (e) {}
  return null
}

function _cacheSet(key, data) {
  const entry = { data, t: Date.now() }
  _driveBrowseCache.set(key, entry)
  try {
    localStorage.setItem(_lsKey(key), JSON.stringify(entry))
    const keys = _persistedKeys()
    if (keys.length > CACHE_MAX) _evictOldest(keys.length - CACHE_MAX)
  } catch (e) {
    // Quota exceeded → drop oldest entries and retry once; give up silently if still failing
    try { _evictOldest(10); localStorage.setItem(_lsKey(key), JSON.stringify(entry)) } catch (e2) {}
  }
}

// Test helper: clear both layers.
export function _clearDriveBrowseCache() {
  _driveBrowseCache.clear()
  _persistedKeys().forEach(k => { try { localStorage.removeItem(k) } catch (e) {} })
}

// Browse the deploy owner's Drive and pick file(s).
// Reuses the api_browseDrive endpoint (folders + files); navigates like FolderPicker.
// Props:
//   multiple  — allow selecting several files (default true). false = single-select.
//   accept    — array of lowercased extensions to show, e.g. ['.xlsx','.xls']. null = all.
//   title     — dialog header text.
export default function DriveFilePicker({ token, onConfirm, onClose, multiple = true, accept = null, title = 'Chọn file từ Google Drive', startAtAppRoot = false, lockToAppRoot = false }) {
  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError]           = useState('')
  const [current, setCurrent]       = useState(null)  // { id, name }
  const [currentFolderId, setCurrentFolderId] = useState(null) // null = My Drive root
  const [folders, setFolders]       = useState([])
  const [files, setFiles]           = useState([])
  const [breadcrumb, setBreadcrumb] = useState([])     // [{ id, name }, ...]
  const [selected, setSelected]     = useState({})     // { fileId: {id, name, mimeType, size} }

  useEffect(() => {
    loadFolder((startAtAppRoot || lockToAppRoot) ? APP_ROOT_SENTINEL : null) // start at app folder or My Drive
  }, [])

  function _applyResult(folderId, folderName, res) {
    setCurrent(res.current)
    setFolders(res.folders || [])
    setFiles(res.files || [])
    if (folderId === APP_ROOT_SENTINEL) {
      // Started inside the app's configured folder. Use its real id from here on.
      // lockToAppRoot: no My Drive crumb → can't navigate above the app folder.
      setCurrentFolderId(res.current.id)
      setBreadcrumb(lockToAppRoot
        ? [{ id: res.current.id, name: res.current.name }]
        : [{ id: null, name: 'My Drive' }, { id: res.current.id, name: res.current.name }])
    } else if (!folderId) {
      setCurrentFolderId(null)
      setBreadcrumb([{ id: null, name: 'My Drive' }])
    } else {
      setCurrentFolderId(folderId)
      setBreadcrumb(prev => {
        const idx = prev.findIndex(b => b.id === folderId)
        if (idx >= 0) return prev.slice(0, idx + 1)
        return [...prev, { id: folderId, name: folderName || res.current.name }]
      })
    }
  }

  async function loadFolder(folderId, folderName, force = false) {
    const key = folderId || 'root'
    setError('')

    const cached = _cacheGet(key)
    if (cached && !force) {
      _applyResult(folderId, folderName, cached)
      setLoading(false)        // remount starts with loading=true — clear it on cache hit
      setRefreshing(false)
      return
    }

    // No cache → full spinner; refreshing cached folder → keep content, spin the button
    if (cached) setRefreshing(true); else setLoading(true)
    try {
      const res = await gasCall('api_browseDrive', token, folderId || '')
      _cacheSet(key, res)
      _applyResult(folderId, folderName, res)
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
    setRefreshing(false)
  }

  function handleRefresh() {
    const crumb = breadcrumb[breadcrumb.length - 1]
    loadFolder(currentFolderId, crumb ? crumb.name : undefined, true)
  }

  function handleBreadcrumbClick(crumb, idx) {
    if (idx === breadcrumb.length - 1) return
    loadFolder(crumb.id, crumb.name)
  }

  function toggleFile(file) {
    setSelected(prev => {
      if (!multiple) return prev[file.id] ? {} : { [file.id]: file }
      const next = { ...prev }
      if (next[file.id]) delete next[file.id]
      else next[file.id] = file
      return next
    })
  }

  // Files filtered by `accept` (by extension on the file name)
  const shownFiles = accept
    ? files.filter(f => accept.some(ext => f.name.toLowerCase().endsWith(ext)))
    : files

  function handleConfirm() {
    const list = Object.values(selected)
    if (list.length) onConfirm(list)
  }

  const selectedCount = Object.keys(selected).length

  function fmtSize(bytes) {
    if (!bytes) return ''
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB'
    return (bytes / 1024 / 1024).toFixed(1) + ' MB'
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-[0_12px_40px_rgba(0,83,219,0.12)] w-full max-w-lg mx-4 flex flex-col max-h-[80vh]"
           onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-surface-container-low px-5 py-4 border-b border-outline-variant flex items-center gap-3 rounded-t-3xl">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Icon name="add_to_drive" size={20} className="text-primary" />
          </div>
          <h3 className="flex-1 font-semibold text-on-surface">{title}</h3>
          <button onClick={handleRefresh} disabled={loading || refreshing} title="Tải lại thư mục này"
            className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-50">
            <Icon name="sync" size={18} className={refreshing ? 'animate-spin' : ''} />
          </button>
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
          ) : folders.length === 0 && shownFiles.length === 0 ? (
            <div className="text-sm text-on-surface-variant flex items-center justify-center h-32">
              {accept ? 'Thư mục này không có file phù hợp' : 'Thư mục này trống'}
            </div>
          ) : (
            <div className="space-y-0.5">
              {folders.map(folder => (
                <button key={folder.id}
                  onClick={() => loadFolder(folder.id, folder.name)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-primary/5 text-left transition-colors group"
                >
                  <Icon name="folder" size={20} className="text-amber-500 shrink-0" />
                  <span className="text-sm text-on-surface group-hover:text-primary transition-colors truncate">{folder.name}</span>
                </button>
              ))}
              {shownFiles.map(file => (
                <button key={file.id}
                  onClick={() => toggleFile(file)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${selected[file.id] ? 'bg-primary/10' : 'hover:bg-primary/5'}`}
                >
                  <Icon name={selected[file.id] ? 'check_box' : 'check_box_outline_blank'} size={20}
                    className={`shrink-0 ${selected[file.id] ? 'text-primary' : 'text-on-surface-variant'}`} />
                  <Icon name="description" size={20} className="text-on-surface-variant shrink-0" />
                  <span className="flex-1 text-sm text-on-surface truncate">{file.name}</span>
                  {file.size > 0 && <span className="text-xs text-on-surface-variant shrink-0">{fmtSize(file.size)}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-outline-variant flex items-center justify-between rounded-b-3xl">
          <div className="text-xs text-on-surface-variant">
            {selectedCount > 0 ? `Đã chọn ${selectedCount} file` : (multiple ? 'Tích vào file để chọn' : 'Chọn 1 file')}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container rounded-full transition-colors">
              Hủy
            </button>
            <button onClick={handleConfirm} disabled={selectedCount === 0}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-accent text-white rounded-full font-medium hover:bg-accent-hover transition-colors shadow-md3-1 disabled:opacity-60">
              <Icon name="check" size={16} />
              Chọn {selectedCount > 0 ? `(${selectedCount})` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
