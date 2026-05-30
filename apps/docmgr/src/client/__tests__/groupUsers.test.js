import { groupUsersByDept } from '../utils/groupUsers'

const users = [
  { ID: 1, 'Tên đăng nhập': 'gd', 'Tên nhân viên': 'Giám đốc A' },
  { ID: 2, 'Tên đăng nhập': 'vt', 'Tên nhân viên': 'Văn thư B' },
  { ID: 3, 'Tên đăng nhập': 'nv', 'Tên nhân viên': 'Nhân viên C' },
]

const phongBan = [
  { ID: 10, 'Tên phòng ban': 'Phòng Kỹ thuật' },
]

const assignments = [
  { UserID: 1, PhongBanID: '', 'Chức vụ': 'Giám đốc' },
  { UserID: 2, PhongBanID: '', 'Chức vụ': 'Văn thư' },
  { UserID: 3, PhongBanID: 10, 'Chức vụ': 'Nhân viên' },
]

describe('groupUsersByDept — excludeGroups', () => {
  test('without excludeGroups, returns all groups including Ban Giám Đốc and Văn thư & Quản trị', () => {
    const groups = groupUsersByDept(users, phongBan, assignments)
    const names = groups.map(g => g.name)
    expect(names).toContain('Ban Giám Đốc')
    expect(names).toContain('Văn thư & Quản trị')
    expect(names).toContain('Phòng Kỹ thuật')
  })

  test('excludeGroups hides specified groups', () => {
    const groups = groupUsersByDept(users, phongBan, assignments, ['Ban Giám Đốc', 'Văn thư & Quản trị'])
    const names = groups.map(g => g.name)
    expect(names).not.toContain('Ban Giám Đốc')
    expect(names).not.toContain('Văn thư & Quản trị')
    expect(names).toContain('Phòng Kỹ thuật')
  })

  test('excludeGroups with empty array returns all groups', () => {
    const groups = groupUsersByDept(users, phongBan, assignments, [])
    const names = groups.map(g => g.name)
    expect(names).toContain('Ban Giám Đốc')
    expect(names).toContain('Văn thư & Quản trị')
  })
})
