import { parsePhuTrach, isPhuTrach, getAvailableActions } from '../lib/workflowPermissions'

// ── parseAssignees ──────────────────────────────────────────────────────────

describe('parsePhuTrach', () => {
  test('returns [] for null/undefined/empty', () => {
    expect(parsePhuTrach(null)).toEqual([])
    expect(parsePhuTrach(undefined)).toEqual([])
    expect(parsePhuTrach('')).toEqual([])
  })

  test('parses JSON array string of usernames', () => {
    expect(parsePhuTrach('["alice","bob"]')).toEqual(['alice', 'bob'])
  })

  test('parses JSON array string of numeric ids and stringifies them', () => {
    expect(parsePhuTrach('[5,11]')).toEqual(['5', '11'])
  })

  test('treats non-JSON string as single-element array', () => {
    expect(parsePhuTrach('alice')).toEqual(['alice'])
  })

  test('accepts array input directly', () => {
    expect(parsePhuTrach(['alice', 'bob'])).toEqual(['alice', 'bob'])
  })

  test('returns single-element array when JSON parse fails', () => {
    // Malformed JSON falls through to plain-string handling
    expect(parsePhuTrach('[bad')).toEqual(['[bad'])
  })
})

// ── isAssignee ──────────────────────────────────────────────────────────────

describe('isAssignee', () => {
  test('matches when Phụ trách stored as username and session has same username', () => {
    const doc = { 'Phụ trách': '["tpkythuat@gmail.com"]' }
    const session = { userId: 10, username: 'tpkythuat@gmail.com' }
    expect(isPhuTrach(doc, session)).toBe(true)
  })

  test('matches when Phụ trách stored as userId and session has same userId', () => {
    const doc = { 'Phụ trách': '[10]' }
    const session = { userId: 10, username: 'tpkythuat@gmail.com' }
    expect(isPhuTrach(doc, session)).toBe(true)
  })

  test('does NOT match when stored username belongs to different user (regression for tpkehoach bug)', () => {
    // Bug repro: doc assigned to tpkythuat but Phụ trách stored as tpkehoach
    // tpkehoach should NOT see the action even though their username matches the stored value
    // (We can't fix that here — but we ensure isAssignee is strictly value-comparison, no fuzzy logic)
    const doc = { 'Phụ trách': '["tpkehoach@gmail.com"]' }
    const tpkythuatSession = { userId: 10, username: 'tpkythuat@gmail.com' }
    expect(isPhuTrach(doc, tpkythuatSession)).toBe(false)
  })

  test('does NOT match when Phụ trách is empty', () => {
    expect(isPhuTrach({ 'Phụ trách': '' }, { userId: 10, username: 'alice' })).toBe(false)
  })

  test('does NOT match when session missing', () => {
    expect(isPhuTrach({ 'Phụ trách': '["alice"]' }, null)).toBe(false)
    expect(isPhuTrach({ 'Phụ trách': '["alice"]' }, undefined)).toBe(false)
  })

  test('matches with multiple assignees', () => {
    const doc = { 'Phụ trách': '["alice","bob"]' }
    expect(isPhuTrach(doc, { userId: 1, username: 'bob' })).toBe(true)
  })

  test('handles userId as string-typed session field', () => {
    const doc = { 'Phụ trách': '["10"]' }
    expect(isPhuTrach(doc, { userId: '10', username: 'x' })).toBe(true)
  })
})

// ── getAvailableActions ─────────────────────────────────────────────────────

const doc = (overrides) => Object.assign({ 'Tình trạng': '', 'Phụ trách': '' }, overrides)
const session = (overrides) => Object.assign({ role: 'Nhân viên', userId: 1, username: 'u1' }, overrides)

describe('getAvailableActions — Văn thư', () => {
  test('returns [] when status="Chờ duyệt" (Văn thư cannot transition from preview)', () => {
    // Văn thư's transitions (trinhDuyet/luuTaiLieu) happen in the create/edit modal, not preview
    expect(getAvailableActions(doc({ 'Tình trạng': 'Chờ duyệt' }), session({ role: 'Văn thư' }))).toEqual([])
  })

  test('returns [] when Văn thư views a doc they are not Phụ trách of', () => {
    expect(getAvailableActions(doc({ 'Tình trạng': 'Chờ xử lý' }), session({ role: 'Văn thư' }))).toEqual([])
  })
})

