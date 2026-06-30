import type { LabelRepository } from '../domain/label-repository'
import type { ActivityLog } from '../domain/activity-log'
import type { Label } from '../domain/models'
import type { Session } from '../domain/session'

export interface LabelService {
  labelList(session: Session): Label[]
  labelAdd(session: Session, data: { name?: string; color?: string }): Label
  labelUpdate(session: Session, id: number, data: Partial<{ name: string; color: string }>): void
  labelRemove(session: Session, id: number): void
}

export function createLabelService(repo: LabelRepository, activityLog: ActivityLog): LabelService {
  return {
    labelList(_session) {
      return repo.list()
    },

    labelAdd(session, data) {
      if (!data || !String(data.name || '').trim()) {
        throw new Error('Tên nhãn không được để trống')
      }
      const rec = repo.add({ name: data.name as string, color: data.color || '' })
      activityLog.log(session, 'Tạo nhãn', 'Nhãn', rec.id, rec.name)
      return rec
    },

    labelUpdate(session, id, data) {
      if (data && data.name !== undefined && !String(data.name).trim()) {
        throw new Error('Tên nhãn không được để trống')
      }
      repo.update(id, data)
      activityLog.log(session, 'Cập nhật nhãn', 'Nhãn', id, (data && data.name) || '')
    },

    labelRemove(session, id) {
      repo.remove(id)
      activityLog.log(session, 'Xóa nhãn', 'Nhãn', id, '')
    },
  }
}
