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

  test('handles missing file gracefully', () => {
    const result = deleteFile('nonexistent')
    expect(result.success).toBe(true)
  })
})

describe('getFileUrl', () => {
  test('returns drive URL for file', () => {
    DriveApp._files['f2'] = { id: 'f2', name: 'doc.pdf', trashed: false }
    const url = getFileUrl('f2')
    expect(url).toContain('drive.google.com/file/d/f2')
  })
})
