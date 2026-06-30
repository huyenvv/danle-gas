// Tests for SheetsDataStore.find() via gviz (server-side pushdown).
// Three suites: builder unit, parser unit, find() integration with mocked UrlFetchApp.

import './mocks/gas'
import { resetGAS, SpreadsheetAppMock, UrlFetchAppMock } from './mocks/gas'
import { buildGvizTq, parseGvizRows, parseGvizCount, colLetter, gvizLit } from '../src/adapters/gas/gviz'
import { createSheetsDataStore } from '../src/adapters/gas/sheets-data-store'
import { sheetHeaders } from '../src/core/schema'

// ── Helpers ────────────────────────────────────────────────────────────────────

function gvizResponseBody(
  colLabels: string[],
  rows: (string | number | null)[][],
  status?: 'ok' | 'error',
): string {
  if (status === 'error') {
    return 'google.visualization.Query.setResponse({"status":"error","errors":[{"detailed_message":"bad query"}]});'
  }
  const cols = colLabels.map(label => ({ label }))
  const tableRows = rows.map(r => ({ c: r.map(v => (v == null ? { v: null } : { v })) }))
  const obj = { status: 'ok', table: { cols, rows: tableRows } }
  return '/*O_o*/\ngoogle.visualization.Query.setResponse(' + JSON.stringify(obj) + ');'
}

function countResponseBody(n: number): string {
  const obj = { status: 'ok', table: { cols: [{ label: 'count ID' }], rows: [{ c: [{ v: n }] }] } }
  return 'google.visualization.Query.setResponse(' + JSON.stringify(obj) + ');'
}

// label headers for 'labels' collection
const LABEL_HEADERS = sheetHeaders('labels')   // ['ID', 'Tên nhãn', 'Màu sắc']
const LABEL_FIELD_TO_HEADER: Record<string, string> = {
  id: 'ID', name: 'Tên nhãn', color: 'Màu sắc',
}

// ── Suite 1: colLetter + buildGvizTq unit tests ────────────────────────────────

describe('colLetter()', () => {
  test('0→A, 25→Z, 26→AA, 27→AB', () => {
    expect(colLetter(0)).toBe('A')
    expect(colLetter(25)).toBe('Z')
    expect(colLetter(26)).toBe('AA')
    expect(colLetter(27)).toBe('AB')
  })
})

describe('gvizLit()', () => {
  test('string without single-quote → wrapped in single quotes', () => {
    expect(gvizLit('hello')).toBe("'hello'")
  })
  test('string with single-quote → wrapped in double quotes', () => {
    expect(gvizLit("o'clock")).toBe('"o\'clock"')
  })
  test('number → bare', () => {
    expect(gvizLit(42)).toBe('42')
  })
  test('boolean → bare', () => {
    expect(gvizLit(true)).toBe('true')
  })
  test("string with single-quote but no double-quote → wraps in double quotes", () => {
    // "#f'f" → has ' but not " → wraps in "
    expect(gvizLit("#f'f")).toBe('"#f\'f"')
  })
  test("string with both ' and \" → strips ' then wraps in ' (data-loss documented)", () => {
    // O'Brien "x" has both quotes → falls through to strip-' branch
    // strips the apostrophe, wraps in single quotes
    expect(gvizLit('O\'Brien "x"')).toBe("'OBrien \"x\"'")
  })
})