describe('getAvailableActions — Giám đốc', () => {
  test('returns ["giaoViec"] when status="Chờ duyệt"', () => {
    const actions = getAvailableActions(doc({ 'Tình trạng': 'Chờ duyệt' }), session({ role: 'Giám đốc' }))
    expect(actions.map(a => a.key)).toEqual(['giaoViec'])
  })

  test('returns ["thuHoi"] when status="Chờ xử lý" — does NOT include "nhanViec" even if assigned', () => {
    const d = doc({ 'Tình trạng': 'Chờ xử lý', 'Phụ trách': '["gd"]' })
    const actions = getAvailableActions(d, session({ role: 'Giám đốc', username: 'gd' }))
    expect(actions.map(a => a.key)).toEqual(['thuHoi'])
  })

  test('returns [] when status="Đang xử lý"', () => {
    expect(getAvailableActions(doc({ 'Tình trạng': 'Đang xử lý' }), session({ role: 'Giám đốc' }))).toEqual([])
  })
})

describe('getAvailableActions — Phụ trách (non-admin, non-Giám đốc)', () => {
  test('returns ["nhanViec"] when status="Chờ xử lý" and user is Phụ trách', () => {
    const d = doc({ 'Tình trạng': 'Chờ xử lý', 'Phụ trách': '["tpkythuat@gmail.com"]' })
    const s = session({ role: 'Trưởng phòng', userId: 10, username: 'tpkythuat@gmail.com' })
    const actions = getAvailableActions(d, s)
    expect(actions.map(a => a.key)).toEqual(['nhanViec'])
  })

  test('REGRESSION: tpkythuat sees nhanViec even if Phụ trách stored as username with userId match fallback', () => {
    const d = doc({ 'Tình trạng': 'Chờ xử lý', 'Phụ trách': '[10]' })
    const s = session({ role: 'Trưởng phòng', userId: 10, username: 'tpkythuat@gmail.com' })
    expect(getAvailableActions(d, s).map(a => a.key)).toEqual(['nhanViec'])
  })

  test('returns ["hoanThanh"] when status="Đang xử lý" and user is Phụ trách', () => {
    const d = doc({ 'Tình trạng': 'Đang xử lý', 'Phụ trách': '["alice"]' })
    const actions = getAvailableActions(d, session({ role: 'Nhân viên', username: 'alice' }))
    expect(actions.map(a => a.key)).toEqual(['hoanThanh'])
  })

  test('returns [] when user is NOT Phụ trách (regression for tpkehoach bug)', () => {
    const d = doc({ 'Tình trạng': 'Chờ xử lý', 'Phụ trách': '["tpkythuat@gmail.com"]' })
    const tpkehoach = session({ role: 'Trưởng phòng', userId: 11, username: 'tpkehoach@gmail.com' })
    expect(getAvailableActions(d, tpkehoach)).toEqual([])
  })

  test('returns [] when Phụ trách user but status not actionable', () => {
    const d = doc({ 'Tình trạng': 'Hoàn thành', 'Phụ trách': '["alice"]' })
    expect(getAvailableActions(d, session({ role: 'Nhân viên', username: 'alice' }))).toEqual([])
  })
})

describe('getAvailableActions — admin / Quản trị viên', () => {
  test('admin sees giaoViec when status="Chờ duyệt"', () => {
    expect(getAvailableActions(doc({ 'Tình trạng': 'Chờ duyệt' }), session({ role: 'admin' })).map(a => a.key))
      .toEqual(['giaoViec'])
  })

  test('admin sees both thuHoi and nhanViec when status="Chờ xử lý"', () => {
    expect(getAvailableActions(doc({ 'Tình trạng': 'Chờ xử lý' }), session({ role: 'admin' })).map(a => a.key))
      .toEqual(['thuHoi', 'nhanViec'])
  })

  test('admin sees hoanThanh when status="Đang xử lý"', () => {
    expect(getAvailableActions(doc({ 'Tình trạng': 'Đang xử lý' }), session({ role: 'admin' })).map(a => a.key))
      .toEqual(['hoanThanh'])
  })

  test('Quản trị viên behaves identically to admin', () => {
    const d = doc({ 'Tình trạng': 'Chờ xử lý' })
    const adminA = getAvailableActions(d, session({ role: 'admin' })).map(a => a.key)
    const qtv = getAvailableActions(d, session({ role: 'Quản trị viên' })).map(a => a.key)
    expect(qtv).toEqual(adminA)
  })
})

describe('getAvailableActions — empty/missing inputs', () => {
  test('returns [] when session is null', () => {
    expect(getAvailableActions(doc({ 'Tình trạng': 'Chờ xử lý' }), null)).toEqual([])
  })

  test('returns [] when doc is null', () => {
    expect(getAvailableActions(null, session())).toEqual([])
  })
})
