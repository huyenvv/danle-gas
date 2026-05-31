# Eager Upload with Draft Status — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upload files to Google Drive immediately when selected (eager upload) with per-file progress, using a "Nháp" draft status to prevent orphaned files.

**Architecture:** Four new server APIs (`api_uploadFileEager`, `api_finalizeDraft`, `api_cancelDraft`, `api_deleteFiles`) added to `documents.js` and registered in `main.js`. Client `DocumentModal.jsx` gets new state for eager uploads + progress UI. `updateDocument` gains a 7th parameter `eagerFileInfos` for pre-uploaded files. `statusColor` in `format.js` gains a 'Nháp' entry.

**Tech Stack:** GAS V8 (ES5 `var`/`function` server-side), React + Tailwind (client), Jest + vm context (tests)

---

### Task 1: Server — `uploadFileEager`

**Files:**
- Modify: `apps/docmgr/src/server/documents.js` (add function after `_resolveCategoryPath` at ~line 735)
- Test: `apps/docmgr/src/server/__tests__/documents.test.js`

- [ ] **Step 1: Write failing tests for `uploadFileEager`**

Add at the end of `documents.test.js`:

```js
describe('uploadFileEager', () => {
  test('uploads file and creates draft row when no draftId', () => {
    setConfig('ROOT_FOLDER_ID', 'root123')
    const result = uploadFileEager(directorToken, 'dGVzdA==', 'text/plain', 'test.txt', 1, null)
    expect(result.draftId).toBeTruthy()
    expect(result.fileInfo.fileId).toBeTruthy()
    expect(result.fileInfo.fileName).toBe('test.txt')

    invalidateSheetCache(SHEETS.HO_SO)
    const docs = getSheetData(SHEETS.HO_SO)
    const draft = docs.find(function(d) { return String(d.ID) === String(result.draftId) })
    expect(draft['Tình trạng']).toBe('Nháp')
    expect(draft['Người tạo']).toBe('director')
  })

  test('appends file to existing draft when draftId provided', () => {
    setConfig('ROOT_FOLDER_ID', 'root123')
    const r1 = uploadFileEager(directorToken, 'dGVzdA==', 'text/plain', 'file1.txt', 1, null)
    const r2 = uploadFileEager(directorToken, 'dGVzdA==', 'text/plain', 'file2.txt', 1, r1.draftId)
    expect(r2.fileInfo.fileName).toBe('file2.txt')
    expect(r2.draftId).toBeUndefined()

    invalidateSheetCache(SHEETS.HO_SO)
    const docs = getSheetData(SHEETS.HO_SO)
    const draft = docs.find(function(d) { return String(d.ID) === String(r1.draftId) })
    const files = JSON.parse(draft['File ID'])
    expect(files).toHaveLength(2)
  })

  test('uploads file without creating row when draftId is "edit"', () => {
    setConfig('ROOT_FOLDER_ID', 'root123')
    const result = uploadFileEager(directorToken, 'dGVzdA==', 'text/plain', 'new.txt', 1, 'edit')
    expect(result.fileInfo.fileId).toBeTruthy()
    expect(result.draftId).toBeUndefined()

    invalidateSheetCache(SHEETS.HO_SO)
    const docs = getSheetData(SHEETS.HO_SO)
    expect(docs).toHaveLength(0)
  })

  test('throws when user lacks create permission', () => {
    setConfig('ROOT_FOLDER_ID', 'root123')
    seedUser(2, 'viewer', 'v@test.com', 'Nhân viên')
    const viewerToken = createSession(2, 'viewer', 'v@test.com', 'Nhân viên')
    expect(() => uploadFileEager(viewerToken, 'dGVzdA==', 'text/plain', 'x.txt', 1, null))
      .toThrow('quyền')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest --config apps/docmgr/jest.config.js -t "uploadFileEager" --no-coverage`
Expected: FAIL — `uploadFileEager is not defined`

- [ ] **Step 3: Implement `uploadFileEager`**

Add in `documents.js` after the `_resolveCategoryPath` function (around line 735):

