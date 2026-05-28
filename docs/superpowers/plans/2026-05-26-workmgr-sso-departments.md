# Workmgr: Xoá quản lý phòng ban, dùng SSO

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove department CRUD from workmgr and read department data from SSO parent sheet instead.

**Architecture:** Workmgr's `Phòng Ban` sheet is replaced by cross-script reads from SSO's `_Phòng Ban` + `_Phân Bổ`. A transformation layer converts SSO data into workmgr's expected format so auth/permission functions work unchanged. Per-department task sheets (`CV_N`) are preserved and created lazily.

**Tech Stack:** GAS (ES5), React, Vite

---

## Data Mapping

SSO's `_Phòng Ban`: `['ID', 'Tên phòng ban', 'Mô tả', 'Trưởng', 'Phó', 'Người phụ trách', 'Đơn vị thuộc sự quản lý']`
SSO's `_Phân Bổ`: `['ID', 'UserID', 'Chức vụ', 'PhongBanID']`

→ Workmgr format:

| Workmgr field | Source |
|---|---|
| `Tên phòng ban` | `_Phòng Ban.'Tên phòng ban'` |
| `Mô tả` | `_Phòng Ban.'Mô tả'` |
| `Trưởng phòng ID` | `_Phân Bổ` where `Chức vụ='Trưởng phòng'` & `PhongBanID=dept.ID` |
| `Phó phòng ID` | `_Phân Bổ` where `Chức vụ='Phó phòng'` (comma-separated if multiple) |
| `PGĐ phụ trách ID` | `_Phân Bổ` where `Chức vụ='Người phụ trách'` & `PhongBanID=dept.ID` |
| `Thành viên` | All `_Phân Bổ.UserID` where `PhongBanID=dept.ID` (comma-separated) |
| `Đơn vị quản lý` | `_Phòng Ban.'Đơn vị thuộc sự quản lý'` |
| `Sheet Name` | Convention: `'CV_' + dept.ID` |

## File Changes

### Server (6 files)

| File | Action |
|---|---|
| `apps/workmgr/src/server/sheets.js` | Modify — `getAllData()` reads SSO `_Phòng Ban` + `_Phân Bổ` cross-script |
| `apps/workmgr/src/server/departments.js` | Modify — remove CRUD, keep `getDashboardStats`, adapt `getDepartments` |
| `apps/workmgr/src/server/tasks.js` | Modify — `_getTaskSheetName()` uses `CV_{id}` convention + lazy create |
| `apps/workmgr/src/server/config.js` | Modify — remove `Phòng Ban` sheet from SHEETS + tabDefs |
| `apps/workmgr/src/server/schedules.js` | Modify — `_findUserDept()` uses SSO data |
| `apps/workmgr/src/server/main.js` | Modify — remove dept CRUD API endpoints |

### Client (5 files)

| File | Action |
|---|---|
| `apps/workmgr/src/client/components/departments/DepartmentListPage.jsx` | Delete |
| `apps/workmgr/src/client/components/departments/DepartmentModal.jsx` | Delete |
| `apps/workmgr/src/client/components/layout/Sidebar.jsx` | Modify — remove dept management tab |
| `apps/workmgr/src/client/components/layout/MainLayout.jsx` | Modify — remove dept route + import |
| `apps/workmgr/src/client/gasClient.js` | Modify — remove dept CRUD mock handlers, update mock phongBan to SSO format |

---

### Task 1: Server — SSO department reader helper

**Files:**
- Modify: `apps/workmgr/src/server/sheets.js`

- [ ] **Step 1: Add `_getSSODepartments()` helper**

Reads SSO parent's `_Phòng Ban` + `_Phân Bổ`, transforms to workmgr format, caches 5 min.

