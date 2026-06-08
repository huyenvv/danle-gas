import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import gasCall from '../gasClient.js'
import { groupAndResolve } from '../utils/importResolver.js'
import { dataCache } from '../utils/dataCache.js'
import { useToast } from '../context/ToastContext.jsx'
import { btnPrimary, btnOutline } from './common/formStyles.js'
import Icon from './common/Icon.jsx'

const MAX_FILE_MB = 5

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

export default function ImportManager({ token, lookups, onImported }) {
  const [stage, setStage] = useState('idle') // idle | parsing | preview | importing | result
  const [fileName, setFileName] = useState('')
  const [groups, setGroups] = useState([])
  const [orphanErrors, setOrphanErrors] = useState([])
  const [result, setResult] = useState(null)
  const [fileModal, setFileModal] = useState(null) // { stt, group } | null
  const fileInputRef = useRef(null)
  const { showToast } = useToast()

  useEffect(() => {
    if (!fileModal) return
    const onKey = e => { if (e.key === 'Escape') setFileModal(null) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [fileModal])

  const validGroups = groups.filter(g => g.errors.length === 0)
  const invalidGroups = groups.filter(g => g.errors.length > 0)

  function reset() {
    setStage('idle'); setFileName(''); setGroups([]); setOrphanErrors([]); setResult(null)
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
            <p className="text-xs text-on-surface-variant mb-5">Tối đa {MAX_FILE_MB}MB · các file phải đã upload sẵn trên Drive</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={handleFile}
              className="hidden"
              id="import-file-input"
            />
            <label htmlFor="import-file-input" className={`${btnPrimary} cursor-pointer`}>
              <Icon name="folder_open" size={18} />
              Chọn file
            </label>
          </div>
        </div>
      )}

      {/* Parsing / importing */}
      {(stage === 'parsing' || stage === 'importing') && (
        <div className="bg-white rounded-2xl shadow-card p-12 flex flex-col items-center text-center">
          <div className="w-9 h-9 border-[3px] border-primary border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm text-on-surface-variant">{stage === 'parsing' ? 'Đang đọc file…' : 'Đang tạo hồ sơ…'}</p>
        </div>
      )}

      {/* Preview */}
      {stage === 'preview' && (
        <>
          <div className="bg-white rounded-2xl shadow-card p-4 flex flex-wrap items-center gap-3">
            <Icon name="description" size={18} className="text-on-surface-variant" />
            <span className="text-sm text-on-surface font-medium truncate max-w-xs">{fileName}</span>
            <span className="text-sm text-on-surface-variant">
              {groups.length} hồ sơ · <span className="text-emerald-600">{validGroups.length} hợp lệ</span>
              {invalidGroups.length > 0 && <> · <span className="text-error">{invalidGroups.length} lỗi</span></>}
            </span>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={reset} className={btnOutline}>Hủy</button>
              <button onClick={handleImport} disabled={validGroups.length === 0} className={btnPrimary}>
                <Icon name="upload" size={18} />
                Import {validGroups.length} hồ sơ
              </button>
            </div>
          </div>

          {orphanErrors.length > 0 && (
            <div className="bg-error-container text-on-error-container rounded-2xl px-4 py-3 text-sm space-y-0.5">
              {orphanErrors.map((e, i) => <div key={i}>{e.message}</div>)}
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant">
                    <th className={`${thCls} w-12 text-center`}>STT</th>
                    <th className={`${thCls} w-12`}></th>
                    <th className={thCls}>Tên hồ sơ</th>
                    <th className={thCls}>Danh mục</th>
                    <th className={`${thCls} text-center`}>Số file</th>
                    <th className={thCls}>Ghi chú</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/40">
                  {groups.map((g, i) => {
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
                        <td className="px-4 py-3 font-medium text-on-surface">{g.tenHoSo}</td>
                        <td className="px-4 py-3 text-on-surface-variant">{g.categoryName || '—'}</td>
                        <td className="px-4 py-3 text-center">
                          {g.fileCount > 0 ? (
                            <button
                              onClick={() => setFileModal({ stt: i + 1, group: g })}
                              className="inline-flex items-center gap-1 text-primary font-medium hover:underline"
                              title="Xem danh sách file"
                            >
                              {g.fileCount}
                              <Icon name="visibility" size={15} />
                            </button>
                          ) : (
                            <span className="text-on-surface-variant">0</span>
                          )}
                        </td>
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
                <p className="text-xs text-on-surface-variant">{fileModal.group.files.length} file</p>
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
    </div>
  )
}
