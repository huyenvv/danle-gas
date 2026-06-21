import { useState, useRef, useCallback, useEffect } from 'react'
import { flushSync } from 'react-dom'
import gasCall from '../gasClient.js'
import { dataCache } from '../utils/dataCache.js'
import { retryWithVerify } from '../utils/gasRetry.js'
import { formatCurrency } from '../utils/format.js'
import { useToast } from '../context/ToastContext.jsx'
import { useConfirm } from '../context/ConfirmContext.jsx'
import LoadingOverlay from './common/LoadingOverlay.jsx'
import UserPickerDropdown from './common/UserPickerDropdown.jsx'
import OptionPickerDropdown from './common/OptionPickerDropdown.jsx'
import ViewerPickerModal from './common/ViewerPickerModal.jsx'
import CategoryPickerDropdown from './common/CategoryPickerDropdown.jsx'
import PublishDialog from './documents/PublishDialog.jsx'
import DriveFilePicker from './settings/DriveFilePicker.jsx'

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
const WARN_FILE_MB = 50
const CHUNK_SIZE = 5 * 1024 * 1024          // 5MB per chunk (Drive resumable upload)
const CHUNKED_THRESHOLD = 25 * 1024 * 1024   // files > 25MB upload directly to Drive in chunks
const PERCENT_THRESHOLD = 50 * 1024 * 1024   // files > 50MB show % progress instead of chunk count

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

