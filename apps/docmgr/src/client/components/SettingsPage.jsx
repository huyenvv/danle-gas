import { useState, useEffect } from 'react'
import gasCall from '../gasClient.js'
import Icon from './common/Icon.jsx'
import FolderPicker from './settings/FolderPicker.jsx'
import LoadingOverlay from './common/LoadingOverlay.jsx'
import { useToast } from '../context/ToastContext.jsx'

export default function SettingsPage({ token, onCompanyNameChange }) {
  const [rootFolderId, setRootFolderId]     = useState('')
  const [rootFolderName, setRootFolderName] = useState('')
  const [companyName, setCompanyName]       = useState('')
  const [saving, setSaving]                 = useState(false)
  const [loading, setLoading]               = useState(true)
  const [showPicker, setShowPicker]         = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    async function load() {
      try {
        const [idRes, nameRes, companyRes] = await Promise.all([
          gasCall('api_getConfig', token, 'ROOT_FOLDER_ID'),
          gasCall('api_getConfig', token, 'ROOT_FOLDER_NAME'),
          gasCall('api_getConfig', token, 'COMPANY_NAME'),
        ])
        if (idRes && idRes.value) setRootFolderId(idRes.value)
        if (nameRes && nameRes.value) setRootFolderName(nameRes.value)
        if (companyRes && companyRes.value) setCompanyName(companyRes.value)
      } catch (_) { /* ignore */ }
      setLoading(false)
    }
    load()
  }, [token])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await gasCall('api_setConfig', token, 'ROOT_FOLDER_ID', rootFolderId)
      await gasCall('api_setConfig', token, 'ROOT_FOLDER_NAME', rootFolderName)
      await gasCall('api_setConfig', token, 'COMPANY_NAME', companyName)
      onCompanyNameChange && onCompanyNameChange(companyName)
      showToast('Đã lưu cài đặt thành công', 'success')
    } catch (err) {
      showToast('Lỗi: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  function handleFolderSelect(folder) {
    setRootFolderId(folder.id)
    setRootFolderName(folder.name)
    setShowPicker(false)
  }

  if (loading) {
    return (
      <div className="max-w-lg">
        <div className="bg-white rounded-2xl shadow-card p-6">
          <p className="text-sm text-on-surface-variant">Đang tải cài đặt…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg space-y-5">
      <div className="bg-white rounded-2xl shadow-card p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Icon name="settings" size={22} className="text-primary" />
          </div>
          <h3 className="font-semibold text-on-surface text-base">Cài đặt hệ thống</h3>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">Tên công ty</label>
            <input
              type="text"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="VD: Công ty TNHH ABC"
              className="w-full bg-surface-container-low rounded-xl px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant border border-transparent focus:border-primary focus:outline-none transition-colors"
            />
            <p className="text-xs text-on-surface-variant mt-1">Hiển thị ở giữa thanh tiêu đề</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">Thư mục gốc Google Drive</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-surface-container-low rounded-xl px-3 py-2 text-sm min-h-[38px] flex items-center">
                {rootFolderName ? (
                  <span className="flex items-center gap-1.5">
                    <Icon name="folder" size={16} className="text-amber-500 shrink-0" />
                    <span className="text-on-surface">{rootFolderName}</span>
                    <span className="text-on-surface-variant text-xs ml-1">({rootFolderId})</span>
                  </span>
                ) : (
                  <span className="text-on-surface-variant">Chưa chọn thư mục</span>
                )}
              </div>
              <button type="button" onClick={() => setShowPicker(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-surface-container border border-outline-variant rounded-xl text-sm text-on-surface hover:bg-surface-container-high transition-colors whitespace-nowrap">
                <Icon name="folder_open" size={16} />
                Chọn thư mục
              </button>
            </div>
            <p className="text-xs text-on-surface-variant mt-1">Thư mục gốc trên Google Drive để lưu file đính kèm</p>
          </div>

          <button type="submit" disabled={saving || !rootFolderId}
            className="flex items-center gap-2 bg-primary text-on-primary px-5 py-2 rounded-full text-sm font-medium hover:bg-primary-700 transition-colors shadow-md3-1 disabled:opacity-60">
            <Icon name="save" size={16} />
            {saving ? 'Đang lưu…' : 'Lưu cài đặt'}
          </button>
        </form>
      </div>

      {showPicker && (
        <FolderPicker
          token={token}
          currentFolderId={rootFolderId}
          onSelect={handleFolderSelect}
          onClose={() => setShowPicker(false)}
        />
      )}

      {saving && <LoadingOverlay />}
    </div>
  )
}
