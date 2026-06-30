import { useState } from 'react'
import { mutate } from '../../utils/mutate.js'
import { useToast } from '../../context/ToastContext.jsx'
import { useConfirm } from '../../context/ConfirmContext.jsx'
import LabelModal from './LabelModal.jsx'

export default function LabelManager({ masterData, reloadMaster, token }) {
  const { showToast } = useToast()
  const { confirm } = useConfirm()
  const [modal, setModal] = useState({ open: false, mode: 'add', data: null })

  const labels = masterData.nhan || []

  const handleSave = async (form, mode) => {
    try {
      if (mode === 'edit' && modal.data) await mutate('api_updateLabel', token, modal.data.ID, form)
      else await mutate('api_addLabel', token, form)
      showToast(mode === 'edit' ? 'Đã cập nhật' : 'Đã tạo nhãn', 'success')
      setModal({ open: false, mode: 'add', data: null })
      reloadMaster()
    } catch (e) { showToast(e.message, 'error') }
  }

  const handleDelete = async (l) => {
    const ok = await confirm('Xóa nhãn', `Xóa nhãn "${l['Tên nhãn']}"?`)
    if (!ok) return
    try { await mutate('api_deleteLabel', token, l.ID); showToast('Đã xóa', 'success'); reloadMaster() }
    catch (e) { showToast(e.message, 'error') }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-card p-4 flex items-center gap-3">
        <span className="text-xs text-on-surface-variant whitespace-nowrap">{labels.length} nhãn</span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => reloadMaster()} title="Làm mới" className="w-9 h-9 flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container border border-outline-variant transition-colors">
            <span className="material-symbols-outlined text-base leading-none">refresh</span>
          </button>
          <button onClick={() => setModal({ open: true, mode: 'add', data: null })} className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent text-white rounded-full text-sm font-medium hover:bg-accent-hover transition-colors shadow-md3-1">
            <span className="material-symbols-outlined text-base">add</span>Tạo Nhãn
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        <table className="min-w-full text-sm">
          <thead><tr className="bg-surface-container-low border-b border-outline-variant">
            <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Màu</th>
            <th className="px-4 py-3 text-left font-semibold text-on-surface-variant text-xs uppercase tracking-wide">Tên nhãn</th>
            <th className="px-4 py-3"></th>
          </tr></thead>
          <tbody className="divide-y divide-outline-variant/40">
            {labels.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-10 text-center text-on-surface-variant">Chưa có nhãn nào</td></tr>
            )}
            {labels.map(l => (
              <tr key={l.ID} className="hover:bg-surface-container-low transition-colors">
                <td className="px-4 py-3">
                  <div className="w-6 h-6 rounded-lg" style={{ background: l['Màu sắc'] }} />
                </td>
                <td className="px-4 py-3 font-medium text-on-surface">{l['Tên nhãn']}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => setModal({ open: true, mode: 'edit', data: l })}
                      className="text-xs px-2.5 py-1 rounded-lg text-primary hover:bg-primary/10 transition-colors font-medium">Sửa</button>
                    <button onClick={() => handleDelete(l)}
                      className="text-xs px-2.5 py-1 rounded-lg text-error hover:bg-error/10 transition-colors font-medium">Xóa</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {labels.length > 0 && (
          <div className="px-4 py-3 border-t border-outline-variant/40 bg-surface-container-lowest">
            <span className="text-xs text-on-surface-variant">{labels.length} nhãn</span>
          </div>
        )}
      </div>

      {modal.open && <LabelModal mode={modal.mode} data={modal.data} onSave={handleSave} onClose={() => setModal({ open: false, mode: 'add', data: null })} />}
    </div>
  )
}
