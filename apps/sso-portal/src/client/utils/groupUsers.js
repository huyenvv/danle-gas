const LEADERSHIP_ROLES = new Set(['Giám đốc', 'Phó GĐ'])
const SUPPORT_ROLES = new Set(['Văn thư', 'admin'])

export function groupUsersByDept(users, phongBan, assignments) {
  const allUsers = users || []
  const depts = phongBan || []
  const allAssignments = assignments || []

  const userDeptsMap = {} // userId -> Set<PhongBanID>
  const leadershipIds = new Set()
  const supportIds = new Set()

  allAssignments.forEach(a => {
    const uid = String(a['UserID'])
    if (!a['PhongBanID'] || a['PhongBanID'] === '') {
      if (LEADERSHIP_ROLES.has(a['Chức vụ'])) leadershipIds.add(uid)
      else if (SUPPORT_ROLES.has(a['Chức vụ'])) supportIds.add(uid)
    } else {
      if (!userDeptsMap[uid]) userDeptsMap[uid] = new Set()
      userDeptsMap[uid].add(String(a['PhongBanID']))
    }
  })

  const groups = []
  const placed = new Set()

  // Ban Giám Đốc (always show, even if also assigned to a dept)
  const bgdUsers = allUsers.filter(u => leadershipIds.has(String(u.ID)))
  if (bgdUsers.length > 0) {
    groups.push({ name: 'Ban Giám Đốc', users: bgdUsers, dept: null })
    bgdUsers.forEach(u => placed.add(String(u.ID)))
  }

  // Văn thư & Quản trị (always show, even if also assigned to a dept)
  const vtUsers = allUsers.filter(u => supportIds.has(String(u.ID)) && !leadershipIds.has(String(u.ID)))
  if (vtUsers.length > 0) {
    groups.push({ name: 'Văn thư & Quản trị', users: vtUsers, dept: null })
    vtUsers.forEach(u => placed.add(String(u.ID)))
  }

  // Each department — users can appear in multiple depts (kiêm nhiệm)
  depts.forEach(dept => {
    const deptId = String(dept.ID)
    const du = allUsers.filter(u => userDeptsMap[String(u.ID)]?.has(deptId))
    if (du.length > 0) {
      groups.push({ name: dept['Tên phòng ban'], users: du, dept })
      du.forEach(u => placed.add(String(u.ID)))
    }
  })

  // Chưa phân phòng
  const unassigned = allUsers.filter(u => !placed.has(String(u.ID)))
  if (unassigned.length > 0) {
    groups.push({ name: 'Chưa phân phòng', users: unassigned, dept: null })
  }

  return groups
}
