import { screen, fireEvent, waitFor } from '@testing-library/react'
import SupplierManager from '../components/suppliers/SupplierManager.jsx'
import ProjectManager from '../components/projects/ProjectManager.jsx'
import gasCall from '../gasClient.js'
import { renderWithProviders } from './helpers/render.jsx'

jest.mock('../gasClient.js')

const admin = { role: 'admin' }

beforeEach(() => { gasCall.mockReset(); gasCall.mockResolvedValue({ ID: '9' }) })

describe('ProjectManager — 4-field form with phone', () => {
  // Filling inputs[4] (the phone field) would throw if the field were absent,
  // so this also proves the phone field exists and maps to "Điện thoại".
  test('add form saves the phone field as "Điện thoại"', async () => {
    renderWithProviders(<ProjectManager token="t" lookups={{ duAn: [] }} onUpdate={() => {}} session={admin} />)
    fireEvent.click(screen.getByRole('button', { name: /thêm dự án/i }))

    const inputs = screen.getAllByRole('textbox') // [search, viết tắt, đầy đủ, địa chỉ, điện thoại]
    expect(inputs).toHaveLength(5)
    fireEvent.change(inputs[1], { target: { value: 'DA-X' } })   // Tên viết tắt (required)
    fireEvent.change(inputs[4], { target: { value: '0909' } })   // Số điện thoại
    fireEvent.click(screen.getByRole('button', { name: /^lưu$/i }))

    await waitFor(() => {
      expect(gasCall).toHaveBeenCalledWith('api_addDuAn', 't',
        expect.objectContaining({ 'Tên dự án viết tắt': 'DA-X', 'Điện thoại': '0909' }))
    })
  })

  test('Tên đầy đủ + Địa chỉ wrap to show full text (no truncate)', () => {
    const longAddress = 'Số 99 đường Trần Hưng Đạo Rất Dài, Phường 1, Quận 5, TP. Hồ Chí Minh'
    renderWithProviders(
      <ProjectManager token="t" session={admin} onUpdate={() => {}}
        lookups={{ duAn: [{ ID: '1', 'Tên dự án viết tắt': 'DA-A', 'Tên dự án đầy đủ': 'Dự án Khu Đô Thị', 'Địa chỉ': longAddress, 'Điện thoại': '0900' }] }} />
    )
    const addrCell = screen.getByText(longAddress)
    expect(addrCell.className).toContain('break-words')
    expect(addrCell.className).not.toContain('truncate')

    const nameCell = screen.getByText('Dự án Khu Đô Thị')
    expect(nameCell.className).not.toContain('truncate')
  })
})

describe('SupplierManager — reduced to the same 4 fields', () => {
  test('add form drops the old extra fields (only 4 inputs)', () => {
    renderWithProviders(<SupplierManager token="t" lookups={{ nhaCungCap: [] }} onUpdate={() => {}} session={admin} />)
    fireEvent.click(screen.getByRole('button', { name: /thêm ncc/i }))

    expect(screen.queryByText('Mã số thuế')).not.toBeInTheDocument()
    expect(screen.queryByText('Người đại diện')).not.toBeInTheDocument()
    expect(screen.queryByText('Số tài khoản')).not.toBeInTheDocument()
    expect(screen.queryByText('Tên ngân hàng')).not.toBeInTheDocument()
    expect(screen.queryByText('Lĩnh vực kinh doanh')).not.toBeInTheDocument()
    expect(screen.getAllByRole('textbox')).toHaveLength(5) // search + 4 form fields
  })

  test('saves phone as "Điện thoại"', async () => {
    renderWithProviders(<SupplierManager token="t" lookups={{ nhaCungCap: [] }} onUpdate={() => {}} session={admin} />)
    fireEvent.click(screen.getByRole('button', { name: /thêm ncc/i }))

    const inputs = screen.getAllByRole('textbox') // [search, viết tắt, đầy đủ, địa chỉ, điện thoại]
    fireEvent.change(inputs[1], { target: { value: 'NCC-X' } })
    fireEvent.change(inputs[4], { target: { value: '0988' } })
    fireEvent.click(screen.getByRole('button', { name: /^lưu$/i }))

    await waitFor(() => {
      expect(gasCall).toHaveBeenCalledWith('api_addNhaCungCap', 't',
        expect.objectContaining({ 'Tên NCC viết tắt': 'NCC-X', 'Điện thoại': '0988' }))
    })
  })

  test('Tên đầy đủ + Địa chỉ wrap to show full text (no truncate)', () => {
    const longAddress = 'Số 123 đường Nguyễn Văn Rất Dài, Phường 4, Quận Bình Thạnh, TP. Hồ Chí Minh'
    renderWithProviders(
      <SupplierManager token="t" session={admin} onUpdate={() => {}}
        lookups={{ nhaCungCap: [{ ID: '1', 'Tên NCC viết tắt': 'NCC-A', 'Tên NCC đầy đủ': 'Công ty TNHH ABC', 'Địa chỉ': longAddress, 'Điện thoại': '0900' }] }} />
    )
    const addrCell = screen.getByText(longAddress)
    expect(addrCell.className).toContain('break-words')
    expect(addrCell.className).not.toContain('truncate')

    const nameCell = screen.getByText('Công ty TNHH ABC')
    expect(nameCell.className).not.toContain('truncate')
  })
})
