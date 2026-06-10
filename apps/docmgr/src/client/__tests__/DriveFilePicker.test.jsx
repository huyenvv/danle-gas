import { screen, fireEvent, act } from '@testing-library/react'
import DriveFilePicker, { _clearDriveBrowseCache, _driveBrowseCache } from '../components/settings/DriveFilePicker.jsx'
import gasCall from '../gasClient.js'
import { renderWithProviders } from './helpers/render.jsx'

jest.mock('../gasClient.js')

const ROOT = {
  current: { id: 'root-id', name: 'My Drive' },
  folders: [{ id: 'fA', name: 'Folder A' }],
  files: [
    { id: 'x1', name: 'a.xlsx', mimeType: 'xlsx', size: 100 },
    { id: 'p1', name: 'b.pdf', mimeType: 'pdf', size: 50 },
  ],
}
const FOLDER_A = {
  current: { id: 'fA', name: 'Folder A' },
  folders: [{ id: 'fB', name: 'Folder B' }],
  files: [{ id: 'x2', name: 'c.xlsx', mimeType: 'xlsx', size: 200 }],
}
const APP_ROOT = {
  current: { id: 'app-root', name: 'Tài liệu công ty' },
  folders: [{ id: 'ar1', name: 'Hợp đồng' }],
  files: [{ id: 'arx', name: 'm.xlsx', mimeType: 'xlsx', size: 300 }],
}

beforeEach(() => {
  _clearDriveBrowseCache()             // reset in-memory + localStorage between tests
  gasCall.mockReset()
  gasCall.mockImplementation((fn, token, folderId) => {
    if (!folderId) return Promise.resolve(ROOT)
    if (folderId === 'fA') return Promise.resolve(FOLDER_A)
    if (folderId === '__APP_ROOT__') return Promise.resolve(APP_ROOT)
    return Promise.resolve({ current: { id: folderId, name: 'X' }, folders: [], files: [] })
  })
})

function renderPicker(props = {}) {
  return renderWithProviders(
    <DriveFilePicker token="t" onConfirm={jest.fn()} onClose={jest.fn()} {...props} />
  )
}

