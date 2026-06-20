import { screen } from '@testing-library/react'
import { renderWithProviders } from './helpers/render.jsx'
import { MOCK_TOKEN, MOCK_ADMIN_SESSION, MOCK_LOOKUPS, MOCK_DOCS } from './helpers/mockData.js'

jest.mock('../gasClient.js')

// Mock UserPickerDropdown → div liệt kê username trong prop `users`, để kiểm picker
// giao việc (Phụ trách / Người phối hợp) lấy nguồn người từ ssoUsers (toàn bộ SSO active),
// KHÔNG chỉ users (người đã có role docmgr). Regression cho T040.
jest.mock('../components/common/UserPickerDropdown.jsx', () => {
  const React = require('react')
  return function MockUPD({ users }) {
    return React.createElement('div', { 'data-testid': 'upd' },
      (users || []).map(u => u['Tên đăng nhập']).join(','))
  }
})

import DocumentModal from '../components/DocumentModal.jsx'

const SSO_ONLY = {
  ID: 99, 'Tên đăng nhập': 'ssoonly', 'Tên nhân viên': 'SSO Only',
  'Email': 's@x.com', 'Trạng thái': 'Active', 'Quyền': 'Nhân viên',
}

test('picker giao việc dùng toàn bộ SSO active (ssoUsers ⊋ users)', () => {
  // ssoUsers có thêm 1 người KHÔNG nằm trong users (chưa từng đăng nhập docmgr)
  const lookups = { ...MOCK_LOOKUPS, users: MOCK_LOOKUPS.users, ssoUsers: [...MOCK_LOOKUPS.users, SSO_ONLY] }
  renderWithProviders(
    <DocumentModal mode="create" doc={null} lookups={lookups} token={MOCK_TOKEN}
      session={MOCK_ADMIN_SESSION} onClose={() => {}} onSaved={() => {}} docs={MOCK_DOCS} />
  )
  // Admin → hiện picker Phụ trách + Người phối hợp; cả hai nhận users=ssoUsers → có 'ssoonly'
  const pickers = screen.getAllByTestId('upd')
  expect(pickers.length).toBeGreaterThan(0)
  expect(pickers.some(el => el.textContent.includes('ssoonly'))).toBe(true)
})