```js
var SSO_DEPTS_CACHE_KEY = 'sso_depts'
var SSO_DEPTS_CACHE_TTL = 300

function _getSSODepartments() {
  var cached = cacheGet(SSO_DEPTS_CACHE_KEY)
  if (cached) return cached

  var parentId = ssoGetParentSheetId()
  if (!parentId) return []

  try {
    var parentSs = SpreadsheetApp.openById(parentId)

    var pbSheet = parentSs.getSheetByName('_Phòng Ban')
    if (!pbSheet) return []
    var depts = rowsToObjects(pbSheet.getDataRange().getValues())

    var phanBoSheet = parentSs.getSheetByName('_Phân Bổ')
    var assignments = phanBoSheet ? rowsToObjects(phanBoSheet.getDataRange().getValues()) : []

    var result = depts.map(function(dept) {
      var deptId = String(dept['ID'])
      var deptAssignments = assignments.filter(function(a) { return String(a['PhongBanID']) === deptId })

      var tpIds = [], ppIds = [], nptIds = [], memberIds = []
      deptAssignments.forEach(function(a) {
        var uid = String(a['UserID'])
        memberIds.push(uid)
        if (a['Chức vụ'] === 'Trưởng phòng') tpIds.push(uid)
        else if (a['Chức vụ'] === 'Phó phòng') ppIds.push(uid)
        else if (a['Chức vụ'] === 'Người phụ trách') nptIds.push(uid)
      })

      return {
        ID: dept['ID'],
        'Tên phòng ban': dept['Tên phòng ban'] || '',
        'Mô tả': dept['Mô tả'] || '',
        'Trưởng phòng ID': tpIds.join(','),
        'Phó phòng ID': ppIds.join(','),
        'PGĐ phụ trách ID': nptIds.join(','),
        'Thành viên': memberIds.join(','),
        'Đơn vị quản lý': dept['Đơn vị thuộc sự quản lý'] || '',
        'Sheet Name': TASK_SHEET_PREFIX + dept['ID'],
      }
    })

    cachePut(SSO_DEPTS_CACHE_KEY, result, SSO_DEPTS_CACHE_TTL)
    return result
  } catch(e) {
    Logger.log('_getSSODepartments error: ' + e.message)
    return []
  }
}
```

- [ ] **Step 2: Update `getAllData()` to use `_getSSODepartments()`**

Replace `getSheetData(SHEETS.PHONG_BAN)` with `_getSSODepartments()`:

```js
return {
  phongBan: _getSSODepartments(),
  nhan:     getSheetData(SHEETS.NHAN),
  users:    users,
}
```

- [ ] **Step 3: Commit**

```
feat(workmgr): read departments from SSO parent sheet
```

---

### Task 2: Server — Update tasks.js to use SSO departments

**Files:**
- Modify: `apps/workmgr/src/server/tasks.js`

- [ ] **Step 1: Rewrite `_getTaskSheetName()` — convention + lazy create**

Replace the current function that reads from `SHEETS.PHONG_BAN`:

```js
function _getTaskSheetName(deptId) {
  return ensureDepartmentTaskSheet(deptId)
}
```

`ensureDepartmentTaskSheet(deptId)` (in config.js) already uses `CV_` + deptId and creates the sheet if missing.

- [ ] **Step 2: Update `getTasks()` — use `_getSSODepartments()`**

Line 45: replace `getSheetData(SHEETS.PHONG_BAN)` → `_getSSODepartments()`

- [ ] **Step 3: Update `_getDeptById()` — use `_getSSODepartments()`**

```js
function _getDeptById(deptId) {
  var depts = _getSSODepartments()
  return depts.find(function(d) { return String(d['ID']) === String(deptId) })
}
```

- [ ] **Step 4: Update `_isLeaderOfDept()` — support comma-separated IDs**

Phó phòng can be multiple in SSO. Update check:

```js
function _isLeaderOfDept(dept, userId) {
  var uid = String(userId)
  if (String(dept['Trưởng phòng ID']).split(',').indexOf(uid) !== -1) return true
  if (String(dept['Phó phòng ID']).split(',').indexOf(uid) !== -1) return true
  if (String(dept['PGĐ phụ trách ID']).split(',').indexOf(uid) !== -1) return true
  return false
}
```

- [ ] **Step 5: Commit**

```
refactor(workmgr): tasks.js reads SSO departments
```

---

### Task 3: Server — Update auth.js for comma-separated IDs

**Files:**
- Modify: `apps/workmgr/src/server/auth.js`

- [ ] **Step 1: Update `_isPGDOfDept()` — support comma-separated**

```js
function _isPGDOfDept(session, dept) {
  if (!dept) return false
  return String(dept['PGĐ phụ trách ID'] || '').split(',').indexOf(String(session.userId)) !== -1
}
```

- [ ] **Step 2: Update `_isLeaderOfDept()` — support comma-separated**

```js
function _isLeaderOfDept(session, dept) {
  if (!dept) return false
  var uid = String(session.userId)
  return String(dept['Trưởng phòng ID'] || '').split(',').indexOf(uid) !== -1 ||
    String(dept['Phó phòng ID'] || '').split(',').indexOf(uid) !== -1
}
```

- [ ] **Step 3: Commit**

```
fix(workmgr): auth permission checks support multi-user fields
```

---

### Task 4: Server — Update departments.js + schedules.js + config.js

**Files:**
- Modify: `apps/workmgr/src/server/departments.js`
- Modify: `apps/workmgr/src/server/schedules.js`
- Modify: `apps/workmgr/src/server/config.js`

- [ ] **Step 1: departments.js — remove CRUD, update reads**

Remove `createDepartment`, `updateDepartment`, `_deleteDepartment` functions.

Update `getDepartments`:
```js
function getDepartments(token, filters) {
  requireAuth(token)
  return _getSSODepartments()
}
```

