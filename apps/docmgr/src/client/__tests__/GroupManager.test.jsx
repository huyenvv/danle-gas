import { screen, fireEvent } from '@testing-library/react'
import GroupManager from '../components/departments/GroupManager.jsx'
import gasCall from '../gasClient.js'
import { renderWithProviders } from './helpers/render.jsx'
import { MOCK_TOKEN, MOCK_USERS } from './helpers/mockData.js'

jest.mock('../gasClient.js')

// A user present in the company SSO directory but who has never opened docmgr,
// so they have no _Phân Quyền row → absent from lookups.users, present in ssoUsers.
const SSO_ONLY_USER = {
  ID: 99,
  'Tên đăng nhập': 'newbie',
  'Tên nhân viên': 'Người Chưa Vào App',
  'Email': 'newbie@test.com',
  'Trạng thái': 'Active',
  'Quyền': '',
}

const LOOKUPS = {
  nhom: [],
  users: MOCK_USERS,                       // only docmgr-authorized users
  ssoUsers: [...MOCK_USERS, SSO_ONLY_USER], // full active SSO directory
}

beforeEach(() => { gasCall.mockReset() })

describe('GroupManager — member picker', () => {
  test('member picker lists every active SSO user, including those not yet in docmgr', () => {
    renderWithProviders(<GroupManager token={MOCK_TOKEN} lookups={LOOKUPS} onUpdate={jest.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /thêm nhóm/i }))

    // SSO-only user would be missing if the picker still read lookups.users
    expect(screen.getByText('Người Chưa Vào App (newbie@test.com)')).toBeInTheDocument()
    expect(screen.getByText('Admin (admin@test.com)')).toBeInTheDocument()
  })
})
