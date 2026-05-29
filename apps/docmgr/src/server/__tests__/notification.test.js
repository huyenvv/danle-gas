require('./setup.js')
const { resetAll, setupRoleSheets, setupDocSheets, seedUser, createSession } = require('./helpers')

const PARENT_ID = 'parent-sso-sheet-id'

function setupSSOParent(opts) {
  opts = opts || {}
  // _Hệ Thống with MAIL_ENABLED — use boolean true to mirror Google Sheets behavior
  SpreadsheetApp._addExternalSheet(PARENT_ID, '_Hệ Thống', [
    ['Key', 'Value'],
    ['MAIL_ENABLED', opts.mailEnabled !== undefined ? opts.mailEnabled : true],
    ['MAIL_SENDER_NAME', opts.senderName || 'Test System'],
  ])
  // _Người Dùng — SSO users with email
  SpreadsheetApp._addExternalSheet(PARENT_ID, '_Người Dùng', [
    ['ID', 'Tên đăng nhập', 'Email', 'Tên nhân viên', 'Trạng thái', 'Mật khẩu', 'Quyền'],
    [1, 'vanthu', 'vanthu@test.com', 'Nguyễn Văn Thư', 'Active', '', ''],
    [2, 'giamdoc', 'giamdoc@test.com', 'Trần Giám Đốc', 'Active', '', ''],
  ])
  PropertiesService.getScriptProperties().setProperty('SSO_PARENT_SHEET_ID', PARENT_ID)
}

let vanthuToken, directorToken

beforeEach(() => {
  resetAll()
  setupRoleSheets()
  setupDocSheets()

  seedUser(1, 'vanthu', 'vanthu@test.com', 'Văn thư')
  seedUser(2, 'giamdoc', 'giamdoc@test.com', 'Giám đốc')

  SpreadsheetApp._sheets[SHEETS.DANH_MUC]._rows.push(
    [1, 'Hợp đồng', '', '', '', '', '']
  )
  invalidateSheetCache(SHEETS.DANH_MUC)

  vanthuToken = createSession(1, 'vanthu', 'vanthu@test.com', 'Văn thư')
  directorToken = createSession(2, 'giamdoc', 'giamdoc@test.com', 'Giám đốc')
})

describe('Trình duyệt email notification', () => {
  test('Văn thư createDocument with notifyTarget=directors sends email to Giám đốc', () => {
    setupSSOParent()

    const result = createDocument(vanthuToken, {
      'Tên hồ sơ': 'HĐ Mua sắm 001',
      'Danh mục': 1,
    }, null, 'directors')

    expect(result.data['ID']).toBeDefined()
    expect(GmailApp._sent).toHaveLength(1)
    expect(GmailApp._sent[0].to).toBe('giamdoc@test.com')
    expect(GmailApp._sent[0].subject).toContain('HĐ Mua sắm 001')
  })

  test('email not sent when MAIL_ENABLED is missing', () => {
    setupSSOParent({ mailEnabled: '' })

    createDocument(vanthuToken, {
      'Tên hồ sơ': 'HĐ No Mail',
      'Danh mục': 1,
    }, null, 'directors')

    expect(GmailApp._sent).toHaveLength(0)
  })

  test('email sends when MAIL_ENABLED is boolean true (Google Sheets auto-conversion)', () => {
    // This is the exact bug scenario: Google Sheets stores TRUE as boolean true,
    // but the old code compared with string 'TRUE' — so the check failed silently.
    setupSSOParent({ mailEnabled: true })

    createDocument(vanthuToken, {
      'Tên hồ sơ': 'HĐ Boolean Bug',
      'Danh mục': 1,
    }, null, 'directors')

    expect(GmailApp._sent).toHaveLength(1)
    expect(GmailApp._sent[0].to).toBe('giamdoc@test.com')
  })

  test('email sends when MAIL_ENABLED is string TRUE', () => {
    setupSSOParent({ mailEnabled: 'TRUE' })

    createDocument(vanthuToken, {
      'Tên hồ sơ': 'HĐ String TRUE',
      'Danh mục': 1,
    }, null, 'directors')

    expect(GmailApp._sent).toHaveLength(1)
  })

  test('createDocument without notifyTarget does not send email', () => {
    setupSSOParent()

    createDocument(vanthuToken, {
      'Tên hồ sơ': 'HĐ Normal',
      'Danh mục': 1,
    }, null)

    expect(GmailApp._sent).toHaveLength(0)
  })

  test('createDocument succeeds even if email throws (emailError returned)', () => {
    setupSSOParent()
    // Make GmailApp.sendEmail throw
    const origSendEmail = GmailApp.sendEmail.bind(GmailApp)
    GmailApp.sendEmail = () => { throw new Error('Quota exceeded') }

    const result = createDocument(vanthuToken, {
      'Tên hồ sơ': 'HĐ Email Fail',
      'Danh mục': 1,
    }, null, 'directors')

    // Restore mock
    GmailApp.sendEmail = origSendEmail

    expect(result.data['ID']).toBeDefined()
    expect(result.data['Tên hồ sơ']).toBe('HĐ Email Fail')
    expect(result.emailError).toContain('Quota exceeded')
  })

  test('Văn thư can updateDocument on own doc with notifyTarget=directors', () => {
    setupSSOParent()

    // Văn thư creates a doc first (no trình duyệt)
    const created = createDocument(vanthuToken, {
      'Tên hồ sơ': 'HĐ Sửa sau',
      'Danh mục': 1,
    }, null)
    invalidateSheetCache(SHEETS.HO_SO)

    // Later, Văn thư edits and submits for approval
    const updated = updateDocument(vanthuToken, created.data['ID'], {
      'Ghi chú': 'Bổ sung ghi chú',
    }, null, null, 'directors')

    expect(updated.data['Ghi chú']).toBe('Bổ sung ghi chú')
    expect(GmailApp._sent).toHaveLength(1)
    expect(GmailApp._sent[0].to).toBe('giamdoc@test.com')
  })

  test('Văn thư cannot updateDocument on doc created by others', () => {
    createDocument(directorToken, {
      'Tên hồ sơ': 'HĐ Giám đốc tạo',
      'Danh mục': 1,
    }, null)
    invalidateSheetCache(SHEETS.HO_SO)

    expect(() => updateDocument(vanthuToken, 1, {
      'Ghi chú': 'Test',
    }, null)).toThrow('chỉ được chỉnh sửa')
  })
})

