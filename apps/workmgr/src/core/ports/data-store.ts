/**
 * Collection-oriented CRUD + query port for the WorkMgr domain.
 *
 * Adapters map each {@link Collection} name to a concrete storage backend
 * (e.g. an SQLite table, a Google Sheets tab, an in-memory map). Consumers
 * depend only on this interface — swap the adapter without touching domain code.
 *
 * Field names throughout this interface are **domain names** (ASCII identifiers).
 * Each adapter is responsible for translating them to storage column names
 * (e.g. `'color'` → `'Màu sắc'` in a Vietnamese-headed Google Sheet).
 */

/** A plain key-value record returned/accepted by all DataStore methods. */
export type DomainRecord = Record<string, unknown>

/** Named collection keys known to the schema. */
export type Collection = 'labels' | 'activities' | 'audit'

/**
 * Comparison operator for a {@link Filter} condition.
 *
 * - `=` / `!=`          exact equality / inequality
 * - `<` / `>` / `<=` / `>=`  numeric/lexicographic ordering
 * - `contains`          substring match (case-sensitive; SQL: `LIKE '%value%'`)
 */
export type FilterOp = '=' | '!=' | '<' | '>' | '>=' | '<=' | 'contains'

/**
 * A single filter predicate applied to one field.
 *
 * @example
 * ```ts
 * { field: 'color', op: '=', value: '#fff' }
 * ```
 */
export interface Filter {
  /** Domain field name to filter on. */
  field: string
  /** Comparison operator. */
  op: FilterOp
  /** Scalar value to compare against. */
  value: string | number | boolean
}

/**
 * A single sort key.
 */
export interface Sort {
  /** Domain field name to sort by. */
  field: string
  /** Sort direction. */
  dir: 'asc' | 'desc'
}

/**
 * Declarative query specification passed to {@link DataStore.find}.
 *
 * All fields are optional — omit any combination; adapters treat missing
 * fields as "no constraint / no ordering / no limit".
 *
 * Multiple `where` entries are **AND-combined** — there is currently no OR
 * support. `orderBy` entries are applied left-to-right (compound sort).
 */
export interface Query {
  /**
   * Filter conditions. All entries must match (logical AND).
   * Field names are domain names; adapters translate to storage columns.
   */
  where?: Filter[]
  /**
   * Sort keys, applied in order (primary sort first).
   */
  orderBy?: Sort[]
  /**
   * Maximum number of rows to return. When omitted the adapter returns all
   * matching rows (potentially unbounded — use with care on large collections).
   */
  limit?: number
  /**
   * Number of matching rows to skip before returning results.
   * Combine with `limit` for cursor-style pagination.
   */
  offset?: number
}

/**
 * Result of {@link DataStore.find}.
 *
 * `total` reflects the **full match count** — the number of records that
 * satisfy the `where` filters, **ignoring** `limit` and `offset`. This lets
 * pagination UIs compute page counts without issuing a separate COUNT query.
 */
export interface Page {
  /** Rows returned for the current page (respects `limit` / `offset`). */
  rows: DomainRecord[]
  /**
   * Total records matching the filters, regardless of `limit`/`offset`.
   * Use this value to compute page counts in pagination UIs.
   */
  total: number
}

/**
 * Collection-oriented CRUD + query port.
 *
 * Adapters map each {@link Collection} to a concrete backend (SQLite table,
 * Google Sheets tab, in-memory store, etc.) and translate domain field names
 * to storage column names. Consumers depend only on this interface.
 */
export interface DataStore {
  /**
   * Return **all** records in `collection`.
   *
   * @warning This loads the **entire collection into memory**. Only use for
   * small / reference collections (e.g. `'labels'`) where the full dataset is
   * bounded and expected to be cache-friendly. For large or growing collections
   * (`'activities'`, `'audit'`), use {@link find} (or the `query()` builder)
   * instead — they push filtering and pagination down to the storage engine,
   * avoiding unbounded memory growth.
   *
   * @param collection Target collection.
   * @returns All records, in storage-native order.
   */
  getAll(collection: Collection): DomainRecord[]

  /**
   * Insert a new record and return it with the adapter-assigned `id`.
   *
   * The adapter assigns a unique `id` (e.g. SQLite `INTEGER PRIMARY KEY`,
   * next row number in Sheets). Callers must not set `id` in `rec`.
   *
   * @param collection Target collection.
   * @param rec        Fields for the new record (no `id`).
   * @returns The stored record including the new `id`.
   */
  insert(collection: Collection, rec: DomainRecord): DomainRecord

  /**
   * Partially update record `id` with the provided `fields` (PATCH semantics).
   *
   * Only the keys present in `fields` are written; other fields are unchanged.
   *
   * @param collection Target collection.
   * @param id         Record identifier (value of the `id` field).
   * @param fields     Partial fields to overwrite.
   * @throws If no record with `id` exists in the collection.
   */
  update(collection: Collection, id: string | number, fields: DomainRecord): void

  /**
   * Remove record `id` from `collection`.
   *
   * @param collection Target collection.
   * @param id         Record identifier.
   * @throws If no record with `id` exists in the collection.
   */
  remove(collection: Collection, id: string | number): void

  /**
   * Execute a declarative query pushed **down to the storage engine**.
   *
   * For SQL adapters this translates to WHERE / ORDER BY / LIMIT / OFFSET
   * clauses. For Google Sheets adapters it becomes a gviz query. Filtering
   * and pagination never happen in JS memory.
   *
   * @param collection Target collection.
   * @param query      Query spec (filters, sort, limit, offset). All fields
   *                   optional — pass `{}` to fetch all rows with a `total`.
   * @returns A {@link Page} whose `total` is the **full match count ignoring**
   *          `limit`/`offset`, so pagination UIs can compute page counts
   *          without a second query.
   *
   * @example
   * ```ts
   * const page = store.find('labels', {
   *   where: [{ field: 'color', op: '=', value: '#fff' }],
   *   orderBy: [{ field: 'name', dir: 'asc' }],
   *   limit: 10,
   *   offset: 0,
   * })
   * // page.total = full match count; page.rows = up to 10 records
   * ```
   */
  find(collection: Collection, query: Query): Page
}
