// Hợp đồng domain Nhãn — không biết transport. args khớp api_* phía server.
import type { Label } from '../../../core/domain/models'

export type Transport = (method: string, args: unknown[]) => Promise<unknown>

export interface LabelsApi {
  list(): Promise<Label[]>
  add(data: Omit<Label, 'id'>): Promise<Label>
  update(id: number, data: Partial<Omit<Label, 'id'>>): Promise<boolean>
  remove(id: number): Promise<boolean>
}

export function makeLabels(call: Transport): LabelsApi {
  return {
    list: () => call('api_getLabels', ['__token__']) as Promise<Label[]>,
    add: (data) => call('api_addLabel', ['__token__', data]) as Promise<Label>,
    update: (id, data) => call('api_updateLabel', ['__token__', id, data]) as Promise<boolean>,
    remove: (id) => call('api_deleteLabel', ['__token__', id]) as Promise<boolean>,
  }
}
