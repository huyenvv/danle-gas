require('./setup.js')
const { resetAll, setupRoleSheets, seedUser, createSession } = require('./helpers')

describe('api_updateUser', () => {
  beforeEach(() => {
    resetAll()
    setupRoleSheets()
    seedUser(1, 'director', 'director@test.com', 'Giám đốc')
  })

  test('director cannot assign admin role', () => {
    const directorToken = createSession(1, 'director', 'director@test.com', 'Giám đốc')

    const result = api_updateUser(directorToken, 2, {
      'Tên đăng nhập': 'staff',
      'Quyền': 'admin',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('Giám đốc hoặc admin')
  })

  test('director cannot assign Giám đốc role', () => {
    const directorToken = createSession(1, 'director', 'director@test.com', 'Giám đốc')

    const result = api_updateUser(directorToken, 2, {
      'Tên đăng nhập': 'staff',
      'Quyền': 'Giám đốc',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('Giám đốc hoặc admin')
  })
})