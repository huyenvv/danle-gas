import { screen } from '@testing-library/react'
import SupplierManager from '../components/suppliers/SupplierManager.jsx'
import ProjectManager from '../components/projects/ProjectManager.jsx'
import { renderWithProviders } from './helpers/render.jsx'

jest.mock('../gasClient.js')

const supplierLookups = { nhaCungCap: [{ ID: '1', 'Tên NCC viết tắt': 'ABC' }] }
const projectLookups = { duAn: [{ ID: '1', 'Tên dự án viết tắt': 'P1' }] }

describe('SupplierManager — Xóa chỉ hiện với admin roles', () => {
  test('Văn thư sees Sửa but NOT Xóa', () => {
    renderWithProviders(<SupplierManager token="t" lookups={supplierLookups} onUpdate={() => {}} session={{ role: 'Văn thư' }} />)
    expect(screen.getByText('Sửa')).toBeInTheDocument()
    expect(screen.queryByText('Xóa')).not.toBeInTheDocument()
  })

  test('non-admin role (Phó GĐ) does NOT see Xóa', () => {
    renderWithProviders(<SupplierManager token="t" lookups={supplierLookups} onUpdate={() => {}} session={{ role: 'Phó GĐ' }} />)
    expect(screen.queryByText('Xóa')).not.toBeInTheDocument()
  })

  test.each(['admin', 'Quản trị viên', 'Giám đốc'])('%s sees Xóa', (role) => {
    renderWithProviders(<SupplierManager token="t" lookups={supplierLookups} onUpdate={() => {}} session={{ role }} />)
    expect(screen.getByText('Xóa')).toBeInTheDocument()
  })
})

describe('ProjectManager — Xóa chỉ hiện với admin roles', () => {
  test('Văn thư sees Sửa but NOT Xóa', () => {
    renderWithProviders(<ProjectManager token="t" lookups={projectLookups} onUpdate={() => {}} session={{ role: 'Văn thư' }} />)
    expect(screen.getByText('Sửa')).toBeInTheDocument()
    expect(screen.queryByText('Xóa')).not.toBeInTheDocument()
  })

  test('non-admin role (Phó GĐ) does NOT see Xóa', () => {
    renderWithProviders(<ProjectManager token="t" lookups={projectLookups} onUpdate={() => {}} session={{ role: 'Phó GĐ' }} />)
    expect(screen.queryByText('Xóa')).not.toBeInTheDocument()
  })

  test.each(['admin', 'Quản trị viên', 'Giám đốc'])('%s sees Xóa', (role) => {
    renderWithProviders(<ProjectManager token="t" lookups={projectLookups} onUpdate={() => {}} session={{ role }} />)
    expect(screen.getByText('Xóa')).toBeInTheDocument()
  })
})