describe('buildGvizTq()', () => {
  test('basic equality + orderBy + limit + offset', () => {
    const tq = buildGvizTq(
      LABEL_FIELD_TO_HEADER,
      {
        where: [{ field: 'color', op: '=', value: "#f'f" }],
        orderBy: [{ field: 'name', dir: 'asc' }],
        limit: 5,
        offset: 10,
      },
      LABEL_HEADERS,
    )
    // color = 'Màu sắc' = 3rd header (index 2) → col C
    // name = 'Tên nhãn' = 2nd header (index 1) → col B
    // "#f'f" has a single-quote → wraps in double-quotes
    expect(tq).toContain('where C = "#f\'f"')
    expect(tq).toContain('order by B asc')
    expect(tq).toContain('limit 5')
    expect(tq).toContain('offset 10')
    expect(tq).toMatch(/^select \*/)
  })

  test('contains operator', () => {
    const tq = buildGvizTq(
      LABEL_FIELD_TO_HEADER,
      { where: [{ field: 'name', op: 'contains', value: 'bug' }] },
      LABEL_HEADERS,
    )
    expect(tq).toContain("B contains 'bug'")
  })

  test('no filters/order — bare select *', () => {
    const tq = buildGvizTq(LABEL_FIELD_TO_HEADER, {}, LABEL_HEADERS)
    expect(tq).toBe('select *')
  })

  test('multiple where clauses joined with AND', () => {
    const tq = buildGvizTq(
      LABEL_FIELD_TO_HEADER,
      {
        where: [
          { field: 'id', op: '=', value: 1 },
          { field: 'color', op: '!=', value: '#fff' },
        ],
      },
      LABEL_HEADERS,
    )
    expect(tq).toContain('where A = 1 and C != ')
  })

  test('selectExpr override → select count(A)', () => {
    const tq = buildGvizTq(LABEL_FIELD_TO_HEADER, {}, LABEL_HEADERS, 'count(A)')
    expect(tq).toBe('select count(A)')
  })

  test('unknown field throws', () => {
    expect(() =>
      buildGvizTq(LABEL_FIELD_TO_HEADER, { where: [{ field: 'nonexistent', op: '=', value: 1 }] }, LABEL_HEADERS),
    ).toThrow('Không tìm thấy mapping cho field: nonexistent')
  })
})

// ── Suite 2: parseGvizRows + parseGvizCount unit tests ────────────────────────

describe('parseGvizRows()', () => {
  test('two label rows parsed to domain records', () => {
    const body = gvizResponseBody(
      LABEL_HEADERS,
      [
        [1, 'Bug', '#e53935'],
        [2, 'Feature', '#1e88e5'],
      ],
    )
    const rows = parseGvizRows(body, 'labels', LABEL_HEADERS)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({ id: 1, name: 'Bug', color: '#e53935' })
    expect(rows[1]).toEqual({ id: 2, name: 'Feature', color: '#1e88e5' })
  })

  test('null cell → empty string in domain record', () => {
    const body = gvizResponseBody(LABEL_HEADERS, [[3, null, '#fff']])
    const rows = parseGvizRows(body, 'labels', LABEL_HEADERS)
    expect(rows[0].name).toBe('')
  })

  test('error status → throws', () => {
    const body = gvizResponseBody([], [], 'error')
    expect(() => parseGvizRows(body, 'labels', LABEL_HEADERS)).toThrow('Lỗi truy vấn gviz')
  })

  test('garbled body → throws', () => {
    expect(() => parseGvizRows('not json at all', 'labels', LABEL_HEADERS)).toThrow()
  })
})

describe('parseGvizCount()', () => {
  test('returns count from count query response', () => {
    expect(parseGvizCount(countResponseBody(42))).toBe(42)
  })

  test('empty rows → 0', () => {
    const body = 'google.visualization.Query.setResponse({"status":"ok","table":{"cols":[],"rows":[]}});'
    expect(parseGvizCount(body)).toBe(0)
  })
})

// ── Suite 3: SheetsDataStore.find() integration (mocked UrlFetchApp) ──────────

beforeEach(() => {
  resetGAS()
  SpreadsheetAppMock._addSheet('Nhãn', [['ID', 'Tên nhãn', 'Màu sắc']])
})

