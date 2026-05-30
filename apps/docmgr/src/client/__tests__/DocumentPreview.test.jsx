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
})
