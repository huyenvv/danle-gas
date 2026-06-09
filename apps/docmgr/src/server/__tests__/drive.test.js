require('./setup.js')
const { resetAll } = require('./helpers')

beforeEach(() => {
  resetAll()
})

describe('getOrCreateFolder', () => {
  test('creates new folder when not found', () => {
    const folder = getOrCreateFolder('root123', 'NewFolder')
    expect(folder.getId()).toContain('folder_')
  })

  test('returns existing folder if name matches', () => {
    DriveApp._files['existing_f'] = { id: 'existing_f', name: 'Reports', isFolder: true }
    const folder = getOrCreateFolder('root123', 'Reports')
    expect(folder.id).toBe('existing_f')
  })
})

describe('uploadFile', () => {
  test('uploads file to nested folder path', () => {
    setConfig('ROOT_FOLDER_ID', 'root123')
    const result = uploadFile('dGVzdA==', 'text/plain', 'test.txt', ['Category', '2025'])
    expect(result.fileId).toBeTruthy()
    expect(result.fileName).toBe('test.txt')
    expect(result.url).toContain('drive.google.com')
  })

  test('throws when ROOT_FOLDER_ID not configured', () => {
    expect(() => uploadFile('dGVzdA==', 'text/plain', 'test.txt', [])).toThrow('thư mục Drive')
  })
})

describe('deleteFile', () => {
  test('trashes the file', () => {
    DriveApp._files['f1'] = { id: 'f1', name: 'old.pdf', trashed: false }
    const result = deleteFile('f1')
    expect(result.success).toBe(true)
    expect(DriveApp._files['f1'].trashed).toBe(true)
  })

  test('handles missing file gracefully (no throw, reports failure)', () => {
    const result = deleteFile('nonexistent')
    expect(result.success).toBe(false)
  })
})

describe('getFileUrl', () => {
  test('returns drive URL for file', () => {
    DriveApp._files['f2'] = { id: 'f2', name: 'doc.pdf', trashed: false }
    const url = getFileUrl('f2')
    expect(url).toContain('drive.google.com/file/d/f2')
  })
})

describe('resolveFolderId', () => {
  test('returns ROOT_FOLDER_ID when path empty', () => {
    setConfig('ROOT_FOLDER_ID', 'root123')
    expect(resolveFolderId([])).toBe('root123')
  })

  test('navigates/creates nested folders and returns final id', () => {
    setConfig('ROOT_FOLDER_ID', 'root123')
    const id = resolveFolderId(['Category', '2025'])
    expect(id).toContain('folder_')
  })

  test('throws when ROOT_FOLDER_ID not configured', () => {
    expect(() => resolveFolderId(['x'])).toThrow('thư mục Drive')
  })
})

describe('initResumableUpload', () => {
  beforeEach(() => {
    UrlFetchApp._nextResponse = { code: 200, headers: { Location: 'https://up-uri' }, body: '{}' }
  })

  test('opens session → returns uploadUri (Location header) + OAuth token', () => {
    const r = initResumableUpload('video/mp4', 'big.mp4', 12345, 'folder1')
    expect(r.uploadUri).toBe('https://up-uri')
    expect(r.accessToken).toBe('mock-oauth-token')
    // request carries upload metadata
    const sent = JSON.parse(UrlFetchApp._lastRequest.params.payload)
    expect(sent).toEqual({ name: 'big.mp4', parents: ['folder1'] })
    expect(UrlFetchApp._lastRequest.params.headers['X-Upload-Content-Length']).toBe('12345')
  })

  test('throws on non-2xx from Drive', () => {
    UrlFetchApp._nextResponse = { code: 500, headers: {}, body: 'err' }
    expect(() => initResumableUpload('video/mp4', 'big.mp4', 100, 'folder1')).toThrow('phiên tải lên')
  })

  test('throws when Location header missing', () => {
    UrlFetchApp._nextResponse = { code: 200, headers: {}, body: '{}' }
    expect(() => initResumableUpload('video/mp4', 'big.mp4', 100, 'folder1')).toThrow('địa chỉ tải lên')
  })
})

describe('getResumableFileId', () => {
  test('returns file id when upload complete (200)', () => {
    UrlFetchApp._nextResponse = { code: 200, headers: {}, body: '{"id":"file-x"}' }
    expect(getResumableFileId('https://up', 100)).toBe('file-x')
    // status query uses Content-Range bytes */total with no body
    expect(UrlFetchApp._lastRequest.params.headers['Content-Range']).toBe('bytes */100')
  })

  test('accepts 201 as complete', () => {
    UrlFetchApp._nextResponse = { code: 201, headers: {}, body: '{"id":"file-y"}' }
    expect(getResumableFileId('https://up', 50)).toBe('file-y')
  })

  test('throws when upload incomplete (308)', () => {
    UrlFetchApp._nextResponse = { code: 308, headers: { Range: 'bytes=0-99' }, body: '' }
    expect(() => getResumableFileId('https://up', 100)).toThrow('chưa hoàn tất')
  })

  test('throws when response has no file id', () => {
    UrlFetchApp._nextResponse = { code: 200, headers: {}, body: '{}' }
    expect(() => getResumableFileId('https://up', 100)).toThrow('file id')
  })
})
