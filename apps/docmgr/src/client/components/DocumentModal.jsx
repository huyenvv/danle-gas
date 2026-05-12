import { useState, useRef } from 'react'
import { flushSync } from 'react-dom'
import gasCall from '../gasClient.js'
import { dataCache } from '../utils/dataCache.js'
import { formatCurrency } from '../utils/format.js'
import { useToast } from '../context/ToastContext.jsx'
import { useConfirm } from '../context/ConfirmContext.jsx'
import LoadingOverlay from './common/LoadingOverlay.jsx'

const STATUS_OPTIONS = ['Chờ duyệt', 'Chờ xử lý', 'Đang xử lý', 'Hoàn thành']

function toDateInput(val) {
  if (!val) return ''
  const s = String(val).trim()
  // Exact YYYY-MM-DD — return directly (no timezone issue)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  // DD/MM/YYYY (Vietnamese input format)
  const dmyMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2].padStart(2,'0')}-${dmyMatch[1].padStart(2,'0')}`
  // ISO string with time (e.g. GAS serialized Date) — use local parts to handle timezone
  try {
    const d = new Date(s)
    if (isNaN(d.getTime())) return ''
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  } catch { return '' }
}

function parseAssignees(v) {
  if (!v) return []
  if (typeof v === 'string' && v.charAt(0) === '[') { try { return JSON.parse(v).map(String) } catch(_) {} }
  return [String(v)]
}
const MAX_FILE_MB = 20

function buildCategoryOptions(danhMuc) {
  const opts = []
  function walk(parentId, depth) {
    danhMuc
      .filter(c => String(c['Danh mục cha'] || '') === String(parentId || ''))
      .forEach(c => {
        const prefix = '\u00A0'.repeat(depth * 4) + (depth > 0 ? '— ' : '')
        opts.push({ id: c.ID, label: prefix + c['Tên danh mục'] })
        walk(c.ID, depth + 1)
      })
  }
  walk('', 0)
  return opts
}

function formatCompact(n) {
  if (n >= 1000000000) return (n / 1000000000).toFixed(n % 1000000000 === 0 ? 0 : 1) + 'B'
  if (n >= 1000000)    return (n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1) + 'M'
  if (n >= 1000)       return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'K'
  return String(n)
}

function parseSuggestions(raw) {
  const digits = String(raw || '').replace(/[^\d]/g, '')
  if (!digits) return []
  const n = Number(digits)
  if (!n) return []
  const multipliers = [10, 100, 1000, 10000, 100000]
  return multipliers.map(m => ({ value: n * m, label: formatCompact(n * m) }))
}

export default function DocumentModal({ mode, doc, lookups: initialLookups, token, session, onClose, onSaved, docs }) {
  const isEdit = mode === 'edit'

  // Phụ trách: single person (parse from JSON array)
  const initialPhuTrach = isEdit && doc?.['Phụ trách']
    ? (() => { try { const v = doc['Phụ trách']; const arr = (typeof v === 'string' && v.charAt(0) === '[') ? JSON.parse(v) : [v]; return String(arr[0] || '') } catch(_) { return String(doc['Phụ trách']) } })()
    : ''

  // Người phối hợp: multi-select (parse from JSON array)
  const initialCollaborators = isEdit && doc?.['Người phối hợp']
    ? (() => { try { const v = doc['Người phối hợp']; return (typeof v === 'string' && v.charAt(0) === '[') ? JSON.parse(v) : (v ? [v] : []) } catch(_) { return [] } })()
    : []

  const [form, setForm] = useState(isEdit ? {
    ...doc,
    'Dự án (Phòng ban)': (doc['Dự án (Phòng ban)'] || '').trim(),
    'Nhà cung cấp (Nơi ban hành)': (doc['Nhà cung cấp (Nơi ban hành)'] || '').trim(),
    'Ngày ban hành': toDateInput(doc['Ngày ban hành']),
    'Ngày kết thúc': toDateInput(doc['Ngày kết thúc']),
    'Ghi chú': doc['Ghi chú'] || '',
  } : {
    'Tên hồ sơ': '',
    'Danh mục': '',
    'Số hồ sơ': '',
    'Dự án (Phòng ban)': '',
    'Nhà cung cấp (Nơi ban hành)': '',
    'Ngày ban hành': '',
    'Ngày kết thúc': '',
    'Giá trị HĐ': '',
    'Tình trạng': 'Chờ duyệt',
    'Ghi chú': '',
    'Nơi lưu hồ sơ cứng': '',
  })
  const [phuTrach, setPhuTrach] = useState(initialPhuTrach)
  const [collaborators, setCollaborators] = useState(initialCollaborators)
  const [collabSearch, setCollabSearch] = useState('')
  const [currencyTyping, setCurrencyTyping] = useState(null)

  const [files, setFiles]           = useState([])   // new files: [{file: File}]
  const [existingFiles, setExistingFiles] = useState(  // existing files in edit mode
    isEdit ? _parseFileInfosClient(doc['File ID']) : []
  )
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState('')
  const [dupWarning, setDupWarning] = useState('')
  const [quickAdd, setQuickAdd]   = useState(null) // null | 'duAn' | 'nhaCungCap'
  const [quickForm, setQuickForm] = useState({})
  const [quickSaving, setQuickSaving] = useState(false)
  const [lookups, setLookups]     = useState(initialLookups)
  const fileRef = useRef()
  const statusOverrideRef = useRef(null)
  const notifyTargetRef = useRef(null)
  const { showToast } = useToast()
  const confirm = useConfirm()

  // Role-based UI
  const role = session?.role || ''
  const isAdminRole = role === 'admin' || role === 'Quản trị viên' || role === 'Giám đốc'
  const isVanThu = role === 'Văn thư'
  const isNvTpCreate = !isEdit && !isAdminRole && !isVanThu && session?.canCreate
  const canEditStatus = isAdminRole || isVanThu
  const statusOptions = isVanThu ? ['Chờ duyệt', 'Hoàn thành'] : STATUS_OPTIONS
  const canEditPhuTrach = isAdminRole
  const isPhuTrachOfDoc = isEdit && (() => { const list = parseAssignees(doc?.['Phụ trách']); return list.includes(String(session?.userId)) || list.includes(session?.username) })()
  const canEditPhoiHop = isAdminRole || isPhuTrachOfDoc
  const canEditFields = isAdminRole || isVanThu
  const canQuickAddLookup = isAdminRole || isVanThu

  function setField(key, val) {
    setForm(f => ({ ...f, [key]: val }))
  }

  function checkDuplicate(soHoSo) {
    if (!soHoSo || !docs) { setDupWarning(''); return }
    const dup = docs.find(d =>
      d['Số hồ sơ'] === soHoSo && (!isEdit || String(d.ID) !== String(doc.ID))
    )
    setDupWarning(dup ? `Số hồ sơ "${soHoSo}" đã tồn tại (${dup['Tên hồ sơ']})` : '')
  }

  function handleFileChange(e) {
    const newFiles = Array.from(e.target.files || [])
    const tooBig = newFiles.find(f => f.size > MAX_FILE_MB * 1024 * 1024)
    if (tooBig) { setError(`File "${tooBig.name}" quá lớn (tối đa ${MAX_FILE_MB}MB)`); return }
    setFiles(prev => [...prev, ...newFiles.map(f => ({ file: f }))])
    e.target.value = ''
  }

  function removeNewFile(idx) {
    setFiles(prev => prev.filter((_, i) => i !== idx))
  }

  async function removeExistingFile(fileId, fileName) {
    if (!await confirm(`Xoá file "${fileName || fileId}" khỏi hồ sơ này?`)) return
    setExistingFiles(prev => prev.filter(f => f.fileId !== fileId))
  }

  // Quick-add project/supplier
  async function handleQuickAdd() {
    setQuickSaving(true)
    try {
      if (quickAdd === 'duAn') {
        if (!quickForm['Tên dự án viết tắt']) return
        await gasCall('api_addDuAn', token, quickForm)
        dataCache.invalidate('lookups')
        const fresh = await gasCall('api_getAllData', token)
        dataCache.set('lookups', fresh)
        setLookups(fresh)
        // Auto-select newly added
        const newItem = fresh.duAn[fresh.duAn.length - 1]
        if (newItem) setField('Dự án (Phòng ban)', newItem['Tên dự án viết tắt'])
      } else if (quickAdd === 'nhaCungCap') {
        if (!quickForm['Tên NCC viết tắt']) return
        await gasCall('api_addNhaCungCap', token, quickForm)
        dataCache.invalidate('lookups')
        const fresh = await gasCall('api_getAllData', token)
        dataCache.set('lookups', fresh)
        setLookups(fresh)
        const newItem = fresh.nhaCungCap[fresh.nhaCungCap.length - 1]
        if (newItem) setField('Nhà cung cấp (Nơi ban hành)', newItem['Tên NCC viết tắt'])
      }
      setQuickAdd(null)
      setQuickForm({})
    } catch (err) {
      setError(err.message)
    } finally {
      setQuickSaving(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form['Tên hồ sơ']) { setError('Tên hồ sơ là bắt buộc'); return }
    if (!form['Danh mục']) { setError('Danh mục là bắt buộc'); return }
    if (dupWarning) { setError('Vui lòng sửa số hồ sơ trùng'); return }
    setError('')
    setUploading(true)

    try {
      const fileInfos = await Promise.all(
        files.map(async ({ file: f }) => {
          const base64 = await toBase64(f)
          return { base64Data: base64, mimeType: f.type, fileName: f.name, size: f.size }
        })
      )
      const keepFileIds = existingFiles.map(f => f.fileId)

      const submitForm = {
        ...form,
        'Tình trạng': statusOverrideRef.current !== null ? statusOverrideRef.current : form['Tình trạng'],
        'Phụ trách': phuTrach || '',
        'Người phối hợp': collaborators.length ? collaborators : [],
      }
      const notifyTarget = notifyTargetRef.current
      statusOverrideRef.current = null
      notifyTargetRef.current = null
      if (isEdit) {
        const updated = await gasCall('api_updateDocument', token, doc.ID, submitForm, fileInfos, keepFileIds, notifyTarget)
        showToast('Đã cập nhật hồ sơ', 'success')
        onSaved(updated)
      } else {
        const created = await gasCall('api_createDocument', token, submitForm, fileInfos, notifyTarget)
        showToast('Đã thêm hồ sơ', 'success')
        onSaved(created)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      {uploading && <LoadingOverlay />}
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col shadow-[0_12px_40px_rgba(0,83,219,0.12)]">

        {/* Header */}
        <div className="bg-surface-container-low px-6 py-4 flex items-center gap-3 border-b border-outline-variant shrink-0">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 20 }}>
              {isEdit ? 'edit_document' : 'note_add'}
            </span>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-on-surface text-base">{isEdit ? 'Chỉnh sửa hồ sơ' : 'Thêm hồ sơ mới'}</h3>
            <p className="text-xs text-on-surface-variant">{isEdit ? 'Cập nhật thông tin hồ sơ' : 'Điền đầy đủ thông tin bên dưới'}</p>
          </div>
          <button onClick={onClose} disabled={uploading} className="w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-40 disabled:pointer-events-none">
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>

        {/* Body */}
        <form id="_docModalForm" onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 grid md:grid-cols-2 gap-x-8 gap-y-5">

            {/* ── LEFT COLUMN ── */}
            <div className="space-y-5">
              {/* Tên hồ sơ */}
              <Field label="Tên hồ sơ *">
                <input className={iCls} value={form['Tên hồ sơ']} onChange={e => setField('Tên hồ sơ', e.target.value)} placeholder="Nhập tên hồ sơ..." />
              </Field>

              {/* Danh mục */}
              <Field label="Danh mục *">
                <select className={iCls} value={form['Danh mục']} onChange={e => {
                  const catId = e.target.value
                  setField('Danh mục', catId)
                  // Auto-fill Nơi lưu hồ sơ cứng from category
                  const cat = (lookups.danhMuc || []).find(c => String(c.ID) === catId)
                  if (cat && cat['Nơi lưu hồ sơ cứng']) {
                    setField('Nơi lưu hồ sơ cứng', cat['Nơi lưu hồ sơ cứng'])
                  }
                }}>
                  <option value="">-- Chọn --</option>
                  {buildCategoryOptions(lookups.danhMuc || []).map(o => (
                    <option key={o.id} value={o.id}>{o.label}</option>
                  ))}
                </select>
              </Field>

              {/* Phụ trách (single person) — only admin/GĐ can change */}
              {canEditPhuTrach ? (
                <Field label="Phụ trách">
                  <select className={iCls} value={phuTrach} onChange={e => setPhuTrach(e.target.value)}>
                    <option value="">-- Chọn --</option>
                    {(lookups.users || []).map(u => {
                      const name = u['Tên nhân viên'] || u['Tên đăng nhập']
                      const label = u['Email'] ? `${name} (${u['Email']})` : name
                      return <option key={u.ID} value={u['Tên đăng nhập']}>{label}</option>
                    })}
                  </select>
                </Field>
              ) : phuTrach ? (
                <Field label="Phụ trách">
                  {(() => {
                    const u = (lookups.users || []).find(u => u['Tên đăng nhập'] === phuTrach)
                    const name = u?.['Tên nhân viên'] || phuTrach
                    const email = u?.['Email'] || ''
                    return (
                      <div className="relative group inline-block w-full">
                        <p className="text-sm text-on-surface bg-surface-container-low rounded-xl px-3 py-2.5 cursor-default">{name}</p>
                        <div className="pointer-events-none absolute bottom-full left-0 mb-1.5 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                          <div className="bg-on-surface text-surface text-xs rounded-lg px-2 py-1.5 whitespace-nowrap shadow-lg">
                            <p className="font-medium">{name}</p>
                            {email && <p className="text-surface/70 text-[10px]">{email}</p>}
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                </Field>
              ) : null}

              {/* Người phối hợp (multi-select) — admin/GĐ/phụ trách can edit */}
              {canEditPhoiHop ? (
                <Field label="Người phối hợp">
                  <div className="space-y-1.5">
                    {collaborators.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {collaborators.map(a => {
                          const u = (lookups.users || []).find(u => u['Tên đăng nhập'] === a)
                          const displayName = u?.['Tên nhân viên'] || a
                          const email = u?.['Email'] || ''
                          return (
                            <div key={a} className="relative group">
                              <span className="inline-flex items-center gap-1 bg-secondary/10 text-secondary text-xs px-2.5 py-1 rounded-full">
                                <span className="w-4 h-4 rounded-full bg-secondary text-on-secondary flex items-center justify-center text-[9px] font-bold shrink-0">{displayName.charAt(0).toUpperCase()}</span>
                                {displayName}
                                <button type="button" onClick={() => setCollaborators(prev => prev.filter(x => x !== a))}
                                  className="ml-0.5 hover:text-error transition-colors">
                                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>close</span>
                                </button>
                              </span>
                              <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                                <div className="bg-on-surface text-surface text-xs rounded-lg px-2 py-1.5 whitespace-nowrap shadow-lg">
                                  <p className="font-medium">{displayName}</p>
                                  {email && <p className="text-surface/70 text-[10px]">{email}</p>}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    <div className="relative">
                      <input className={iCls} placeholder="Thêm người phối hợp..."
                        value={collabSearch}
                        onChange={e => setCollabSearch(e.target.value)} />
                      {collabSearch && (() => {
                        const users = lookups.users || []
                        const filtered = users.filter(u =>
                          (u['Tên nhân viên'] || u['Tên đăng nhập']).toLowerCase().includes(collabSearch.toLowerCase()) &&
                          !collaborators.includes(u['Tên đăng nhập']) &&
                          u['Tên đăng nhập'] !== phuTrach
                        )
                        if (!filtered.length) return null
                        return (
                          <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-white border border-outline-variant rounded-xl shadow-md3-3 max-h-40 overflow-y-auto">
                            {filtered.map(u => {
                              const dn = u['Tên nhân viên'] || u['Tên đăng nhập']
                              return (
                                <button key={u.ID} type="button"
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-secondary/5 flex items-center gap-2"
                                  onClick={() => { setCollaborators(prev => [...prev, u['Tên đăng nhập']]); setCollabSearch('') }}>
                                  <span className="w-6 h-6 rounded-full bg-secondary text-on-secondary flex items-center justify-center text-[10px] font-bold shrink-0">{dn.charAt(0).toUpperCase()}</span>
                                  <span>{dn}</span>
                                </button>
                              )
                            })}
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                </Field>
              ) : collaborators.length > 0 ? (
                <Field label="Người phối hợp">
                  <div className="flex flex-wrap gap-1.5 bg-surface-container-low rounded-xl px-3 py-2.5">
                    {collaborators.map(a => {
                      const u = (lookups.users || []).find(u => u['Tên đăng nhập'] === a)
                      const dn = u?.['Tên nhân viên'] || a
                      const email = u?.['Email'] || ''
                      return (
                        <div key={a} className="relative group">
                          <span className="inline-flex items-center gap-1 bg-secondary/10 text-secondary text-xs px-2.5 py-1 rounded-full">
                            <span className="w-4 h-4 rounded-full bg-secondary text-on-secondary flex items-center justify-center text-[9px] font-bold shrink-0">{dn.charAt(0).toUpperCase()}</span>
                            {dn}
                          </span>
                          <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                            <div className="bg-on-surface text-surface text-xs rounded-lg px-2 py-1.5 whitespace-nowrap shadow-lg">
                              <p className="font-medium">{dn}</p>
                              {email && <p className="text-surface/70 text-[10px]">{email}</p>}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Field>
              ) : null}

              {/* Ngày ban hành + Ngày kết thúc */}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Ngày ban hành">
                  <input type="date" className={iCls} value={form['Ngày ban hành']} onChange={e => setField('Ngày ban hành', e.target.value)} />
                </Field>
                <Field label="Ngày kết thúc">
                  <input type="date" className={iCls} value={form['Ngày kết thúc']} onChange={e => setField('Ngày kết thúc', e.target.value)} />
                </Field>
              </div>

              {/* File đính kèm */}
              <Field label="File đính kèm">
                {/* Existing files (edit mode) */}
                {existingFiles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {existingFiles.map(ef => (
                      <span key={ef.fileId} className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2.5 py-1 rounded-full">
                        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>attach_file</span>
                        <span className="max-w-[120px] truncate">{ef.fileName || ef.fileId}</span>
                        <button type="button" onClick={() => removeExistingFile(ef.fileId, ef.fileName)}
                          className="ml-0.5 hover:text-error transition-colors">
                          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>close</span>
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* New files */}
                {files.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {files.map(({ file: f }, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1 bg-secondary/10 text-secondary text-xs px-2.5 py-1 rounded-full">
                        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>upload_file</span>
                        <span className="max-w-[120px] truncate">{f.name}</span>
                        <span className="opacity-60">({(f.size / 1024 / 1024).toFixed(1)}MB)</span>
                        <button type="button" onClick={() => removeNewFile(idx)}
                          className="ml-0.5 hover:text-error transition-colors">
                          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>close</span>
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div
                  className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-colors ${
                    isDragging ? 'border-primary bg-primary/10' : 'border-outline-variant hover:border-primary/50 hover:bg-primary/5'
                  }`}
                  onClick={() => fileRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                  onDragEnter={e => { e.preventDefault(); setIsDragging(true) }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={e => {
                    e.preventDefault(); setIsDragging(false)
                    const dropped = Array.from(e.dataTransfer.files)
                    handleFileChange({ target: { files: dropped } })
                  }}
                >
                  <span className="material-symbols-outlined text-on-surface-variant mb-1" style={{ fontSize: 28 }}>upload_file</span>
                  <p className="text-sm text-on-surface-variant">Kéo file vào đây hoặc <span className="text-primary font-medium">chọn file</span></p>
                  <p className="text-xs text-on-surface-variant mt-0.5">PDF, DOC, XLSX, PNG, JPG — tối đa 20MB/file, nhiều file</p>
                  <input ref={fileRef} type="file" className="hidden" onChange={handleFileChange} multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" />
                </div>
              </Field>
            </div>

            {/* ── RIGHT COLUMN ── */}
            <div className="space-y-5">
              {/* Dự án (Phòng ban) */}
              <Field label="Dự án (Phòng ban)">
                <div className="flex gap-2">
                  <select className={iCls + ' flex-1'} value={form['Dự án (Phòng ban)']} onChange={e => setField('Dự án (Phòng ban)', e.target.value)}>
                    <option value="">-- Chọn dự án --</option>
                    {(lookups.duAn || []).map(p => <option key={p.ID} value={p['Tên dự án viết tắt']}>
                      {p['Tên dự án đầy đủ'] ? `${p['Tên dự án đầy đủ']} (${p['Tên dự án viết tắt']})` : p['Tên dự án viết tắt']}
                    </option>)}
                  </select>
                  {canQuickAddLookup && (
                  <button type="button"
                    onClick={() => { setQuickAdd('duAn'); setQuickForm({ 'Tên dự án viết tắt': '', 'Tên dự án đầy đủ': '' }) }}
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-secondary/10 text-secondary hover:bg-secondary/20 transition-colors shrink-0"
                    title="Thêm dự án mới">
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>add_circle</span>
                  </button>
                  )}
                </div>
              </Field>

              {/* Nhà cung cấp (Nơi ban hành) */}
              <Field label="Nhà cung cấp (Nơi ban hành)">
                <div className="flex gap-2">
                  <select className={iCls + ' flex-1'} value={form['Nhà cung cấp (Nơi ban hành)']} onChange={e => setField('Nhà cung cấp (Nơi ban hành)', e.target.value)}>
                    <option value="">-- Chọn NCC --</option>
                    {(lookups.nhaCungCap || []).map(p => <option key={p.ID} value={p['Tên NCC viết tắt']}>
                      {p['Tên NCC đầy đủ'] ? `${p['Tên NCC đầy đủ']} (${p['Tên NCC viết tắt']})` : p['Tên NCC viết tắt']}
                    </option>)}
                  </select>
                  {canQuickAddLookup && (
                  <button type="button"
                    onClick={() => { setQuickAdd('nhaCungCap'); setQuickForm({ 'Tên NCC viết tắt': '', 'Tên NCC đầy đủ': '' }) }}
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-secondary/10 text-secondary hover:bg-secondary/20 transition-colors shrink-0"
                    title="Thêm NCC mới">
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>add_circle</span>
                  </button>
                  )}
                </div>
              </Field>

              {/* Quick-add inline panel */}
              {quickAdd && (
                <div className="bg-secondary/5 border border-secondary/20 rounded-2xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-secondary">
                    + Thêm nhanh {quickAdd === 'duAn' ? 'dự án' : 'nhà cung cấp'}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {quickAdd === 'duAn' ? (<>
                      <input className={iCls} placeholder="Tên viết tắt *" value={quickForm['Tên dự án viết tắt'] || ''}
                        onChange={e => setQuickForm(f => ({ ...f, 'Tên dự án viết tắt': e.target.value }))} />
                      <input className={iCls} placeholder="Tên đầy đủ" value={quickForm['Tên dự án đầy đủ'] || ''}
                        onChange={e => setQuickForm(f => ({ ...f, 'Tên dự án đầy đủ': e.target.value }))} />
                    </>) : (<>
                      <input className={iCls} placeholder="Tên viết tắt *" value={quickForm['Tên NCC viết tắt'] || ''}
                        onChange={e => setQuickForm(f => ({ ...f, 'Tên NCC viết tắt': e.target.value }))} />
                      <input className={iCls} placeholder="Tên đầy đủ" value={quickForm['Tên NCC đầy đủ'] || ''}
                        onChange={e => setQuickForm(f => ({ ...f, 'Tên NCC đầy đủ': e.target.value }))} />
                    </>)}
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button type="button" onClick={() => setQuickAdd(null)}
                      className="px-3 py-1.5 text-xs border border-outline-variant rounded-full text-on-surface-variant hover:bg-surface-container transition-colors">Hủy</button>
                    <button type="button" onClick={handleQuickAdd} disabled={quickSaving}
                      className="px-3 py-1.5 text-xs bg-secondary text-on-secondary rounded-full disabled:opacity-60 hover:opacity-90 transition-opacity">
                      {quickSaving ? 'Đang lưu…' : 'Thêm'}
                    </button>
                  </div>
                </div>
              )}

              {/* Giá trị HĐ */}
              <Field label="Giá trị HĐ (VNĐ)">
                <input type="text" inputMode="numeric" className={iCls}
                  value={form['Giá trị HĐ'] ? Number(String(form['Giá trị HĐ']).replace(/\./g, '')).toLocaleString('vi-VN') : ''}
                  onChange={e => { setField('Giá trị HĐ', e.target.value.replace(/[^\d]/g, '')); setCurrencyTyping('hd') }}
                  onBlur={() => setTimeout(() => setCurrencyTyping(null), 200)}
                  placeholder="0" />
                {currencyTyping === 'hd' && parseSuggestions(form['Giá trị HĐ']).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {parseSuggestions(form['Giá trị HĐ']).map(({ value, label }) => (
                      <button key={value} type="button" onMouseDown={e => { e.preventDefault(); setField('Giá trị HĐ', String(value)); setCurrencyTyping(null) }}
                        className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full hover:bg-primary/20 transition-colors">
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </Field>

              {/* Tình trạng + Số hồ sơ */}
              <div className={`grid ${isEdit || (!isVanThu && !isNvTpCreate) ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
                {/* Tình trạng — hidden for Văn thư/NV/TP in create mode (buttons handle status) */}
                {(isEdit || (!isVanThu && !isNvTpCreate)) && (
                  <Field label="Tình trạng">
                    <select className={iCls} value={form['Tình trạng']} onChange={e => setField('Tình trạng', e.target.value)}
                      disabled={!canEditStatus}>
                      {statusOptions.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </Field>
                )}
                <Field label="Số hồ sơ">
                  <input className={iCls} value={form['Số hồ sơ']}
                    onChange={e => setField('Số hồ sơ', e.target.value)}
                    onBlur={e => checkDuplicate(e.target.value)} />
                  {dupWarning && <p className="text-amber-600 text-xs mt-1">{dupWarning}</p>}
                </Field>
              </div>

              {/* Ghi chú */}
              <Field label="Ghi chú">
                <textarea className={iCls + ' resize-none h-20'} value={form['Ghi chú'] || ''} onChange={e => setField('Ghi chú', e.target.value)} placeholder="Ghi chú..." />
              </Field>

              {/* Nơi lưu hồ sơ cứng */}
              <Field label="Nơi lưu hồ sơ cứng">
                <input className={iCls} value={form['Nơi lưu hồ sơ cứng'] || ''} onChange={e => setField('Nơi lưu hồ sơ cứng', e.target.value)} placeholder="VD: Tủ A, Kệ 3..." />
              </Field>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mx-6 mb-4 bg-error-container text-on-error-container rounded-xl px-4 py-3 text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-error" style={{ fontSize: 18 }}>error</span>
              {error}
            </div>
          )}

          {/* Footer */}
          <div className="bg-surface-container-low border-t border-outline-variant px-6 py-4 flex justify-end gap-3 shrink-0">
            <button type="button" onClick={onClose}
              className="px-5 py-2.5 border border-outline-variant rounded-full text-sm text-on-surface hover:bg-surface-container transition-colors font-medium">
              Hủy
            </button>
            {!isEdit && (isVanThu || isNvTpCreate) ? (
              <>
                <button type="button" disabled={uploading}
                  onClick={async () => {
                    if (!await confirm('Có chắc chỉ lưu trữ, không gửi thông báo tới Giám đốc?')) return
                    statusOverrideRef.current = 'Hoàn thành'; notifyTargetRef.current = 'none'; flushSync(() => {}); document.getElementById('_docModalForm')?.requestSubmit()
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-full text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 transition-colors shadow-md3-2">
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>inventory</span>
                  {uploading ? 'Đang lưu…' : 'Lưu tài liệu'}
                </button>
                {isVanThu && (
                <button type="button" disabled={uploading}
                  onClick={async () => {
                    if (!await confirm('Có chắc gửi Trình duyệt tới Giám đốc?')) return
                    notifyTargetRef.current = 'directors'; document.getElementById('_docModalForm')?.requestSubmit()
                  }}
                  className="flex items-center gap-2 px-6 py-2.5 bg-primary text-on-primary rounded-full text-sm font-medium hover:bg-primary-700 disabled:opacity-60 transition-colors shadow-md3-2">
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>send</span>
                  {uploading ? 'Đang lưu…' : 'Trình duyệt'}
                </button>
                )}
              </>
            ) : (
              <button type="submit" disabled={uploading}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-on-primary rounded-full text-sm font-medium hover:bg-primary-700 disabled:opacity-60 transition-colors shadow-md3-2">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  {uploading ? 'sync' : 'save'}
                </span>
                {uploading ? 'Đang lưu…' : isEdit ? 'Cập nhật' : 'Lưu tài liệu'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-on-surface-variant mb-1.5 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  )
}

const iCls = 'w-full bg-surface-container-low border-none rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 text-on-surface'

function toBase64(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader()
    reader.onload = e => {
      // Remove data:... prefix, keep only Base64
      const b64 = e.target.result.split(',')[1]
      res(b64)
    }
    reader.onerror = rej
    reader.readAsDataURL(file)
  })
}

function _parseFileInfosClient(fileIdCol) {
  if (!fileIdCol) return []
  if (typeof fileIdCol === 'string' && fileIdCol.charAt(0) === '[') {
    try { return JSON.parse(fileIdCol) } catch (e) { /* fall through */ }
  }
  if (typeof fileIdCol === 'string' && fileIdCol) {
    return [{ fileId: fileIdCol, fileName: fileIdCol, mimeType: '', size: 0 }]
  }
  return []
}
