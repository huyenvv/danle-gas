import { useState, useRef } from 'react'
import gasCall from '../gasClient.js'

const STATUS_OPTIONS = ['Hiệu lực', 'Hết hạn', 'Sắp hết hạn', 'Chờ duyệt', 'Đã thanh lý']
const MAX_FILE_MB = 20

export default function DocumentModal({ mode, doc, lookups, token, onClose, onSaved }) {
  const isEdit = mode === 'edit'

  const [form, setForm] = useState(isEdit ? { ...doc } : {
    'Tên hồ sơ': '',
    'Danh mục': '',
    'Loại hồ sơ': '',
    'Số hợp đồng': '',
    'Đơn vị/ Trường': '',
    'Ngày ký': '',
    'Ngày hiệu lực': '',
    'Ngày hết hạn': '',
    'Giá trị HĐ': '',
    'Giá trị thực hiện': '',
    'Trạng thái': 'Hiệu lực',
    'Ghi chú': '',
  })

  const [file, setFile]           = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState('')
  const fileRef = useRef()

  function setField(key, val) {
    setForm(f => ({ ...f, [key]: val }))
  }

  function handleFileChange(e) {
    const f = e.target.files[0]
    if (!f) return
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`File quá lớn (tối đa ${MAX_FILE_MB}MB)`)
      return
    }
    setFile(f)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form['Tên hồ sơ']) { setError('Tên hồ sơ là bắt buộc'); return }
    if (!form['Danh mục']) { setError('Danh mục là bắt buộc'); return }
    setError('')
    setUploading(true)

    try {
      let fileInfo = null
      if (file) {
        const base64 = await toBase64(file)
        fileInfo = { base64Data: base64, mimeType: file.type, fileName: file.name }
      }

      if (isEdit) {
        await gasCall('api_updateDocument', token, doc.ID, form, fileInfo)
      } else {
        await gasCall('api_createDocument', token, form, fileInfo)
      }
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">{isEdit ? 'Chỉnh sửa hồ sơ' : 'Thêm hồ sơ mới'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Field label="Tên hồ sơ *">
                <input className={inputCls} value={form['Tên hồ sơ']} onChange={e => setField('Tên hồ sơ', e.target.value)} />
              </Field>
            </div>

            <Field label="Danh mục *">
              <select className={inputCls} value={form['Danh mục']} onChange={e => setField('Danh mục', e.target.value)}>
                <option value="">-- Chọn danh mục --</option>
                {lookups.danhMuc.map(c => <option key={c.ID} value={c.ID}>{c['Tên danh mục']}</option>)}
              </select>
            </Field>

            <Field label="Trạng thái">
              <select className={inputCls} value={form['Trạng thái']} onChange={e => setField('Trạng thái', e.target.value)}>
                {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
              </select>
            </Field>

            <Field label="Số hợp đồng">
              <input className={inputCls} value={form['Số hợp đồng']} onChange={e => setField('Số hợp đồng', e.target.value)} />
            </Field>

            <Field label="Đơn vị / Trường">
              <input className={inputCls} value={form['Đơn vị/ Trường']} onChange={e => setField('Đơn vị/ Trường', e.target.value)} />
            </Field>

            <Field label="Ngày ký">
              <input type="date" className={inputCls} value={form['Ngày ký']} onChange={e => setField('Ngày ký', e.target.value)} />
            </Field>

            <Field label="Ngày hiệu lực">
              <input type="date" className={inputCls} value={form['Ngày hiệu lực']} onChange={e => setField('Ngày hiệu lực', e.target.value)} />
            </Field>

            <Field label="Ngày hết hạn">
              <input type="date" className={inputCls} value={form['Ngày hết hạn']} onChange={e => setField('Ngày hết hạn', e.target.value)} />
            </Field>

            <Field label="Giá trị HĐ (VNĐ)">
              <input type="number" className={inputCls} value={form['Giá trị HĐ']} onChange={e => setField('Giá trị HĐ', e.target.value)} />
            </Field>

            <Field label="Giá trị thực hiện (VNĐ)">
              <input type="number" className={inputCls} value={form['Giá trị thực hiện']} onChange={e => setField('Giá trị thực hiện', e.target.value)} />
            </Field>

            <div className="col-span-2">
              <Field label="Ghi chú">
                <textarea className={inputCls + ' resize-none h-20'} value={form['Ghi chú']} onChange={e => setField('Ghi chú', e.target.value)} />
              </Field>
            </div>

            <div className="col-span-2">
              <Field label={isEdit && doc['Tên file'] ? `File đính kèm (hiện tại: ${doc['Tên file']})` : 'File đính kèm'}>
                <input ref={fileRef} type="file" className="text-sm" onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" />
                {file && <p className="text-xs text-gray-500 mt-1">{file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)</p>}
              </Field>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-3 text-sm">{error}</div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-5 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
              Hủy
            </button>
            <button type="submit" disabled={uploading}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60">
              {uploading ? 'Đang lưu…' : isEdit ? 'Cập nhật' : 'Thêm mới'}
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
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

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
