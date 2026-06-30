// Mirror of server-side permission rules (apps/workmgr/src/server/auth.js).
// Used for client-side gating of buttons / drag handles.
// Server still enforces; this is purely UX.

const ADMIN_ROLES = ['admin', 'Quản trị viên', 'Giám đốc']

export function isAdminRole(role) {
  return ADMIN_ROLES.includes(role)
}

export function isPGDOfDept(session, dept) {
  if (!session || !dept) return false
  return String(dept['PGĐ phụ trách ID']) === String(session.userId)
}

export function isLeaderOfDept(session, dept) {
  if (!session || !dept) return false
  const uid = String(session.userId)
  return String(dept['Trưởng phòng ID']) === uid || String(dept['Phó phòng ID']) === uid
}

/** Only Admin/GĐ can create/edit/delete the dept row itself. */
export function canManageDept(session) {
  return isAdminRole(session?.role)
}

/** Create/edit/delete tasks in a dept: Admin/GĐ + PGĐ phụ trách + Trưởng/Phó phòng. */
export function canManageDeptTasks(session, dept) {
  if (!session) return false
  if (isAdminRole(session.role)) return true
  if (isPGDOfDept(session, dept)) return true
  if (isLeaderOfDept(session, dept)) return true
  return false
}

/** Update task progress: managers above + assignee. */
export function canUpdateTaskProgress(session, dept, task) {
  if (canManageDeptTasks(session, dept)) return true
  if (task && String(task['Người thực hiện ID']) === String(session?.userId)) return true
  return false
}

/** Whether a Kanban move from one status to another is allowed for the user. */
export function canMoveTaskStatus(session, dept, task, fromStatus, toStatus) {
  if (!session) return false
  if (isAdminRole(session.role)) return true
  const isAssignee = task && String(task['Người thực hiện ID']) === String(session.userId)
  const isLeaderOrPGD = isLeaderOfDept(session, dept) || isPGDOfDept(session, dept)

  if (toStatus === 'Hoàn Thành') return isLeaderOrPGD
  if ((fromStatus === 'Cần Làm' && toStatus === 'Đang Thực Hiện') ||
      (fromStatus === 'Đang Thực Hiện' && toStatus === 'Chờ Duyệt')) {
    return isAssignee || isLeaderOrPGD
  }
  return isLeaderOrPGD
}
