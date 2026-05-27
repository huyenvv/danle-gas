import { screen, fireEvent, waitFor } from '@testing-library/react'
import DocumentModal from '../components/DocumentModal.jsx'
import gasCall from '../gasClient.js'
import { renderWithProviders } from './helpers/render.jsx'
import { MOCK_TOKEN, MOCK_ADMIN_SESSION, MOCK_VIEWER_SESSION, MOCK_LOOKUPS, MOCK_DOCS } from './helpers/mockData.js'

jest.mock('../gasClient.js')

// Non-admin, non-Văn thư, canCreate=false → falls into simple type="submit" path
const VIEWER_SESSION = { ...MOCK_VIEWER_SESSION, role: 'Nhân viên', canCreate: false }

const DEFAULT_PROPS = {
  mode: 'create',
  doc: null,
  lookups: MOCK_LOOKUPS,
  token: MOCK_TOKEN,
  session: VIEWER_SESSION,
  onClose: jest.fn(),
  onSaved: jest.fn(),
  docs: MOCK_DOCS,
}

function renderModal(overrides = {}) {
  return renderWithProviders(<DocumentModal {...DEFAULT_PROPS} {...overrides} />)
}

beforeEach(() => {
  gasCall.mockReset()
  DEFAULT_PROPS.onClose.mockReset()
  DEFAULT_PROPS.onSaved.mockReset()
})

describe('DocumentModal', () => {
  // Test 1: Validation — submit without Tên hồ sơ shows error, does not call API
  it('shows validation error and does not call API when Tên hồ sơ is empty', async () => {
    renderModal()

    const submitBtn = screen.getByRole('button', { name: /lưu tài liệu/i })
    fireEvent.click(submitBtn)

    expect(await screen.findByText('Tên hồ sơ là bắt buộc')).toBeInTheDocument()
    expect(gasCall).not.toHaveBeenCalled()
  })

  // Test 2: Create — fill Tên hồ sơ + Danh mục → submit → api_createDocument called, onSaved called
  it('calls api_createDocument and onSaved when form is valid', async () => {
    const mockDoc = { ID: '99', 'Tên hồ sơ': 'Test Hồ Sơ Mới' }
    gasCall.mockResolvedValue(mockDoc)

    renderModal()

    // Fill Tên hồ sơ
    fireEvent.change(screen.getByPlaceholderText('Nhập tên hồ sơ...'), {
      target: { value: 'Test Hồ Sơ Mới' },
    })

    // Select Danh mục (required field)
    const danhMucSelect = screen.getAllByRole('combobox')[0]
    fireEvent.change(danhMucSelect, { target: { value: '1' } })

    const submitBtn = screen.getByRole('button', { name: /lưu tài liệu/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(gasCall).toHaveBeenCalledWith(
        'api_createDocument',
        MOCK_TOKEN,
        expect.objectContaining({ 'Tên hồ sơ': 'Test Hồ Sơ Mới' }),
        expect.any(Array),  // fileInfos
        null,               // notifyTarget (ref starts as null)
      )
    })

    expect(DEFAULT_PROPS.onSaved).toHaveBeenCalledWith(mockDoc)
  })

  // Test 3: Edit pre-fill — mode='edit', doc=MOCK_DOCS[0] → Tên hồ sơ pre-filled
  it('pre-fills Tên hồ sơ in edit mode', () => {
    renderModal({
      mode: 'edit',
      doc: MOCK_DOCS[0],
      session: MOCK_ADMIN_SESSION,
    })

    const input = screen.getByPlaceholderText('Nhập tên hồ sơ...')
    expect(input).toHaveValue(MOCK_DOCS[0]['Tên hồ sơ'])
  })

  // Test 4: Edit submit — change name → submit → api_updateDocument called
  it('calls api_updateDocument with updated name in edit mode', async () => {
    const updatedDoc = { ...MOCK_DOCS[0], 'Tên hồ sơ': 'Tên Hồ Sơ Đã Sửa' }
    gasCall.mockResolvedValue(updatedDoc)

    renderModal({
      mode: 'edit',
      doc: MOCK_DOCS[0],
      session: MOCK_ADMIN_SESSION,
    })

    // Change Tên hồ sơ
    const input = screen.getByPlaceholderText('Nhập tên hồ sơ...')
    fireEvent.change(input, { target: { value: 'Tên Hồ Sơ Đã Sửa' } })

    const submitBtn = screen.getByRole('button', { name: /cập nhật/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(gasCall).toHaveBeenCalledWith(
        'api_updateDocument',
        MOCK_TOKEN,
        MOCK_DOCS[0].ID,
        expect.objectContaining({ 'Tên hồ sơ': 'Tên Hồ Sơ Đã Sửa' }),
        expect.any(Array),  // fileInfos
        expect.any(Array),  // keepFileIds
        null,               // notifyTarget (ref starts as null)
      )
    })

    expect(DEFAULT_PROPS.onSaved).toHaveBeenCalledWith(updatedDoc)
  })
})
