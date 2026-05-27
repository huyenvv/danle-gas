import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import MainApp from '../components/MainApp.jsx'
import gasCall from '../gasClient.js'
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

// ── Tests ─────────────────────────────────────────────────────────────────────

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

  test('typing keyword + Enter calls api_getDocuments with keyword', async () => {
    // Set up per-fn responses so UserManager's api_getUsers returns an array
    gasCall.mockImplementation((fn) => {
      if (fn === 'api_getDocuments') return Promise.resolve({ data: [] })
      if (fn === 'api_getDocumentStats') return Promise.resolve({})
      if (fn === 'api_getUsers') return Promise.resolve([])
      return Promise.resolve({})
    })
    renderMainApp()

    // Wait for initial render via __INITIAL_DATA__
    expect(await screen.findByText('Hợp đồng mua sắm CNTT')).toBeInTheDocument()

    const searchInput = screen.getByPlaceholderText(/tìm kiếm hồ sơ/i)
    fireEvent.change(searchInput, { target: { value: 'Hợp đồng' } })
    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' })

    await waitFor(() => {
      expect(gasCall).toHaveBeenCalledWith(
        'api_getDocuments',
        MOCK_TOKEN,
        { keyword: 'Hợp đồng' }
      )
    })
  })
})
