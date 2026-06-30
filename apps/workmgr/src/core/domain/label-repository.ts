import type { DataStore, DomainRecord } from '../ports/data-store'
import type { Label } from './models'

/**
 * Repository interface for the `labels` collection.
 *
 * Sits directly on top of {@link DataStore} — it is a thin mapping layer that
 * converts raw {@link DomainRecord}s to typed {@link Label}s and vice-versa.
 *
 * **Validation responsibility:** `add` and `update` do NOT validate business
 * rules (uniqueness, non-empty name, etc.). That belongs to the service layer
 * above this interface. The repository itself only concerns itself with
 * storage read/write.
 */
export interface LabelRepository {
  /**
   * Return all labels in the collection, unfiltered.
   *
   * @returns Array of {@link Label}s (may be empty).
   */
  list(): Label[]

  /**
   * Persist a new label and return the saved record (with assigned `id`).
   *
   * @param fields `name` and `color` for the new label.
   * @returns The newly created {@link Label} with its storage-assigned `id`.
   */
  add(fields: { name: string; color: string }): Label

  /**
   * Apply a partial update to an existing label.
   *
   * Only the provided fields are changed; omitted fields are untouched.
   *
   * @param id     Numeric identifier of the label to update.
   * @param fields Partial `{ name, color }` — may include one or both keys.
   */
  update(id: number, fields: Partial<{ name: string; color: string }>): void

  /**
   * Delete a label by its numeric identifier.
   *
   * No-op if the id does not exist (behaviour delegated to the adapter).
   *
   * @param id Numeric identifier of the label to remove.
   */
  remove(id: number): void
}

function toLabel(r: DomainRecord): Label {
  return { id: Number(r.id), name: String(r.name ?? ''), color: String(r.color ?? '') }
}

export function createLabelRepository(ds: DataStore): LabelRepository {
  const C = 'labels' as const
  return {
    list: () => ds.getAll(C).map(toLabel),
    add: (fields) => toLabel(ds.insert(C, fields)),
    update: (id, fields) => ds.update(C, id, fields),
    remove: (id) => ds.remove(C, id),
  }
}
