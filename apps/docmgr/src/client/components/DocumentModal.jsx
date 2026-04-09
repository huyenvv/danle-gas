import { useState, useRef } from 'react'
import gasCall from '../gasClient.js'
import { dataCache } from '../utils/dataCache.js'
import { formatCurrency } from '../utils/format.js'
import { useToast } from '../context/ToastContext.jsx'
import LoadingOverlay from './common/LoadingOverlay.jsx'

const STATUS_OPTIONS = ['Hiệu lực', 'Hết hạn', 'Sắp hết hạn', 'Chờ duyệt', 'Đã thanh lý']
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

const DEPT_RESTRICTED_ROLES = ['Trưởng phòng', 'Nhân viên']

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
  const isDeptRestricted = session && DEPT_RESTRICTED_ROLES.includes(session.role)
  const defaultPhongBan = isDeptRestricted ? (session.departments?.[0] || '') : ''

  const initialAssignees = isEdit && doc?.['Phụ trách']
    ? (() => { try { const v = doc['Phụ trách']; return (typeof v === 'string' && v.charAt(0) === '[') ? JSON.parse(v) : [v] } catch(_) { return [String(doc['Phụ trách'])] } })()
    : (session ? [session.username] : [])

  const [form, setForm] = useState(isEdit ? { ...doc, 'Phòng ban': doc['Phòng ban'] || defaultPhongBan } : {
    'Tên hồ sơ': '',
    'Danh mục': '',
    'Phòng ban': defaultPhongBan,
    'Số hồ sơ': '',
    'Dự án': '',
    'Nhà cung cấp': '',
    'Ngày ban hành': '',
    'Ngày kết thúc': '',
    'Giá trị HĐ': '',
    'Giá trị thực hiện': '',
    'Tình trạng': 'Hiệu lực',
    'Mô tả': '',
  })
  const [assignees, setAssignees] = useState(initialAssignees)
  const [assigneeSearch, setAssigneeSearch] = useState('')
  const [currencyTyping, setCurrencyTyping] = useState(null) // 'hd' | 'th'

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
  const { showToast } = useToast()

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

  function removeExistingFile(fileId) {
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
        if (newItem) setField('Dự án', newItem['Tên dự án viết tắt'])
      } else if (quickAdd === 'nhaCungCap') {
        if (!quickForm['Tên NCC viết tắt']) return
        await gasCall('api_addNhaCungCap', token, quickForm)
        dataCache.invalidate('lookups')
        const fresh = await gasCall('api_getAllData', token)
        dataCache.set('lookups', fresh)
        setLookups(fresh)
        const newItem = fresh.nhaCungCap[fresh.nhaCungCap.length - 1]
        if (newItem) setField('Nhà cung cấp', newItem['Tên NCC viết tắt'])
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

      const submitForm = { ...form, 'Phụ trách': assignees.length ? JSON.stringify(assignees) : JSON.stringify([session?.username || '']) }
      if (isEdit) {
        await gasCall('api_updateDocument', token, doc.ID, submitForm, fileInfos, keepFileIds)
      } else {
        await gasCall('api_createDocument', token, submitForm, fileInfos)
      }
      showToast(isEdit ? 'Đã cập nhật hồ sơ' : 'Đã thêm hồ sơ', 'success')
      onSaved()
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 grid md:grid-cols-2 gap-x-8 gap-y-5">

            {/* ── LEFT COLUMN ── */}
            <div className="space-y-5">
              {/* Tên hồ sơ */}
              <Field label="Tên hồ sơ *">
                <input className={iCls} value={form['Tên hồ sơ']} onChange={e => setField('Tên hồ sơ', e.target.value)} placeholder="Nhập tên hồ sơ..." />
              </Field>

              {/* Danh mục + Phòng ban */}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Danh mục *">
                  <select className={iCls} value={form['Danh mục']} onChange={e => setField('Danh mục', e.target.value)}>
                    <option value="">-- Chọn --</option>
                    {buildCategoryOptions(lookups.danhMuc || []).map(o => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Phòng ban">
                  {isDeptRestricted ? (
                    <div className={iCls + ' text-on-surface-variant bg-surface-container'}>{form['Phòng ban'] || '—'}</div>
                  ) : (
                    <select className={iCls} value={form['Phòng ban']} onChange={e => setField('Phòng ban', e.target.value)}>
                      <option value="">-- Chọn --</option>
                      {(lookups.phongBan || []).map(p => <option key={p.ID} value={p['Tên phòng ban']}>{p['Tên phòng ban']}</option>)}
                    </select>
                  )}
                </Field>
              </div>

              {/* Phụ trách */}
              <Field label="Phụ trách">
                <div className="space-y-1.5">
                  {assignees.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {assignees.map(a => (
                        <span key={a} className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2.5 py-1 rounded-full">
                          <span className="w-4 h-4 rounded-full bg-primary text-on-primary flex items-center justify-center text-[9px] font-bold shrink-0">{String(a).charAt(0).toUpperCase()}</span>
                          {a}
                          <button type="button" onClick={() => setAssignees(prev => prev.filter(x => x !== a))}
                            className="ml-0.5 hover:text-error transition-colors">
                            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>close</span>
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="relative">
                    <input className={iCls} placeholder="Thêm người phụ trách..."
                      value={assigneeSearch}
                      onChange={e => setAssigneeSearch(e.target.value)} />
                    {assigneeSearch && (() => {
                      const users = lookups.users || []
                      const filtered = users.filter(u =>
                        u['Tên đăng nhập'].toLowerCase().includes(assigneeSearch.toLowerCase()) &&
                        !assignees.includes(u['Tên đăng nhập'])
                      )
                      if (!filtered.length) return null
                      return (
                        <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-white border border-outline-variant rounded-xl shadow-md3-3 max-h-40 overflow-y-auto">
                          {filtered.map(u => (
                            <button key={u.ID} type="button"
                              className="w-full text-left px-3 py-2 text-sm hover:bg-primary/5 flex items-center gap-2"
                              onClick={() => { setAssignees(prev => [...prev, u['Tên đăng nhập']]); setAssigneeSearch('') }}>
                              <span className="w-6 h-6 rounded-full bg-primary text-on-primary flex items-center justify-center text-[10px] font-bold shrink-0">{u['Tên đăng nhập'].charAt(0).toUpperCase()}</span>
                              <span>{u['Tên đăng nhập']}</span>
                              {u['Phòng ban'] && <span className="text-xs text-on-surface-variant ml-auto">{u['Phòng ban']}</span>}
                            </button>
                          ))}
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </Field>

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
                        <button type="button" onClick={() => removeExistingFile(ef.fileId)}
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
              {/* Dự án */}
              <Field label="Dự án">
                <div className="flex gap-2">
                  <select className={iCls + ' flex-1'} value={form['Dự án']} onChange={e => setField('Dự án', e.target.value)}>
                    <option value="">-- Chọn dự án --</option>
                    {(lookups.duAn || []).map(p => <option key={p.ID} value={p['Tên dự án viết tắt']}>
                      {p['Tên dự án đầy đủ'] ? `${p['Tên dự án đầy đủ']} (${p['Tên dự án viết tắt']})` : p['Tên dự án viết tắt']}
                    </option>)}
                  </select>
                  <button type="button"
                    onClick={() => { setQuickAdd('duAn'); setQuickForm({ 'Tên dự án viết tắt': '', 'Tên dự án đầy đủ': '' }) }}
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-secondary/10 text-secondary hover:bg-secondary/20 transition-colors shrink-0"
                    title="Thêm dự án mới">
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>add_circle</span>
                  </button>
                </div>
              </Field>

              {/* Nhà cung cấp */}
              <Field label="Nhà cung cấp">
                <div className="flex gap-2">
                  <select className={iCls + ' flex-1'} value={form['Nhà cung cấp']} onChange={e => setField('Nhà cung cấp', e.target.value)}>
                    <option value="">-- Chọn NCC --</option>
                    {(lookups.nhaCungCap || []).map(p => <option key={p.ID} value={p['Tên NCC viết tắt']}>
                      {p['Tên NCC đầy đủ'] ? `${p['Tên NCC đầy đủ']} (${p['Tên NCC viết tắt']})` : p['Tên NCC viết tắt']}
                    </option>)}
                  </select>
                  <button type="button"
                    onClick={() => { setQuickAdd('nhaCungCap'); setQuickForm({ 'Tên NCC viết tắt': '', 'Tên NCC đầy đủ': '' }) }}
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-secondary/10 text-secondary hover:bg-secondary/20 transition-colors shrink-0"
                    title="Thêm NCC mới">
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>add_circle</span>
                  </button>
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

              {/* Financial card */}
              <div className="bg-surface-container-low rounded-2xl p-4 space-y-3">
                <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">Tài chính</p>
                <div className="grid grid-cols-2 gap-3">
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
                  <Field label="Giá trị thực hiện (VNĐ)">
                    <input type="text" inputMode="numeric" className={iCls}
                      value={form['Giá trị thực hiện'] ? Number(String(form['Giá trị thực hiện']).replace(/\./g, '')).toLocaleString('vi-VN') : ''}
                      onChange={e => { setField('Giá trị thực hiện', e.target.value.replace(/[^\d]/g, '')); setCurrencyTyping('th') }}
                      onBlur={() => setTimeout(() => setCurrencyTyping(null), 200)}
                      placeholder="0" />
                    {currencyTyping === 'th' && parseSuggestions(form['Giá trị thực hiện']).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {parseSuggestions(form['Giá trị thực hiện']).map(({ value, label }) => (
                          <button key={value} type="button" onMouseDown={e => { e.preventDefault(); setField('Giá trị thực hiện', String(value)); setCurrencyTyping(null) }}
                            className="px-2 py-0.5 bg-secondary/10 text-secondary text-xs rounded-full hover:bg-secondary/20 transition-colors">
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </Field>
                </div>
                {(form['Giá trị HĐ'] || form['Giá trị thực hiện']) && (
                  <div className="flex items-center justify-between pt-1 border-t border-outline-variant">
                    <span className="text-xs text-on-surface-variant">Chênh lệch</span>
                    <span className={`text-sm font-semibold ${
                      (Number(form['Giá trị HĐ']) || 0) - (Number(form['Giá trị thực hiện']) || 0) >= 0 ? 'text-emerald-700' : 'text-error'
                    }`}>
                      {formatCurrency((Number(form['Giá trị HĐ']) || 0) - (Number(form['Giá trị thực hiện']) || 0))}
                    </span>
                  </div>
                )}
              </div>

              {/* Tình trạng + Số hồ sơ */}
              <div className="grid grid-cols-2 gap-4">
                <Field label="Tình trạng">
                  <select className={iCls} value={form['Tình trạng']} onChange={e => setField('Tình trạng', e.target.value)}>
                    {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Số hồ sơ">
                  <input className={iCls} value={form['Số hồ sơ']}
                    onChange={e => setField('Số hồ sơ', e.target.value)}
                    onBlur={e => checkDuplicate(e.target.value)} />
                  {dupWarning && <p className="text-amber-600 text-xs mt-1">{dupWarning}</p>}
                </Field>
              </div>

              {/* Mô tả */}
              <Field label="Mô tả">
                <textarea className={iCls + ' resize-none h-20'} value={form['Mô tả']} onChange={e => setField('Mô tả', e.target.value)} placeholder="Ghi chú thêm..." />
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
            <button type="submit" disabled={uploading}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-on-primary rounded-full text-sm font-medium hover:bg-primary-700 disabled:opacity-60 transition-colors shadow-md3-2">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                {uploading ? 'sync' : 'save'}
              </span>
              {uploading ? 'Đang lưu…' : isEdit ? 'Cập nhật' : 'Lưu tài liệu'}
            </button>
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
