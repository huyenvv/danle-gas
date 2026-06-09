import { screen, fireEvent, act } from '@testing-library/react'
import ImportManager from '../components/ImportManager.jsx'
import gasCall from '../gasClient.js'
import { renderWithProviders } from './helpers/render.jsx'
import { MOCK_LOOKUPS } from './helpers/mockData.js'

jest.mock('../gasClient.js')

// Rows crafted to exercise: clean group, warning group, invalid groups (out-of-order
// row numbers), and an orphan — against MOCK_LOOKUPS (danh mục: Hợp đồng/Công văn).
const ROWS = [
  { rowIndex: 2, tenHoSo: 'CV hợp lệ', danhMuc: 'Công văn', gId: 'g1', tenFile: 'a.pdf' },
  { rowIndex: 3, tenHoSo: 'HD cảnh báo', danhMuc: 'Hợp đồng', gId: 'g2', tenFile: 'b.pdf', phuTrach: 'khong@co.com' },
  { rowIndex: 5, tenHoSo: 'Sai danh mục', danhMuc: 'Không Tồn Tại', gId: 'g3', tenFile: 'c.pdf' },
  { rowIndex: 4, tenHoSo: 'Thiếu file', danhMuc: 'Công văn', gId: '', tenFile: 'd.pdf' },
  { rowIndex: 6, tenHoSo: '', danhMuc: 'Công văn', gId: 'g5', tenFile: 'e.pdf' },
]

beforeEach(() => {
  gasCall.mockReset()
  gasCall.mockResolvedValue({ rows: ROWS })
})

async function uploadAndPreview(rows) {
  if (rows) gasCall.mockResolvedValue({ rows })
  const { container } = renderWithProviders(
    <ImportManager token="t" lookups={MOCK_LOOKUPS} onImported={jest.fn()} />
  )
  const input = container.querySelector('input[type="file"]')
  const file = new File(['x'], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  await act(async () => {
    fireEvent.change(input, { target: { files: [file] } })
  })
  await screen.findByText(/dòng dữ liệu$/)
  return container
}

describe('ImportManager preview', () => {
  it('shows total data-row count and total hồ sơ count', async () => {
    await uploadAndPreview()
    // 5 data rows total (4 named + 1 orphan), 4 hồ sơ groups
    expect(screen.getByText(/^5 dòng dữ liệu$/)).toBeInTheDocument()
    expect(screen.getByText(/^4 hồ sơ$/)).toBeInTheDocument()
  })

  it('orders valid hồ sơ above invalid ones in the table', async () => {
    const container = await uploadAndPreview()
    const names = Array.from(container.querySelectorAll('button[title="Xem đầy đủ thông tin hồ sơ"]'))
      .map(b => b.textContent.replace('visibility', '').trim()) // strip the Material icon glyph text
    expect(names).toEqual(['CV hợp lệ', 'HD cảnh báo', 'Sai danh mục', 'Thiếu file'])
  })

  it('lists invalid rows sorted by row number ascending', async () => {
    await uploadAndPreview()
    const dongItems = screen.getAllByRole('listitem')
      .map(li => li.textContent)
      .filter(t => t.includes('Dòng'))
    expect(dongItems[0]).toContain('Dòng 4') // Thiếu file (thiếu G_ID)
    expect(dongItems[1]).toContain('Dòng 5') // Sai danh mục
    expect(dongItems[2]).toContain('Dòng 6') // orphan (thiếu Tên hồ sơ)
  })

  it('opens the full detail popup when clicking a hồ sơ name', async () => {
    await uploadAndPreview()
    fireEvent.click(screen.getByRole('button', { name: /CV hợp lệ/ }))
    // Modal shows document field labels + the file list section
    expect(await screen.findByText(/Danh sách file/)).toBeInTheDocument()
    expect(screen.getByText('Số hồ sơ')).toBeInTheDocument()
  })

  it('shows "Xem thêm" and opens a popup when more than 10 invalid rows', async () => {
    const many = Array.from({ length: 11 }, (_, i) => ({
      rowIndex: i + 2, tenHoSo: `Bad ${i}`, danhMuc: 'Không Tồn Tại', gId: 'g' + i, tenFile: 'f.pdf',
    }))
    await uploadAndPreview(many)

    expect(screen.getByText(/^11 dòng dữ liệu$/)).toBeInTheDocument()
    // 10 shown inline + "Xem thêm 1 dòng…"
    const moreBtn = screen.getByText(/Xem thêm 1 dòng/)
    fireEvent.click(moreBtn)
    // Popup lists all invalid rows
    expect(await screen.findByText('Dòng chưa hợp lệ')).toBeInTheDocument()
  })
})