describe('SheetsDataStore.find() — mocked gviz fetch', () => {
  test('returns parsed rows + total from two gviz calls', () => {
    // Data response: 2 label rows
    UrlFetchAppMock._pushResponse({
      code: 200,
      body: gvizResponseBody(LABEL_HEADERS, [[1, 'Bug', '#e53935'], [2, 'Feature', '#1e88e5']]),
    })
    // Count response: total = 7
    UrlFetchAppMock._pushResponse({ code: 200, body: countResponseBody(7) })

    const ds = createSheetsDataStore()
    const page = ds.find('labels', { limit: 2, offset: 0 })

    expect(page.rows).toHaveLength(2)
    expect(page.rows[0]).toEqual({ id: 1, name: 'Bug', color: '#e53935' })
    expect(page.total).toBe(7)
  })

  test('data gviz URL contains encoded tq with limit/offset', () => {
    UrlFetchAppMock._pushResponse({ code: 200, body: gvizResponseBody(LABEL_HEADERS, []) })
    UrlFetchAppMock._pushResponse({ code: 200, body: countResponseBody(0) })

    const ds = createSheetsDataStore()
    ds.find('labels', {
      where: [{ field: 'color', op: '=', value: '#fff' }],
      limit: 5,
      offset: 10,
    })

    const requests = UrlFetchAppMock._requests
    // First request = data query
    const dataUrl = requests[0].url
    expect(dataUrl).toContain('gviz/tq')
    expect(dataUrl).toContain('gid=')
    // Decoded tq should have: where C = '#fff' limit 5 offset 10
    const tqMatch = dataUrl.match(/[?&]tq=([^&]+)/)
    expect(tqMatch).not.toBeNull()
    const tq = decodeURIComponent(tqMatch![1])
    expect(tq).toContain("C = '#fff'")
    expect(tq).toContain('limit 5')
    expect(tq).toContain('offset 10')
    // Second request = count query
    const countUrl = requests[1].url
    const countTqMatch = countUrl.match(/[?&]tq=([^&]+)/)
    expect(countTqMatch).not.toBeNull()
    const countTq = decodeURIComponent(countTqMatch![1])
    expect(countTq).toContain('count(A)')
    expect(countTq).toContain("C = '#fff'")
    // Count query must NOT have limit/offset
    expect(countTq).not.toContain('limit')
    expect(countTq).not.toContain('offset')
  })

  test('Authorization Bearer header is sent', () => {
    UrlFetchAppMock._pushResponse({ code: 200, body: gvizResponseBody(LABEL_HEADERS, []) })
    UrlFetchAppMock._pushResponse({ code: 200, body: countResponseBody(0) })

    const ds = createSheetsDataStore()
    ds.find('labels', {})

    const opts = UrlFetchAppMock._requests[0].options as { headers?: Record<string, string> }
    expect(opts?.headers?.['Authorization']).toBe('Bearer mock-oauth-token')
  })

  test('HTTP error on data fetch → throws', () => {
    UrlFetchAppMock._pushResponse({ code: 401, body: '' })

    const ds = createSheetsDataStore()
    expect(() => ds.find('labels', {})).toThrow('Lỗi gviz fetch (mã 401)')
  })

  test('HTTP error on count fetch → throws (not silent wrong total)', () => {
    // Data succeeds, count returns non-200 → must throw, not silently fall back to rows.length
    UrlFetchAppMock._pushResponse({ code: 200, body: gvizResponseBody(LABEL_HEADERS, [[1, 'Bug', '#e53935']]) })
    UrlFetchAppMock._pushResponse({ code: 503, body: '' })

    const ds = createSheetsDataStore()
    expect(() => ds.find('labels', { limit: 1 })).toThrow('gviz count query failed: HTTP 503')
  })

  test('empty query {} → rows=[] total=0 on empty sheet data', () => {
    UrlFetchAppMock._pushResponse({ code: 200, body: gvizResponseBody(LABEL_HEADERS, []) })
    UrlFetchAppMock._pushResponse({ code: 200, body: countResponseBody(0) })

    const ds = createSheetsDataStore()
    const page = ds.find('labels', {})
    expect(page.rows).toEqual([])
    expect(page.total).toBe(0)
  })
})
