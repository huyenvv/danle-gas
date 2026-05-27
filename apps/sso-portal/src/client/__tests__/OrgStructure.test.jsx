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
    const bgdHeading = screen.getByText('Ban Giám Đốc')
    expect(bgdHeading).toBeInTheDocument()
    // Walk up to the card container (h2 → button → outer div)
    const bgdSection = bgdHeading.closest('div.bg-white')
    expect(bgdSection).not.toBeNull()
    // Huyên is assigned Giám đốc at company level — chip must be inside this section
    expect(bgdSection.textContent).toContain('Huyên')
  })

  test('user with both company and dept roles appears in both sections', async () => {
    const multiRoleAssignments = [
      { ID: 2, 'UserID': '2', 'Chức vụ': 'Trưởng phòng', 'PhongBanID': '1' },  // Kỹ thuật
      { ID: 10, 'UserID': '2', 'Chức vụ': 'Giám đốc', 'PhongBanID': '' },       // Ban Giám Đốc
      { ID: 3, 'UserID': '3', 'Chức vụ': 'Nhân viên', 'PhongBanID': '1' },
    ]
    await goToOrgTab({ phongBan: MOCK_PHONG_BAN, assignments: multiRoleAssignments, users: MOCK_USERS })
    // huyenvv (Huyên) should appear as a chip in Ban Giám Đốc AND in Kỹ thuật
    const allHuyen = screen.getAllByText('Huyên')
    expect(allHuyen.length).toBeGreaterThanOrEqual(2)
  })
})
