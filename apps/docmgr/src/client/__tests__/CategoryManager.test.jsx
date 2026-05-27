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
