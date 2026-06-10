import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import gasCall from '../gasClient.js'
import { groupAndResolve } from '../utils/importResolver.js'
import { dataCache } from '../utils/dataCache.js'
import { useToast } from '../context/ToastContext.jsx'
import { btnPrimary, btnOutline } from './common/formStyles.js'
import Icon from './common/Icon.jsx'
import DriveFilePicker from './settings/DriveFilePicker.jsx'

const MAX_FILE_MB = 25
const MAX_ROWS = 1000   // server cap in import.js — keep in sync

function formatBytes(n) {
  const b = Number(n) || 0
  if (b <= 0) return '—'
  if (b < 1024) return b + ' B'
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB'
  return (b / (1024 * 1024)).toFixed(1) + ' MB'
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      const comma = result.indexOf(',')
      resolve(comma !== -1 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(new Error('Không đọc được file'))
    reader.readAsDataURL(file)
  })
}

const thCls = 'px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide'

// Stat chip — doubles as the legend for the status icons used in the table.
function StatBadge({ icon, count, label, cls }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm ${cls}`}>
      <Icon name={icon} size={16} />
      <b>{count}</b>
      <span>{label}</span>
    </span>
  )
}

export default function ImportManager({ token, lookups, onImported }) {
  const [stage, setStage] = useState('idle') // idle | parsing | preview | importing | result
  const [fileName, setFileName] = useState('')
  const [groups, setGroups] = useState([])
  const [orphanErrors, setOrphanErrors] = useState([])
  const [result, setResult] = useState(null)
  const [fileModal, setFileModal] = useState(null) // { stt, group } | null
  const [showAllRows, setShowAllRows] = useState(false)
  const [showDrivePicker, setShowDrivePicker] = useState(false)
  const fileInputRef = useRef(null)
  const { showToast } = useToast()

  useEffect(() => {
    if (!fileModal && !showAllRows) return
    const onKey = e => { if (e.key === 'Escape') { setFileModal(null); setShowAllRows(false) } }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [fileModal, showAllRows])

  const validGroups = groups.filter(g => g.errors.length === 0)
  const invalidGroups = groups.filter(g => g.errors.length > 0)
  const cleanGroups = validGroups.filter(g => g.warnings.length === 0)
  const warnGroups = validGroups.filter(g => g.warnings.length > 0)
  // Hợp lệ lên trên, lỗi xuống dưới
  const sortedGroups = [...validGroups, ...invalidGroups]

  // Row-level (dòng) tallies — distinct from hồ sơ (groups), since 1 hồ sơ can span nhiều dòng.
  const countRows = gs => gs.reduce((s, g) => s + (g.rowIndices || []).length, 0)
  const validRowCount = countRows(validGroups)
  const orphanRowCount = orphanErrors.reduce((s, e) => s + ((e.rowIndices || []).length || 1), 0)
  const invalidRowCount = countRows(invalidGroups) + orphanRowCount
  const totalDataRows = validRowCount + invalidRowCount
  const stripDong = s => String(s).replace(/^Dòng\s+[\d,\s]+:\s*/i, '')
  const invalidRowItems = [
    ...orphanErrors.map(e => ({ row: (e.rowIndices || [9999])[0], text: e.message })),
    ...invalidGroups.map(g => {
      const rows = g.rowIndices || []
      return {
        row: rows.length ? Math.min.apply(null, rows) : 9999,
        text: `Dòng ${rows.join(', ')} — ${g.tenHoSo}: ${g.errors.map(stripDong).join('; ')}`,
      }
    }),
  ].sort((a, b) => a.row - b.row)

  // Resolve a user ID (from resolved docData) back to a readable name for the detail popup.
  function userName(id) {
    const u = (lookups.users || []).find(x => String(x['ID']) === String(id))
    return u ? (u['Tên nhân viên'] || u['Tên đăng nhập'] || u['Email'] || String(id)) : String(id)
  }

  function reset() {
    setStage('idle'); setFileName(''); setGroups([]); setOrphanErrors([]); setResult(null); setShowAllRows(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleFile(e) {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      showToast(`File quá lớn (tối đa ${MAX_FILE_MB}MB)`, 'error')
      e.target.value = ''
      return
    }
    setFileName(file.name)
    setStage('parsing')
    try {
      const base64 = await readFileAsBase64(file)
      const res = await gasCall('api_parseImportFile', token, base64, file.name)
      const { groups: gs, orphanErrors: oe } = groupAndResolve(res.rows || [], lookups)
      setGroups(gs)
      setOrphanErrors(oe)
      setStage('preview')
    } catch (err) {
      showToast(err.message || 'Lỗi đọc file', 'error')
      reset()
    }
  }

  // Parse an Excel or Google Sheet file picked from the deploy owner's Drive (no re-upload).
  async function handleDriveFile(picked) {
    setShowDrivePicker(false)
    const file = picked && picked[0]
    if (!file) return
    setFileName(file.name)
    setStage('parsing')
    try {
      const res = await gasCall('api_parseImportFileFromDrive', token, file.id)
      const { groups: gs, orphanErrors: oe } = groupAndResolve(res.rows || [], lookups)
      setGroups(gs)
      setOrphanErrors(oe)
      setStage('preview')
    } catch (err) {
      showToast(err.message || 'Lỗi đọc file', 'error')
      reset()
    }
  }

  async function handleImport() {
    if (validGroups.length === 0) { showToast('Không có hồ sơ hợp lệ để import', 'error'); return }
    setStage('importing')
    try {
      const payload = {
        groups: validGroups.map(g => ({
          docData: g.docData,
          // strip preview-only `link` — stored file JSON stays {fileId, fileName, mimeType, size}
          files: g.files.map(({ link, ...f }) => f),
          rowIndices: g.rowIndices,
        })),
      }
      const res = await gasCall('api_bulkImportDocuments', token, payload)
      setResult(res)
      setStage('result')
      dataCache.invalidate('lookups')
      if (onImported) onImported()
      showToast(`Đã tạo ${res.created} hồ sơ`, 'success')
    } catch (err) {
      showToast(err.message || 'Lỗi import', 'error')
      setStage('preview')
    }
  }

  return (
    <div className="space-y-5">
      {/* Header card */}
      <div className="bg-white rounded-2xl shadow-card p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
          <Icon name="upload_file" size={22} className="text-accent" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-on-surface leading-tight">Nhập hồ sơ từ Excel</h2>
          <p className="text-xs text-on-surface-variant truncate">
            Đọc tab <b>FileMoi</b>, nhóm theo Tên hồ sơ và liên kết file đã có trên Drive.
          </p>
        </div>
        {stage !== 'idle' && (
          <button onClick={reset} className={`${btnOutline} ml-auto`}>
            <Icon name="restart_alt" size={18} />
            <span>Chọn file khác</span>
          </button>
        )}
      </div>

      {/* Idle / upload */}
      {stage === 'idle' && (
        <div className="bg-white rounded-2xl shadow-card p-10">
          <div className="border-2 border-dashed border-outline-variant rounded-2xl py-12 px-6 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-surface-container flex items-center justify-center mb-4">
              <Icon name="cloud_upload" size={28} className="text-on-surface-variant" />
            </div>
            <p className="text-sm font-medium text-on-surface mb-1">Chọn file Excel (.xlsx)</p>
            <p className="text-xs text-on-surface-variant mb-5">Tối đa {MAX_ROWS} dòng · các tài liệu liệt kê trong file phải đã có sẵn trên Drive</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={handleFile}
              className="hidden"
              id="import-file-input"
            />
            <div className="flex items-center gap-3">
              <label htmlFor="import-file-input" className={`${btnPrimary} cursor-pointer`}>
                <Icon name="folder_open" size={18} />
                Chọn file
              </label>
              <button type="button" onClick={() => setShowDrivePicker(true)} className={`${btnOutline} cursor-pointer`}>
                <Icon name="add_to_drive" size={18} />
                Chọn từ Drive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Parsing / importing — full-screen blocking overlay */}
      {(stage === 'parsing' || stage === 'importing') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-card px-12 py-10 flex flex-col items-center text-center">
            <div className="w-12 h-12 border-[3px] border-primary border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm font-medium text-on-surface">{stage === 'parsing' ? 'Đang đọc file…' : 'Đang tạo hồ sơ…'}</p>
            <p className="text-xs text-on-surface-variant mt-1">Vui lòng đợi, không đóng cửa sổ</p>
          </div>
        </div>
      )}

      {/* Preview */}
      {stage === 'preview' && (
        <>
          {/* File + actions */}
          <div className="bg-white rounded-2xl shadow-card p-4 flex flex-wrap items-center gap-3">
            <Icon name="description" size={18} className="text-on-surface-variant" />
            <span className="text-sm text-on-surface font-medium truncate max-w-xs">{fileName}</span>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={reset} className={btnOutline}>Hủy</button>
              <button onClick={handleImport} disabled={validGroups.length === 0} className={btnPrimary}>
                <Icon name="upload" size={18} />
                Import {validGroups.length} hồ sơ
              </button>
            </div>
          </div>

          {/* 1) Dòng dữ liệu */}
          <div className="bg-white rounded-2xl shadow-card p-4 space-y-3">
            <h3 className="text-base font-semibold text-on-surface">{totalDataRows} dòng dữ liệu</h3>
            <div className="flex flex-wrap items-center gap-2">
              <StatBadge icon="check_circle" count={validRowCount} label="hợp lệ" cls="bg-emerald-100 text-emerald-700" />
              <StatBadge
                icon={invalidRowCount > 0 ? 'error' : 'check_circle'}
                count={invalidRowCount}
                label="chưa hợp lệ"
                cls={invalidRowCount > 0 ? 'bg-red-100 text-red-700' : 'bg-surface-container text-on-surface-variant'}
              />
            </div>
            {invalidRowItems.length > 0 && (
              <div className="border-t border-outline-variant pt-3 space-y-1.5">
                <ul className="text-xs space-y-1">
                  {invalidRowItems.slice(0, 10).map((d, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-on-surface-variant">
                      <Icon name="error" size={14} className="text-error mt-px shrink-0" />
                      <span>{d.text}</span>
                    </li>
                  ))}
                </ul>
                {invalidRowItems.length > 10 && (
                  <button onClick={() => setShowAllRows(true)} className="text-xs text-primary font-medium hover:underline">
                    Xem thêm {invalidRowItems.length - 10} dòng…
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 2) Hồ sơ */}
          <div className="bg-white rounded-2xl shadow-card overflow-hidden">
            <div className="p-4 space-y-2 border-b border-outline-variant">
              <h3 className="text-base font-semibold text-on-surface">{groups.length} hồ sơ</h3>
              <div className="flex flex-wrap items-center gap-2">
                <StatBadge icon="check_circle" count={cleanGroups.length} label="hợp lệ" cls="bg-emerald-100 text-emerald-700" />
                <StatBadge icon="warning" count={warnGroups.length} label="cảnh báo" cls="bg-amber-100 text-amber-700" />
                <StatBadge icon="error" count={invalidGroups.length} label="lỗi" cls="bg-red-100 text-red-700" />
              </div>
              <div className="text-xs text-on-surface-variant space-y-0.5">
                <div>Hồ sơ <b className="text-amber-700">cảnh báo</b> vẫn được import.</div>
                <div>Hồ sơ <b className="text-error">lỗi</b> bị bỏ qua.</div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant">
                    <th className={`${thCls} w-12 text-center`}>STT</th>
                    <th className={`${thCls} w-12`}></th>
                    <th className={thCls}>Tên hồ sơ</th>
                    <th className={thCls}>Danh mục</th>
                    <th className={`${thCls} text-center`}>Số file</th>
                    <th className={thCls}>Lỗi / Cảnh báo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/40">
                  {sortedGroups.map((g, i) => {
                    const ok = g.errors.length === 0
                    const warn = ok && g.warnings.length > 0
                    return (
                      <tr key={i} className="hover:bg-surface-container-low transition-colors align-top">
                        <td className="px-4 py-3 text-center text-on-surface-variant">{i + 1}</td>
                        <td className="px-4 py-3">
                          <Icon
                            name={ok ? (warn ? 'warning' : 'check_circle') : 'error'}
                            size={18}
                            className={ok ? (warn ? 'text-amber-600' : 'text-emerald-600') : 'text-error'}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setFileModal({ stt: i + 1, group: g })}
                            className="font-medium text-primary text-left hover:underline inline-flex items-center gap-1"
                            title="Xem đầy đủ thông tin hồ sơ"
                          >
                            {g.tenHoSo}
                            <Icon name="visibility" size={13} className="opacity-60" />
                          </button>
                        </td>
                        <td className="px-4 py-3 text-on-surface-variant">{g.categoryName || '—'}</td>
                        <td className="px-4 py-3 text-center text-on-surface-variant">{g.fileCount}</td>
                        <td className="px-4 py-3 text-xs space-y-0.5">
                          {g.errors.map((er, j) => <div key={'e' + j} className="text-error">{er}</div>)}
                          {g.warnings.map((w, j) => <div key={'w' + j} className="text-amber-600">{w}</div>)}
                          {ok && !warn && <span className="text-on-surface-variant/60">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Result */}
      {stage === 'result' && result && (
        <>
          <div className="bg-white rounded-2xl shadow-card p-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
              <Icon name="task_alt" size={22} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-base font-semibold text-on-surface leading-tight">Đã tạo {result.created} hồ sơ ({result.totalFiles} file)</p>
              {result.errors.length > 0 && <p className="text-sm text-error">{result.errors.length} hồ sơ lỗi không tạo được</p>}
            </div>
            <button onClick={reset} className={`${btnPrimary} ml-auto`}>
              <Icon name="add" size={18} />
              Import thêm
            </button>
          </div>

          {result.errors.length > 0 && (
            <div className="bg-white rounded-2xl shadow-card overflow-hidden">
              <div className="px-4 py-3 bg-surface-container-low border-b border-outline-variant text-xs font-semibold uppercase tracking-wide text-error">Lỗi</div>
              <table className="min-w-full text-sm">
                <tbody className="divide-y divide-outline-variant/40">
                  {result.errors.map((e, i) => (
                    <tr key={i} className="hover:bg-surface-container-low transition-colors">
                      <td className="px-4 py-3 font-medium text-on-surface">{e.group}</td>
                      <td className="px-4 py-3 text-error">{e.message}</td>
                      <td className="px-4 py-3 text-on-surface-variant text-xs">{(e.rowIndices || []).join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {fileModal && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
          onClick={() => setFileModal(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-md3-3 w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-6 py-4 border-b border-outline-variant shrink-0">
              <div className="w-8 h-8 rounded-lg bg-primary-container flex items-center justify-center shrink-0">
                <Icon name="attach_file" size={18} className="text-on-primary-container" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-semibold text-on-surface truncate">{fileModal.group.tenHoSo}</h2>
                <p className="text-xs text-on-surface-variant truncate">{fileModal.group.categoryName || '—'} · {fileModal.group.files.length} file</p>
              </div>
              <button
                onClick={() => setFileModal(null)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors"
                aria-label="Đóng"
              >
                <Icon name="close" size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {(() => {
                const g = fileModal.group
                const d = g.docData || {}
                const giaTri = Number(d['Giá trị HĐ']) || 0
                const fields = [
                  ['Danh mục', g.categoryName],
                  ['Số hồ sơ', d['Số hồ sơ']],
                  ['Ngày ban hành', d['Ngày ban hành']],
                  ['Ngày kết thúc', d['Ngày kết thúc']],
                  ['Dự án', d['Dự án (Phòng ban)']],
                  ['Nhà cung cấp', d['Nhà cung cấp (Nơi ban hành)']],
                  ['Giá trị HĐ', giaTri ? giaTri.toLocaleString('vi-VN') + ' đ' : ''],
                  ['Phụ trách', d['Phụ trách'] ? userName(d['Phụ trách']) : ''],
                  ['Người phối hợp', (d['Người phối hợp'] || []).map(userName).join(', ')],
                  ['Nơi lưu hồ sơ cứng', d['Nơi lưu hồ sơ cứng']],
                  ['Ghi chú', d['Ghi chú']],
                ]
                return (
                  <>
                    {(g.errors.length > 0 || g.warnings.length > 0) && (
                      <div className="px-6 py-3 border-b border-outline-variant text-xs space-y-1">
                        {g.errors.map((er, j) => (
                          <div key={'e' + j} className="flex items-start gap-1.5 text-error">
                            <Icon name="error" size={14} className="mt-px shrink-0" /><span>{er}</span>
                          </div>
                        ))}
                        {g.warnings.map((w, j) => (
                          <div key={'w' + j} className="flex items-start gap-1.5 text-amber-700">
                            <Icon name="warning" size={14} className="mt-px shrink-0" /><span>{w}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <dl className="px-6 py-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 border-b border-outline-variant">
                      {fields.map(([label, val]) => (
                        <div key={label} className="min-w-0">
                          <dt className="text-xs text-on-surface-variant uppercase tracking-wide">{label}</dt>
                          <dd className="text-sm text-on-surface break-words">{val || '—'}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="px-6 pt-4 pb-1 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                      Danh sách file ({g.files.length})
                    </div>
                  </>
                )
              })()}
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant">
                    <th className={`${thCls} w-12 text-center`}>STT</th>
                    <th className={thCls}>Tên file</th>
                    <th className={thCls}>Loại</th>
                    <th className={`${thCls} text-right`}>Kích thước</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/40">
                  {fileModal.group.files.map((f, i) => {
                    const href = f.link || (f.fileId ? `https://drive.google.com/file/d/${f.fileId}/view` : '')
                    return (
                      <tr key={i} className="hover:bg-surface-container-low transition-colors">
                        <td className="px-4 py-2.5 text-center text-on-surface-variant">{i + 1}</td>
                        <td className="px-4 py-2.5 break-all">
                          {href ? (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                              title="Mở file ở tab mới"
                            >
                              {f.fileName || '(không tên)'}
                              <Icon name="open_in_new" size={14} />
                            </a>
                          ) : (
                            <span className="text-on-surface">{f.fileName || '—'}</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-on-surface-variant text-xs">{f.mimeType || '—'}</td>
                        <td className="px-4 py-2.5 text-right text-on-surface-variant">{formatBytes(f.size)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showAllRows && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
          onClick={() => setShowAllRows(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-md3-3 w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-6 py-4 border-b border-outline-variant shrink-0">
              <div className="w-8 h-8 rounded-lg bg-error-container flex items-center justify-center shrink-0">
                <Icon name="error" size={18} className="text-error" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-semibold text-on-surface">Dòng chưa hợp lệ</h2>
                <p className="text-xs text-on-surface-variant">{invalidRowItems.length} dòng</p>
              </div>
              <button
                onClick={() => setShowAllRows(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container transition-colors"
                aria-label="Đóng"
              >
                <Icon name="close" size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <ul className="text-sm space-y-2">
                {invalidRowItems.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-on-surface-variant">
                    <Icon name="error" size={16} className="text-error mt-px shrink-0" />
                    <span>{d.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>,
        document.body
      )}

      {showDrivePicker && (
        <DriveFilePicker
          token={token}
          multiple={false}
          accept={['.xlsx', '.xls', 'application/vnd.google-apps.spreadsheet']}
          title="Chọn file Excel / Google Sheet từ Drive"
          onConfirm={handleDriveFile}
          onClose={() => setShowDrivePicker(false)}
        />
      )}
    </div>
  )
}