```js
function uploadFileEager(token, base64Data, mimeType, fileName, categoryId, draftId) {
  var session = requireAuth(token)

  // Permission check (same as createDocument)
  var adminRoles = ['admin', 'Quản trị viên', 'Giám đốc', 'Văn thư']
  if (draftId !== 'edit' && adminRoles.indexOf(session.role) === -1) {
    var roles = getSheetData(SHEETS.APP_ROLES)
    var appRole = roles.find(function(r) { return String(r['UserID']) === String(session.userId) && r['AppID'] === APP_ID })
    var allowed = appRole && (appRole['Được tạo hồ sơ'] === 'TRUE' || appRole['Được tạo hồ sơ'] === true)
    if (!allowed) throw new Error('Bạn không có quyền tạo hồ sơ')
  }

  var catPath = _resolveCategoryPath(categoryId)
  var result = uploadFile(base64Data, mimeType, fileName, catPath)
  var fileInfo = { fileId: result.fileId, fileName: result.fileName, mimeType: mimeType, size: result.size || 0 }

  // Edit mode — upload only, no row
  if (draftId === 'edit') {
    return { fileInfo: fileInfo }
  }

  // Create mode — append to existing draft or create new
  if (draftId) {
    invalidateSheetCache(SHEETS.HO_SO)
    var docs = getSheetData(SHEETS.HO_SO)
    var draft = docs.find(function(d) { return String(d.ID) === String(draftId) })
    if (!draft || draft['Tình trạng'] !== 'Nháp') throw new Error('Không tìm thấy bản nháp')
    if (draft['Người tạo'] !== session.username) throw new Error('Không có quyền')

    var existingFiles = _parseFileInfos(draft['File ID'])
    existingFiles.push(fileInfo)
    updateRow(SHEETS.HO_SO, draftId, {
      'File ID': JSON.stringify(existingFiles),
      'Tên file': existingFiles.map(function(f) { return f.fileName }).join(', '),
    })
    return { fileInfo: fileInfo }
  }

  // New draft
  var record = {
    'Tên hồ sơ': '',
    'Danh mục': categoryId,
    'Số hồ sơ': '',
    'Dự án (Phòng ban)': '',
    'Nhà cung cấp (Nơi ban hành)': '',
    'Ngày ban hành': '',
    'Ngày kết thúc': '',
    'Giá trị HĐ': '',
    'Tình trạng': 'Nháp',
    'File ID': JSON.stringify([fileInfo]),
    'Tên file': fileInfo.fileName,
    'Loại file': mimeType,
    'Kích thước': '',
    'Phụ trách': '',
    'Người phối hợp': '',
    'Ghi chú': '',
    'Nơi lưu hồ sơ cứng': '',
    'Ngày cập nhật': new Date().toISOString(),
    'Người tạo': session.username,
    'Người cập nhật': session.username,
    'Khẩn': '',
  }
  var added = addRow(SHEETS.HO_SO, record)
  return { draftId: added['ID'], fileInfo: fileInfo }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest --config apps/docmgr/jest.config.js -t "uploadFileEager" --no-coverage`
Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/docmgr/src/server/documents.js apps/docmgr/src/server/__tests__/documents.test.js
git commit -m "feat(docmgr): add uploadFileEager server function"
```

---

### Task 2: Server — `finalizeDraft`

**Files:**
- Modify: `apps/docmgr/src/server/documents.js` (add after `uploadFileEager`)
- Test: `apps/docmgr/src/server/__tests__/documents.test.js`

- [ ] **Step 1: Write failing tests for `finalizeDraft`**

Add at the end of `documents.test.js`:

```js
describe('finalizeDraft', () => {
  beforeEach(() => {
    setConfig('ROOT_FOLDER_ID', 'root123')
  })

  test('updates draft with form data and changes status', () => {
    const r = uploadFileEager(directorToken, 'dGVzdA==', 'text/plain', 'a.txt', 1, null)
    const result = finalizeDraft(directorToken, r.draftId, {
      'Tên hồ sơ': 'Final Doc',
      'Danh mục': 1,
      'Tình trạng': 'Chờ duyệt',
    })
    expect(result.data['Tên hồ sơ']).toBe('Final Doc')
    expect(result.data['Tình trạng']).toBe('Chờ duyệt')
    expect(result.data['File ID']).toBeTruthy()
  })

  test('throws without Tên hồ sơ', () => {
    const r = uploadFileEager(directorToken, 'dGVzdA==', 'text/plain', 'a.txt', 1, null)
    expect(() => finalizeDraft(directorToken, r.draftId, { 'Danh mục': 1 }))
      .toThrow('bắt buộc')
  })

  test('throws if doc is not a draft', () => {
    createDocument(directorToken, { 'Tên hồ sơ': 'Real', 'Danh mục': 1 }, null)
    invalidateSheetCache(SHEETS.HO_SO)
    expect(() => finalizeDraft(directorToken, 1, { 'Tên hồ sơ': 'X', 'Danh mục': 1 }))
      .toThrow('bản nháp')
  })

  test('moves files when category changed from upload', () => {
    SpreadsheetApp._sheets[SHEETS.DANH_MUC]._rows.push(
      [2, 'Công văn', '', '', '', '', '']
    )
    invalidateSheetCache(SHEETS.DANH_MUC)

    const r = uploadFileEager(directorToken, 'dGVzdA==', 'text/plain', 'a.txt', 1, null)
    const result = finalizeDraft(directorToken, r.draftId, {
      'Tên hồ sơ': 'Moved Doc',
      'Danh mục': 2,
    })
    expect(result.data['Danh mục']).toBe(2)
  })

  test('defaults status to Chờ duyệt when not specified', () => {
    const r = uploadFileEager(directorToken, 'dGVzdA==', 'text/plain', 'a.txt', 1, null)
    const result = finalizeDraft(directorToken, r.draftId, {
      'Tên hồ sơ': 'Doc Default',
      'Danh mục': 1,
    })
    expect(result.data['Tình trạng']).toBe('Chờ duyệt')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest --config apps/docmgr/jest.config.js -t "finalizeDraft" --no-coverage`
Expected: FAIL — `finalizeDraft is not defined`

- [ ] **Step 3: Implement `finalizeDraft`**

Add in `documents.js` after `uploadFileEager`:

```js
function finalizeDraft(token, draftId, data, notifyTarget) {
  var session = requireAuth(token)

  if (!data['Tên hồ sơ']) throw new Error('Tên hồ sơ là bắt buộc')
  if (!data['Danh mục']) throw new Error('Danh mục là bắt buộc')

  invalidateSheetCache(SHEETS.HO_SO)
  var docs = getSheetData(SHEETS.HO_SO)
  var draft = docs.find(function(d) { return String(d.ID) === String(draftId) })
  if (!draft || draft['Tình trạng'] !== 'Nháp') throw new Error('Không tìm thấy bản nháp')
  if (draft['Người tạo'] !== session.username) throw new Error('Không có quyền')

  // Move files if category changed
  var oldCatId = String(draft['Danh mục'] || '')
  var newCatId = String(data['Danh mục'])
  var existingFiles = _parseFileInfos(draft['File ID'])
  if (oldCatId !== newCatId && existingFiles.length > 0) {
    var newCatPath = _resolveCategoryPath(newCatId)
    existingFiles.forEach(function(f) {
      try { moveFile(f.fileId, newCatPath) } catch(e) { Logger.log('Move file error: ' + e.message) }
    })
  }

  var updates = {
    'Tên hồ sơ': data['Tên hồ sơ'],
    'Danh mục': data['Danh mục'],
    'Số hồ sơ': data['Số hồ sơ'] || '',
    'Dự án (Phòng ban)': (data['Dự án (Phòng ban)'] || '').trim(),
    'Nhà cung cấp (Nơi ban hành)': (data['Nhà cung cấp (Nơi ban hành)'] || '').trim(),
    'Ngày ban hành': data['Ngày ban hành'] || '',
    'Ngày kết thúc': data['Ngày kết thúc'] || '',
    'Giá trị HĐ': data['Giá trị HĐ'] || 0,
    'Tình trạng': data['Tình trạng'] || 'Chờ duyệt',
    'Phụ trách': data['Phụ trách'] ? JSON.stringify([String(data['Phụ trách'])]) : '',
    'Người phối hợp': _buildAssignees(data['Người phối hợp'], null),
    'Ghi chú': data['Ghi chú'] || '',
    'Nơi lưu hồ sơ cứng': data['Nơi lưu hồ sơ cứng'] || '',
    'Ngày cập nhật': new Date().toISOString(),
    'Người cập nhật': session.username,
    'Khẩn': data['Khẩn'] === true || data['Khẩn'] === 'TRUE' ? 'TRUE' : '',
  }

  updateRow(SHEETS.HO_SO, draftId, updates)
  var updated = Object.assign({}, draft, updates)

  logAudit(session, 'Tạo', 'Hồ sơ', updates['Tên hồ sơ'], JSON.stringify({ soHoSo: updates['Số hồ sơ'], danhMuc: updates['Danh mục'] }))

  // Notification logic (same as createDocument)
  var emailError = null
  if (notifyTarget === 'directors') {
    var roles = getSheetData(SHEETS.APP_ROLES)
    var dirUserIds = []
    roles.forEach(function(r) { if (r['Quyền'] === 'Giám đốc' && r['AppID'] === APP_ID) dirUserIds.push(r['Tên đăng nhập'] || String(r['UserID'])) })
    _markUnreadForUsers(dirUserIds, draftId)
    try {
      var dirRecipients = _getRecipientsByUsernames(dirUserIds)
      _sendNotificationEmails(dirRecipients, updated, 'trinhDuyet', session)
    } catch(e) {
      Logger.log('finalizeDraft trinhDuyet email error: ' + e.message)
      emailError = e.message
    }
  }

  if (notifyTarget === 'publish' && data._publishTo) {
    try {
      publishDocument(token, draftId, data._publishTo, data._publishCc || [])
    } catch(e) {
      Logger.log('finalizeDraft publish email error: ' + e.message)
      emailError = e.message
    }
  }

  return { data: updated, emailError: emailError }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest --config apps/docmgr/jest.config.js -t "finalizeDraft" --no-coverage`
Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/docmgr/src/server/documents.js apps/docmgr/src/server/__tests__/documents.test.js
git commit -m "feat(docmgr): add finalizeDraft server function"
```

---

### Task 3: Server — `cancelDraft` and `deleteFiles`

**Files:**
- Modify: `apps/docmgr/src/server/documents.js` (add after `finalizeDraft`)
- Test: `apps/docmgr/src/server/__tests__/documents.test.js`

- [ ] **Step 1: Write failing tests**

Add at the end of `documents.test.js`:

```js
describe('cancelDraft', () => {
  beforeEach(() => {
    setConfig('ROOT_FOLDER_ID', 'root123')
  })

  test('deletes draft row and trashes files', () => {
    const r = uploadFileEager(directorToken, 'dGVzdA==', 'text/plain', 'a.txt', 1, null)
    const fileId = r.fileInfo.fileId

    cancelDraft(directorToken, r.draftId)

    invalidateSheetCache(SHEETS.HO_SO)
    const docs = getSheetData(SHEETS.HO_SO)
    expect(docs).toHaveLength(0)
    expect(DriveApp._files[fileId].trashed).toBe(true)
  })

  test('throws if doc is not a draft', () => {
    createDocument(directorToken, { 'Tên hồ sơ': 'Real', 'Danh mục': 1 }, null)
    invalidateSheetCache(SHEETS.HO_SO)
    expect(() => cancelDraft(directorToken, 1)).toThrow('bản nháp')
  })

  test('throws if user is not the creator', () => {
    const r = uploadFileEager(directorToken, 'dGVzdA==', 'text/plain', 'a.txt', 1, null)
    seedUser(2, 'other', 'o@test.com', 'Giám đốc')
    const otherToken = createSession(2, 'other', 'o@test.com', 'Giám đốc')
    expect(() => cancelDraft(otherToken, r.draftId)).toThrow('quyền')
  })
})

describe('deleteFiles', () => {
  test('trashes specified files', () => {
    setConfig('ROOT_FOLDER_ID', 'root123')
    const r1 = uploadFileEager(directorToken, 'dGVzdA==', 'text/plain', 'a.txt', 1, 'edit')
    const r2 = uploadFileEager(directorToken, 'dGVzdA==', 'text/plain', 'b.txt', 1, 'edit')

    deleteFiles(directorToken, [r1.fileInfo.fileId, r2.fileInfo.fileId])

    expect(DriveApp._files[r1.fileInfo.fileId].trashed).toBe(true)
    expect(DriveApp._files[r2.fileInfo.fileId].trashed).toBe(true)
  })

  test('handles empty array gracefully', () => {
    const result = deleteFiles(directorToken, [])
    expect(result.success).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest --config apps/docmgr/jest.config.js -t "cancelDraft|deleteFiles" --no-coverage`
Expected: FAIL — functions not defined

- [ ] **Step 3: Implement `cancelDraft` and `deleteFiles`**

Add in `documents.js` after `finalizeDraft`:

```js
function cancelDraft(token, draftId) {
  var session = requireAuth(token)

  invalidateSheetCache(SHEETS.HO_SO)
  var docs = getSheetData(SHEETS.HO_SO)
  var draft = docs.find(function(d) { return String(d.ID) === String(draftId) })
  if (!draft || draft['Tình trạng'] !== 'Nháp') throw new Error('Không tìm thấy bản nháp')
  if (draft['Người tạo'] !== session.username) throw new Error('Không có quyền')

  // Delete files from Drive
  var fileInfos = _parseFileInfos(draft['File ID'])
  fileInfos.forEach(function(f) {
    if (f.fileId) deleteFile(f.fileId)
  })

  // Delete draft row
  deleteRow(SHEETS.HO_SO, draftId)
  return { success: true }
}

function deleteFiles(token, fileIds) {
  requireAuth(token)
  if (!Array.isArray(fileIds)) fileIds = []
  fileIds.forEach(function(fid) {
    if (fid) deleteFile(fid)
  })
  return { success: true }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest --config apps/docmgr/jest.config.js -t "cancelDraft|deleteFiles" --no-coverage`
Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/docmgr/src/server/documents.js apps/docmgr/src/server/__tests__/documents.test.js
git commit -m "feat(docmgr): add cancelDraft and deleteFiles server functions"
```

---

### Task 4: Server — Modify `updateDocument` for eager file infos

**Files:**
- Modify: `apps/docmgr/src/server/documents.js` (modify `updateDocument` signature + body)
- Test: `apps/docmgr/src/server/__tests__/documents.test.js`

- [ ] **Step 1: Write failing test**

Add at the end of `documents.test.js`:

```js
describe('updateDocument — eagerFileInfos', () => {
  beforeEach(() => {
    setConfig('ROOT_FOLDER_ID', 'root123')
    createDocument(directorToken, { 'Tên hồ sơ': 'Existing', 'Danh mục': 1 }, null)
    invalidateSheetCache(SHEETS.HO_SO)
  })

  test('merges pre-uploaded files without re-uploading', () => {
    const eager = uploadFileEager(directorToken, 'dGVzdA==', 'text/plain', 'eager.txt', 1, 'edit')

    const result = updateDocument(directorToken, 1,
      { 'Tên hồ sơ': 'Updated' },
      [],   // no base64 fileInfos
      [],   // no keepFileIds
      null, // notifyTarget
      [eager.fileInfo]  // eagerFileInfos
    )
    const files = JSON.parse(result.data['File ID'])
    expect(files).toHaveLength(1)
    expect(files[0].fileName).toBe('eager.txt')
  })

  test('merges eager files with kept existing files', () => {
    // First add a file via base64
    updateDocument(directorToken, 1, {},
      [{ base64Data: 'dGVzdA==', mimeType: 'text/plain', fileName: 'old.txt', size: 4 }],
      [], null)
    invalidateSheetCache(SHEETS.HO_SO)

    const docs = getSheetData(SHEETS.HO_SO)
    const oldFiles = JSON.parse(docs[0]['File ID'])
    const oldFileId = oldFiles[0].fileId

    // Now add an eager file while keeping old
    const eager = uploadFileEager(directorToken, 'dGVzdA==', 'text/plain', 'new.txt', 1, 'edit')
    const result = updateDocument(directorToken, 1, {},
      [],          // no new base64
      [oldFileId], // keep old
      null,
      [eager.fileInfo]
    )
    const files = JSON.parse(result.data['File ID'])
    expect(files).toHaveLength(2)
    expect(files.map(function(f) { return f.fileName })).toContain('old.txt')
    expect(files.map(function(f) { return f.fileName })).toContain('new.txt')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest --config apps/docmgr/jest.config.js -t "eagerFileInfos" --no-coverage`
Expected: FAIL — `updateDocument` receives 7 args but only accepts 6

- [ ] **Step 3: Modify `updateDocument` to accept `eagerFileInfos`**

In `documents.js`, change the `updateDocument` function signature (line ~507):

Old:
```js
function updateDocument(token, id, data, fileInfos, keepFileIds, notifyTarget) {
```

New:
```js
function updateDocument(token, id, data, fileInfos, keepFileIds, notifyTarget, eagerFileInfos) {
```

Then, after the `newlyUploaded` block (after line ~582 where `newlyUploaded` forEach ends), add:

```js
  // Merge eagerly-uploaded files (already on Drive, no base64)
  if (eagerFileInfos && Array.isArray(eagerFileInfos)) {
    eagerFileInfos.forEach(function(ef) {
      if (ef && ef.fileId) {
        newlyUploaded.push({ fileId: ef.fileId, fileName: ef.fileName, mimeType: ef.mimeType, size: ef.size || 0 })
      }
    })
  }
```

Also, move eager files to new category if category changed. In the existing category-change move block (line ~587-592), change:

Old:
```js
  if (oldCatId !== newCatId && keptFiles.length > 0) {
    var newCatPath = _resolveCategoryPath(newCatId)
    keptFiles.forEach(function(f) {
      try { moveFile(f.fileId, newCatPath) } catch(e) { Logger.log('Move file error: ' + e.message) }
    })
  }
```

New (also move eager files):
```js
  if (oldCatId !== newCatId) {
    var newCatPath = _resolveCategoryPath(newCatId)
    keptFiles.concat(newlyUploaded).forEach(function(f) {
      try { moveFile(f.fileId, newCatPath) } catch(e) { Logger.log('Move file error: ' + e.message) }
    })
  }
```

Note: this moves BOTH kept and eager files to the new category. Kept files were already moved in the original code; adding eager files here handles the case where user uploads files then changes category before saving.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest --config apps/docmgr/jest.config.js -t "eagerFileInfos" --no-coverage`
Expected: 2 tests PASS

- [ ] **Step 5: Run all document tests to verify no regressions**

Run: `npx jest --config apps/docmgr/jest.config.js --no-coverage`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add apps/docmgr/src/server/documents.js apps/docmgr/src/server/__tests__/documents.test.js
git commit -m "feat(docmgr): support eagerFileInfos in updateDocument"
```

---

### Task 5: Server — Register new APIs in `main.js`

**Files:**
- Modify: `apps/docmgr/src/server/main.js` (add 4 wrapper functions after `api_publishDocument`)

- [ ] **Step 1: Add API wrappers**

In `main.js`, after the `api_publishDocument` function (line ~395), add:

```js
function api_uploadFileEager(token, base64Data, mimeType, fileName, categoryId, draftId) {
  return _wrap(function() { return uploadFileEager(token, base64Data, mimeType, fileName, categoryId, draftId) })
}

function api_finalizeDraft(token, draftId, data, notifyTarget) {
  return _wrap(function() { return finalizeDraft(token, draftId, data, notifyTarget) })
}

function api_cancelDraft(token, draftId) {
  return _wrap(function() { return cancelDraft(token, draftId) })
}

function api_deleteFiles(token, fileIds) {
  return _wrap(function() { return deleteFiles(token, fileIds) })
}
```

- [ ] **Step 2: Update `api_updateDocument` to pass 7th arg**

In `main.js`, modify the existing `api_updateDocument` wrapper (line ~377):

Old:
```js
function api_updateDocument(token, id, data, fileInfos, keepFileIds, notifyTarget) {
  return _wrap(function() { return updateDocument(token, id, data, fileInfos, keepFileIds, notifyTarget) })
}
```

New:
```js
function api_updateDocument(token, id, data, fileInfos, keepFileIds, notifyTarget, eagerFileInfos) {
  return _wrap(function() { return updateDocument(token, id, data, fileInfos, keepFileIds, notifyTarget, eagerFileInfos) })
}
```

- [ ] **Step 3: Run all tests to verify no regressions**

Run: `npx jest --config apps/docmgr/jest.config.js --no-coverage`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add apps/docmgr/src/server/main.js
git commit -m "feat(docmgr): register eager upload APIs in main.js"
```

---

### Task 6: Client — Add 'Nháp' to status color + exclude from stats

**Files:**
- Modify: `apps/docmgr/src/client/utils/format.js` (add Nháp to statusColor map)

- [ ] **Step 1: Add 'Nháp' status color**

In `format.js`, add to the `statusColor` map (inside the `map` object, after line 42):

```js
    'Nháp':               'bg-gray-100 text-gray-500 border border-dashed border-gray-300',
```

- [ ] **Step 2: Commit**

```bash
git add apps/docmgr/src/client/utils/format.js
git commit -m "feat(docmgr): add Nháp status color"
```

---

### Task 7: Client — Add mock implementations in `gasClient.js`

**Files:**
- Modify: `apps/docmgr/src/client/gasClient.js` (add mock cases for dev server)

- [ ] **Step 1: Add mock cases**

In `gasClient.js`, inside the `switch (fn)` block in `mockCall`, add before the `default:` case:

```js
    case 'api_uploadFileEager': {
      await delay(500) // simulate upload delay
      const catId = args[3]
      const dId = args[4]
      const fakeFileId = 'eager_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
      const fi = { fileId: fakeFileId, fileName: args[2], mimeType: args[1], size: 1024 }
      if (dId === 'edit' || dId) {
        return { fileInfo: fi }
      }
      const draftDoc = { ID: ++_nextId, 'Tên hồ sơ': '', 'Danh mục': catId, 'Tình trạng': 'Nháp', 'File ID': JSON.stringify([fi]), 'Tên file': fi.fileName, 'Người tạo': _mockSession?.username || 'admin', 'Ngày cập nhật': new Date().toISOString() }
      _mockData.docs.push(draftDoc)
      return { draftId: draftDoc.ID, fileInfo: fi }
    }
    case 'api_finalizeDraft': {
      const did = args[1]
      const fData = args[2]
      const idx = _mockData.docs.findIndex(d => String(d.ID) === String(did))
      if (idx === -1) throw new Error('Không tìm thấy bản nháp')
      Object.assign(_mockData.docs[idx], fData, { 'Tình trạng': fData['Tình trạng'] || 'Chờ duyệt', 'Ngày cập nhật': new Date().toISOString() })
      return { data: { ..._mockData.docs[idx] } }
    }
    case 'api_cancelDraft': {
      const did2 = args[1]
      const idx2 = _mockData.docs.findIndex(d => String(d.ID) === String(did2))
      if (idx2 !== -1) _mockData.docs.splice(idx2, 1)
      return { success: true }
    }
    case 'api_deleteFiles':
      return { success: true }
```

- [ ] **Step 2: Verify dev server starts**

Run: `cd apps/docmgr && npx vite --port 5173 &` — open briefly to check no JS errors, then stop.

- [ ] **Step 3: Commit**

```bash
git add apps/docmgr/src/client/gasClient.js
git commit -m "feat(docmgr): add mock implementations for eager upload APIs"
```

---

### Task 8: Client — Eager upload logic in DocumentModal

**Files:**
- Modify: `apps/docmgr/src/client/components/DocumentModal.jsx`

This is the core client change. It modifies state, `handleFileChange`, submit, and cancel.

- [ ] **Step 1: Add new state variables**

In `DocumentModal.jsx`, after the existing state declarations (after line 127 `const { showToast } = useToast()`), add:

```jsx
  const [draftId, setDraftId] = useState(null)
  const [eagerUploads, setEagerUploads] = useState([])
  // Each: { id, fileName, size, status: 'uploading'|'done'|'error', fileInfo?, error? }
  const eagerIdCounter = useRef(0)
```

Add `useEffect` import if not present (it already imports `useState, useRef`). Add `useEffect` to the import:

Change line 1:
```jsx
import { useState, useRef, useEffect } from 'react'
```

- [ ] **Step 2: Replace `handleFileChange` with eager upload logic**

Replace the existing `handleFileChange` function (lines 172-180) with:

```jsx
  async function handleFileChange(e) {
    const newFiles = Array.from(e.target.files || e.dataTransfer?.files || [])
    if (e.target && e.target.value) e.target.value = ''
    if (!newFiles.length) return

    if (!form['Danh mục']) {
      setError('Vui lòng chọn Danh mục trước khi đính kèm file')
      return
    }

    const bigFile = newFiles.find(f => f.size > WARN_FILE_MB * 1024 * 1024)
    if (bigFile) {
      showToast(`File "${bigFile.name}" lớn hơn ${WARN_FILE_MB}MB — upload có thể chậm hoặc thất bại`, 'warning')
    }

    // Deduplicate: skip files already in eagerUploads or existingFiles
    const existingNames = new Set([
      ...eagerUploads.map(u => u.fileName),
      ...existingFiles.map(f => f.fileName),
    ])
    const uniqueFiles = newFiles.filter(f => !existingNames.has(f.name))
    if (!uniqueFiles.length) return

    // Add placeholders
    const entries = uniqueFiles.map(f => ({
      id: ++eagerIdCounter.current,
      fileName: f.name,
      size: f.size,
      status: 'pending',
      file: f,
    }))
    setEagerUploads(prev => [...prev, ...entries])

    // Upload sequentially
    let currentDraftId = draftId
    for (const entry of entries) {
      setEagerUploads(prev => prev.map(u => u.id === entry.id ? { ...u, status: 'uploading' } : u))
      try {
        const b64 = await toBase64(entry.file)
        const apiDraftId = isEdit ? 'edit' : (currentDraftId || null)
        const result = await gasCall('api_uploadFileEager', token, b64, entry.file.type, entry.file.name, form['Danh mục'], apiDraftId)
        if (result.draftId) {
          currentDraftId = result.draftId
          setDraftId(result.draftId)
        }
        setEagerUploads(prev => prev.map(u => u.id === entry.id ? { ...u, status: 'done', fileInfo: result.fileInfo, file: undefined } : u))
      } catch (err) {
        setEagerUploads(prev => prev.map(u => u.id === entry.id ? { ...u, status: 'error', error: err.message, file: undefined } : u))
      }
    }
  }
```

- [ ] **Step 3: Remove old `files` state usage from the upload area**

The old `files` state (line 110) and `removeNewFile` function (lines 182-184) are no longer needed for new uploads. Remove:

```jsx
  // DELETE these lines:
  const [files, setFiles]           = useState([])   // new files: [{file: File}]
  // ...
  function removeNewFile(idx) {
    setFiles(prev => prev.filter((_, i) => i !== idx))
  }
```

Add a function to remove an eager upload:

```jsx
  async function removeEagerUpload(id) {
    const upload = eagerUploads.find(u => u.id === id)
    if (!upload) return

    if (upload.status === 'done' && upload.fileInfo) {
      // Delete from Drive
      try {
        if (draftId && !isEdit) {
          // For drafts, cancel the whole draft if it's the last file,
          // or just delete the file and update the draft row
          // Simplification: just delete the file, draft row stays with remaining files
          await gasCall('api_deleteFiles', token, [upload.fileInfo.fileId])
        } else {
          await gasCall('api_deleteFiles', token, [upload.fileInfo.fileId])
        }
      } catch (_) { /* best effort */ }
    }
    setEagerUploads(prev => prev.filter(u => u.id !== id))
  }
```

- [ ] **Step 4: Modify `handleSubmit` for eager upload flow**

Replace the `handleSubmit` function (lines 232-295) with:

```jsx
  async function handleSubmit(e) {
    e.preventDefault()
    if (!form['Tên hồ sơ']) { setError('Tên hồ sơ là bắt buộc'); return }
    if (!form['Danh mục']) { setError('Danh mục là bắt buộc'); return }
    if (dupWarning) { setError('Vui lòng sửa số hồ sơ trùng'); return }
    if (eagerUploads.some(u => u.status === 'uploading' || u.status === 'pending')) {
      setError('Vui lòng chờ tải file xong'); return
    }
    setError('')
    setUploading(true)

    let submitForm, notifyTarget
    try {
      submitForm = {
        ...form,
        'Tình trạng': statusOverrideRef.current !== null ? statusOverrideRef.current : form['Tình trạng'],
        'Phụ trách': phuTrach || '',
        'Người phối hợp': collaborators.length ? collaborators : [],
      }
      if (publishDataRef.current) {
        submitForm._publishTo = publishDataRef.current.to
        submitForm._publishCc = publishDataRef.current.cc
        publishDataRef.current = null
      }
      notifyTarget = notifyTargetRef.current
      statusOverrideRef.current = null
      notifyTargetRef.current = null

      if (isEdit) {
        // Edit mode: pass eager uploads as pre-uploaded
        const eagerFileInfos = eagerUploads.filter(u => u.status === 'done' && u.fileInfo).map(u => u.fileInfo)
        const keepFileIds = existingFiles.map(f => f.fileId)
        const updated = await gasCall('api_updateDocument', token, doc.ID, submitForm, [], keepFileIds, notifyTarget, eagerFileInfos)
        showToast(updated?.emailError ? 'Đã cập nhật hồ sơ (gửi email thất bại)' : 'Đã cập nhật hồ sơ', updated?.emailError ? 'warning' : 'success')
        onSaved(updated)
      } else if (draftId) {
        // Create mode with draft: finalize
        const result = await gasCall('api_finalizeDraft', token, draftId, submitForm, notifyTarget)
        showToast(result?.emailError ? 'Đã thêm hồ sơ (gửi email thất bại)' : 'Đã thêm hồ sơ', result?.emailError ? 'warning' : 'success')
        onSaved(result)
      } else {
        // Create mode without files: original flow
        const created = await gasCall('api_createDocument', token, submitForm, [], notifyTarget)
        showToast(created?.emailError ? 'Đã thêm hồ sơ (gửi email thất bại)' : 'Đã thêm hồ sơ', created?.emailError ? 'warning' : 'success')
        onSaved(created)
      }
    } catch (err) {
      if (err.message === 'Lỗi không xác định' && isEdit) {
        const eagerFileInfos = eagerUploads.filter(u => u.status === 'done' && u.fileInfo).map(u => u.fileInfo)
        const keepFileIds = existingFiles.map(f => f.fileId)
        const r = await retryWithVerify({
          fn: () => gasCall('api_updateDocument', token, doc.ID, submitForm, [], keepFileIds, notifyTarget, eagerFileInfos),
          verify: _makeVerify(),
          onRetry: (i, n) => setError(`Có lỗi xảy ra — đang thử lại lần ${i}/${n}…`),
        })
        if (r.ok) { showToast('Đã lưu hồ sơ', 'success'); onSaved(r.data) }
        else { setError(r.error) }
      } else if (err.message === 'Lỗi không xác định') {
        showToast('Đã lưu hồ sơ — đang cập nhật', 'warning'); onSaved(null)
      } else {
        setError(err.message)
      }
    } finally {
      setUploading(false)
    }
  }
```

- [ ] **Step 5: Add cancel cleanup to `onClose`**

Replace the close button's `onClick={onClose}` handler. Wrap `onClose` in a cleanup function. Add this function after `handleSubmit`:

```jsx
  async function handleClose() {
    if (draftId) {
      try { await gasCall('api_cancelDraft', token, draftId) } catch (_) {}
    } else if (isEdit) {
      const doneIds = eagerUploads.filter(u => u.status === 'done' && u.fileInfo).map(u => u.fileInfo.fileId)
      if (doneIds.length > 0) {
        try { await gasCall('api_deleteFiles', token, doneIds) } catch (_) {}
      }
    }
    onClose()
  }
```

Then update all `onClick={onClose}` in the template to `onClick={handleClose}`:
- The close (X) button in the header (line ~312): `onClick={handleClose}`
- The "Hủy" button in the footer (line ~630): `onClick={handleClose}`

- [ ] **Step 6: Update trinhDuyetLai and hoanThanhLai flows**

The existing `trinhDuyetLai` and `hoanThanhLai` button handlers (lines ~676-745) still use the old `files` state with base64. Update them to use `eagerUploads` instead.

In the `trinhDuyetLai` handler (around line 676), replace the `fileInfos` + `keepFileIds` construction:

Old pattern:
```jsx
const fileInfos = await Promise.all(
  files.map(async ({ file: f }) => {
    const base64 = await toBase64(f)
    return { base64Data: base64, mimeType: f.type, fileName: f.name, size: f.size }
  })
)
const keepFileIds = existingFiles.map(f => f.fileId)
```

New pattern:
```jsx
const fileInfos = []  // no more base64 uploads
const keepFileIds = existingFiles.map(f => f.fileId)
const eagerFileInfos = eagerUploads.filter(u => u.status === 'done' && u.fileInfo).map(u => u.fileInfo)
```

And update the `gasCall` to pass `eagerFileInfos` as the last arg of `api_transitionDocument`'s updateData. Since `api_transitionDocument` passes `updateData.fileInfos` and `updateData.keepFileIds`, add `eagerFileInfos`:

```jsx
const res = await gasCall('api_transitionDocument', token, doc.ID, 'trinhDuyetLai', {}, {
  formData: { ...form }, fileInfos, keepFileIds, eagerFileInfos,
})
```

Do the same for `hoanThanhLai` handler (around line 722).

**Important:** Also update `transitionDocument` in `documents.js` to pass `eagerFileInfos` through to `updateDocument`. In the `transitionDocument` function, find where it calls `updateDocument` and pass `updateData.eagerFileInfos` as the 7th argument.

- [ ] **Step 7: Commit**

```bash
git add apps/docmgr/src/client/components/DocumentModal.jsx
git commit -m "feat(docmgr): eager upload logic in DocumentModal"
```

---

### Task 9: Client — Update file display UI in DocumentModal

**Files:**
- Modify: `apps/docmgr/src/client/components/DocumentModal.jsx` (file chips section)

- [ ] **Step 1: Replace the file chips render section**

Replace the "New files" section (lines ~457-471) and the drop zone's `onClick`/`onDrop` to use `eagerUploads` instead of `files`. Replace the entire `{/* File đính kèm */}` Field block (lines ~438-493) with:

```jsx
              {/* File đính kèm */}
              <Field label="File đính kèm">
                {/* Existing files (edit mode) */}
                {existingFiles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {existingFiles.map(ef => (
                      <span key={ef.fileId} className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2.5 py-1 rounded-full">
                        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>attach_file</span>
                        <span className="max-w-[120px] truncate">{ef.fileName || ef.fileId}</span>
                        <button type="button" onClick={() => removeExistingFile(ef.fileId, ef.fileName)}
                          className="ml-0.5 hover:text-error transition-colors">
                          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>close</span>
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Eagerly uploaded / uploading files */}
                {eagerUploads.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {eagerUploads.map(u => (
                      <span key={u.id} className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full ${
                        u.status === 'done' ? 'bg-emerald-100 text-emerald-700' :
                        u.status === 'error' ? 'bg-red-100 text-red-700' :
                        'bg-secondary/10 text-secondary'
                      }`}>
                        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
                          {u.status === 'done' ? 'check_circle' :
                           u.status === 'error' ? 'error' :
                           'sync'}
                        </span>
                        <span className="max-w-[120px] truncate">{u.fileName}</span>
                        <span className="opacity-60">({(u.size / 1024 / 1024).toFixed(1)}MB)</span>
                        {u.status !== 'uploading' && u.status !== 'pending' && (
                          <button type="button" onClick={() => removeEagerUpload(u.id)}
                            className="ml-0.5 hover:text-error transition-colors">
                            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>close</span>
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                )}

                {/* Upload progress text */}
                {eagerUploads.some(u => u.status === 'uploading' || u.status === 'pending') && (
                  <p className="text-xs text-primary font-medium mb-2 flex items-center gap-1">
                    <span className="material-symbols-outlined animate-spin" style={{ fontSize: 14 }}>sync</span>
                    Đang tải lên... ({eagerUploads.filter(u => u.status === 'done').length}/{eagerUploads.length})
                  </p>
                )}

                <div
                  className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-colors ${
                    isDragging ? 'border-primary bg-primary/10' : 'border-outline-variant hover:border-primary/50 hover:bg-primary/5'
                  }`}
                  onClick={() => fileRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                  onDragEnter={e => { e.preventDefault(); setIsDragging(true) }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={e => {
                    e.preventDefault(); setIsDragging(false)
                    handleFileChange({ target: { files: Array.from(e.dataTransfer.files) } })
                  }}
                >
                  <span className="material-symbols-outlined text-on-surface-variant mb-1" style={{ fontSize: 28 }}>upload_file</span>
                  <p className="text-sm text-on-surface-variant">Kéo file vào đây hoặc <span className="text-primary font-medium">chọn file</span></p>
                  <p className="text-xs text-on-surface-variant mt-0.5">PDF, DOC, XLSX, PNG, JPG — nhiều file</p>
                  <input ref={fileRef} type="file" className="hidden" onChange={handleFileChange} multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" />
                </div>
              </Field>
```

- [ ] **Step 2: Disable submit buttons while uploading**

Find all submit-related buttons and add the uploading check. The existing `disabled={uploading}` already covers the save state. Add a check for eager uploads in progress:

Define a computed variable near the top of the component (after the state declarations):

```jsx
  const hasUploading = eagerUploads.some(u => u.status === 'uploading' || u.status === 'pending')
```

Then on every submit button, change `disabled={uploading}` to `disabled={uploading || hasUploading}`.

- [ ] **Step 3: Commit**

```bash
git add apps/docmgr/src/client/components/DocumentModal.jsx
git commit -m "feat(docmgr): eager upload progress UI in DocumentModal"
```

---

### Task 10: Server — Pass `eagerFileInfos` through `transitionDocument`

**Files:**
- Modify: `apps/docmgr/src/server/documents.js` (modify `transitionDocument` function)

- [ ] **Step 1: Find and modify `transitionDocument`**

Find the `transitionDocument` function in `documents.js`. It receives `updateData` which may contain `fileInfos`, `keepFileIds`, `formData`. Add `eagerFileInfos` pass-through.

Find where it calls `updateDocument` inside `transitionDocument`. It likely does something like:

```js
updateDocument(token, id, formData, updateData.fileInfos, updateData.keepFileIds, ...)
```

Add `updateData.eagerFileInfos` as the 7th argument:

```js
updateDocument(token, id, formData, updateData.fileInfos, updateData.keepFileIds, notifyTarget, updateData.eagerFileInfos)
```

- [ ] **Step 2: Run all tests**

Run: `npx jest --config apps/docmgr/jest.config.js --no-coverage`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add apps/docmgr/src/server/documents.js
git commit -m "fix(docmgr): pass eagerFileInfos through transitionDocument"
```

---

### Task 11: Final — Verify all tests pass + manual verification

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `npx jest --config apps/docmgr/jest.config.js --no-coverage`
Expected: All tests PASS (original + new eager upload tests)

- [ ] **Step 2: Build check**

Run: `npm run build:docmgr`
Expected: Build succeeds without errors

- [ ] **Step 3: Dev server smoke test**

Run: `npm run dev:docmgr`
Open http://localhost:5173 — verify:
- Modal opens without errors
- File selection triggers upload (visible in console via `[gasClient mock] api_uploadFileEager`)
- Progress chips show uploading → done
- Submit works via finalizeDraft or updateDocument
- Cancel cleans up

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "chore(docmgr): eager upload final fixes"
```