Update `getDashboardStats`:
- Line 102: `getDataVersion(SHEETS.PHONG_BAN)` → remove from cache key (sheet no longer exists locally). Use a simple timestamp-based cache key instead.
- Line 108: `getSheetData(SHEETS.PHONG_BAN)` → `_getSSODepartments()`
- Line 229: `depts.some(function(d) { return String(d['PGĐ phụ trách ID']) === ...` → support comma-separated: use `.split(',').indexOf(...)`.

- [ ] **Step 2: schedules.js — `_findUserDept()` uses SSO depts**

Replace `getSheetData(SHEETS.PHONG_BAN)` → `_getSSODepartments()` in `_findUserDept()`.

- [ ] **Step 3: config.js — remove PHONG_BAN from SHEETS + tabDefs**

Remove `PHONG_BAN: 'Phòng Ban'` from SHEETS object.
Remove the `{ name: SHEETS.PHONG_BAN, headers: [...] }` entry from tabDefs.
Remove `getAllDeptTaskSheetNames()` function (reads local sheet).
Bump `SCHEMA_V` to `'3'`.

- [ ] **Step 4: Commit**

```
refactor(workmgr): remove local dept management, use SSO
```

---

### Task 5: Server — Remove dept CRUD API endpoints from main.js

**Files:**
- Modify: `apps/workmgr/src/server/main.js`

- [ ] **Step 1: Remove API wrappers**

Delete:
- `api_createDepartment(token, data)`
- `api_updateDepartment(token, id, data)`
- `api_deleteDepartment(token, id)`

Keep:
- `api_getDepartments(token, filters)` (now reads from SSO)
- `api_getDashboardStats(token, filters)`

- [ ] **Step 2: Remove audit log entries for dept CRUD**

Any `logAudit` calls referencing "phòng ban" creation/update/deletion are now dead code in departments.js — already removed in Task 4.

- [ ] **Step 3: Commit**

```
refactor(workmgr): remove dept CRUD API endpoints
```

---

### Task 6: Client — Remove dept management UI

**Files:**
- Delete: `apps/workmgr/src/client/components/departments/DepartmentListPage.jsx`
- Delete: `apps/workmgr/src/client/components/departments/DepartmentModal.jsx`
- Modify: `apps/workmgr/src/client/components/layout/Sidebar.jsx`
- Modify: `apps/workmgr/src/client/components/layout/MainLayout.jsx`

- [ ] **Step 1: Delete department components**

```bash
rm apps/workmgr/src/client/components/departments/DepartmentListPage.jsx
rm apps/workmgr/src/client/components/departments/DepartmentModal.jsx
```

Check if directory is empty, remove if so:
```bash
rmdir apps/workmgr/src/client/components/departments/ 2>/dev/null
```

- [ ] **Step 2: Remove dept tab from Sidebar.jsx**

Remove the "Phòng/ Ban/ NM" nav item (the one with `apartment` icon and `adminOnly: true`).

- [ ] **Step 3: Remove dept route from MainLayout.jsx**

Remove the import of `DepartmentListPage` and its route case.
Remove `DepartmentModal` import and its trigger (if any).

- [ ] **Step 4: Commit**

```
refactor(workmgr): remove dept management UI
```

---

### Task 7: Client — Update gasClient.js mock

**Files:**
- Modify: `apps/workmgr/src/client/gasClient.js`

- [ ] **Step 1: Update mock phongBan data to SSO format**

Replace current mock phongBan that has `Trưởng phòng ID`, `Sheet Name`, etc. with enriched SSO format (same shape, fields derived from assignments):

```js
phongBan: [
  {
    ID: 1, 'Tên phòng ban': 'Phòng Công Nghệ', 'Mô tả': 'Phát triển phần mềm',
    'Trưởng phòng ID': '2', 'Phó phòng ID': '', 'PGĐ phụ trách ID': '',
    'Thành viên': '2,3', 'Đơn vị quản lý': '', 'Sheet Name': 'CV_1',
  },
  // ... other depts
],
```

- [ ] **Step 2: Remove dept CRUD mock handlers**

Remove `api_createDepartment`, `api_updateDepartment`, `api_deleteDepartment` from the switch statement.

- [ ] **Step 3: Commit**

```
refactor(workmgr): update mock data, remove dept CRUD mocks
```

---

### Task 8: Verify

- [ ] **Step 1: Run dev server**

```bash
npm run dev:workmgr
```

Verify: app loads, no "Phòng/ Ban/ NM" tab in sidebar.

- [ ] **Step 2: Check task views**

Navigate to task list, Kanban, calendar — department filters still work using SSO-sourced data.

- [ ] **Step 3: Check dashboard**

Dashboard shows dept distribution stats.

- [ ] **Step 4: Check permission model**

Create task as admin → works.
Switch mock user to TP → can manage own dept tasks only.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(workmgr): replace local dept management with SSO departments"
```
