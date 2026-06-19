import { useState } from 'react'
import gasCall from '../gasClient.js'
import { useToast } from '../context/ToastContext.jsx'
import FormModal from './common/FormModal.jsx'
import CategoryPickerDropdown from './common/CategoryPickerDropdown.jsx'

// In / Xuất danh mục hồ sơ ra Excel — modal. Chỉ Văn thư / Admin / Giám đốc
// (gác ở CreateMenu + server). Chọn MỘT danh mục (bắt buộc) → tải file .xlsx
// các hồ sơ (trừ Nháp) trong danh mục đó và mọi danh mục con.
export default function ExportCatalogModal({ open, onClose, token, lookups }) {
  const [categoryId, setCategoryId] = useState('')
  const [loading, setLoading] = useState(false)
  const { showToast } = useToast()

  async function handleExport() {
    if (!categoryId) { showToast('Vui lòng chọn danh mục', 'error'); return }
    setLoading(true)
    try {
      const res = await gasCall('api_exportCatalog', token, categoryId)
      const binary = atob(res.base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob = new Blob([bytes], { type: res.mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = res.fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showToast('Đã tải file mục lục (' + res.count + ' hồ sơ)', 'success')
      onClose()
    } catch (err) {
      showToast(err.message || 'Không xuất được danh mục', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <FormModal
      open={open}
      title="In danh mục hồ sơ"
      icon="file_download"
      onClose={onClose}
      onSave={handleExport}
      saving={loading}
      saveDisabled={!categoryId}
      saveLabel={loading ? 'Đang tạo file…' : 'Tải Excel'}
      maxWidth="max-w-2xl"
    >
      {/* min-height đủ chỗ cho dropdown danh mục (max-h-72) bung ra mà không làm popup phải scroll */}
      <div className="min-h-[26rem]">
        <p className="text-sm text-on-surface-variant mb-4">
          Xuất danh sách hồ sơ trong danh mục được chọn (gồm cả danh mục con) ra file Excel để lưu trữ. Bao gồm mọi hồ sơ <b>trừ bản nháp</b>.
        </p>
        <label className="block text-sm font-medium text-on-surface-variant mb-1.5">
          Danh mục <span className="text-error">*</span>
        </label>
        <CategoryPickerDropdown
          categories={lookups.danhMuc}
          value={categoryId}
          onChange={setCategoryId}
          placeholder="-- Chọn danh mục --"
          defaultCollapsed
          testId="export-category-picker"
        />
      </div>
    </FormModal>
  )
}