export default function DocumentModal({ mode, doc, lookups: initialLookups, token, session, onClose, onSaved, onDeleted, docs }) {
  const isEdit = mode === 'edit'
  const isDraftEdit = isEdit && doc?.['Tình trạng'] === 'Nháp'

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
    'Dự án (Phòng ban)': String(doc['Dự án (Phòng ban)'] || '').trim(),
    'Nhà cung cấp (Nơi ban hành)': String(doc['Nhà cung cấp (Nơi ban hành)'] || '').trim(),
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
    'Khẩn': '',
  })
  const [phuTrach, setPhuTrach] = useState(initialPhuTrach)
  const [collaborators, setCollaborators] = useState(initialCollaborators)
  const [currencyTyping, setCurrencyTyping] = useState(null)

  // Phân quyền xem (008) — chỉ theo NGƯỜI. Options = SSO active trừ vai trò mặc định đã xem.
  const initialLookups2 = initialLookups || {}
  const _defaultViewerIds = new Set()
  ;(initialLookups2.assignments || []).forEach(a => {
    if (['admin', 'Quản trị viên', 'Giám đốc', 'Văn thư'].includes(a['Chức vụ'])) _defaultViewerIds.add(String(a['UserID']))
  })
  const eligibleViewerUsers = (initialLookups2.ssoUsers || initialLookups2.users || [])
    .filter(u => !_defaultViewerIds.has(String(u.ID)) && u['Quyền'] !== 'Quản trị')
  const eligibleIdSet = new Set(eligibleViewerUsers.map(u => String(u.ID)))

  // Người xem được của một danh mục = (trực tiếp + thành viên Nhóm được xem) của danh mục
  // VÀ kế thừa ngược lên các danh mục CHA (đi theo chuỗi 'Danh mục cha').
  function categoryViewerIds(catId) {
    const cats = initialLookups2.danhMuc || []
    const ids = new Set()
    const seen = new Set()
    let cur = String(catId || '')
    while (cur && !seen.has(cur)) {
      seen.add(cur)
      const cat = cats.find(c => String(c.ID) === cur)
      if (!cat) break
      parseAssignees(cat['Người được xem']).forEach(id => ids.add(String(id)))
      parseAssignees(cat['Nhóm được xem']).forEach(gid => {
        const g = (initialLookups2.nhom || []).find(x => String(x.ID) === String(gid))
        if (g) parseAssignees(g['Thành viên']).forEach(id => ids.add(String(id)))
      })
      cur = String(cat['Danh mục cha'] || '')
    }
    return [...ids].filter(id => eligibleIdSet.has(id))
  }

  const [viewers, setViewers] = useState(isEdit ? parseAssignees(doc?.['Người được xem']) : [])
  const [showViewerModal, setShowViewerModal] = useState(false) // popup "Phân quyền xem" (008)
  // Đổi danh mục (CẢ tạo & sửa) → tự đặt lại "Người được xem" theo danh mục + cảnh báo.
  // Ref bỏ qua lần mount để KHÔNG ghi đè danh sách đã có khi mở form (chỉ khi đổi thật).
  const catSnapRef = useRef(form['Danh mục'])
  useEffect(() => {
    const prev = catSnapRef.current
    if (prev === form['Danh mục']) return
    catSnapRef.current = form['Danh mục']
    setViewers(categoryViewerIds(form['Danh mục']))
    // Cảnh báo chỉ khi GHI ĐÈ một lựa chọn trước (đổi từ danh mục đã có sang danh mục khác);
    // lần đầu chọn danh mục (tạo mới) thì auto-tích lặng lẽ.
    if (prev && form['Danh mục']) showToast('Đã đặt lại "Người được xem" theo danh mục mới', 'info')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form['Danh mục']])

  // Snapshot field ban đầu để phát hiện MỌI thay đổi khi đóng X (so cùng định dạng).
  const initialFormRef = useRef({ ...form })
  const initialViewersRef = useRef([...viewers])
  const _draftRebasedRef = useRef(false)

  // Dự án (Nơi nhận): multi-select. Stored in form as JSON array string; legacy single value parses too.
  const selectedDuAn = parseAssignees(form['Dự án (Phòng ban)'])
  const setDuAn = (next) => setField('Dự án (Phòng ban)', next.length ? JSON.stringify(next) : '')

  // Eager upload state: [{id, fileName, mimeType, size, status:'uploading'|'done'|'error', fileId?, error?}]
  const [eagerUploads, setEagerUploads] = useState([])
  const eagerIdCounter = useRef(0)
  const [draftId, setDraftId] = useState(isDraftEdit ? doc.ID : null)
  const [draftDoc, setDraftDoc] = useState(isDraftEdit ? doc : null)
  useEffect(() => {
    // Khi eager-draft vừa tạo (create): Danh mục (bắt buộc để upload) + Người được xem
    // (tự đặt theo danh mục) coi như đã lưu vào draft → rebase baseline, tránh báo nhầm
    // cho luồng chỉ-upload-tệp.
    if (draftId && !isDraftEdit && !_draftRebasedRef.current) {
      _draftRebasedRef.current = true
      initialFormRef.current = { ...initialFormRef.current, 'Danh mục': form['Danh mục'] }
      initialViewersRef.current = [...viewers]
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId])
  const [existingFiles, setExistingFiles] = useState(
    isEdit ? _parseFileInfosClient(doc['Tệp đính kèm']) : []
  )
  // Gỡ file (sẵn có hoặc vừa upload) chỉ đổi state local, persist khi save → thay đổi chưa lưu.
  const fileRemovedRef = useRef(false)
  const [isDragging, setIsDragging] = useState(false)
  const [showDrivePicker, setShowDrivePicker] = useState(false)
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
  const publishDataRef = useRef(null)
  const [showPublishDialog, setShowPublishDialog] = useState(false)
  const { showToast } = useToast()
  const confirm = useConfirm()

  function _makeVerify(expectedStatus) {
    return async () => {
      try {
        const result = await gasCall('api_getDocuments', token, {})
        const freshDoc = (result.data || []).find(d => String(d.ID) === String(doc?.ID))
        if (freshDoc && (!expectedStatus || freshDoc['Tình trạng'] === expectedStatus)) {
          return freshDoc
        }
      } catch (_) {}
      return null
    }
  }

  // Upload "Lỗi không xác định" thường là response bị mất dù server ĐÃ upload xong +
  // gắn file vào nháp. Xác minh bằng cách đọc lại nháp & tìm file theo tên (không
  // upload lại để tránh trùng). Trả { draftId, fileId, data } nếu tìm thấy.
  async function _verifyEagerUpload(entry, currentDraftId) {
    // Sửa hồ sơ không-nháp: upload chỉ đẩy lên Drive, không tạo row → không xác minh được.
    if (isEdit && !isDraftEdit && !currentDraftId) return null
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, 1500))
      try {
        const docs = (await gasCall('api_getDocuments', token, {})).data || []
        const candidates = currentDraftId
          ? docs.filter(d => String(d.ID) === String(currentDraftId))
          : docs
              .filter(d => d['Tình trạng'] === 'Nháp' && d['Người tạo'] === session?.username)
              .sort((a, b) => String(b['Ngày cập nhật'] || '').localeCompare(String(a['Ngày cập nhật'] || '')))
        for (const d of candidates) {
          const match = _parseFileInfosClient(d['Tệp đính kèm']).find(f => f.fileName === entry.fileName)
          if (match) return { draftId: d['Tình trạng'] === 'Nháp' ? d.ID : null, fileId: match.fileId, data: d }
        }
      } catch (_) {}
    }
    return null
  }

  // Role-based UI
  const role = session?.role || ''
  const isAdminRole = role === 'admin' || role === 'Quản trị viên' || role === 'Giám đốc'
  const isVanThu = role === 'Văn thư'
  const isVanThuOwnDoc = isVanThu && isEdit && doc?.['Người tạo'] === session?.username
  const isTuChoiDoc = isEdit && doc?.['Tình trạng'] === 'Từ chối'
  const isTuChoiKetQuaDoc = isEdit && doc?.['Tình trạng'] === 'Từ chối kết quả'
  const isNvTpCreate = !isEdit && !isAdminRole && !isVanThu && session?.canCreate
  const canEditStatus = isAdminRole || isVanThu
  const statusOptions = isVanThu ? ['Chờ duyệt', 'Hoàn thành'] : STATUS_OPTIONS
  const canEditPhuTrach = isAdminRole
  const isPhuTrachOfDoc = isEdit && (() => { const list = parseAssignees(doc?.['Phụ trách']); return list.includes(String(session?.userId)) || list.includes(session?.username) })()
  const canEditPhoiHop = isAdminRole || isPhuTrachOfDoc
  const canEditFields = isAdminRole || isVanThu
  const canPublish = isAdminRole || isVanThu || session?.canPublish
  const canPickDrive = isAdminRole || isVanThu || session?.canPickDrive
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

  const hasUploading = eagerUploads.some(u => u.status === 'uploading')

  // Tạo mới / sửa nháp: phải đủ Tên hồ sơ + Danh mục + ít nhất 1 tệp đính kèm
  // mới được rời trạng thái Nháp (Lưu tài liệu / Trình duyệt / Phát hành).
  // Thiếu thông tin → chỉ được lưu nháp.
  const hasAttachment = existingFiles.length > 0 ||
    eagerUploads.some(u => u.status === 'done' && u.fileId)
  const requireFullForFinalize = !isEdit || isDraftEdit
  const MISSING_ATTACHMENT_MSG = 'Cần đính kèm ít nhất một tệp để hoàn tất hồ sơ.'

  async function handleFileChange(e) {
    const newFiles = Array.from(e.target.files || e.dataTransfer?.files || [])
    if (e.target?.value) e.target.value = ''
    if (!newFiles.length) return

    if (!form['Danh mục']) {
      setError('Vui lòng chọn Danh mục trước')
      return
    }

    // Dedup: skip files with same name already in eagerUploads or existingFiles
    const existingNames = new Set([
      ...eagerUploads.map(u => u.fileName),
      ...existingFiles.map(f => f.fileName),
    ])
    const unique = newFiles.filter(f => !existingNames.has(f.name))
    if (!unique.length) return

    const bigFile = unique.find(f => f.size > WARN_FILE_MB * 1024 * 1024)
    if (bigFile) {
      showToast(`File "${bigFile.name}" khá lớn — đang tải lên theo từng phần, vui lòng đợi`, 'info')
    }

    // Create placeholder entries
    const entries = unique.map(f => ({
      id: ++eagerIdCounter.current,
      fileName: f.name,
      mimeType: f.type,
      size: f.size,
      status: 'uploading',
      fileId: null,
      file: f,
    }))
    setEagerUploads(prev => [...prev, ...entries])

    // Sequential upload
    setError('')
    let currentDraftId = draftId
    for (const entry of entries) {
      try {
        const isFirstUpload = !currentDraftId && !(isEdit && !isDraftEdit)
        if (isFirstUpload) showToast('Đang tạo hồ sơ nháp + upload file...', 'info')

        const draftArg = (isEdit && !isDraftEdit) ? 'edit' : (currentDraftId || null)
        let result
        if (entry.size > CHUNKED_THRESHOLD) {
          result = await uploadChunked(entry, form['Danh mục'], draftArg)
        } else {
          const base64 = await toBase64(entry.file)
          result = await gasCall('api_uploadFileEager', token, base64, entry.mimeType, entry.fileName, form['Danh mục'], draftArg)
        }
        if (result.draftId) {
          currentDraftId = result.draftId
          setDraftId(result.draftId)
          showToast('Đã tạo hồ sơ nháp', 'success')
        }
        if (result.data) setDraftDoc(result.data)
        setEagerUploads(prev => prev.map(u =>
          u.id === entry.id ? { ...u, status: 'done', fileId: result.fileInfo.fileId } : u
        ))
      } catch (err) {
        // Response bị mất dù server có thể đã upload xong → xác minh & phục hồi.
        if (err.message === 'Lỗi không xác định') {
          const recovered = await _verifyEagerUpload(entry, currentDraftId)
          if (recovered) {
            if (recovered.draftId && !currentDraftId) { currentDraftId = recovered.draftId; setDraftId(recovered.draftId) }
            if (recovered.data) setDraftDoc(recovered.data)
            setEagerUploads(prev => prev.map(u =>
              u.id === entry.id ? { ...u, status: 'done', fileId: recovered.fileId } : u
            ))
            showToast(`Đã tải "${entry.fileName}"`, 'success')
            continue
          }
        }
        const msg = `Lỗi tải "${entry.fileName}": ${err.message}`
        showToast(msg, 'error')
        setError(msg)   // persist on the form — toast tự tắt quá nhanh
        // Upload failed → drop the placeholder so it doesn't look attached
        setEagerUploads(prev => prev.filter(u => u.id !== entry.id))
      }
    }
  }

  // Link files chosen from the deploy owner's Drive (no copy). The server derives
  // the category from each file's folder and validates it; if the form has no
  // category yet, it's auto-filled from the result. Whole-batch (server throws on
  // any invalid file), so entries are all attached or all rolled back.
  async function handleDriveFiles(picked) {
    setShowDrivePicker(false)
    if (!picked || !picked.length) return

    const existingNames = new Set([
      ...eagerUploads.map(u => u.fileName),
      ...existingFiles.map(f => f.fileName),
    ])
    const unique = picked.filter(f => !existingNames.has(f.name))
    if (!unique.length) return

    const entries = unique.map(f => ({
      id: ++eagerIdCounter.current,
      driveId: f.id,
      fileName: f.name,
      mimeType: f.mimeType,
      size: f.size,
      status: 'uploading',
      fileId: null,
      linked: true,
    }))
    setEagerUploads(prev => [...prev, ...entries])
    setError('')

    try {
      const draftArg = (isEdit && !isDraftEdit) ? 'edit' : (draftId || null)
      const isFirst = !draftId && !(isEdit && !isDraftEdit)
      if (isFirst) showToast('Đang tạo hồ sơ nháp + liên kết file từ Drive...', 'info')

      // docId: khi sửa hồ sơ không-nháp, truyền ID để re-link file của chính nó không bị coi là xung đột
      const linkDocId = (isEdit && !isDraftEdit) ? doc.ID : null
      const res = await gasCall('api_linkDriveFiles', token, unique.map(f => f.id), form['Danh mục'] || null, draftArg, linkDocId)
      if (res.categoryId && !form['Danh mục']) setField('Danh mục', String(res.categoryId))   // auto-fill derived category
      if (res.draftId) {
        setDraftId(res.draftId)
        showToast('Đã tạo hồ sơ nháp', 'success')
      }
      if (res.data) setDraftDoc(res.data)

      const byDrive = {}
      ;(res.results || []).forEach(r => { byDrive[r.fileId] = r })
      setEagerUploads(prev => prev.flatMap(u => {
        if (!entries.find(e => e.id === u.id)) return [u]
        const r = byDrive[u.driveId]
        if (r && r.ok) return [{ ...u, status: 'done', fileId: r.fileInfo.fileId, linked: true }]
        return []
      }))
    } catch (err) {
      showToast(err.message || 'Lỗi liên kết file từ Drive', 'error')
      setError(err.message)
      setEagerUploads(prev => prev.filter(u => !entries.find(e => e.id === u.id)))
    }
  }

  // Chunked upload for large files (> CHUNKED_THRESHOLD): the server opens a
  // Drive resumable session, then the browser PUTs each chunk directly to Drive.
  async function uploadChunked(entry, categoryId, draftArg) {
    const { uploadUri, accessToken } = await gasCall(
      'api_startResumableUpload', token,
      entry.mimeType || 'application/octet-stream', entry.fileName, entry.size, categoryId
    )

    const totalChunks = Math.max(1, Math.ceil(entry.size / CHUNK_SIZE))
    setEagerUploads(prev => prev.map(u => u.id === entry.id ? { ...u, totalChunks, progress: 0 } : u))

    // Dev mock returns a non-http uploadUri — simulate progress instead of real PUTs
    const isMock = !/^https?:/i.test(uploadUri)

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE
      const end = Math.min(start + CHUNK_SIZE, entry.size)
      const isLast = i === totalChunks - 1

      if (isMock) {
        await new Promise(r => setTimeout(r, 150))
      } else {
        let attempt = 0
        while (true) {
          let res
          try {
            res = await fetch(uploadUri, {
              method: 'PUT',
              headers: {
                Authorization: 'Bearer ' + accessToken,
                'Content-Range': `bytes ${start}-${end - 1}/${entry.size}`,
              },
              body: entry.file.slice(start, end),
            })
          } catch (netErr) {
            // The final chunk's response is often blocked cross-origin even though
            // Drive received the bytes — tolerate it; the server confirms completion.
            if (attempt++ >= 2) {
              if (isLast) break
              throw new Error(`Lỗi mạng khi tải phần ${i + 1}/${totalChunks}`)
            }
            await new Promise(r => setTimeout(r, 800 * attempt))
            continue
          }
          // 308 = more chunks; 200/201 = complete. Don't read the body (cross-origin).
          if (res.status === 308 || res.status === 200 || res.status === 201) break
          if (attempt++ >= 2) throw new Error(`Tải phần ${i + 1}/${totalChunks} thất bại (HTTP ${res.status})`)
          await new Promise(r => setTimeout(r, 800 * attempt))
        }
      }
      setEagerUploads(prev => prev.map(u => u.id === entry.id ? { ...u, progress: i + 1 } : u))
    }

    // Server queries the resumable session for the file id + confirms completion
    return await gasCall(
      'api_finalizeChunkedUpload', token,
      uploadUri, entry.fileName, entry.mimeType, entry.size, categoryId, draftArg
    )
  }

  async function removeEagerUpload(uploadId) {
    const upload = eagerUploads.find(u => u.id === uploadId)
    if (!upload) return
    // File đã upload xong (đang nằm trong nháp trên server): xác nhận + đánh dấu thay đổi.
    // Trash Drive + cập nhật cột để dành lúc lưu (finalizeDraft keepFileIds), giống file sẵn có.
    if (upload.status === 'done' && upload.fileId) {
      if (!await confirm(`Xoá file "${upload.fileName || upload.fileId}" khỏi hồ sơ này?`)) return
      fileRemovedRef.current = true
    }
    setEagerUploads(prev => prev.filter(u => u.id !== uploadId))
  }

  async function removeExistingFile(fileId, fileName) {
    if (!await confirm(`Xoá file "${fileName || fileId}" khỏi hồ sơ này?`)) return
    fileRemovedRef.current = true
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
        // Auto-select newly added (append to current multi-selection)
        const newItem = fresh.duAn[fresh.duAn.length - 1]
        if (newItem) {
          const next = [...selectedDuAn, newItem['Tên dự án viết tắt']]
          setField('Dự án (Phòng ban)', JSON.stringify(next))
        }
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

  function handlePublishFromDialog(toIds, ccIds) {
    setShowPublishDialog(false)
    publishDataRef.current = { to: toIds, cc: ccIds }
    statusOverrideRef.current = 'Hoàn thành'
    notifyTargetRef.current = 'publish'
    document.getElementById('_docModalForm')?.requestSubmit()
  }

  // Có thay đổi field CHƯA lưu không? So MỌI field (+ phụ trách/phối hợp/người xem)
  // với snapshot ban đầu. Thao tác tệp (upload/xoá) đã tự lưu server nên KHÔNG tính.
  // Chỉ áp cho tạo mới / sửa nháp (non-draft edit lưu qua "Cập nhật", không lưu nháp).
  function _hasUnsavedFieldChanges() {
    if (!requireFullForFinalize) return false
    const init = initialFormRef.current
    const keys = new Set([...Object.keys(init), ...Object.keys(form)])
    for (const k of keys) {
      if (String(form[k] == null ? '' : form[k]) !== String(init[k] == null ? '' : init[k])) return true
    }
    if (phuTrach !== initialPhuTrach) return true
    if (JSON.stringify(collaborators) !== JSON.stringify(initialCollaborators)) return true
    if (JSON.stringify(viewers) !== JSON.stringify(initialViewersRef.current)) return true
    // Gỡ file (sẵn có hoặc vừa upload) — chưa persist tới khi lưu → là thay đổi
    if (fileRemovedRef.current) return true
    return false
  }

  // Lưu hồ sơ hiện tại ở trạng thái Nháp. Đã có draft (đã upload tệp) → finalizeDraft;
  // chưa có draft → createDraft từ form (cần ít nhất Tên hồ sơ hoặc Danh mục).
  async function handleSaveDraft() {
    if (!draftId && !form['Tên hồ sơ'] && !form['Danh mục']) {
      setError('Cần ít nhất Tên hồ sơ hoặc Danh mục để lưu nháp')
      return
    }
    setUploading(true)
    try {
      const saveForm = {
        ...form,
        'Tình trạng': 'Nháp',
        'Phụ trách': phuTrach || '',
        'Người phối hợp': collaborators.length ? collaborators : [],
        'Người được xem': viewers.length ? JSON.stringify(viewers) : '',
      }
      const keepFileIds = existingFiles.map(f => f.fileId).concat(
        eagerUploads.filter(u => u.status === 'done' && u.fileId).map(u => u.fileId)
      )
      const result = draftId
        ? await gasCall('api_finalizeDraft', token, draftId, saveForm, null, keepFileIds)
        : await gasCall('api_createDraft', token, saveForm)
      showToast('Đã lưu nháp', 'success')
      onSaved(result.data)
    } catch (err) {
      setError('Lỗi lưu nháp: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  async function handleCloseX() {
    if (_hasUnsavedFieldChanges() && await confirm('Lưu thông tin vừa thay đổi vào hồ sơ nháp?')) {
      await handleSaveDraft()
      return
    }

    // Không có field nào chưa lưu (hoặc chọn "Huỷ"): đóng. Nếu đã có draft do
    // upload thì surface ra danh sách thay vì để mồ côi.
    if (draftDoc) onSaved(draftDoc)
    else onClose()
  }

  async function handleCancel() {
    const doneFiles = eagerUploads.filter(u => u.status === 'done' && u.fileId)
    const hasDraft = draftId
    const hasEagerFiles = isEdit && !isDraftEdit && doneFiles.length > 0

    if (!hasDraft && !hasEagerFiles) { onClose(); return }

    const allFileNames = [
      ...existingFiles.map(f => f.fileName),
      ...doneFiles.map(u => u.fileName),
    ].filter(Boolean)
    const fileList = allFileNames.length > 0 ? ` (${allFileNames.join(', ')})` : ''
    const msg = hasDraft
      ? `Bạn có chắc chắn muốn Huỷ?\nHồ sơ nháp và file đã upload${fileList} sẽ bị xoá.`
      : `Bạn có chắc chắn muốn Huỷ?\nFile mới upload${fileList} sẽ bị xoá.`
    if (!await confirm(msg)) return

    setUploading(true)
    try {
      if (hasDraft) {
        await gasCall('api_cancelDraft', token, draftId)
        if (onDeleted) onDeleted(draftId)   // remove the draft from the list immediately
      } else if (hasEagerFiles) {
        // Don't trash linked Drive files — only machine uploads
        const toTrash = doneFiles.filter(u => !u.linked).map(u => u.fileId)
        if (toTrash.length) await gasCall('api_deleteFiles', token, toTrash)
      }
      showToast('Đã xoá hồ sơ nháp và file đính kèm', 'success')
    } catch (err) {
      showToast('Lỗi khi xoá: ' + err.message, 'error')
    } finally {
      setUploading(false)
    }
    onClose()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form['Tên hồ sơ']) { setError('Tên hồ sơ là bắt buộc'); return }
    if (!form['Danh mục']) { setError('Danh mục là bắt buộc'); return }
    if (requireFullForFinalize && !hasAttachment) { setError(MISSING_ATTACHMENT_MSG); return }
    if (dupWarning) { setError('Vui lòng sửa số hồ sơ trùng'); return }
    setError('')
    setUploading(true)

    const eagerFileInfos = eagerUploads
      .filter(u => u.status === 'done' && u.fileId)
      .map(u => ({ fileId: u.fileId, fileName: u.fileName, mimeType: u.mimeType, size: u.size }))

    let submitForm, notifyTarget
    try {
      submitForm = {
        ...form,
        'Tình trạng': statusOverrideRef.current !== null ? statusOverrideRef.current : (isDraftEdit ? 'Chờ duyệt' : form['Tình trạng']),
        'Phụ trách': phuTrach || '',
        'Người phối hợp': collaborators.length ? collaborators : [],
        'Người được xem': viewers.length ? JSON.stringify(viewers) : '',
      }
      if (publishDataRef.current) {
        submitForm._publishTo = publishDataRef.current.to
        submitForm._publishCc = publishDataRef.current.cc
        publishDataRef.current = null
      }
      notifyTarget = notifyTargetRef.current
      statusOverrideRef.current = null
      notifyTargetRef.current = null

      if (isEdit && !isDraftEdit) {
        const keepFileIds = existingFiles.map(f => f.fileId)
        const updated = await gasCall('api_updateDocument', token, doc.ID, submitForm, [], keepFileIds, notifyTarget, eagerFileInfos)
        showToast(updated?.emailError ? 'Đã cập nhật hồ sơ (gửi email thất bại)' : 'Đã cập nhật hồ sơ', updated?.emailError ? 'warning' : 'success')
        onSaved(updated)
      } else if (draftId) {
        const keepFileIds = existingFiles.map(f => f.fileId).concat(eagerFileInfos.map(f => f.fileId))
        const result = await gasCall('api_finalizeDraft', token, draftId, submitForm, notifyTarget, keepFileIds)
        showToast(result?.emailError ? 'Đã thêm hồ sơ (gửi email thất bại)' : 'Đã thêm hồ sơ', result?.emailError ? 'warning' : 'success')
        onSaved(result.data)
      } else {
        // No files uploaded — fallback to createDocument
        const created = await gasCall('api_createDocument', token, submitForm, [], notifyTarget)
        showToast(created?.emailError ? 'Đã thêm hồ sơ (gửi email thất bại)' : 'Đã thêm hồ sơ', created?.emailError ? 'warning' : 'success')
        onSaved(created)
      }
    } catch (err) {
      if (err.message === 'Lỗi không xác định' && isEdit && !isDraftEdit) {
        const keepFileIds = existingFiles.map(f => f.fileId)
        const r = await retryWithVerify({
          fn: () => gasCall('api_updateDocument', token, doc.ID, submitForm, [], keepFileIds, notifyTarget, eagerFileInfos),
          verify: _makeVerify(),
          onRetry: (i, n) => setError(`Có lỗi xảy ra — đang thử lại lần ${i}/${n}…`),
        })
        if (r.ok) {
          showToast('Đã lưu hồ sơ', 'success')
          onSaved(r.data)
        } else {
          setError(r.error)
        }
      } else if (err.message === 'Lỗi không xác định') {
        showToast('Đã lưu hồ sơ — đang cập nhật', 'warning')
        onSaved(null)
      } else {
        setError(err.message)
      }
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
          <button onClick={handleCloseX} disabled={uploading || hasUploading} data-testid="doc-modal-close" className="w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-40 disabled:pointer-events-none">
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>

        {/* Body */}
        <form id="_docModalForm" onSubmit={handleSubmit} className={`flex-1 overflow-y-auto transition-colors ${form['Khẩn'] === 'TRUE' || form['Khẩn'] === true ? 'bg-red-50/40' : ''}`}>
          <div className="p-6 grid md:grid-cols-2 gap-x-8 gap-y-5">

            {/* ── LEFT COLUMN ── */}
            <div className="space-y-5">
              {/* Tên hồ sơ + Khẩn */}
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <Field label="Tên hồ sơ *">
                    <input className={iCls} value={form['Tên hồ sơ']} onChange={e => setField('Tên hồ sơ', e.target.value)} placeholder="Nhập tên hồ sơ..." />
                  </Field>
                </div>
                <label className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl cursor-pointer select-none transition-colors ${form['Khẩn'] === 'TRUE' || form['Khẩn'] === true ? 'bg-red-100 text-red-700' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'}`}>
                  <input type="checkbox" checked={form['Khẩn'] === 'TRUE' || form['Khẩn'] === true} onChange={e => setField('Khẩn', e.target.checked ? 'TRUE' : '')}
                    className="w-4 h-4 rounded accent-red-600 cursor-pointer" />
                  <span className="text-sm font-medium whitespace-nowrap">Khẩn</span>
                </label>
              </div>

              {/* Danh mục */}
              <Field label="Danh mục *">
                <CategoryPickerDropdown
                  testId="danhmuc-picker"
                  categories={lookups.danhMuc || []}
                  value={form['Danh mục']}
                  onChange={catId => {
                    setField('Danh mục', catId)
                    // Auto-fill Nơi lưu hồ sơ cứng from category
                    const cat = (lookups.danhMuc || []).find(c => String(c.ID) === catId)
                    if (cat && cat['Nơi lưu hồ sơ cứng']) {
                      setField('Nơi lưu hồ sơ cứng', cat['Nơi lưu hồ sơ cứng'])
                    }
                  }}
                />
              </Field>

              {/* Phụ trách (single person) — only admin/GĐ can change */}
              {canEditPhuTrach ? (
                <Field label="Phụ trách">
                  <UserPickerDropdown
                    users={lookups.ssoUsers || lookups.users || []}
                    phongBan={lookups.phongBan || []}
                    assignments={lookups.assignments || []}
                    value={phuTrach}
                    onChange={setPhuTrach}
                  />
                </Field>
              ) : phuTrach ? (
                <Field label="Phụ trách">
                  {(() => {
                    const u = (lookups.ssoUsers || lookups.users || []).find(u => u['Tên đăng nhập'] === phuTrach)
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
                  <UserPickerDropdown
                    users={lookups.ssoUsers || lookups.users || []}
                    phongBan={lookups.phongBan || []}
                    assignments={lookups.assignments || []}
                    value={collaborators}
                    onChange={setCollaborators}
                    placeholder="+ Thêm người phối hợp..."
                    exclude={phuTrach ? [phuTrach] : []}
                    multiple
                  />
                </Field>
              ) : collaborators.length > 0 ? (
                <Field label="Người phối hợp">
                  <div className="flex flex-wrap gap-1.5 bg-surface-container-low rounded-xl px-3 py-2.5">
                    {collaborators.map(a => {
                      const u = (lookups.ssoUsers || lookups.users || []).find(u => u['Tên đăng nhập'] === a)
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

              {/* Phân quyền xem (008) — nút mở popup chọn người */}
              <button type="button" onClick={() => setShowViewerModal(true)}
                className="w-full flex items-center justify-between border border-outline-variant rounded-xl px-3 py-2.5 text-left hover:bg-surface-container-low transition-colors">
                <span className="flex items-center gap-2 text-sm font-medium text-on-surface">
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant">lock</span>
                  Phân quyền xem
                  <span className="text-xs font-normal text-on-surface-variant">
                    {viewers.length > 0 ? `— ${viewers.length} người` : '— trống (chỉ người tham gia + toàn quyền)'}
                  </span>
                </span>
                <span className="text-on-surface-variant text-base">›</span>
              </button>
              {showViewerModal && (
                <ViewerPickerModal
                  users={eligibleViewerUsers}
                  phongBan={initialLookups.phongBan}
                  assignments={initialLookups.assignments}
                  value={viewers}
                  categoryViewerIds={categoryViewerIds(form['Danh mục'])}
                  catName={(initialLookups2.danhMuc || []).find(c => String(c.ID) === String(form['Danh mục']))?.['Tên danh mục'] || ''}
                  onConfirm={ids => { setViewers(ids); setShowViewerModal(false) }}
                  onClose={() => setShowViewerModal(false)}
                />
              )}

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
                          data-testid="existing-file-remove"
                          className="ml-0.5 hover:text-error transition-colors">
                          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>close</span>
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Eager uploads with status */}
                {eagerUploads.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {eagerUploads.map(u => (
                      <span key={u.id} className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full ${
                        u.status === 'error' ? 'bg-red-100 text-red-700' :
                        u.status === 'done' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-secondary/10 text-secondary'
                      }`}>
                        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
                          {u.status === 'uploading' ? 'sync' : u.status === 'done' ? 'check_circle' : 'error'}
                        </span>
                        <span className="max-w-[120px] truncate">{u.fileName}</span>
                        <span className="opacity-60">({(u.size / 1024 / 1024).toFixed(1)}MB)</span>
                        {u.status === 'uploading' && u.totalChunks ? (
                          <span className="opacity-60">— {u.size > PERCENT_THRESHOLD
                            ? Math.round((u.progress || 0) / u.totalChunks * 100) + '%'
                            : `${u.progress || 0}/${u.totalChunks}`}</span>
                        ) : null}
                        {u.status !== 'uploading' && (
                          <button type="button" onClick={() => removeEagerUpload(u.id)}
                            data-testid="eager-file-remove"
                            className="ml-0.5 hover:text-error transition-colors">
                            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>close</span>
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                )}

                {hasUploading && (() => {
                  const done = eagerUploads.filter(u => u.status === 'done').length
                  const total = eagerUploads.length
                  return (
                    <p className="text-xs text-primary font-medium mb-1.5 flex items-center gap-1">
                      <span className="material-symbols-outlined animate-spin" style={{ fontSize: 14 }}>sync</span>
                      Đang tải lên... ({done}/{total})
                    </p>
                  )
                })()}

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
                    handleFileChange(e)
                  }}
                >
                  <span className="material-symbols-outlined text-on-surface-variant mb-1" style={{ fontSize: 28 }}>upload_file</span>
                  <p className="text-sm text-on-surface-variant">Kéo file vào đây hoặc <span className="text-primary font-medium">chọn file</span></p>
                  <p className="text-xs text-on-surface-variant mt-0.5">PDF, DOC, XLSX, PNG, JPG — nhiều file</p>
                  <input ref={fileRef} type="file" className="hidden" onChange={handleFileChange} multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" />
                </div>
                {canPickDrive && (
                  <button type="button"
                    onClick={() => setShowDrivePicker(true)}
                    className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl border border-outline-variant text-sm text-on-surface hover:bg-primary/5 hover:border-primary/50 transition-colors">
                    <span className="material-symbols-outlined text-primary" style={{ fontSize: 20 }}>add_to_drive</span>
                    Link file từ Google Drive
                  </button>
                )}
              </Field>
            </div>

            {/* ── RIGHT COLUMN ── */}
            <div className="space-y-5">
              {/* Dự án (Nơi nhận) */}
              <Field label="Dự án (Nơi nhận)">
                <div className="flex gap-2">
                  <OptionPickerDropdown
                    testId="duan-picker"
                    options={(lookups.duAn || []).map(p => ({
                      value: p['Tên dự án viết tắt'],
                      label: p['Tên dự án đầy đủ'] ? `${p['Tên dự án đầy đủ']} (${p['Tên dự án viết tắt']})` : p['Tên dự án viết tắt'],
                    }))}
                    value={selectedDuAn}
                    onChange={setDuAn}
                    placeholder="-- Chọn dự án --"
                  />
                  {canQuickAddLookup && (
                  <button type="button"
                    onClick={() => { setQuickAdd('duAn'); setQuickForm({ 'Tên dự án viết tắt': '', 'Tên dự án đầy đủ': '' }) }}
                    className="w-9 h-9 flex items-center justify-center rounded-xl bg-secondary/10 text-secondary hover:bg-secondary/20 transition-colors shrink-0"
                    title="Thêm dự án / nơi nhận mới">
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>add_circle</span>
                  </button>
                  )}
                </div>
              </Field>

              {/* NCC (Nơi gửi) */}
              <Field label="NCC (Nơi gửi)">
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
                    title="Thêm NCC / nơi gửi mới">
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>add_circle</span>
                  </button>
                  )}
                </div>
              </Field>

              {/* Quick-add inline panel */}
              {quickAdd && (
                <div className="bg-secondary/5 border border-secondary/20 rounded-2xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-secondary">
                    + Thêm nhanh {quickAdd === 'duAn' ? 'dự án / nơi nhận' : 'NCC / nơi gửi'}
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
              <div className={`grid ${(isEdit && !isVanThuOwnDoc && !isDraftEdit) || (!isVanThu && !isNvTpCreate) ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
                {/* Tình trạng — hidden for Văn thư/NV/TP in create mode, Văn thư editing own doc, and draft edit (buttons handle status) */}
                {((isEdit && !isVanThuOwnDoc && !isDraftEdit) || (!isVanThu && !isNvTpCreate)) && (
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
            <button type="button" onClick={handleCancel} disabled={uploading || hasUploading}
              className="px-5 py-2.5 border border-outline-variant rounded-full text-sm text-on-surface hover:bg-surface-container transition-colors font-medium disabled:opacity-40 disabled:pointer-events-none">
              Hủy
            </button>
            {requireFullForFinalize && (() => {
              const canSaveDraft = !!draftId || !!form['Tên hồ sơ'] || !!form['Danh mục']
              return (
              <button type="button" onClick={handleSaveDraft}
                disabled={uploading || hasUploading || !canSaveDraft}
                title={!canSaveDraft ? 'Cần ít nhất Tên hồ sơ hoặc Danh mục để lưu nháp' : undefined}
                className="flex items-center gap-2 px-5 py-2.5 border border-outline-variant rounded-full text-sm text-on-surface hover:bg-surface-container transition-colors font-medium disabled:opacity-40 disabled:pointer-events-none">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>save</span>
                Lưu nháp
              </button>
              )
            })()}
            {(!isEdit && (isAdminRole || isVanThu || isNvTpCreate)) || isVanThuOwnDoc || isDraftEdit || (isTuChoiKetQuaDoc && isPhuTrachOfDoc) ? (
              <>
                {!isTuChoiDoc && !isTuChoiKetQuaDoc && (
                <button type="button" disabled={uploading || hasUploading}
                  onClick={async () => {
                    if (requireFullForFinalize && !hasAttachment) { setError(MISSING_ATTACHMENT_MSG); return }
                    if (!await confirm('Có chắc chỉ lưu trữ, không gửi thông báo tới Giám đốc?')) return
                    statusOverrideRef.current = 'Hoàn thành'; notifyTargetRef.current = 'none'; flushSync(() => {}); document.getElementById('_docModalForm')?.requestSubmit()
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-full text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 transition-colors shadow-md3-2">
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>inventory</span>
                  {uploading ? 'Đang lưu…' : 'Lưu tài liệu'}
                </button>
                )}
                {canPublish && (!isEdit || doc?.['Tình trạng'] === 'Hoàn thành' || ((doc?.['Tình trạng'] === 'Nháp' || doc?.['Tình trạng'] === 'YC Phát hành') && doc?.['Người tạo'] === session?.username)) && (
                <button type="button" disabled={uploading || hasUploading}
                  onClick={() => {
                    if (!form['Tên hồ sơ']) { setError('Tên hồ sơ là bắt buộc'); return }
                    if (!form['Danh mục']) { setError('Danh mục là bắt buộc'); return }
                    if (requireFullForFinalize && !hasAttachment) { setError(MISSING_ATTACHMENT_MSG); return }
                    setShowPublishDialog(true)
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 text-white rounded-full text-sm font-medium hover:bg-amber-700 disabled:opacity-60 transition-colors shadow-md3-2">
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>send</span>
                  {uploading ? 'Đang lưu…' : 'Phát hành'}
                </button>
                )}
                {(isAdminRole || isVanThu) && !isTuChoiDoc && !isTuChoiKetQuaDoc && (
                <button type="button" disabled={uploading || hasUploading}
                  onClick={async () => {
                    if (requireFullForFinalize && !hasAttachment) { setError(MISSING_ATTACHMENT_MSG); return }
                    if (!await confirm('Có chắc gửi Trình duyệt tới Giám đốc?')) return
                    notifyTargetRef.current = 'directors'; document.getElementById('_docModalForm')?.requestSubmit()
                  }}
                  className="flex items-center gap-2 px-6 py-2.5 bg-accent text-white rounded-full text-sm font-medium hover:bg-accent-hover disabled:opacity-60 transition-colors shadow-md3-2">
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>send</span>
                  {uploading ? 'Đang lưu…' : 'Trình duyệt'}
                </button>
                )}
                {isTuChoiDoc && isVanThuOwnDoc && (
                <button type="button" disabled={uploading || hasUploading}
                  onClick={async () => {
                    if (!form['Tên hồ sơ']) { setError('Tên hồ sơ là bắt buộc'); return }
                    if (!form['Danh mục']) { setError('Danh mục là bắt buộc'); return }
                    if (!await confirm('Có chắc gửi Trình duyệt lại tới Giám đốc?')) return
                    setUploading(true)
                    const keepFileIds = existingFiles.map(f => f.fileId)
                    const eagerInfos = eagerUploads
                      .filter(u => u.status === 'done' && u.fileId)
                      .map(u => ({ fileId: u.fileId, fileName: u.fileName, mimeType: u.mimeType, size: u.size }))
                    try {
                      const res = await gasCall('api_transitionDocument', token, doc.ID, 'trinhDuyetLai', {}, {
                        formData: { ...form }, fileInfos: [], keepFileIds, eagerFileInfos: eagerInfos,
                      })
                      showToast('Đã trình duyệt lại', 'success')
                      onSaved(res.data)
                    } catch (err) {
                      if (err.message === 'Lỗi không xác định') {
                        const r = await retryWithVerify({
                          fn: () => gasCall('api_transitionDocument', token, doc.ID, 'trinhDuyetLai', {}, {
                            formData: { ...form }, fileInfos: [], keepFileIds, eagerFileInfos: eagerInfos,
                          }).then(res => res.data),
                          verify: _makeVerify('Chờ duyệt'),
                          onRetry: (i, n) => setError(`Có lỗi xảy ra — đang thử lại lần ${i}/${n}…`),
                        })
                        if (r.ok) {
                          showToast('Đã trình duyệt lại', 'success')
                          onSaved(r.data)
                        } else {
                          setError(r.error)
                        }
                      } else {
                        setError(err.message)
                      }
                    } finally {
                      setUploading(false)
                    }
                  }}
                  className="flex items-center gap-2 px-6 py-2.5 bg-accent text-white rounded-full text-sm font-medium hover:bg-accent-hover disabled:opacity-60 transition-colors shadow-md3-2">
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>send</span>
                  {uploading ? 'Đang lưu…' : 'Trình duyệt lại'}
                </button>
                )}
                {isTuChoiKetQuaDoc && isPhuTrachOfDoc && (
                <button type="button" disabled={uploading || hasUploading}
                  onClick={async () => {
                    if (!form['Tên hồ sơ']) { setError('Tên hồ sơ là bắt buộc'); return }
                    if (!form['Danh mục']) { setError('Danh mục là bắt buộc'); return }
                    if (!await confirm('Có chắc gửi Hoàn thành lại?')) return
                    setUploading(true)
                    try {
                      const keepFileIds = existingFiles.map(f => f.fileId)
                      const eagerInfos = eagerUploads
                        .filter(u => u.status === 'done' && u.fileId)
                        .map(u => ({ fileId: u.fileId, fileName: u.fileName, mimeType: u.mimeType, size: u.size }))
                      const submitForm = { ...form }
                      const res = await gasCall('api_transitionDocument', token, doc.ID, 'hoanThanhLai', {}, {
                        formData: submitForm, fileInfos: [], keepFileIds, eagerFileInfos: eagerInfos,
                      })
                      onSaved(res.data)
                    } catch (err) {
                      setError(err.message)
                    } finally {
                      setUploading(false)
                    }
                  }}
                  className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-full text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 transition-colors shadow-md3-2">
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>task_alt</span>
                  {uploading ? 'Đang lưu…' : 'Hoàn thành'}
                </button>
                )}
              </>
            ) : (
              <button type="submit" disabled={uploading || hasUploading}
                className="flex items-center gap-2 px-6 py-2.5 bg-accent text-white rounded-full text-sm font-medium hover:bg-accent-hover disabled:opacity-60 transition-colors shadow-md3-2">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  {uploading ? 'sync' : 'save'}
                </span>
                {uploading ? 'Đang lưu…' : isEdit ? 'Cập nhật' : 'Lưu tài liệu'}
              </button>
            )}
          </div>
        </form>
      </div>

      {showPublishDialog && (
        <PublishDialog
          users={lookups.ssoUsers || lookups.users || []}
          phongBan={lookups.phongBan || []}
          assignments={lookups.assignments || []}
          onPublish={handlePublishFromDialog}
          onClose={() => setShowPublishDialog(false)}
          loading={uploading}
        />
      )}

      {showDrivePicker && (
        <DriveFilePicker
          token={token}
          lockToAppRoot
          title="Link file từ Google Drive"
          onConfirm={handleDriveFiles}
          onClose={() => setShowDrivePicker(false)}
        />
      )}
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
