import { useState, useEffect } from 'react'
import gasCall from '../gasClient.js'
import Icon from './common/Icon.jsx'
import FolderPicker from './settings/FolderPicker.jsx'
import LoadingOverlay from './common/LoadingOverlay.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useConfirm } from '../context/ConfirmContext.jsx'

const DEFAULT_TEMPLATES = {
  trinhDuyet: {
    subject: '{hoảTốc}[Cần duyệt] {tênHồSơ}',
    body: 'Xin chào {vaiTròNgườiNhận}: {tênNgườiNhận},\n\n{ngườiGửi} ({emailNgườiGửi}) đã trình duyệt hồ sơ "{tênHồSơ}".\n\nVui lòng đăng nhập hệ thống để xem và phê duyệt tại đây:\n{linkHệThống}',
  },
  giaoViec: {
    subject: '{hoảTốc}[Giao việc] {tênHồSơ}',
    body: 'Xin chào {vaiTròNgườiNhận}: {tênNgườiNhận},\n\n{ngườiGửi} ({emailNgườiGửi}) đã giao việc hồ sơ "{tênHồSơ}" cho bạn.\n\nNội dung: {nộiDungGiaoViec}\n\nVui lòng đăng nhập hệ thống để xem chi tiết và xử lý tại đây:\n{linkHệThống}',
  },
  phoiHop: {
    subject: '{hoảTốc}[Phối hợp] {tênHồSơ}',
    body: 'Xin chào {tênNgườiNhận},\n\nBạn được {tênNgườiGửi} giao phối hợp xử lý công việc hồ sơ "{tênHồSơ}".\n\nNội dung: {nộiDungPhoiHop}\n\nVui lòng đăng nhập hệ thống để xem chi tiết và phối hợp tại đây:\n{linkHệThống}',
  },
  phatHanh: {
    subject: '{hoảTốc}[SBM – Phát hành] {tênHồSơ}',
    body: 'Kính gửi {tênNgườiNhận},\n\n{tênNgườiGửi} đã phát hành văn bản "{tênHồSơ}". {linkTàiLiệu}\n\n{ghiChú}\n\nVui lòng đăng nhập hệ thống để xem tại đây:\n{linkHệThống}',
  },
  tuChoi: {
    subject: '{hoảTốc}[Từ chối] {tênHồSơ}',
    body: 'Xin chào {tênNgườiNhận},\n\n{ngườiGửi} ({emailNgườiGửi}) đã từ chối hồ sơ "{tênHồSơ}".\n\nLý do: {lyDoTuChoi}\n\nVui lòng đăng nhập hệ thống để chỉnh sửa và trình duyệt lại:\n{linkHệThống}',
  },
  tuChoiKetQua: {
    subject: '{hoảTốc}[Từ chối kết quả] {tênHồSơ}',
    body: 'Xin chào {tênNgườiNhận},\n\n{ngườiGửi} ({emailNgườiGửi}) đã từ chối kết quả xử lý hồ sơ "{tênHồSơ}".\n\nLý do: {lyDoTuChoi}\n\nVui lòng đăng nhập hệ thống để chỉnh sửa và hoàn thành lại:\n{linkHệThống}',
  },
}

