require('./setup.js')
const { resetAll, setupRoleSheets, seedUser } = require('./helpers')

const SSO_PARENT_ID = 'sso-parent-id'

function setupSso() {
  ssoStoreParentSheetId(SSO_PARENT_ID)
  SpreadsheetApp._addExternalSheet(SSO_PARENT_ID, '_Người Dùng', [
    ['ID', 'Tên đăng nhập', 'Tên nhân viên', 'Email', 'Trạng thái'],
    [5, 'giamdoc', 'Giám đốc A', 'gd@test.com', 'Active'],
    [9, 'vanthu', 'Văn Thư B', 'vt@test.com', 'Active'],
  ])
  SpreadsheetApp._addExternalSheet(SSO_PARENT_ID, '_Phòng Ban', [
    ['ID', 'Tên phòng ban'],
    [1, 'Phòng Kế hoạch'],
    [2, 'Ban Giám đốc'],
  ])
  SpreadsheetApp._addExternalSheet(SSO_PARENT_ID, '_Phân Bổ', [
    ['ID', 'UserID', 'Chức vụ', 'PhongBanID'],
    [1, 5, 'Giám đốc', 2],
    [2, 9, 'Văn thư', 1],
  ])
}

beforeEach(() => {
  resetAll()
  setupRoleSheets()
  setupSso()
})

describe('recipient resolvers — role + phòng ban from _Phân Bổ', () => {
  test('_getRecipientsByIds returns role and phongBan from _Phân Bổ/_Phòng Ban', () => {
    const r = _getRecipientsByIds([5])
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ email: 'gd@test.com', role: 'Giám đốc', phongBan: 'Ban Giám đốc' })
  })

  test('_getRecipientsByUsernames sources role from _Phân Bổ, NOT the app role', () => {
    // App role intentionally different from the org Chức vụ
    seedUser(9, 'vanthu', 'vt@test.com', 'Nhân viên')
    const r = _getRecipientsByUsernames(['vanthu'])
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ email: 'vt@test.com', role: 'Văn thư', phongBan: 'Phòng Kế hoạch' })
  })
})

describe('_sendNotificationEmails — new template variables', () => {
  test('renders sender role/department and recipient department into the email body', () => {
    SpreadsheetApp._addExternalSheet(SSO_PARENT_ID, '_Hệ Thống', [
      ['Key', 'Value'],
      ['MAIL_ENABLED', 'TRUE'],
    ])
    setConfig('MAIL_TEMPLATES', JSON.stringify({
      test: {
        subject: 'S',
        body: 'gửi:{vaiTròNgườiGửi}|bpGửi:{phòngBanNgườiGửi}|nhận:{vaiTròNgườiNhận}|bpNhận:{phòngBanNgườiNhận}',
      },
    }))

    // Sender = Văn thư (uid 9, Phòng Kế hoạch); recipient = Giám đốc (uid 5, Ban Giám đốc)
    const session = { userId: 9, username: 'vanthu', name: 'Văn Thư B', email: 'vt@test.com', role: 'Văn thư' }
    const recipients = _getRecipientsByIds([5])
    _sendNotificationEmails(recipients, { 'Tên hồ sơ': 'HS1' }, 'test', session)

    expect(GmailApp._sent).toHaveLength(1)
    expect(GmailApp._sent[0].body).toBe('gửi:Văn thư|bpGửi:Phòng Kế hoạch|nhận:Giám đốc|bpNhận:Ban Giám đốc')
  })
})
