// Pure permission logic for the doc workflow. Tested in workflowPermissions.test.js.
// Mirrors WORKFLOW_ACTIONS in apps/docmgr/src/server/documents.js — keep in sync.

export function parsePhuTrach(value) {
  if (value == null || value === '') return []
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === 'string' && value.charAt(0) === '[') {
    try { return JSON.parse(value).map(String) } catch (_) { /* fall through */ }
  }
  return [String(value)]
}

export function isPhuTrach(doc, session) {
  if (!doc || !session) return false
  const list = parsePhuTrach(doc['Phụ trách'])
  return list.includes(String(session.userId)) || list.includes(session.username)
}

const ADMIN_ROLES = ['admin', 'Quản trị viên']

const ACTIONS = {
  giaoViec:  { key: 'giaoViec',  label: 'Giao việc',  icon: 'assignment_ind', color: 'primary' },
  thuHoi:    { key: 'thuHoi',    label: 'Thu hồi',     icon: 'undo',          color: 'amber'   },
  nhanViec:  { key: 'nhanViec',  label: 'Nhận việc',   icon: 'check_circle',  color: 'blue'    },
  hoanThanh: { key: 'hoanThanh', label: 'Hoàn thành',  icon: 'task_alt',      color: 'emerald' },
}

const ADMIN_ACTIONS = {
  '':           ['giaoViec'],
  'Chờ duyệt':  ['giaoViec'],
  'Chờ xử lý':  ['thuHoi', 'nhanViec'],
  'Đang xử lý': ['hoanThanh'],
}

const GIAM_DOC_ACTIONS = {
  'Chờ duyệt': ['giaoViec'],
  'Chờ xử lý': ['thuHoi'],
}

const PHUTRACH_ACTIONS = {
  'Chờ xử lý':  ['nhanViec'],
  'Đang xử lý': ['hoanThanh'],
}

export function getAvailableActions(doc, session) {
  if (!doc || !session) return []
  const status = doc['Tình trạng'] || ''
  const role = session.role || ''

  let keys = []
  const isAdmin = ADMIN_ROLES.includes(role)

  if (isAdmin) {
    keys = ADMIN_ACTIONS[status] || []
  } else if (role === 'Giám đốc') {
    keys = GIAM_DOC_ACTIONS[status] || []
  } else if (isPhuTrach(doc, session)) {
    keys = PHUTRACH_ACTIONS[status] || []
  }

  return keys.map(k => ACTIONS[k])
}
