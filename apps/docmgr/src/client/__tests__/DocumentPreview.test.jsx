import { screen, fireEvent, waitFor } from '@testing-library/react'
import DocumentPreview from '../components/documents/DocumentPreview.jsx'
import gasCall from '../gasClient.js'
import { renderWithProviders } from './helpers/render.jsx'
import { MOCK_TOKEN, MOCK_ADMIN_SESSION, MOCK_LOOKUPS, MOCK_DOCS, MOCK_COMMENTS } from './helpers/mockData.js'

jest.mock('../gasClient.js')

const MOCK_DOC = MOCK_DOCS[0]

const DEFAULT_PROPS = {
  doc: MOCK_DOC,
  lookups: MOCK_LOOKUPS,
  isAdmin: true,
  canDelete: true,
  token: MOCK_TOKEN,
  session: MOCK_ADMIN_SESSION,
  onClose: jest.fn(),
  onEdit: jest.fn(),
  onDelete: jest.fn(),
  onDocUpdated: jest.fn(),
}

function renderPreview(overrides = {}) {
  return renderWithProviders(<DocumentPreview {...DEFAULT_PROPS} {...overrides} />)
}

beforeEach(() => {
  gasCall.mockReset()
  gasCall.mockImplementation((fn) => {
    if (fn === 'api_getComments') return Promise.resolve({ data: MOCK_COMMENTS })
    if (fn === 'api_markAsRead') return Promise.resolve({ success: true })
    return Promise.reject(new Error('Unhandled mock: ' + fn))
  })
})

