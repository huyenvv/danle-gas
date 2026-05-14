import { useState } from 'react'
import { mutate } from '../../utils/mutate.js'
import { useToast } from '../../context/ToastContext.jsx'
import { useConfirm } from '../../context/ConfirmContext.jsx'
import LabelModal from './LabelModal.jsx'

export default function LabelManager({ masterData, reloadMaster, token }) {
  const { showToast } = useToast()
  const { confirm } = useConfirm()
  const [modal, setModal] = useState({ open: false, mode: 'add', data: null })

  const handleSave = async (form, mode) => {
    try {
      if (mode === 'edit' && modal.data) await mutate('api_updateLabel', token, modal.data.ID, form)
      else await mutate('api_addLabel', token, form)
      showToast(mode === 'edit' ? 'Đã cập nhật' : 'Đã tạo nhãn', 'success')
      setModal({ open: false, mode: 'add', data: null })
      reloadMaster()
    } catch (e) { showToast(e.message, 'error') }
  }

  const handleEdit = (label) => {
    setModal({ open: true, mode: 'edit', data: label })
  }

  const handleDelete = async (l) => {
    const ok = await confirm('Xóa nhãn', `Xóa nhãn "${l['Tên nhãn']}"?`)
    if (!ok) return
    try { await mutate('api_deleteLabel', token, l.ID); showToast('Đã xóa', 'success'); reloadMaster() }
    catch (e) { showToast(e.message, 'error') }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-card p-4 flex flex-wrap gap-3 items-center">
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setModal({ open: true, mode: 'add', data: null })} className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent text-white rounded-full text-sm font-medium hover:bg-accent-hover transition-colors shadow-md3-1">
            <span className="material-symbols-outlined text-base">add</span>Tạo Nhãn
          </button>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl shadow-card divide-y divide-outline-variant/50">
        {(masterData.nhan || []).map(l => (
          <div key={l.ID} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-container-low/50 transition-colors">
            <div className="w-6 h-6 rounded-lg" style={{ background: l['Màu sắc'] }} />
            <span className="flex-1 text-sm font-medium text-on-surface">{l['Tên nhãn']}</span>
            <button onClick={() => handleEdit(l)} className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant"><span className="material-symbols-outlined text-base">edit</span></button>
            <button onClick={() => handleDelete(l)} className="p-1.5 rounded-lg hover:bg-error-container text-on-surface-variant hover:text-error"><span className="material-symbols-outlined text-base">delete</span></button>
          </div>
        ))}
        {(!masterData.nhan || masterData.nhan.length === 0) && <div className="text-center py-10 text-sm text-on-surface-variant">Chưa có nhãn nào</div>}
      </div>

      {modal.open && <LabelModal mode={modal.mode} data={modal.data} onSave={handleSave} onClose={() => setModal({ open: false, mode: 'add', data: null })} />}
    </div>
  )
}