const TEMPLATE_VARS = [
  { key: '{tênHồSơ}', desc: 'Tên hồ sơ' },
  { key: '{tênNgườiGửi}', desc: 'Tên người gửi' },
  { key: '{ngườiGửi}', desc: 'Tên đăng nhập người gửi' },
  { key: '{emailNgườiGửi}', desc: 'Email người gửi' },
  { key: '{vaiTròNgườiGửi}', desc: 'Vai trò người gửi (chức vụ cao nhất, loại Admin)' },
  { key: '{phòngBanNgườiGửi}', desc: 'Phòng ban người gửi' },
  { key: '{tênNgườiNhận}', desc: 'Tên người nhận' },
  { key: '{vaiTròNgườiNhận}', desc: 'Vai trò người nhận' },
  { key: '{phòngBanNgườiNhận}', desc: 'Phòng ban người nhận' },
  { key: '{linkHệThống}', desc: 'Link đăng nhập hệ thống' },
  { key: '{linkTàiLiệu}', desc: 'Link file đính kèm (nhiều file = nhiều link)' },
  { key: '{ngàyBanHành}', desc: 'Ngày ban hành (dd/mm/yyyy)' },
  { key: '{ngàyKếtThúc}', desc: 'Ngày kết thúc (dd/mm/yyyy)' },
  { key: '{ghiChú}', desc: 'Ghi chú của hồ sơ' },
  { key: '{lyDoTuChoi}', desc: 'Lý do từ chối (chỉ dùng trong email Từ chối)' },
  { key: '{nộiDungGiaoViec}', desc: 'Nội dung giao việc (chỉ dùng trong email Giao việc)' },
  { key: '{nộiDungPhoiHop}', desc: 'Nội dung phối hợp (chỉ dùng trong email Phối hợp)' },
  { key: '{hoảTốc}', desc: 'Tiền tố [HOẢ TỐC] nếu hồ sơ đánh dấu Khẩn' },
]

const TOP_TABS = [
  { key: 'general', label: 'Cài đặt chung', icon: 'settings' },
  { key: 'email', label: 'Email thông báo', icon: 'mail' },
]