describe('DriveFilePicker', () => {
  it('loads root once and shows folders + files', async () => {
    renderPicker()
    await screen.findByText('Folder A')
    expect(screen.getByText('a.xlsx')).toBeInTheDocument()
    expect(screen.getByText('b.pdf')).toBeInTheDocument()
    expect(gasCall).toHaveBeenCalledTimes(1)
  })

  it('caches folders — revisiting a folder does not re-fetch', async () => {
    renderPicker()
    await screen.findByText('Folder A')                       // root → 1 call

    await act(async () => { fireEvent.click(screen.getByText('Folder A')) })
    await screen.findByText('Folder B')                       // folder A → 2 calls
    expect(gasCall).toHaveBeenCalledTimes(2)

    await act(async () => { fireEvent.click(screen.getByText('Folder B')) }) // folder B → 3 calls
    expect(gasCall).toHaveBeenCalledTimes(3)

    // Breadcrumb back to Folder A — cached, must NOT hit the server again
    await act(async () => { fireEvent.click(screen.getByText('Folder A')) })
    await screen.findByText('Folder B')
    expect(gasCall).toHaveBeenCalledTimes(3)
  })

  it('reopening the popup shows the cached root without re-fetching or sticking on the spinner', async () => {
    const { unmount } = renderPicker()
    await screen.findByText('Folder A')                       // root → 1 call
    unmount()                                                 // close popup

    renderPicker()                                            // reopen → remounts
    await screen.findByText('Folder A')                       // list visible from cache
    expect(screen.getByText('a.xlsx')).toBeInTheDocument()
    expect(gasCall).toHaveBeenCalledTimes(1)                  // no extra fetch
  })

  it('persists across reload (F5) via localStorage', async () => {
    const { unmount } = renderPicker()
    await screen.findByText('Folder A')                       // 1 call → persisted to localStorage
    unmount()
    _driveBrowseCache.clear()                                 // simulate F5: memory gone, localStorage kept

    renderPicker()
    await screen.findByText('Folder A')                       // hydrated from localStorage
    expect(screen.getByText('a.xlsx')).toBeInTheDocument()
    expect(gasCall).toHaveBeenCalledTimes(1)                  // no new fetch
  })

  it('Refresh button forces a re-fetch of the current folder', async () => {
    renderPicker()
    await screen.findByText('Folder A')                       // 1 call
    await act(async () => { fireEvent.click(screen.getByTitle('Tải lại thư mục này')) })
    expect(gasCall).toHaveBeenCalledTimes(2)                  // forced, bypasses cache
  })

  it('startAtAppRoot opens the configured folder with a My Drive escape crumb', async () => {
    renderPicker({ startAtAppRoot: true })
    await screen.findByText('Hợp đồng')                       // app-root listing shown
    expect(gasCall).toHaveBeenCalledWith('api_browseDrive', 't', '__APP_ROOT__')
    expect(screen.getByText('Tài liệu công ty')).toBeInTheDocument()  // app folder crumb
    expect(screen.getByText('My Drive')).toBeInTheDocument()          // escape crumb

    // Clicking My Drive escapes to the full Drive root
    await act(async () => { fireEvent.click(screen.getByText('My Drive')) })
    await screen.findByText('Folder A')
    expect(gasCall).toHaveBeenCalledWith('api_browseDrive', 't', '')
  })

  it('lockToAppRoot opens the app folder with NO My Drive escape crumb', async () => {
    renderPicker({ lockToAppRoot: true })
    await screen.findByText('Hợp đồng')
    expect(gasCall).toHaveBeenCalledWith('api_browseDrive', 't', '__APP_ROOT__')
    expect(screen.getByText('Tài liệu công ty')).toBeInTheDocument()  // app folder crumb
    expect(screen.queryByText('My Drive')).not.toBeInTheDocument()    // locked — no escape
  })

  it('accept filter hides non-matching files', async () => {
    renderPicker({ accept: ['.xlsx'] })
    await screen.findByText('a.xlsx')
    expect(screen.queryByText('b.pdf')).not.toBeInTheDocument()
  })

  it('accept matches Google Sheets by mimeType (no file extension in the name)', async () => {
    gasCall.mockImplementation(() => Promise.resolve({
      current: { id: 'r', name: 'My Drive' },
      folders: [],
      files: [
        { id: 'gs1', name: 'Báo cáo', mimeType: 'application/vnd.google-apps.spreadsheet', size: 0 },
        { id: 'x1', name: 'a.xlsx', mimeType: 'xlsx', size: 100 },
        { id: 'p1', name: 'b.pdf', mimeType: 'pdf', size: 50 },
      ],
    }))
    renderPicker({ accept: ['.xlsx', '.xls', 'application/vnd.google-apps.spreadsheet'] })
    await screen.findByText('Báo cáo')                            // Google Sheet shown by mimeType
    expect(screen.getByText('a.xlsx')).toBeInTheDocument()        // Excel still shown by extension
    expect(screen.queryByText('b.pdf')).not.toBeInTheDocument()   // unrelated file hidden
  })

  it('single-select replaces the previous selection', async () => {
    const onConfirm = jest.fn()
    renderPicker({ multiple: false, onConfirm })
    await screen.findByText('a.xlsx')
    fireEvent.click(screen.getByText('a.xlsx'))
    fireEvent.click(screen.getByText('b.pdf'))               // replaces a.xlsx
    fireEvent.click(screen.getByRole('button', { name: /Chọn/ }))   // confirm button
    expect(onConfirm).toHaveBeenCalledTimes(1)
    const picked = onConfirm.mock.calls[0][0]
    expect(picked).toHaveLength(1)
    expect(picked[0].id).toBe('p1')
  })
})
