import { screen, fireEvent, waitFor } from '@testing-library/react'
import CategoryManager from '../components/CategoryManager.jsx'
import gasCall from '../gasClient.js'
import { renderWithProviders } from './helpers/render.jsx'
import { MOCK_TOKEN, MOCK_ADMIN_SESSION, MOCK_VIEWER_SESSION, MOCK_LOOKUPS } from './helpers/mockData.js'

jest.mock('../gasClient.js')

const DEFAULT_PROPS = {
  token:   MOCK_TOKEN,
  lookups: MOCK_LOOKUPS,
  session: MOCK_ADMIN_SESSION,
}

let mockOnUpdate

beforeEach(() => {
  gasCall.mockReset()
  mockOnUpdate = jest.fn()
})

function renderCategoryManager(overrides = {}) {
  return renderWithProviders(
    <CategoryManager {...DEFAULT_PROPS} onUpdate={mockOnUpdate} {...overrides} />
  )
}

describe('CategoryManager — rendering', () => {
  test('renders category names from lookups', () => {
    renderCategoryManager()
    expect(screen.getByText('Hợp đồng')).toBeInTheDocument()
    expect(screen.getByText('Công văn')).toBeInTheDocument()
  })

  test('admin sees Thêm danh mục button', () => {
    renderCategoryManager()
    expect(screen.getByRole('button', { name: /Thêm danh mục/i })).toBeInTheDocument()
  })

  test('non-admin does not see Thêm danh mục button', () => {
    renderCategoryManager({ session: MOCK_VIEWER_SESSION })
    expect(screen.queryByRole('button', { name: /Thêm danh mục/i })).not.toBeInTheDocument()
  })

  test('non-admin WITH canCreateRootCat sees Thêm danh mục button', () => {
    renderCategoryManager({ session: { ...MOCK_VIEWER_SESSION, role: 'Văn thư', canCreateRootCat: true } })
    expect(screen.getByRole('button', { name: /Thêm danh mục/i })).toBeInTheDocument()
  })
})

describe('CategoryManager — collapse tree', () => {
  const NESTED_LOOKUPS = {
    ...MOCK_LOOKUPS,
    danhMuc: [
      { ID: '1', 'Tên danh mục': 'Hợp đồng', 'Danh mục cha': '' },
      { ID: '10', 'Tên danh mục': 'Hợp đồng mua', 'Danh mục cha': '1' },
    ],
  }

  test('children are collapsed by default and shown after expanding', () => {
    renderCategoryManager({ lookups: NESTED_LOOKUPS })

    // Root visible, child hidden initially
    expect(screen.getByText('Hợp đồng')).toBeInTheDocument()
    expect(screen.queryByText('Hợp đồng mua')).not.toBeInTheDocument()

    // Child count badge shows on the root
    expect(screen.getByText('1')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /mở rộng/i }))
    expect(screen.getByText('Hợp đồng mua')).toBeInTheDocument()
  })

  test('expanded child can be collapsed again', () => {
    renderCategoryManager({ lookups: NESTED_LOOKUPS })

    fireEvent.click(screen.getByRole('button', { name: /mở rộng/i }))
    expect(screen.getByText('Hợp đồng mua')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /thu gọn/i }))
    expect(screen.queryByText('Hợp đồng mua')).not.toBeInTheDocument()
  })

  test('expand state persists to localStorage and is restored on remount', () => {
    localStorage.removeItem('docmgr_cat_expanded')

    const { unmount } = renderCategoryManager({ lookups: NESTED_LOOKUPS })
    fireEvent.click(screen.getByRole('button', { name: /mở rộng/i }))
    expect(JSON.parse(localStorage.getItem('docmgr_cat_expanded'))).toContain('1')

    unmount()

    // Remount: previously-expanded node stays open, child visible without clicking
    renderCategoryManager({ lookups: NESTED_LOOKUPS })
    expect(screen.getByText('Hợp đồng mua')).toBeInTheDocument()

    localStorage.removeItem('docmgr_cat_expanded')
  })
})

describe('CategoryManager — add category', () => {
  test('Thêm danh mục button opens modal with form heading', async () => {
    renderCategoryManager()
    fireEvent.click(screen.getByRole('button', { name: /thêm danh mục/i }))
    expect(await screen.findByRole('heading', { name: /thêm danh mục/i })).toBeInTheDocument()
  })

  test('filling form and submitting calls api_addCategory', async () => {
    gasCall.mockResolvedValue({ ID: '99', 'Tên danh mục': 'Quyết định', 'Danh mục cha': '' })

    renderCategoryManager()
    fireEvent.click(screen.getByRole('button', { name: /thêm danh mục/i }))

    const nameInput = await screen.findByPlaceholderText(/tên danh mục/i)
    fireEvent.change(nameInput, { target: { value: 'Quyết định' } })

    const saveBtn = screen.getByRole('button', { name: /lưu/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(gasCall).toHaveBeenCalledWith(
        'api_addCategory',
        MOCK_TOKEN,
        expect.objectContaining({ 'Tên danh mục': 'Quyết định' })
      )
    })
  })

  test('Người được xem picker lists every active SSO user, including those not yet in docmgr', async () => {
    // SSO-only user: in the company directory (ssoUsers) but no docmgr role (users)
    const ssoOnlyUser = {
      ID: 99, 'Tên đăng nhập': 'newbie', 'Tên nhân viên': 'Người Chưa Vào App',
      'Email': 'newbie@test.com', 'Trạng thái': 'Active', 'Quyền': '',
    }
    const lookups = { ...MOCK_LOOKUPS, ssoUsers: [...MOCK_LOOKUPS.users, ssoOnlyUser] }

    renderCategoryManager({ lookups })
    fireEvent.click(screen.getByRole('button', { name: /thêm danh mục/i }))
    await screen.findByRole('heading', { name: /thêm danh mục/i })

    // Would be missing if the picker still read lookups.users
    expect(screen.getByText('Người Chưa Vào App (newbie@test.com)')).toBeInTheDocument()
  })

  test('submitting empty name does not call api_addCategory and shows error', async () => {
    renderCategoryManager()
    fireEvent.click(screen.getByRole('button', { name: /thêm danh mục/i }))

    // Wait for form to open
    await screen.findByRole('heading', { name: /thêm danh mục/i })

    // Submit without filling name
    const saveBtn = screen.getByRole('button', { name: /lưu/i })
    fireEvent.click(saveBtn)

    // gasCall should NOT have been called
    expect(gasCall).not.toHaveBeenCalledWith('api_addCategory', expect.anything(), expect.anything())

    // Error message should appear
    await waitFor(() => {
      expect(screen.getByText('Tên danh mục là bắt buộc')).toBeInTheDocument()
    })
  })
})