export default function SettingsPage({ token, onCompanyNameChange, initialConfigs }) {
  const [activeTab, setActiveTab]           = useState('general')
  const [rootFolderId, setRootFolderId]     = useState('')
  const [rootFolderName, setRootFolderName] = useState('')
  const [companyName, setCompanyName]       = useState('')
  const [appUrl, setAppUrl]                 = useState('')
  const [templates, setTemplates]           = useState(DEFAULT_TEMPLATES)
  const [saving, setSaving]                 = useState(false)
  const [savingMail, setSavingMail]         = useState(false)
  const [clearingCache, setClearingCache]   = useState(false)
  const [loading, setLoading]               = useState(true)
  const [showPicker, setShowPicker]         = useState(false)
  const { showToast } = useToast()
  const confirm = useConfirm()

  useEffect(() => {
    // Dùng configs đã inject sẵn — không cần round trip
    if (initialConfigs) {
      if (initialConfigs.ROOT_FOLDER_ID)   setRootFolderId(initialConfigs.ROOT_FOLDER_ID)
      if (initialConfigs.ROOT_FOLDER_NAME) setRootFolderName(initialConfigs.ROOT_FOLDER_NAME)
      if (initialConfigs.COMPANY_NAME)     setCompanyName(initialConfigs.COMPANY_NAME)
      if (initialConfigs.APP_URL)          setAppUrl(initialConfigs.APP_URL)
      if (initialConfigs.MAIL_TEMPLATES) {
        try { setTemplates({ ...DEFAULT_TEMPLATES, ...JSON.parse(initialConfigs.MAIL_TEMPLATES) }) } catch (_) {}
      }
      setLoading(false)
      return
    }
    // Fallback: 1 lần gọi thay vì 5
    async function load() {
      try {
        const configs = await gasCall('api_getConfigs', token, [
          'ROOT_FOLDER_ID', 'ROOT_FOLDER_NAME', 'COMPANY_NAME', 'MAIL_TEMPLATES', 'APP_URL',
        ])
        if (configs.ROOT_FOLDER_ID)   setRootFolderId(configs.ROOT_FOLDER_ID)
        if (configs.ROOT_FOLDER_NAME) setRootFolderName(configs.ROOT_FOLDER_NAME)
        if (configs.COMPANY_NAME)     setCompanyName(configs.COMPANY_NAME)
        if (configs.APP_URL)          setAppUrl(configs.APP_URL)
        if (configs.MAIL_TEMPLATES) {
          try { setTemplates({ ...DEFAULT_TEMPLATES, ...JSON.parse(configs.MAIL_TEMPLATES) }) } catch (_) {}
        }
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
      await gasCall('api_setConfig', token, 'APP_URL', appUrl)
      onCompanyNameChange && onCompanyNameChange(companyName)
      showToast('Đã lưu cài đặt thành công', 'success')
    } catch (err) {
      showToast('Lỗi: ' + err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  function setTpl(type, field, value) {
    setTemplates(t => ({ ...t, [type]: { ...t[type], [field]: value } }))
  }

  async function handleClearCache() {
    if (!await confirm('Xóa toàn bộ cache? Server sẽ đọc lại dữ liệu từ sheet ngay lập tức.')) return
    setClearingCache(true)
    try {
      await gasCall('api_clearCache', token)
      showToast('Đã xóa toàn bộ cache', 'success')
    } catch (err) {
      showToast('Lỗi: ' + err.message, 'error')
    } finally {
      setClearingCache(false)
    }
  }

  async function handleSaveMail() {
    setSavingMail(true)
    try {
      await gasCall('api_setConfig', token, 'MAIL_TEMPLATES', JSON.stringify(templates))
      showToast('Đã lưu cài đặt email', 'success')
    } catch (err) {
      showToast('Lỗi: ' + err.message, 'error')
    } finally {
      setSavingMail(false)
    }
  }

  function handleFolderSelect(folder) {
    setRootFolderId(folder.id)
    setRootFolderName(folder.name)
    setShowPicker(false)
  }

  if (loading) {
    return (
      <div className="max-w-3xl">
        <div className="bg-white rounded-2xl shadow-card p-6">
          <p className="text-sm text-on-surface-variant">Đang tải cài đặt…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Top-level tabs */}
      <div className="flex border-b border-outline-variant/60">
        {TOP_TABS.map(t => (
          <button key={t.key} type="button" onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline-variant'
            }`}>
            <Icon name={t.icon} size={18} />
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'general' && (
        <div className="bg-white rounded-2xl shadow-card p-6 space-y-5">
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
              <label className="block text-sm font-medium text-on-surface mb-1">Link SSO Portal</label>
              <input
                type="url"
                value={appUrl}
                onChange={e => setAppUrl(e.target.value)}
                placeholder="VD: https://script.google.com/macros/s/.../exec"
                className="w-full bg-surface-container-low rounded-xl px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant border border-transparent focus:border-primary focus:outline-none transition-colors"
              />
              <p className="text-xs text-on-surface-variant mt-1">Dùng trong email thông báo để người nhận click vào đăng nhập</p>
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
              className="flex items-center gap-2 bg-accent text-white px-5 py-2 rounded-full text-sm font-medium hover:bg-accent-hover transition-colors shadow-md3-1 disabled:opacity-60">
              <Icon name="save" size={16} />
              {saving ? 'Đang lưu…' : 'Lưu cài đặt'}
            </button>
          </form>
        </div>
      )}

      {activeTab === 'general' && (
        <div className="bg-white rounded-2xl shadow-card p-6">
          <h3 className="text-sm font-medium text-on-surface mb-1">Xóa cache dữ liệu</h3>
          <p className="text-xs text-on-surface-variant mb-4">Buộc server đọc lại dữ liệu trực tiếp từ sheet, bỏ qua cache 10 phút. Dùng khi bạn sửa dữ liệu thẳng trong Google Sheets.</p>
          <button type="button" onClick={handleClearCache} disabled={clearingCache}
            className="flex items-center gap-2 bg-error text-white px-5 py-2 rounded-full text-sm font-medium hover:bg-error/90 transition-colors shadow-md3-1 disabled:opacity-60">
            <Icon name="delete_sweep" size={16} />
            {clearingCache ? 'Đang xóa…' : 'Xóa cache'}
          </button>
        </div>
      )}

      {activeTab === 'email' && (
        <div className="bg-white rounded-2xl shadow-card p-6 space-y-5">
          <div className="bg-surface-container-low rounded-xl px-4 py-3">
            <p className="text-xs font-medium text-on-surface-variant mb-1.5">Biến hỗ trợ:</p>
            <div className="flex flex-wrap gap-2">
              {TEMPLATE_VARS.map(v => (
                <span key={v.key} className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full font-mono">
                  {v.key} <span className="font-sans text-on-surface-variant">— {v.desc}</span>
                </span>
              ))}
            </div>
          </div>

          <MailTabs templates={templates} onSetTpl={setTpl} />

          <button type="button" onClick={handleSaveMail} disabled={savingMail}
            className="flex items-center gap-2 bg-accent text-white px-5 py-2 rounded-full text-sm font-medium hover:bg-accent-hover transition-colors shadow-md3-1 disabled:opacity-60">
            <Icon name="save" size={16} />
            {savingMail ? 'Đang lưu…' : 'Lưu cài đặt email'}
          </button>
        </div>
      )}

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

const MAIL_TABS = [
  { key: 'trinhDuyet', label: 'Trình duyệt', icon: 'send', desc: 'Gửi cho Giám đốc khi có hồ sơ cần duyệt' },
  { key: 'giaoViec', label: 'Giao việc', icon: 'assignment_ind', desc: 'Gửi cho Phụ trách (TO) và Phối hợp (CC) khi Giám đốc giao việc' },
  { key: 'phoiHop', label: 'Phối hợp', icon: 'groups', desc: 'Gửi cho người phối hợp MỚI (người nhận chính) khi Phụ trách bổ sung lúc nhận việc' },
  { key: 'phatHanh', label: 'Phát hành', icon: 'mark_email_read', desc: 'Gửi khi phát hành hồ sơ cho người nhận' },
  { key: 'tuChoi', label: 'Từ chối', icon: 'cancel', desc: 'Gửi cho Văn thư khi Giám đốc từ chối hồ sơ (kèm lý do)' },
  { key: 'tuChoiKetQua', label: 'Từ chối kết quả', icon: 'unpublished', desc: 'Gửi cho Phụ trách khi Giám đốc từ chối kết quả xử lý (kèm lý do)' },
  { key: 'ycPhatHanh', label: 'YC Phát hành', icon: 'publish', desc: 'Gửi cho người tạo hồ sơ khi Giám đốc yêu cầu phát hành (kèm lý do)' },
]

function MailTabs({ templates, onSetTpl }) {
  const [active, setActive] = useState(MAIL_TABS[0].key)
  const tab = MAIL_TABS.find(t => t.key === active)
  const tpl = templates[active] || {}
  return (
    <div>
      <div className="flex border-b border-outline-variant/60 mb-4">
        {MAIL_TABS.map(t => (
          <button key={t.key} type="button" onClick={() => setActive(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              active === t.key
                ? 'border-secondary text-secondary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline-variant'
            }`}>
            <Icon name={t.icon} size={16} />
            {t.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-on-surface-variant mb-3">{tab.desc}</p>
      <TemplateSection tpl={tpl} onChange={(field, val) => onSetTpl(active, field, val)} />
    </div>
  )
}

function TemplateSection({ tpl, onChange }) {
  const iCls = 'w-full bg-surface-container-low rounded-xl px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant border border-transparent focus:border-primary focus:outline-none transition-colors'
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-on-surface-variant mb-1">Tiêu đề</label>
        <input className={iCls} value={tpl?.subject || ''} onChange={e => onChange('subject', e.target.value)} placeholder="VD: [Cần duyệt] {docName}" />
      </div>
      <div>
        <label className="block text-xs font-medium text-on-surface-variant mb-1">Nội dung</label>
        <textarea className={iCls + ' resize-none h-40'} value={tpl?.body || ''} onChange={e => onChange('body', e.target.value)} placeholder="Nội dung email..." />
      </div>
    </div>
  )
}
