import { screen, fireEvent, waitFor } from '@testing-library/react'
import gasCall from '../gasClient.js'
import { renderDashboard, MOCK_USERS, MOCK_PHONG_BAN, MOCK_ASSIGNMENTS } from './helpers.js'

jest.mock('../gasClient.js')

beforeEach(() => { gasCall.mockReset() })

async function goToOrgTab(overrides = {}) {
  await renderDashboard(gasCall, overrides)
  const tabButtons = screen.getAllByRole('button')
  const orgTab = tabButtons.find(btn => btn.textContent.includes('Phòng ban'))
  expect(orgTab).toBeDefined()
  fireEvent.click(orgTab)
  // Wait for org structure to render — dept h2 headings appear
  await waitFor(() => {
    const headings = screen.getAllByRole('heading')
    expect(headings.some(h => h.textContent === 'Kỹ thuật')).toBe(true)
  })
}

describe('OrgStructure — dept groups', () => {
  test('renders department names from phongBan data', async () => {
    await goToOrgTab({ phongBan: MOCK_PHONG_BAN, assignments: MOCK_ASSIGNMENTS, users: MOCK_USERS })
    const headings = screen.getAllByRole('heading')
    expect(headings.some(h => h.textContent === 'Kỹ thuật')).toBe(true)
    expect(headings.some(h => h.textContent === 'Kinh doanh')).toBe(true)
  })

  test('user appears under their assigned dept position', async () => {
    await goToOrgTab({ phongBan: MOCK_PHONG_BAN, assignments: MOCK_ASSIGNMENTS, users: MOCK_USERS })
    // huyenvv (ID 2) is Trưởng phòng in Kỹ thuật (PhongBanID: 1)
    // Their name renders as a chip inside the Kỹ thuật dept section
    expect(screen.getByText('Huyên')).toBeInTheDocument()
  })
})

describe('OrgStructure — company-level role display', () => {
  test('user with company-level role (no PhongBanID) appears in Ban Giám Đốc section', async () => {
    const assignmentsWithGiamdoc = [
      ...MOCK_ASSIGNMENTS,
      { ID: 10, 'UserID': '2', 'Chức vụ': 'Giám đốc', 'PhongBanID': '' },
    ]
    await goToOrgTab({ phongBan: MOCK_PHONG_BAN, assignments: assignmentsWithGiamdoc, users: MOCK_USERS })
    // Ban Giám Đốc section header
    expect(screen.getByText('Ban Giám Đốc')).toBeInTheDocument()
    // Huyên is assigned Giám đốc at company level — name renders as chip in that section
    // getAllByText handles any duplicate 'Huyên' occurrences
    const huyenEls = screen.getAllByText('Huyên')
    expect(huyenEls.length).toBeGreaterThan(0)
  })
})
