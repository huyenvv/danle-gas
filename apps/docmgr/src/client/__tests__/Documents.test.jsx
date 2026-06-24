import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import MainApp from '../components/MainApp.jsx'
import gasCall from '../gasClient.js'
import { dataCache } from '../utils/dataCache.js'
import { useAuth } from '../context/AuthContext.jsx'
import {
  MOCK_TOKEN,
  MOCK_ADMIN_SESSION,
  MOCK_VIEWER_SESSION,
  MOCK_INITIAL_DATA,
  MOCK_DOCS,
} from './helpers/mockData.js'
import { renderWithProviders } from './helpers/render.jsx'

// ── Module mocks ──────────────────────────────────────────────────────────────

jest.mock('../gasClient.js')

jest.mock('../context/AuthContext.jsx', () => ({
  useAuth: jest.fn(),
  AuthProvider: ({ children }) => children,
}))

jest.mock('../utils/dataCache.js', () => ({
  dataCache: {
    get: jest.fn(() => null),
    set: jest.fn(),
    subscribe: jest.fn(() => () => {}),
    invalidate: jest.fn(),
    isStale: jest.fn(() => true),
    isTooOld: jest.fn(() => true),
  },
  prefetchLookups: jest.fn(() => Promise.resolve({})),
  refreshLookups:  jest.fn(() => Promise.resolve()),
  startPolling:    jest.fn(() => undefined),
  stopPolling:     jest.fn(),
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderMainApp() {
  return renderWithProviders(<MainApp />)
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  gasCall.mockReset()
  useAuth.mockReturnValue({ session: MOCK_ADMIN_SESSION, loading: false, logout: jest.fn() })
  window.__INITIAL_DATA__ = JSON.parse(JSON.stringify(MOCK_INITIAL_DATA))
  localStorage.setItem('docmgr_access_token', MOCK_TOKEN)
})

// ── Frozen clock ────────────────────────────────────────────────────────────
// Deadline assertions read `new Date()` twice — once when daysFromNow() builds a
// fixture, once when getDeadlineStatus() renders. If real local midnight falls
// between those two calls, the day-count drifts by one and the test flakes.
// Freeze the no-arg `new Date()` to a fixed local noon (away from any midnight
// boundary) so both calls see the same instant. Parameterized `new Date(...)`
// and timers stay real so date parsing and RTL async still work.
const RealDate = Date
const FROZEN_MS = new RealDate(2026, 5, 15, 12, 0, 0).getTime() // local noon, 15 Jun 2026

beforeAll(() => {
  global.Date = class extends RealDate {
    constructor(...args) {
      super(...(args.length === 0 ? [FROZEN_MS] : args))
    }
    static now() { return FROZEN_MS }
  }
})

afterAll(() => {
  global.Date = RealDate
})

// ── Tests ─────────────────────────────────────────────────────────────────────

const MOCK_VT_SESSION = {
  userId: 3,
  username: 'vanthu',
  role: 'Văn thư',
  email: 'vt@test.com',
  name: 'Văn Thư',
  permissions: {
    hoSo:       { c: true, r: true, u: true, d: false },
    danhMuc:    { c: false, r: true, u: false, d: false },
    nhom:       { c: false, r: true, u: false, d: false },
    nhaCungCap: { c: false, r: true, u: false, d: false },
    duAn:       { c: false, r: true, u: false, d: false },
    user:       { c: false, r: false, u: false, d: false },
    caiDat:     { c: false, r: false, u: false, d: false },
  },
  canCreate: true,
  canCreateSubCat: false,
  departments: [],
}

describe('Documents page — MainApp', () => {
  test('renders document list with names and statuses', async () => {
    renderMainApp()

    // Both doc names from MOCK_DOCS should appear
    expect(await screen.findByText('Hợp đồng mua sắm CNTT')).toBeInTheDocument()
    expect(screen.getByText('Công văn số 01/2024')).toBeInTheDocument()

    // Status badge for first doc — multiple 'Chờ duyệt' exist (badge + select option)
    expect(screen.getAllByText('Chờ duyệt').length).toBeGreaterThan(0)
  })

  test('admin sees Người dùng, Nhóm, Nhật ký in sidebar', async () => {
    useAuth.mockReturnValue({ session: MOCK_ADMIN_SESSION, loading: false, logout: jest.fn() })
    renderMainApp()

    // Wait for render to settle
    expect(await screen.findByText('Hợp đồng mua sắm CNTT')).toBeInTheDocument()

    // Scope to the sidebar <aside> element to avoid collisions with table headers
    const sidebar = document.querySelector('aside')
    expect(sidebar).not.toBeNull()
    expect(sidebar.textContent).toContain('Người dùng')
    expect(sidebar.textContent).toContain('Nhóm')
    expect(sidebar.textContent).toContain('Nhật ký')
  })

  test('viewer (Nhân viên) does NOT see Người dùng, Nhóm, Nhật ký', async () => {
    useAuth.mockReturnValue({ session: MOCK_VIEWER_SESSION, loading: false, logout: jest.fn() })
    renderMainApp()

    expect(await screen.findByText('Hợp đồng mua sắm CNTT')).toBeInTheDocument()

    const sidebar = document.querySelector('aside')
    expect(sidebar).not.toBeNull()
    expect(sidebar.textContent).not.toContain('Người dùng')
    expect(sidebar.textContent).not.toContain('Nhóm')
    expect(sidebar.textContent).not.toContain('Nhật ký')
  })

  test('all roles see Hồ sơ nav item', async () => {
    renderMainApp()

    expect(await screen.findByText('Hồ sơ')).toBeInTheDocument()
  })

  test('search runs server-side full-text only on Enter [012/T028]', async () => {
    gasCall.mockImplementation((fn) => {
      if (fn === 'api_getDocuments') return Promise.resolve({ data: [], page: 1, hasNext: false })
      if (fn === 'api_getDocumentStats') return Promise.resolve({})
      if (fn === 'api_getUsers') return Promise.resolve([])
      return Promise.resolve({})
    })
    renderMainApp()

    // Wait for initial render via __INITIAL_DATA__
    expect(await screen.findByText('Hợp đồng mua sắm CNTT')).toBeInTheDocument()

    const searchInput = screen.getByPlaceholderText(/toàn bộ hồ sơ/i)

    // Gõ KHÔNG kích hoạt server search
    fireEvent.change(searchInput, { target: { value: 'Công văn' } })
    expect(gasCall).not.toHaveBeenCalledWith(
      'api_getDocuments', MOCK_TOKEN, expect.objectContaining({ keyword: expect.anything() })
    )

    // Nhấn Enter → server tìm toàn tập, tải lại từ trang 1 kèm keyword
    fireEvent.keyDown(searchInput, { key: 'Enter' })
    await waitFor(() => {
      expect(gasCall).toHaveBeenCalledWith(
        'api_getDocuments', MOCK_TOKEN,
        expect.objectContaining({ keyword: 'Công văn', page: 1 })
      )
    })
  })

  test('load ngầm (poll) đang search → reload đúng query, KHÔNG đè bằng dữ liệu không-lọc [012/đợt3]', async () => {
    gasCall.mockImplementation((fn) => {
      if (fn === 'api_getDocuments') return Promise.resolve({ data: [], page: 1, hasNext: false })
      if (fn === 'api_getDocumentStats') return Promise.resolve({})
      if (fn === 'api_getUsers') return Promise.resolve([])
      return Promise.resolve({})
    })
    renderMainApp()
    expect(await screen.findByText('Hợp đồng mua sắm CNTT')).toBeInTheDocument()

    // Bật search
    const searchInput = screen.getByPlaceholderText(/toàn bộ hồ sơ/i)
    fireEvent.change(searchInput, { target: { value: 'Công văn' } })
    fireEvent.keyDown(searchInput, { key: 'Enter' })
    await waitFor(() => expect(gasCall).toHaveBeenCalledWith('api_getDocuments', MOCK_TOKEN, expect.objectContaining({ keyword: 'Công văn' })))

    gasCall.mockClear()

    // Mô phỏng poll nền phát trang-1 KHÔNG lọc — lấy subscriber 'docs' MỚI NHẤT
    // (mock.calls tích luỹ qua các test → phải lấy của render hiện tại)
    const docsCalls = dataCache.subscribe.mock.calls.filter(c => c[0] === 'docs')
    const docsSub = docsCalls[docsCalls.length - 1]
    expect(docsSub).toBeTruthy()
    await act(async () => {
      docsSub[1]([{ ID: 999, 'Tên hồ sơ': 'Hồ sơ không-lọc từ poll', 'Tình trạng': 'Đang xử lý' }])
    })

    // Vì đang search → silent reload đúng query (kèm keyword), KHÔNG áp trực tiếp dữ liệu poll
    await waitFor(() => expect(gasCall).toHaveBeenCalledWith('api_getDocuments', MOCK_TOKEN, expect.objectContaining({ keyword: 'Công văn' })))
    expect(screen.queryByText('Hồ sơ không-lọc từ poll')).not.toBeInTheDocument()
  })

  test('VT creator sees edit in context menu for Từ chối doc', async () => {
    const rejectedDoc = {
      ...MOCK_DOCS[0],
      'Tình trạng': 'Từ chối',
      'Lý do từ chối': 'Thiếu file',
      'Người tạo': 'vanthu',
    }
    window.__INITIAL_DATA__ = JSON.parse(JSON.stringify({
      ...MOCK_INITIAL_DATA,
      docs: [rejectedDoc],
      stats: { total: 1, byStatus: { 'Từ chối': 1 }, totalValue: 0 },
    }))
    useAuth.mockReturnValue({ session: MOCK_VT_SESSION, loading: false, logout: jest.fn() })

    renderMainApp()
    expect(await screen.findByText('Hợp đồng mua sắm CNTT')).toBeInTheDocument()

    const menuBtn = screen.getByText('more_vert').closest('button')
    fireEvent.click(menuBtn)

    await waitFor(() => {
      expect(screen.getByText('Chỉnh sửa')).toBeInTheDocument()
    })
  })

  test('VT non-creator does NOT see edit in context menu for Từ chối doc', async () => {
    const rejectedDoc = {
      ...MOCK_DOCS[0],
      'Tình trạng': 'Từ chối',
      'Lý do từ chối': 'Thiếu file',
      'Người tạo': 'othervanthu',
    }
    window.__INITIAL_DATA__ = JSON.parse(JSON.stringify({
      ...MOCK_INITIAL_DATA,
      docs: [rejectedDoc],
      stats: { total: 1, byStatus: { 'Từ chối': 1 }, totalValue: 0 },
    }))
    useAuth.mockReturnValue({ session: MOCK_VT_SESSION, loading: false, logout: jest.fn() })

    renderMainApp()
    expect(await screen.findByText('Hợp đồng mua sắm CNTT')).toBeInTheDocument()

    // No menu button — no actions available for non-creator VT on rejected doc without files
    expect(screen.queryByText('more_vert')).not.toBeInTheDocument()
  })
})

// ── Feature 011: flat list, pagination & online category filter ──────────────

describe('Flat list, pagination & category filter (011)', () => {
  function makeDocs(n) {
    return Array.from({ length: n }, (_, i) => ({
      ...MOCK_DOCS[0], ID: String(1000 + i), 'Tên hồ sơ': 'Doc ' + i, 'Tình trạng': 'Đang xử lý',
    }))
  }

  test('flat list: no category-group rows and no per-folder "Xem thêm" [US1/T004]', async () => {
    renderMainApp()
    await screen.findByText('Hợp đồng mua sắm CNTT')
    // Both docs render flat; legacy grouping artifacts are gone
    expect(screen.getByText('Công văn số 01/2024')).toBeInTheDocument()
    expect(screen.queryByText(/Xem thêm/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Chưa phân danh mục/)).not.toBeInTheDocument()
  })

  test('empty state shows "Không có hồ sơ nào" [US1/T004/FR-015]', async () => {
    window.__INITIAL_DATA__ = JSON.parse(JSON.stringify({
      ...MOCK_INITIAL_DATA, docs: [], stats: { total: 0, byStatus: {}, totalValue: 0 },
    }))
    renderMainApp()
    expect(await screen.findByText('Không có hồ sơ nào')).toBeInTheDocument()
  })

  test('pagination: Trước disabled on page 1; Sau loads page 2 via api_getDocuments [US2/T011]', async () => {
    window.__INITIAL_DATA__ = JSON.parse(JSON.stringify({
      ...MOCK_INITIAL_DATA, docs: makeDocs(100), stats: { total: 100, byStatus: {}, totalValue: 0 },
    }))
    gasCall.mockImplementation((fn) => {
      if (fn === 'api_getDocuments') return Promise.resolve({ data: makeDocs(20), page: 2, hasNext: false })
      if (fn === 'api_getDocumentStats') return Promise.resolve({})
      if (fn === 'api_getUsers') return Promise.resolve([])
      return Promise.resolve({})
    })
    renderMainApp()
    await screen.findByText('Doc 0')

    expect(screen.getByText('Trang 1')).toBeInTheDocument()
    expect(screen.getByText('‹ Trước').closest('button')).toBeDisabled()
    const next = screen.getByText('Sau ›').closest('button')
    expect(next).not.toBeDisabled() // 100 docs → heuristic hasNext

    fireEvent.click(next)

    await waitFor(() => {
      expect(gasCall).toHaveBeenCalledWith('api_getDocuments', MOCK_TOKEN, { page: 2 })
      expect(screen.getByText('Trang 2')).toBeInTheDocument()
    })
    expect(screen.getByText('Sau ›').closest('button')).toBeDisabled() // hasNext=false on last page
  })

  test('selecting a category calls server with danhMucId and resets to page 1; clearing drops it [US3/T018]', async () => {
    gasCall.mockImplementation((fn) => {
      if (fn === 'api_getDocuments') return Promise.resolve({ data: [MOCK_DOCS[1]], page: 1, hasNext: false })
      if (fn === 'api_getDocumentStats') return Promise.resolve({})
      if (fn === 'api_getUsers') return Promise.resolve([])
      return Promise.resolve({})
    })
    renderMainApp()
    await screen.findByText('Hợp đồng mua sắm CNTT')

    // Open the collapse picker, pick category "Công văn" (ID 2)
    fireEvent.click(screen.getByTestId('doc-category-filter'))
    fireEvent.click(screen.getByTestId('doc-category-filter-opt-2'))

    await waitFor(() => {
      expect(gasCall).toHaveBeenCalledWith('api_getDocuments', MOCK_TOKEN, { page: 1, danhMucId: '2' })
    })

    // Clear back to "Tất cả danh mục" → server called without danhMucId
    fireEvent.click(screen.getByTestId('doc-category-filter'))
    fireEvent.click(screen.getByTestId('doc-category-filter-opt-root'))
    await waitFor(() => {
      expect(gasCall).toHaveBeenCalledWith('api_getDocuments', MOCK_TOKEN, { page: 1 })
    })
  })

  test('"Công việc của tôi" shows only incomplete docs related to me, any role [US4/T030/FR-016]', async () => {
    // me = viewer1 (userId 2). Button is hidden for admin, so use a staff session.
    const docs = [
      { ...MOCK_DOCS[0], ID: '101', 'Tên hồ sơ': 'Việc tạo bởi tôi',   'Tình trạng': 'Đang xử lý', 'Người tạo': 'viewer1', 'Phụ trách': '', 'Người phối hợp': '' },
      { ...MOCK_DOCS[0], ID: '102', 'Tên hồ sơ': 'Việc tôi phụ trách', 'Tình trạng': 'Chờ xử lý',  'Người tạo': 'admin',   'Phụ trách': JSON.stringify(['2']), 'Người phối hợp': '' },
      { ...MOCK_DOCS[0], ID: '103', 'Tên hồ sơ': 'Việc tôi phối hợp',  'Tình trạng': 'Đang xử lý', 'Người tạo': 'admin',   'Phụ trách': '', 'Người phối hợp': JSON.stringify(['2']) },
      { ...MOCK_DOCS[0], ID: '104', 'Tên hồ sơ': 'Việc người khác',    'Tình trạng': 'Đang xử lý', 'Người tạo': 'admin',   'Phụ trách': JSON.stringify(['999']), 'Người phối hợp': '' },
      { ...MOCK_DOCS[0], ID: '105', 'Tên hồ sơ': 'Việc đã xong của tôi','Tình trạng': 'Hoàn thành', 'Người tạo': 'viewer1', 'Phụ trách': JSON.stringify(['2']), 'Người phối hợp': '' },
    ]
    window.__INITIAL_DATA__ = JSON.parse(JSON.stringify({
      ...MOCK_INITIAL_DATA, docs, stats: { total: docs.length, byStatus: {}, totalValue: 0 },
    }))
    useAuth.mockReturnValue({ session: MOCK_VIEWER_SESSION, loading: false, logout: jest.fn() })
    renderMainApp()
    await screen.findByText('Việc tạo bởi tôi')

    fireEvent.click(screen.getByText('Công việc của tôi').closest('button'))

    await waitFor(() => {
      expect(screen.getByText('Việc tạo bởi tôi')).toBeInTheDocument()
      expect(screen.getByText('Việc tôi phụ trách')).toBeInTheDocument()
      expect(screen.getByText('Việc tôi phối hợp')).toBeInTheDocument()
      expect(screen.queryByText('Việc người khác')).not.toBeInTheDocument()      // không liên quan
      expect(screen.queryByText('Việc đã xong của tôi')).not.toBeInTheDocument()  // đã hoàn thành
    })
  })
})

// ── Deadline warning badge rendering ─────────────────────────────────────────

// Emit a LOCAL dd/mm/yyyy string. Using toISOString() here would serialize in
// UTC, so near midnight the date could land ±1 day off the intended local day,
// drifting "Quá hạn N ngày" by one. getDeadlineStatus parses dd/mm/yyyy in local
// time, matching its local "today", so the day-count is exact in any timezone.
function daysFromNow(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

function renderWithDocs(docs) {
  window.__INITIAL_DATA__ = JSON.parse(JSON.stringify({
    ...MOCK_INITIAL_DATA,
    docs,
    stats: { total: docs.length, byStatus: {}, totalValue: 0 },
  }))
  renderMainApp()
}

describe('Deadline warning badges', () => {
  test('overdue doc shows "Quá hạn X ngày" badge with red background', async () => {
    renderWithDocs([{
      ...MOCK_DOCS[0],
      'Tình trạng': 'Chờ duyệt',
      'Ngày kết thúc': daysFromNow(-3),
    }])
    await screen.findByText('Hợp đồng mua sắm CNTT')

    expect(screen.getByText(/Quá hạn 3 ngày/)).toBeInTheDocument()
    const row = screen.getByText('Hợp đồng mua sắm CNTT').closest('tr')
    expect(row.className).toContain('bg-red-100')
  })

  test('urgent doc (≤3 days) shows "Còn X ngày" with yellow row', async () => {
    renderWithDocs([{
      ...MOCK_DOCS[0],
      'Tình trạng': 'Đang xử lý',
      'Ngày kết thúc': daysFromNow(2),
    }])
    await screen.findByText('Hợp đồng mua sắm CNTT')

    expect(screen.getByText(/Còn 2 ngày/)).toBeInTheDocument()
    const row = screen.getByText('Hợp đồng mua sắm CNTT').closest('tr')
    expect(row.className).toContain('bg-yellow-50')
  })

  test('today deadline shows "Hết hạn hôm nay" with yellow row', async () => {
    renderWithDocs([{
      ...MOCK_DOCS[0],
      'Tình trạng': 'Đang xử lý',
      'Ngày kết thúc': daysFromNow(0),
    }])
    await screen.findByText('Hợp đồng mua sắm CNTT')

    expect(screen.getByText('Hết hạn hôm nay')).toBeInTheDocument()
    const row = screen.getByText('Hợp đồng mua sắm CNTT').closest('tr')
    expect(row.className).toContain('bg-yellow-50')
  })

  test('warning doc (4-7 days) shows "Còn X ngày" with green row', async () => {
    renderWithDocs([{
      ...MOCK_DOCS[0],
      'Tình trạng': 'Chờ xử lý',
      'Ngày kết thúc': daysFromNow(5),
    }])
    await screen.findByText('Hợp đồng mua sắm CNTT')

    expect(screen.getByText(/Còn 5 ngày/)).toBeInTheDocument()
    const row = screen.getByText('Hợp đồng mua sắm CNTT').closest('tr')
    expect(row.className).toContain('bg-green-50')
  })

  test('normal doc (>7 days) shows no deadline badge', async () => {
    renderWithDocs([{
      ...MOCK_DOCS[0],
      'Tình trạng': 'Đang xử lý',
      'Ngày kết thúc': daysFromNow(15),
    }])
    await screen.findByText('Hợp đồng mua sắm CNTT')

    expect(screen.queryByText(/Còn \d+ ngày/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Quá hạn \d+ ngày/)).not.toBeInTheDocument()
  })

  test('completed doc shows no deadline badge even if overdue', async () => {
    renderWithDocs([{
      ...MOCK_DOCS[0],
      'Tình trạng': 'Hoàn thành',
      'Ngày kết thúc': daysFromNow(-10),
    }])
    await screen.findByText('Hợp đồng mua sắm CNTT')

    expect(screen.queryByText(/Quá hạn \d+ ngày/)).not.toBeInTheDocument()
  })

  test('Khẩn doc has orange row background and still shows deadline text', async () => {
    renderWithDocs([{
      ...MOCK_DOCS[0],
      'Tình trạng': 'Chờ duyệt',
      'Khẩn': 'TRUE',
      'Ngày kết thúc': daysFromNow(-3),
    }])
    await screen.findByText('Hợp đồng mua sắm CNTT')

    // "Khẩn" badge appears before doc name
    const khanBadge = screen.getByText('Khẩn')
    expect(khanBadge).toBeInTheDocument()
    expect(khanBadge.className).toContain('bg-red-100')
    expect(khanBadge.className).toContain('text-red-700')
    // Overdue takes priority — row has red background, not orange
    const row = screen.getByText('Hợp đồng mua sắm CNTT').closest('tr')
    expect(row.className).toContain('bg-red-100')
    expect(row.className).not.toContain('bg-orange-100')
    // Deadline text still shown
    expect(screen.getByText(/Quá hạn 3 ngày/)).toBeInTheDocument()
  })

  test('Khẩn without deadline shows orange row, no deadline text', async () => {
    renderWithDocs([{
      ...MOCK_DOCS[0],
      'Tình trạng': 'Đang xử lý',
      'Khẩn': 'TRUE',
      'Ngày kết thúc': '',
    }])
    await screen.findByText('Hợp đồng mua sắm CNTT')

    const row = screen.getByText('Hợp đồng mua sắm CNTT').closest('tr')
    expect(row.className).toContain('bg-orange-100')
    expect(screen.queryByText(/Quá hạn \d+ ngày/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Còn \d+ ngày/)).not.toBeInTheDocument()
    expect(screen.queryByText('Hết hạn hôm nay')).not.toBeInTheDocument()
  })

  test('Khẩn completed doc has no orange row', async () => {
    renderWithDocs([{
      ...MOCK_DOCS[0],
      'Tình trạng': 'Hoàn thành',
      'Khẩn': 'TRUE',
      'Ngày kết thúc': daysFromNow(-5),
    }])
    await screen.findByText('Hợp đồng mua sắm CNTT')

    const row = screen.getByText('Hợp đồng mua sắm CNTT').closest('tr')
    expect(row.className).not.toContain('bg-orange-100')
    expect(row.className).not.toContain('bg-red-100')
  })

  test('Khẩn row color takes priority over deadline color', async () => {
    renderWithDocs([{
      ...MOCK_DOCS[0],
      'Tình trạng': 'Chờ xử lý',
      'Khẩn': 'TRUE',
      'Ngày kết thúc': daysFromNow(5),
    }])
    await screen.findByText('Hợp đồng mua sắm CNTT')

    const row = screen.getByText('Hợp đồng mua sắm CNTT').closest('tr')
    expect(row.className).toContain('bg-orange-100')
    expect(row.className).not.toContain('bg-green-50')
    // Deadline text still shows
    expect(screen.getByText(/Còn 5 ngày/)).toBeInTheDocument()
  })

  test('normal doc (>7 days) has no colored row background', async () => {
    renderWithDocs([{
      ...MOCK_DOCS[0],
      'Tình trạng': 'Đang xử lý',
      'Ngày kết thúc': daysFromNow(15),
    }])
    await screen.findByText('Hợp đồng mua sắm CNTT')

    const row = screen.getByText('Hợp đồng mua sắm CNTT').closest('tr')
    expect(row.className).not.toContain('bg-red-100')
    expect(row.className).not.toContain('bg-yellow-50')
    expect(row.className).not.toContain('bg-green-50')
    expect(row.className).not.toContain('bg-orange-100')
  })

  test('doc with 10-day deadline has no colored row background', async () => {
    renderWithDocs([{
      ...MOCK_DOCS[0],
      'Tình trạng': 'Đang xử lý',
      'Ngày kết thúc': daysFromNow(10),
    }])
    await screen.findByText('Hợp đồng mua sắm CNTT')

    const row = screen.getByText('Hợp đồng mua sắm CNTT').closest('tr')
    expect(row.className).not.toContain('bg-red-100')
    expect(row.className).not.toContain('bg-yellow-50')
    expect(row.className).not.toContain('bg-green-50')
    expect(row.className).not.toContain('bg-orange-100')
    expect(screen.queryByText(/Còn \d+ ngày/)).not.toBeInTheDocument()
  })

  test('doc without deadline has no colored row background', async () => {
    renderWithDocs([{
      ...MOCK_DOCS[0],
      'Tình trạng': 'Chờ xử lý',
      'Ngày kết thúc': '',
    }])
    await screen.findByText('Hợp đồng mua sắm CNTT')

    const row = screen.getByText('Hợp đồng mua sắm CNTT').closest('tr')
    expect(row.className).not.toContain('bg-red-100')
    expect(row.className).not.toContain('bg-yellow-50')
    expect(row.className).not.toContain('bg-green-50')
    expect(row.className).not.toContain('bg-orange-100')
  })

  test('completed doc has no colored row background', async () => {
    renderWithDocs([{
      ...MOCK_DOCS[0],
      'Tình trạng': 'Hoàn thành',
      'Ngày kết thúc': daysFromNow(-10),
    }])
    await screen.findByText('Hợp đồng mua sắm CNTT')

    const row = screen.getByText('Hợp đồng mua sắm CNTT').closest('tr')
    expect(row.className).not.toContain('bg-red-100')
    expect(row.className).not.toContain('bg-yellow-50')
    expect(row.className).not.toContain('bg-green-50')
    expect(row.className).not.toContain('bg-orange-100')
  })

  test('badge text does NOT contain "KT:" date prefix', async () => {
    renderWithDocs([{
      ...MOCK_DOCS[0],
      'Tình trạng': 'Chờ duyệt',
      'Ngày kết thúc': daysFromNow(-2),
    }])
    await screen.findByText('Hợp đồng mua sắm CNTT')

    expect(screen.getByText(/Quá hạn 2 ngày/)).toBeInTheDocument()
    // Old format had "KT: dd/mm/yyyy (quá hạn X ngày)" — verify it's gone
    expect(screen.queryByText(/KT:/)).not.toBeInTheDocument()
  })
})

// ── Filter dropdowns ─────────────────────────────────────────────────────────

describe('Tình trạng filter includes all statuses', () => {
  test('dropdown has acceptance-gate statuses', async () => {
    renderMainApp()
    await screen.findByText('Hợp đồng mua sắm CNTT')

    const select = screen.getByDisplayValue('Tất cả tình trạng')
    const options = Array.from(select.querySelectorAll('option')).map(o => o.textContent)
    expect(options).toContain('Từ chối')
    expect(options).toContain('Chờ xác nhận HT')
    expect(options).toContain('Từ chối kết quả')
  })

  test('selecting "Từ chối" filters docs', async () => {
    const rejectedDoc = { ...MOCK_DOCS[0], 'Tình trạng': 'Từ chối' }
    window.__INITIAL_DATA__ = JSON.parse(JSON.stringify({
      ...MOCK_INITIAL_DATA,
      docs: [rejectedDoc, MOCK_DOCS[1]],
      stats: { total: 2, byStatus: {}, totalValue: 0 },
    }))
    renderMainApp()
    await screen.findByText('Hợp đồng mua sắm CNTT')

    fireEvent.change(screen.getByDisplayValue('Tất cả tình trạng'), { target: { value: 'Từ chối' } })

    await waitFor(() => {
      expect(screen.getByText('Hợp đồng mua sắm CNTT')).toBeInTheDocument()
      expect(screen.queryByText('Công văn số 01/2024')).not.toBeInTheDocument()
    })
  })
})

describe('Deadline status filter', () => {
  test('dropdown renders with all options', async () => {
    renderMainApp()
    await screen.findByText('Hợp đồng mua sắm CNTT')

    const select = screen.getByDisplayValue('Tất cả hạn')
    const options = Array.from(select.querySelectorAll('option')).map(o => o.textContent)
    expect(options).toEqual(['Tất cả hạn', 'Còn hạn', 'Còn hạn 1 tuần', 'Quá hạn'])
  })

  test('"Quá hạn" shows only overdue docs', async () => {
    const overdueDoc = { ...MOCK_DOCS[0], ID: '10', 'Tên hồ sơ': 'HĐ Quá hạn', 'Tình trạng': 'Đang xử lý', 'Ngày kết thúc': daysFromNow(-5) }
    const freshDoc = { ...MOCK_DOCS[0], ID: '11', 'Tên hồ sơ': 'HĐ Còn hạn', 'Tình trạng': 'Đang xử lý', 'Ngày kết thúc': daysFromNow(20) }
    window.__INITIAL_DATA__ = JSON.parse(JSON.stringify({
      ...MOCK_INITIAL_DATA,
      docs: [overdueDoc, freshDoc],
      stats: { total: 2, byStatus: {}, totalValue: 0 },
    }))
    renderMainApp()
    await screen.findByText('HĐ Quá hạn')

    fireEvent.change(screen.getByDisplayValue('Tất cả hạn'), { target: { value: 'quaHan' } })

    await waitFor(() => {
      expect(screen.getByText('HĐ Quá hạn')).toBeInTheDocument()
      expect(screen.queryByText('HĐ Còn hạn')).not.toBeInTheDocument()
    })
  })

  test('"Còn hạn 1 tuần" shows urgent + warning docs only', async () => {
    const urgentDoc = { ...MOCK_DOCS[0], ID: '10', 'Tên hồ sơ': 'HĐ Gấp', 'Tình trạng': 'Đang xử lý', 'Ngày kết thúc': daysFromNow(2) }
    const warningDoc = { ...MOCK_DOCS[0], ID: '11', 'Tên hồ sơ': 'HĐ Sắp hạn', 'Tình trạng': 'Đang xử lý', 'Ngày kết thúc': daysFromNow(6) }
    const farDoc = { ...MOCK_DOCS[0], ID: '12', 'Tên hồ sơ': 'HĐ Xa', 'Tình trạng': 'Đang xử lý', 'Ngày kết thúc': daysFromNow(30) }
    window.__INITIAL_DATA__ = JSON.parse(JSON.stringify({
      ...MOCK_INITIAL_DATA,
      docs: [urgentDoc, warningDoc, farDoc],
      stats: { total: 3, byStatus: {}, totalValue: 0 },
    }))
    renderMainApp()
    await screen.findByText('HĐ Gấp')

    fireEvent.change(screen.getByDisplayValue('Tất cả hạn'), { target: { value: 'conHan1Tuan' } })

    await waitFor(() => {
      expect(screen.getByText('HĐ Gấp')).toBeInTheDocument()
      expect(screen.getByText('HĐ Sắp hạn')).toBeInTheDocument()
      expect(screen.queryByText('HĐ Xa')).not.toBeInTheDocument()
    })
  })

  test('"Còn hạn" excludes overdue and completed docs', async () => {
    const okDoc = { ...MOCK_DOCS[0], ID: '10', 'Tên hồ sơ': 'HĐ OK', 'Tình trạng': 'Đang xử lý', 'Ngày kết thúc': daysFromNow(3) }
    const overdueDoc = { ...MOCK_DOCS[0], ID: '11', 'Tên hồ sơ': 'HĐ Trễ', 'Tình trạng': 'Đang xử lý', 'Ngày kết thúc': daysFromNow(-2) }
    const doneDoc = { ...MOCK_DOCS[0], ID: '12', 'Tên hồ sơ': 'HĐ Xong', 'Tình trạng': 'Hoàn thành', 'Ngày kết thúc': daysFromNow(5) }
    window.__INITIAL_DATA__ = JSON.parse(JSON.stringify({
      ...MOCK_INITIAL_DATA,
      docs: [okDoc, overdueDoc, doneDoc],
      stats: { total: 3, byStatus: {}, totalValue: 0 },
    }))
    renderMainApp()
    await screen.findByText('HĐ OK')

    fireEvent.change(screen.getByDisplayValue('Tất cả hạn'), { target: { value: 'conHan' } })

    await waitFor(() => {
      expect(screen.getByText('HĐ OK')).toBeInTheDocument()
      expect(screen.queryByText('HĐ Trễ')).not.toBeInTheDocument()
      expect(screen.queryByText('HĐ Xong')).not.toBeInTheDocument()
    })
  })
})