describe('Từ chối email notification', () => {
  test('tuChoi sends email to doc creator with rejection reason', () => {
    setupSSOParent()

    createDocument(vanthuToken, {
      'Tên hồ sơ': 'HĐ Bị từ chối',
      'Danh mục': 1,
      'Tình trạng': 'Chờ duyệt',
    }, null)
    invalidateSheetCache(SHEETS.HO_SO)

    transitionDocument(directorToken, 1, 'tuChoi', { lyDoTuChoi: 'Thiếu chữ ký giám đốc' })

    expect(GmailApp._sent).toHaveLength(1)
    expect(GmailApp._sent[0].to).toBe('vanthu@test.com')
    expect(GmailApp._sent[0].subject).toContain('HĐ Bị từ chối')
    expect(GmailApp._sent[0].body).toContain('Thiếu chữ ký giám đốc')
  })

  test('tuChoi email contains {lyDoTuChoi} in body', () => {
    setupSSOParent()

    createDocument(vanthuToken, {
      'Tên hồ sơ': 'HĐ Lý Do',
      'Danh mục': 1,
      'Tình trạng': 'Chờ duyệt',
    }, null)
    invalidateSheetCache(SHEETS.HO_SO)

    transitionDocument(directorToken, 1, 'tuChoi', { lyDoTuChoi: 'Sai số hợp đồng' })

    const sent = GmailApp._sent[0]
    expect(sent.body).toContain('Sai số hợp đồng')
    expect(sent.body).not.toContain('{lyDoTuChoi}')
  })
})

describe('Phát hành email notification', () => {
  test('publishDocument sends email to specified users', () => {
    setupSSOParent()

    // Create a doc first
    createDocument(directorToken, {
      'Tên hồ sơ': 'Thông báo nội bộ',
      'Danh mục': 1,
    }, null)
    invalidateSheetCache(SHEETS.HO_SO)

    // Publish to vanthu (userId 1)
    publishDocument(directorToken, 1, [1], [])

    expect(GmailApp._sent).toHaveLength(1)
    expect(GmailApp._sent[0].to).toBe('vanthu@test.com')
    expect(GmailApp._sent[0].subject).toContain('Thông báo nội bộ')
  })

  test('publishDocument fails silently when MAIL_ENABLED is boolean false', () => {
    setupSSOParent({ mailEnabled: false })

    createDocument(directorToken, {
      'Tên hồ sơ': 'No Mail',
      'Danh mục': 1,
    }, null)
    invalidateSheetCache(SHEETS.HO_SO)

    publishDocument(directorToken, 1, [1], [])

    expect(GmailApp._sent).toHaveLength(0)
  })
})
