/**
 * @module query-builder
 *
 * Lazy, fluent QueryBuilder over the {@link DataStore} `find()` primitive.
 *
 * Inspired by EF-Core's deferred LINQ queries: builder methods accumulate a
 * {@link Query} spec **without touching the store**. Execution is deferred until
 * one of the materializer methods is called (`page`, `toArray`, `first`, `count`).
 *
 * @example
 * ```ts
 * // Nothing runs here — spec accumulates in memory.
 * const qb = query(store, 'tasks')
 *   .where('status', '=', 'done')
 *   .orderBy('deadline')
 *   .limit(50)
 *
 * // Only NOW does store.find get called.
 * const result = qb.page()
 * ```
 */

import type { Collection, DataStore, DomainRecord, FilterOp, Page, Query } from './ports/data-store'

/**
 * Fluent, deferred query builder for a single collection.
 *
 * Build a query by chaining {@link where}, {@link orderBy}, {@link limit},
 * and {@link offset}. Nothing hits the store until a materializer is called.
 */
export class QueryBuilder {
  private readonly store: DataStore
  private readonly collection: Collection
  private spec: Query

  /** @internal Use {@link query} factory function, not the constructor directly. */
  constructor(store: DataStore, collection: Collection) {
    this.store = store
    this.collection = collection
    this.spec = {}
  }

  // ── Builder methods (deferred — never call store.find) ──────────────────

  /**
   * Append a filter condition. Multiple calls are AND-combined.
   *
   * @param field Domain field name (ASCII). Adapters translate to storage column.
   * @param op    Comparison operator: `=`, `!=`, `<`, `>`, `>=`, `<=`, `contains`.
   * @param value Scalar value to compare against.
   * @returns `this` for chaining.
   */
  where(field: string, op: FilterOp, value: string | number | boolean): this {
    this.spec.where = [...(this.spec.where ?? []), { field, op, value }]
    return this
  }

  /**
   * Append a sort key. Multiple calls produce compound ORDER BY.
   *
   * @param field Domain field name.
   * @param dir   Sort direction. Defaults to `'asc'`.
   * @returns `this` for chaining.
   */
  orderBy(field: string, dir: 'asc' | 'desc' = 'asc'): this {
    this.spec.orderBy = [...(this.spec.orderBy ?? []), { field, dir }]
    return this
  }

  /**
   * Set the maximum number of rows to return.
   *
   * @param n Maximum row count.
   * @returns `this` for chaining.
   */
  limit(n: number): this {
    this.spec.limit = n
    return this
  }

  /**
   * Set the number of rows to skip before returning results.
   *
   * @param n Rows to skip.
   * @returns `this` for chaining.
   */
  offset(n: number): this {
    this.spec.offset = n
    return this
  }

  // ── Materializers (these call store.find) ──────────────────────────────

  /**
   * Execute the query and return a {@link Page}.
   *
   * `page.total` is the FULL match count **ignoring** limit/offset, useful for
   * building pagination UIs without a second COUNT query.
   *
   * @returns Page containing matched rows and total match count.
   */
  page(): Page {
    return this.store.find(this.collection, this.spec)
  }

  /**
   * Execute the query and return only the matched rows.
   *
   * @returns Array of matching {@link DomainRecord}s.
   */
  toArray(): DomainRecord[] {
    return this.page().rows
  }

  /**
   * Execute the query with `limit: 1` and return the first match or `null`.
   *
   * Overrides any previously set limit to avoid fetching unnecessary rows.
   *
   * @returns First matching record, or `null` if none.
   */
  first(): DomainRecord | null {
    return this.store.find(this.collection, { ...this.spec, limit: 1 }).rows[0] ?? null
  }

  /**
   * Execute the query and return the total match count (ignoring limit/offset).
   *
   * Strips `limit` and `offset` from the spec before calling `store.find` so
   * the builder itself guarantees correct count semantics — adapters need not
   * special-case these fields.
   *
   * @returns Total number of records matching the accumulated filters.
   */
  count(): number {
    return this.store.find(this.collection, { where: this.spec.where, orderBy: this.spec.orderBy }).total
  }
}

/**
 * Create a lazy {@link QueryBuilder} for `collection` backed by `store`.
 *
 * @param store      DataStore adapter to delegate to on materialisation.
 * @param collection Target collection name.
 * @returns A new, empty {@link QueryBuilder}. No store call is made yet.
 *
 * @example
 * ```ts
 * const page = query(store, 'tasks')
 *   .where('status', '=', 'done')
 *   .orderBy('deadline')
 *   .limit(50)
 *   .page()
 * ```
 */
export function query(store: DataStore, collection: Collection): QueryBuilder {
  return new QueryBuilder(store, collection)
}