describe('<DocumentPreview />', () => {
  test('Details - shows doc name and status', async () => {
    renderPreview()
    expect(screen.getByText('Hợp đồng mua sắm CNTT')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText('Chờ duyệt')).toBeInTheDocument()
    })
  })

  test('Phân quyền xem: vai trò toàn quyền bấm "Sửa" → mở CÙNG ViewerPickerModal (popup)', () => {
    renderPreview() // MOCK_ADMIN_SESSION (role admin) → canManageViewers
    expect(screen.queryByTestId('vpm')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('edit-viewers-btn'))
    expect(screen.getByTestId('vpm')).toBeInTheDocument() // popup dùng chung với add/edit
  })

  test('Details - shows creator name', async () => {
    renderPreview()
    // creator 'admin' → looks up MOCK_USERS → 'Tên nhân viên': 'Admin'
    // 'Admin' appears in multiple places (Phụ trách + Người tạo), use getAllByText
    await waitFor(() => {
      const matches = screen.getAllByText('Admin')
      expect(matches.length).toBeGreaterThan(0)
    })
    // Also verify the "Người tạo" label is present to confirm the section rendered
    expect(screen.getByText('Người tạo')).toBeInTheDocument()
  })

  test('Comments - loads comments on mount', async () => {
    renderPreview()
    await waitFor(() => {
      expect(gasCall).toHaveBeenCalledWith('api_getComments', MOCK_TOKEN, MOCK_DOC.ID)
    })
    await waitFor(() => {
      expect(screen.getByText('Bình luận đầu tiên')).toBeInTheDocument()
    })
  })

  test('Comments - submitting adds comment via api_addComment', async () => {
    const newComment = {
      ID: 99,
      DocID: MOCK_DOC.ID,
      UserID: 1,
      'Tên người dùng': 'admin',
      'Nội dung': 'Bình luận mới',
      'Thời gian': new Date().toISOString(),
    }
    gasCall.mockImplementation((fn) => {
      if (fn === 'api_getComments') return Promise.resolve({ data: MOCK_COMMENTS })
      if (fn === 'api_markAsRead') return Promise.resolve({ success: true })
      if (fn === 'api_addComment') return Promise.resolve({ data: newComment })
      return Promise.reject(new Error('Unhandled mock: ' + fn))
    })

    renderPreview()

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Bình luận đầu tiên')).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText('Nhập bình luận...')
    fireEvent.change(input, { target: { value: 'Bình luận mới' } })
    fireEvent.submit(input.closest('form'))

    await waitFor(() => {
      expect(gasCall).toHaveBeenCalledWith('api_addComment', MOCK_TOKEN, MOCK_DOC.ID, 'Bình luận mới')
    })
    await waitFor(() => {
      expect(screen.getByText('Bình luận mới')).toBeInTheDocument()
    })
  })

  test('Comments - failed add removes optimistic entry', async () => {
    gasCall.mockImplementation((fn) => {
      if (fn === 'api_getComments') return Promise.resolve({ data: MOCK_COMMENTS })
      if (fn === 'api_markAsRead') return Promise.resolve({ success: true })
      if (fn === 'api_addComment') return Promise.reject(new Error('Lỗi server'))
      return Promise.reject(new Error('Unhandled mock: ' + fn))
    })

    renderPreview()

    await waitFor(() => {
      expect(screen.getByText('Bình luận đầu tiên')).toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText('Nhập bình luận...')
    fireEvent.change(input, { target: { value: 'Comment sẽ bị xóa' } })
    fireEvent.submit(input.closest('form'))

    // Optimistic comment appears briefly
    await waitFor(() => {
      expect(gasCall).toHaveBeenCalledWith('api_addComment', MOCK_TOKEN, MOCK_DOC.ID, 'Comment sẽ bị xóa')
    })

    // After rejection, optimistic comment is removed
    await waitFor(() => {
      expect(screen.queryByText('Comment sẽ bị xóa')).not.toBeInTheDocument()
    })
  })

  test('Edit - VT (creator) sees edit button on Từ chối doc', async () => {
    const vanThuSession = {
      ...MOCK_ADMIN_SESSION,
      userId: 3,
      username: 'vanthu',
      role: 'Văn thư',
      canCreate: true,
      canPublish: false,
    }
    const rejectedDoc = {
      ...MOCK_DOC,
      'Tình trạng': 'Từ chối',
      'Lý do từ chối': 'Thiếu file',
      'Người tạo': 'vanthu',
    }
    renderPreview({ doc: rejectedDoc, session: vanThuSession, isAdmin: false, canDelete: false })
    await waitFor(() => {
      expect(screen.getByText('Từ chối')).toBeInTheDocument()
    })
    expect(screen.getByText('Chỉnh sửa')).toBeInTheDocument()
  })

  test('Edit - VT (not creator) does not see edit button on Từ chối doc', async () => {
    const vanThuSession = {
      ...MOCK_ADMIN_SESSION,
      userId: 3,
      username: 'vanthu',
      role: 'Văn thư',
      canCreate: true,
      canPublish: false,
    }
    const rejectedDoc = {
      ...MOCK_DOC,
      'Tình trạng': 'Từ chối',
      'Lý do từ chối': 'Thiếu file',
      'Người tạo': 'othervanthu',
    }
    renderPreview({ doc: rejectedDoc, session: vanThuSession, isAdmin: false, canDelete: false })
    await waitFor(() => {
      expect(screen.getByText('Từ chối')).toBeInTheDocument()
    })
    expect(screen.queryByText('Chỉnh sửa')).not.toBeInTheDocument()
  })

  test('Publish - VT does not see publish button on Từ chối doc', async () => {
    const vanThuSession = {
      ...MOCK_ADMIN_SESSION,
      userId: 3,
      username: 'vanthu',
      role: 'Văn thư',
      canCreate: true,
      canPublish: false,
    }
    const rejectedDoc = {
      ...MOCK_DOC,
      'Tình trạng': 'Từ chối',
      'Lý do từ chối': 'Thiếu file',
      'Người tạo': 'vanthu',
    }
    renderPreview({ doc: rejectedDoc, session: vanThuSession, isAdmin: false, canDelete: false })
    await waitFor(() => {
      expect(screen.getByText('Từ chối')).toBeInTheDocument()
    })
    expect(screen.queryByText('Phát hành')).not.toBeInTheDocument()
  })

  test('Publish - VT sees publish button on Hoàn thành doc', async () => {
    const vanThuSession = {
      ...MOCK_ADMIN_SESSION,
      userId: 3,
      username: 'vanthu',
      role: 'Văn thư',
      canCreate: true,
      canPublish: false,
    }
    const completedDoc = {
      ...MOCK_DOC,
      'Tình trạng': 'Hoàn thành',
      'Người tạo': 'vanthu',
    }
    renderPreview({ doc: completedDoc, session: vanThuSession, isAdmin: false, canDelete: false })
    await waitFor(() => {
      expect(screen.getByText('Hoàn thành')).toBeInTheDocument()
    })
    expect(screen.getByText('Phát hành')).toBeInTheDocument()
  })

  test('PT does NOT see edit button on Từ chối kết quả doc', async () => {
    const ptSession = {
      ...MOCK_ADMIN_SESSION,
      userId: 5,
      username: 'staff1',
      role: 'Nhân viên',
      canCreate: false,
      canPublish: false,
    }
    const rejectedResultDoc = {
      ...MOCK_DOC,
      'Tình trạng': 'Từ chối kết quả',
      'Lý do từ chối': 'Chưa đủ',
      'Phụ trách': JSON.stringify(['staff1']),
    }
    renderPreview({ doc: rejectedResultDoc, session: ptSession, isAdmin: false, canDelete: false })
    await waitFor(() => {
      expect(screen.getByText('Từ chối kết quả')).toBeInTheDocument()
    })
    expect(screen.queryByText('Chỉnh sửa')).not.toBeInTheDocument()
    // But should see Hoàn thành button
    expect(screen.getByText('Hoàn thành')).toBeInTheDocument()
  })

  test('PT sees rejection banner on Từ chối kết quả doc', async () => {
    const ptSession = {
      ...MOCK_ADMIN_SESSION,
      userId: 5,
      username: 'staff1',
      role: 'Nhân viên',
    }
    const rejectedResultDoc = {
      ...MOCK_DOC,
      'Tình trạng': 'Từ chối kết quả',
      'Lý do từ chối': 'Thiếu báo cáo',
      'Phụ trách': JSON.stringify(['staff1']),
    }
    renderPreview({ doc: rejectedResultDoc, session: ptSession, isAdmin: false, canDelete: false })
    await waitFor(() => {
      expect(screen.getByText('Thiếu báo cáo')).toBeInTheDocument()
    })
  })

  test('tuChoiKetQua reason dialog preserves action key when typing', async () => {
    // GĐ on Chờ xác nhận HT → click Từ chối → type reason → submit should send tuChoiKetQua not tuChoi
    const gdSession = {
      ...MOCK_ADMIN_SESSION,
      userId: 2,
      username: 'giamdoc',
      role: 'Giám đốc',
    }
    const pendingDoc = {
      ...MOCK_DOC,
      'Tình trạng': 'Chờ xác nhận HT',
    }
    gasCall.mockImplementation((fn) => {
      if (fn === 'api_getComments') return Promise.resolve({ data: [] })
      if (fn === 'api_markAsRead') return Promise.resolve({ success: true })
      if (fn === 'api_transitionDocument') return Promise.resolve({ data: { ...pendingDoc, 'Tình trạng': 'Từ chối kết quả' } })
      return Promise.resolve({})
    })

    renderPreview({ doc: pendingDoc, session: gdSession, isAdmin: false, canDelete: false })

    // Find and click Từ chối button (tuChoiKetQua action)
    await waitFor(() => {
      expect(screen.getByText('Từ chối')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Từ chối'))

    // Type reason (this used to overwrite action key)
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Nhập lý do từ chối…')).toBeInTheDocument()
    })
    fireEvent.change(screen.getByPlaceholderText('Nhập lý do từ chối…'), { target: { value: 'Chưa đạt yêu cầu' } })

    // Click submit
    fireEvent.click(screen.getByText('Xác nhận từ chối'))

    // Confirm dialog — use the confirm context's "Xác nhận" button (exact match to avoid collision with "Xác nhận HT" and "Xác nhận từ chối")
    await waitFor(() => {
      const allBtns = screen.getAllByRole('button')
      const confirmBtn = allBtns.find(b => b.textContent.trim() === 'Xác nhận')
      expect(confirmBtn).toBeTruthy()
      fireEvent.click(confirmBtn)
    })

    // Should call tuChoiKetQua, NOT tuChoi
    await waitFor(() => {
      expect(gasCall).toHaveBeenCalledWith(
        'api_transitionDocument',
        expect.any(String),
        expect.anything(),
        'tuChoiKetQua',
        { lyDoTuChoi: 'Chưa đạt yêu cầu' },
      )
    })
  })

  test('giao việc form has a content field and sends it as Nội dung', async () => {
    const gdSession = { ...MOCK_ADMIN_SESSION, userId: 2, username: 'giamdoc', role: 'Giám đốc' }
    const choDuyetDoc = { ...MOCK_DOC, 'Tình trạng': 'Chờ duyệt' }
    gasCall.mockImplementation((fn) => {
      if (fn === 'api_getComments') return Promise.resolve({ data: [] })
      if (fn === 'api_markAsRead') return Promise.resolve({ success: true })
      if (fn === 'api_transitionDocument') return Promise.resolve({ data: { ...choDuyetDoc, 'Tình trạng': 'Chờ xử lý' } })
      return Promise.resolve({})
    })

    renderPreview({ doc: choDuyetDoc, session: gdSession, isAdmin: false, canDelete: false })

    // Open the giao việc form
    await waitFor(() => expect(screen.getByRole('button', { name: /giao việc/i })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /giao việc/i }))

    // The content field is present
    const noiDung = await screen.findByPlaceholderText('Nhập nội dung giao việc… (bắt buộc nếu có người phối hợp)')
    fireEvent.change(noiDung, { target: { value: 'Ưu tiên xử lý trong tuần' } })

    // Pick a Phụ trách (single-select picker shows the '-- Chọn --' placeholder when empty)
    fireEvent.click(screen.getByText('-- Chọn --'))
    fireEvent.click(screen.getByText('Viewer One'))

    // Confirm giao việc
    fireEvent.click(screen.getByText('Xác nhận giao việc'))
    await waitFor(() => {
      const confirmBtn = screen.getAllByRole('button').find(b => b.textContent.trim() === 'Xác nhận')
      expect(confirmBtn).toBeTruthy()
      fireEvent.click(confirmBtn)
    })

    await waitFor(() => {
      expect(gasCall).toHaveBeenCalledWith(
        'api_transitionDocument', expect.any(String), '1', 'giaoViec',
        expect.objectContaining({ 'Nội dung': 'Ưu tiên xử lý trong tuần' }),
      )
    })
  })

  test('Workflow - renders at least one action button for admin + Chờ duyệt', async () => {
    renderPreview()
    // Admin with 'Chờ duyệt' status → canEditDoc is true (admin role) → "Chỉnh sửa" button visible
    // Also canDelete=true → "Xóa" button visible
    await waitFor(() => {
      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)
    })
    // At least the delete button should be present
    expect(screen.getByText('Xóa')).toBeInTheDocument()
  })

  // ── YC Phát hành: publish button visibility ──

  test('Publish - VT (creator) sees publish button on YC Phát hành doc', async () => {
    const vanThuSession = {
      ...MOCK_ADMIN_SESSION,
      userId: 3, username: 'vanthu', role: 'Văn thư',
      canCreate: true, canPublish: false,
    }
    const ycDoc = { ...MOCK_DOC, 'Tình trạng': 'YC Phát hành', 'Lý do từ chối': 'Phát hành gấp', 'Người tạo': 'vanthu' }
    renderPreview({ doc: ycDoc, session: vanThuSession, isAdmin: false, canDelete: false })
    await waitFor(() => { expect(screen.getByText('YC Phát hành')).toBeInTheDocument() })
    expect(screen.getByText('Phát hành')).toBeInTheDocument()
  })

  test('Publish - VT (non-creator) does NOT see publish button on YC Phát hành doc', async () => {
    const vanThuSession = {
      ...MOCK_ADMIN_SESSION,
      userId: 3, username: 'vanthu', role: 'Văn thư',
      canCreate: true, canPublish: false,
    }
    const ycDoc = { ...MOCK_DOC, 'Tình trạng': 'YC Phát hành', 'Lý do từ chối': 'Phát hành gấp', 'Người tạo': 'othervt' }
    renderPreview({ doc: ycDoc, session: vanThuSession, isAdmin: false, canDelete: false })
    await waitFor(() => { expect(screen.getByText('YC Phát hành')).toBeInTheDocument() })
    expect(screen.queryByText('Phát hành')).not.toBeInTheDocument()
  })

  test('Publish - admin sees publish button on YC Phát hành doc regardless of creator', async () => {
    const ycDoc = { ...MOCK_DOC, 'Tình trạng': 'YC Phát hành', 'Lý do từ chối': 'Gấp', 'Người tạo': 'othervt' }
    renderPreview({ doc: ycDoc })
    await waitFor(() => { expect(screen.getByText('YC Phát hành')).toBeInTheDocument() })
    expect(screen.getByText('Phát hành')).toBeInTheDocument()
  })

  // ── YC Phát hành: edit button visibility ──

  test('Edit - VT (creator) does NOT see edit button on YC Phát hành doc', async () => {
    const vanThuSession = {
      ...MOCK_ADMIN_SESSION,
      userId: 3, username: 'vanthu', role: 'Văn thư',
      canCreate: true, canPublish: false,
    }
    const ycDoc = { ...MOCK_DOC, 'Tình trạng': 'YC Phát hành', 'Người tạo': 'vanthu' }
    renderPreview({ doc: ycDoc, session: vanThuSession, isAdmin: false, canDelete: false })
    await waitFor(() => { expect(screen.getByText('YC Phát hành')).toBeInTheDocument() })
    expect(screen.queryByText('Chỉnh sửa')).not.toBeInTheDocument()
  })

  test('Edit - admin sees edit button on YC Phát hành doc', async () => {
    const ycDoc = { ...MOCK_DOC, 'Tình trạng': 'YC Phát hành', 'Người tạo': 'othervt' }
    renderPreview({ doc: ycDoc })
    await waitFor(() => { expect(screen.getByText('YC Phát hành')).toBeInTheDocument() })
    expect(screen.getByText('Chỉnh sửa')).toBeInTheDocument()
  })

  // ── YC Phát hành: reason banner ──

  test('Banner - shows amber reason banner on YC Phát hành doc', async () => {
    const ycDoc = { ...MOCK_DOC, 'Tình trạng': 'YC Phát hành', 'Lý do từ chối': 'Cần phát hành ngay' }
    renderPreview({ doc: ycDoc })
    await waitFor(() => {
      expect(screen.getByText('Lý do yêu cầu phát hành')).toBeInTheDocument()
      expect(screen.getByText('Cần phát hành ngay')).toBeInTheDocument()
    })
  })

  // ── Publish button: NOT visible on other statuses ──

  test('Publish - VT does NOT see publish button on Chờ duyệt doc', async () => {
    const vanThuSession = {
      ...MOCK_ADMIN_SESSION,
      userId: 3, username: 'vanthu', role: 'Văn thư',
      canCreate: true, canPublish: false,
    }
    const doc = { ...MOCK_DOC, 'Tình trạng': 'Chờ duyệt', 'Người tạo': 'vanthu' }
    renderPreview({ doc, session: vanThuSession, isAdmin: false, canDelete: false })
    await waitFor(() => { expect(screen.getByText('Chờ duyệt')).toBeInTheDocument() })
    expect(screen.queryByText('Phát hành')).not.toBeInTheDocument()
  })

  test('Publish - VT does NOT see publish button on Đang xử lý doc', async () => {
    const vanThuSession = {
      ...MOCK_ADMIN_SESSION,
      userId: 3, username: 'vanthu', role: 'Văn thư',
      canCreate: true, canPublish: false,
    }
    const doc = { ...MOCK_DOC, 'Tình trạng': 'Đang xử lý', 'Người tạo': 'vanthu' }
    renderPreview({ doc, session: vanThuSession, isAdmin: false, canDelete: false })
    await waitFor(() => { expect(screen.getByText('Đang xử lý')).toBeInTheDocument() })
    expect(screen.queryByText('Phát hành')).not.toBeInTheDocument()
  })

  // ── Nháp: publish button only for creator ──

  test('Publish - VT (creator) sees publish button on Nháp doc', async () => {
    const vanThuSession = {
      ...MOCK_ADMIN_SESSION,
      userId: 3, username: 'vanthu', role: 'Văn thư',
      canCreate: true, canPublish: false,
    }
    const draftDoc = { ...MOCK_DOC, 'Tình trạng': 'Nháp', 'Người tạo': 'vanthu' }
    renderPreview({ doc: draftDoc, session: vanThuSession, isAdmin: false, canDelete: false })
    await waitFor(() => { expect(screen.getByText('Nháp')).toBeInTheDocument() })
    expect(screen.getByText('Phát hành')).toBeInTheDocument()
  })

  test('Publish - VT (non-creator) does NOT see publish button on Nháp doc', async () => {
    const vanThuSession = {
      ...MOCK_ADMIN_SESSION,
      userId: 3, username: 'vanthu', role: 'Văn thư',
      canCreate: true, canPublish: false,
    }
    const draftDoc = { ...MOCK_DOC, 'Tình trạng': 'Nháp', 'Người tạo': 'othervt' }
    renderPreview({ doc: draftDoc, session: vanThuSession, isAdmin: false, canDelete: false })
    await waitFor(() => { expect(screen.getByText('Nháp')).toBeInTheDocument() })
    expect(screen.queryByText('Phát hành')).not.toBeInTheDocument()
  })
})
