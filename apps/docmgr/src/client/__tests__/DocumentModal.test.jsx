import { screen, fireEvent, waitFor, act } from '@testing-library/react'
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

  // Test 5: VT trình duyệt lại calls single api_transitionDocument with updateData
  it('VT trình duyệt lại sends edits + transition in one API call', async () => {
    const vanThuSession = {
      ...MOCK_ADMIN_SESSION,
      userId: 3,
      username: 'vanthu',
      role: 'Văn thư',
      canCreate: true,
      canPublish: false,
    }
    const rejectedDoc = {
      ...MOCK_DOCS[0],
      'Tình trạng': 'Từ chối',
      'Lý do từ chối': 'Thiếu file',
      'Người tạo': 'vanthu',
    }
    const transitionResult = { ...rejectedDoc, 'Tình trạng': 'Chờ duyệt', 'Lý do từ chối': '' }
    gasCall.mockImplementation((fn) => {
      if (fn === 'api_transitionDocument') return Promise.resolve({ data: transitionResult })
      return Promise.resolve({})
    })

    renderModal({ mode: 'edit', doc: rejectedDoc, session: vanThuSession })

    const input = screen.getByPlaceholderText('Nhập tên hồ sơ...')
    fireEvent.change(input, { target: { value: 'HĐ Đã Sửa' } })

    const btn = screen.getByRole('button', { name: /trình duyệt lại/i })
    fireEvent.click(btn)

    await waitFor(() => {
      const confirmBtn = screen.getByRole('button', { name: /đồng ý|xác nhận|có/i })
      fireEvent.click(confirmBtn)
    })

    await waitFor(() => {
      expect(gasCall).toHaveBeenCalledWith(
        'api_transitionDocument',
        MOCK_TOKEN,
        rejectedDoc.ID,
        'trinhDuyetLai',
        {},
        expect.objectContaining({
          formData: expect.objectContaining({ 'Tên hồ sơ': 'HĐ Đã Sửa' }),
          fileInfos: expect.any(Array),
          keepFileIds: expect.any(Array),
        }),
      )
    })

    expect(gasCall).not.toHaveBeenCalledWith('api_updateDocument', expect.anything(), expect.anything(), expect.anything(), expect.anything(), expect.anything(), expect.anything())
    expect(DEFAULT_PROPS.onSaved).toHaveBeenCalledWith(transitionResult)
  })

  // Test 6: VT editing Từ chối doc — only "Trình duyệt lại", no "Lưu tài liệu" or "Phát hành"
  it('VT editing Từ chối doc sees only Trình duyệt lại button', () => {
    const vanThuSession = {
      ...MOCK_ADMIN_SESSION,
      userId: 3,
      username: 'vanthu',
      role: 'Văn thư',
      canCreate: true,
      canPublish: true,
    }
    const rejectedDoc = {
      ...MOCK_DOCS[0],
      'Tình trạng': 'Từ chối',
      'Lý do từ chối': 'Thiếu file',
      'Người tạo': 'vanthu',
    }
    renderModal({ mode: 'edit', doc: rejectedDoc, session: vanThuSession })

    expect(screen.getByRole('button', { name: /trình duyệt lại/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^lưu tài liệu$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /phát hành/i })).not.toBeInTheDocument()
  })

  // Test 6: VT editing normal doc — sees all 3 buttons
  it('VT editing normal doc sees Lưu tài liệu + Trình duyệt', () => {
    const vanThuSession = {
      ...MOCK_ADMIN_SESSION,
      userId: 3,
      username: 'vanthu',
      role: 'Văn thư',
      canCreate: true,
      canPublish: true,
    }
    const normalDoc = {
      ...MOCK_DOCS[0],
      'Tình trạng': 'Chờ duyệt',
      'Người tạo': 'vanthu',
    }
    renderModal({ mode: 'edit', doc: normalDoc, session: vanThuSession })

    expect(screen.getByRole('button', { name: /lưu tài liệu/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /trình duyệt$/i })).toBeInTheDocument()
  })

  // Test: VT editing Từ chối doc created by someone else — NO Trình duyệt lại
  it('VT does not see Trình duyệt lại for rejected doc created by another user', () => {
    const vanThuSession = {
      ...MOCK_ADMIN_SESSION,
      userId: 3,
      username: 'vanthu',
      role: 'Văn thư',
      canCreate: true,
      canPublish: false,
    }
    const otherRejectedDoc = {
      ...MOCK_DOCS[0],
      'Tình trạng': 'Từ chối',
      'Lý do từ chối': 'Thiếu file',
      'Người tạo': 'admin', // created by someone else
    }
    renderModal({ mode: 'edit', doc: otherRejectedDoc, session: vanThuSession })

    expect(screen.queryByRole('button', { name: /trình duyệt lại/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /trình duyệt$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /lưu tài liệu/i })).not.toBeInTheDocument()
  })

  // Test: handleSubmit create mode — shows warning on GAS transport error (can't verify without doc ID)
  it('shows warning on "Lỗi không xác định" in handleSubmit create mode', async () => {
    gasCall.mockRejectedValue(new Error('Lỗi không xác định'))

    renderModal()

    fireEvent.change(screen.getByPlaceholderText('Nhập tên hồ sơ...'), {
      target: { value: 'Test Doc' },
    })
    const danhMucSelect = screen.getAllByRole('combobox')[0]
    fireEvent.change(danhMucSelect, { target: { value: '1' } })

    fireEvent.click(screen.getByRole('button', { name: /lưu tài liệu/i }))

    await waitFor(() => {
      expect(DEFAULT_PROPS.onSaved).toHaveBeenCalledWith(null)
    })
    expect(screen.queryByText('Lỗi không xác định')).not.toBeInTheDocument()
    const toast = screen.getByRole('alert')
    expect(toast).toHaveTextContent('Đã lưu hồ sơ — đang cập nhật')
  })

  // Test: handleSubmit edit mode — verifies doc and shows success on GAS transport error
  it('verifies doc and shows success on "Lỗi không xác định" in handleSubmit edit mode', async () => {
    const freshDoc = { ...MOCK_DOCS[0], 'Ngày cập nhật': new Date().toISOString() }
    let callCount = 0
    gasCall.mockImplementation((fn) => {
      callCount++
      if (callCount === 1) return Promise.reject(new Error('Lỗi không xác định'))
      if (fn === 'api_getDocuments') return Promise.resolve({ data: [freshDoc] })
      return Promise.resolve({})
    })

    renderModal({ mode: 'edit', doc: MOCK_DOCS[0], session: MOCK_ADMIN_SESSION })

    const submitBtn = screen.getByRole('button', { name: /cập nhật/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(DEFAULT_PROPS.onSaved).toHaveBeenCalledWith(freshDoc)
    })
    expect(screen.queryByText('Lỗi không xác định')).not.toBeInTheDocument()
    const toast = screen.getByRole('alert')
    expect(toast).toHaveTextContent('Đã lưu hồ sơ')
  })

  // Test: handleSubmit edit mode — verify finds doc (no expectedStatus), shows success immediately
  it('verify finds doc immediately on "Lỗi không xác định" in handleSubmit edit mode (no retry needed)', async () => {
    const freshDoc = { ...MOCK_DOCS[0] }
    let callCount = 0
    gasCall.mockImplementation((fn) => {
      callCount++
      if (callCount === 1) return Promise.reject(new Error('Lỗi không xác định'))
      if (fn === 'api_getDocuments') return Promise.resolve({ data: [freshDoc] })
      return Promise.resolve({})
    })

    renderModal({ mode: 'edit', doc: MOCK_DOCS[0], session: MOCK_ADMIN_SESSION })
    fireEvent.click(screen.getByRole('button', { name: /cập nhật/i }))

    await waitFor(() => {
      expect(DEFAULT_PROPS.onSaved).toHaveBeenCalled()
    })
    const toast = screen.getByRole('alert')
    expect(toast).toHaveTextContent('Đã lưu hồ sơ')
    // No retry — verify passed on first check
    expect(gasCall).toHaveBeenCalledWith('api_getDocuments', expect.anything(), expect.anything())
    expect(gasCall).toHaveBeenCalledTimes(2) // 1 initial + 1 verify
  })

  // Test: handleSubmit edit mode — verify also fails, retries with delay, shows retry messages
  it('retries with delay and shows retry messages in handleSubmit edit mode', async () => {
    jest.useFakeTimers()
    gasCall.mockRejectedValue(new Error('Lỗi không xác định'))

    renderModal({ mode: 'edit', doc: MOCK_DOCS[0], session: MOCK_ADMIN_SESSION })
    fireEvent.click(screen.getByRole('button', { name: /cập nhật/i }))

    await waitFor(() => {
      expect(screen.getByText(/đang thử lại lần 1\/3/)).toBeInTheDocument()
    })
    await act(async () => { await jest.advanceTimersByTimeAsync(2000) })

    await waitFor(() => {
      expect(screen.getByText(/đang thử lại lần 2\/3/)).toBeInTheDocument()
    })
    await act(async () => { await jest.advanceTimersByTimeAsync(3000) })

    await waitFor(() => {
      expect(screen.getByText(/đang thử lại lần 3\/3/)).toBeInTheDocument()
    })
    await act(async () => { await jest.advanceTimersByTimeAsync(5000) })

    await waitFor(() => {
      expect(screen.getByText('Lỗi không xác định')).toBeInTheDocument()
    })
    expect(DEFAULT_PROPS.onSaved).not.toHaveBeenCalled()
    jest.useRealTimers()
  })

  // Test: handleSubmit edit mode — retry returns real server error, stops retrying
  it('stops retrying on real server error in handleSubmit edit mode', async () => {
    jest.useFakeTimers()
    const calls = []
    gasCall.mockImplementation((fn) => {
      calls.push(fn)
      if (fn === 'api_getDocuments') return Promise.reject(new Error('Lỗi không xác định'))
      if (fn === 'api_updateDocument') {
        if (calls.filter(c => c === 'api_updateDocument').length === 1) {
          return Promise.reject(new Error('Lỗi không xác định'))
        }
        return Promise.reject(new Error('Bạn không có quyền chỉnh sửa'))
      }
      return Promise.resolve({})
    })

    renderModal({ mode: 'edit', doc: MOCK_DOCS[0], session: MOCK_ADMIN_SESSION })
    fireEvent.click(screen.getByRole('button', { name: /cập nhật/i }))

    await waitFor(() => {
      expect(screen.getByText(/đang thử lại lần 1\/3/)).toBeInTheDocument()
    })
    await act(async () => { await jest.advanceTimersByTimeAsync(2000) })

    await waitFor(() => {
      expect(screen.getByText('Bạn không có quyền chỉnh sửa')).toBeInTheDocument()
    })
    expect(DEFAULT_PROPS.onSaved).not.toHaveBeenCalled()
    jest.useRealTimers()
  })

  // Test: handleSubmit still shows real errors
  it('shows real API error in handleSubmit', async () => {
    gasCall.mockRejectedValue(new Error('Bạn không có quyền'))

    renderModal()

    fireEvent.change(screen.getByPlaceholderText('Nhập tên hồ sơ...'), {
      target: { value: 'Test Doc' },
    })
    const danhMucSelect = screen.getAllByRole('combobox')[0]
    fireEvent.change(danhMucSelect, { target: { value: '1' } })

    fireEvent.click(screen.getByRole('button', { name: /lưu tài liệu/i }))

    expect(await screen.findByText('Bạn không có quyền')).toBeInTheDocument()
    expect(DEFAULT_PROPS.onSaved).not.toHaveBeenCalled()
  })

  // Test: trinhDuyetLai verifies doc status and shows success on GAS transport error
  it('verifies doc status and shows success on "Lỗi không xác định" in trinhDuyetLai', async () => {
    const vanThuSession = {
      ...MOCK_ADMIN_SESSION,
      userId: 3,
      username: 'vanthu',
      role: 'Văn thư',
      canCreate: true,
      canPublish: false,
    }
    const rejectedDoc = {
      ...MOCK_DOCS[0],
      'Tình trạng': 'Từ chối',
      'Lý do từ chối': 'Thiếu file',
      'Người tạo': 'vanthu',
    }
    const freshDoc = { ...rejectedDoc, 'Tình trạng': 'Chờ duyệt', 'Lý do từ chối': '' }
    let callCount = 0
    gasCall.mockImplementation((fn) => {
      callCount++
      if (callCount === 1) return Promise.reject(new Error('Lỗi không xác định'))
      if (fn === 'api_getDocuments') return Promise.resolve({ data: [freshDoc] })
      return Promise.resolve({})
    })

    renderModal({ mode: 'edit', doc: rejectedDoc, session: vanThuSession })

    fireEvent.click(screen.getByRole('button', { name: /trình duyệt lại/i }))

    await waitFor(() => {
      const confirmBtn = screen.getByRole('button', { name: /đồng ý|xác nhận|có/i })
      fireEvent.click(confirmBtn)
    })

    await waitFor(() => {
      expect(DEFAULT_PROPS.onSaved).toHaveBeenCalledWith(freshDoc)
    })
    expect(screen.queryByText('Lỗi không xác định')).not.toBeInTheDocument()
    const toast = screen.getByRole('alert')
    expect(toast).toHaveTextContent('Đã trình duyệt lại')
  })

  // Test: trinhDuyetLai retries with delay and succeeds after initial verify fails
  it('retries with delay and succeeds on "Lỗi không xác định" in trinhDuyetLai', async () => {
    jest.useFakeTimers()
    const vanThuSession = {
      ...MOCK_ADMIN_SESSION,
      userId: 3,
      username: 'vanthu',
      role: 'Văn thư',
      canCreate: true,
      canPublish: false,
    }
    const rejectedDoc = {
      ...MOCK_DOCS[0],
      'Tình trạng': 'Từ chối',
      'Lý do từ chối': 'Thiếu file',
      'Người tạo': 'vanthu',
    }
    const freshDoc = { ...rejectedDoc, 'Tình trạng': 'Chờ duyệt', 'Lý do từ chối': '' }
    const calls = []
    gasCall.mockImplementation((fn) => {
      calls.push(fn)
      if (fn === 'api_transitionDocument') {
        if (calls.filter(c => c === 'api_transitionDocument').length === 1) {
          return Promise.reject(new Error('Lỗi không xác định'))
        }
        return Promise.resolve({ data: freshDoc })
      }
      if (fn === 'api_getDocuments') return Promise.resolve({ data: [rejectedDoc] })
      return Promise.resolve({})
    })

    renderModal({ mode: 'edit', doc: rejectedDoc, session: vanThuSession })

    fireEvent.click(screen.getByRole('button', { name: /trình duyệt lại/i }))
    await waitFor(() => {
      const confirmBtn = screen.getByRole('button', { name: /đồng ý|xác nhận|có/i })
      fireEvent.click(confirmBtn)
    })

    await waitFor(() => {
      expect(screen.getByText(/đang thử lại lần 1\/3/)).toBeInTheDocument()
    })
    await act(async () => { await jest.advanceTimersByTimeAsync(2000) })

    await waitFor(() => {
      expect(DEFAULT_PROPS.onSaved).toHaveBeenCalled()
    })
    const toast = screen.getByRole('alert')
    expect(toast).toHaveTextContent('Đã trình duyệt lại')
    jest.useRealTimers()
  })

  // Test: trinhDuyetLai retry also fails but post-retry verify finds doc updated
  it('succeeds via post-retry verify when retry also gets transport error in trinhDuyetLai', async () => {
    jest.useFakeTimers()
    const vanThuSession = {
      ...MOCK_ADMIN_SESSION,
      userId: 3,
      username: 'vanthu',
      role: 'Văn thư',
      canCreate: true,
      canPublish: false,
    }
    const rejectedDoc = {
      ...MOCK_DOCS[0],
      'Tình trạng': 'Từ chối',
      'Lý do từ chối': 'Thiếu file',
      'Người tạo': 'vanthu',
    }
    const freshDoc = { ...rejectedDoc, 'Tình trạng': 'Chờ duyệt', 'Lý do từ chối': '' }
    let verifyCalls = 0
    gasCall.mockImplementation((fn) => {
      // All transition calls fail with transport error
      if (fn === 'api_transitionDocument') return Promise.reject(new Error('Lỗi không xác định'))
      if (fn === 'api_getDocuments') {
        verifyCalls++
        // 1st verify (before loop): still Từ chối
        // 2nd verify (after retry 1): server processed it — now Chờ duyệt
        if (verifyCalls === 1) return Promise.resolve({ data: [rejectedDoc] })
        return Promise.resolve({ data: [freshDoc] })
      }
      return Promise.resolve({})
    })

    renderModal({ mode: 'edit', doc: rejectedDoc, session: vanThuSession })

    fireEvent.click(screen.getByRole('button', { name: /trình duyệt lại/i }))
    await waitFor(() => {
      const confirmBtn = screen.getByRole('button', { name: /đồng ý|xác nhận|có/i })
      fireEvent.click(confirmBtn)
    })

    await waitFor(() => {
      expect(screen.getByText(/đang thử lại lần 1\/3/)).toBeInTheDocument()
    })
    await act(async () => { await jest.advanceTimersByTimeAsync(2000) })

    await waitFor(() => {
      expect(DEFAULT_PROPS.onSaved).toHaveBeenCalledWith(freshDoc)
    })
    const toast = screen.getByRole('alert')
    expect(toast).toHaveTextContent('Đã trình duyệt lại')
    jest.useRealTimers()
  })

  // Test: trinhDuyetLai exhausts retries with delays, shows retry messages
  it('shows retry messages then error after retries exhaust in trinhDuyetLai', async () => {
    jest.useFakeTimers()
    const vanThuSession = {
      ...MOCK_ADMIN_SESSION,
      userId: 3,
      username: 'vanthu',
      role: 'Văn thư',
      canCreate: true,
      canPublish: false,
    }
    const rejectedDoc = {
      ...MOCK_DOCS[0],
      'Tình trạng': 'Từ chối',
      'Lý do từ chối': 'Thiếu file',
      'Người tạo': 'vanthu',
    }
    gasCall.mockImplementation((fn) => {
      if (fn === 'api_getDocuments') return Promise.resolve({ data: [rejectedDoc] })
      if (fn === 'api_transitionDocument') return Promise.reject(new Error('Lỗi không xác định'))
      return Promise.resolve({})
    })

    renderModal({ mode: 'edit', doc: rejectedDoc, session: vanThuSession })

    fireEvent.click(screen.getByRole('button', { name: /trình duyệt lại/i }))
    await waitFor(() => {
      const confirmBtn = screen.getByRole('button', { name: /đồng ý|xác nhận|có/i })
      fireEvent.click(confirmBtn)
    })

    const delays = [2000, 3000, 5000]
    for (let i = 1; i <= 3; i++) {
      await waitFor(() => {
        expect(screen.getByText(new RegExp(`đang thử lại lần ${i}/3`))).toBeInTheDocument()
      })
      await act(async () => { await jest.advanceTimersByTimeAsync(delays[i - 1]) })
    }

    await waitFor(() => {
      expect(screen.getByText('Lỗi không xác định')).toBeInTheDocument()
    })
    expect(DEFAULT_PROPS.onSaved).not.toHaveBeenCalled()
    jest.useRealTimers()
  })

  // Test: trinhDuyetLai shows real errors (not swallowed)
  it('shows real API error in trinhDuyetLai', async () => {
    const vanThuSession = {
      ...MOCK_ADMIN_SESSION,
      userId: 3,
      username: 'vanthu',
      role: 'Văn thư',
      canCreate: true,
      canPublish: false,
    }
    const rejectedDoc = {
      ...MOCK_DOCS[0],
      'Tình trạng': 'Từ chối',
      'Lý do từ chối': 'Thiếu file',
      'Người tạo': 'vanthu',
    }
    gasCall.mockRejectedValue(new Error('Bạn không có quyền thực hiện hành động này'))

    renderModal({ mode: 'edit', doc: rejectedDoc, session: vanThuSession })

    fireEvent.click(screen.getByRole('button', { name: /trình duyệt lại/i }))

    await waitFor(() => {
      const confirmBtn = screen.getByRole('button', { name: /đồng ý|xác nhận|có/i })
      fireEvent.click(confirmBtn)
    })

    expect(await screen.findByText('Bạn không có quyền thực hiện hành động này')).toBeInTheDocument()
    expect(DEFAULT_PROPS.onSaved).not.toHaveBeenCalled()
  })
})
