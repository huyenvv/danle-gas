import { render, screen, fireEvent } from '@testing-library/react'
import CreateMenu from '../components/CreateMenu.jsx'

describe('<CreateMenu />', () => {
  test('renders primary label, no caret when onImport absent', () => {
    render(<CreateMenu onCreate={() => {}} label="Tạo hồ sơ mới" />)
    expect(screen.getByText('Tạo hồ sơ mới')).toBeInTheDocument()
    expect(screen.queryByLabelText('Thêm tùy chọn')).not.toBeInTheDocument()
  })

  test('primary click calls onCreate', () => {
    const onCreate = jest.fn()
    render(<CreateMenu onCreate={onCreate} onImport={() => {}} label="Tạo hồ sơ mới" />)
    fireEvent.click(screen.getByText('Tạo hồ sơ mới'))
    expect(onCreate).toHaveBeenCalledTimes(1)
  })

  test('caret opens dropdown and "Nhập từ Excel" calls onImport', () => {
    const onImport = jest.fn()
    render(<CreateMenu onCreate={() => {}} onImport={onImport} label="Thêm hồ sơ" />)
    // dropdown closed initially
    expect(screen.queryByText('Nhập từ Excel')).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Thêm tùy chọn'))
    const importItem = screen.getByText('Nhập từ Excel')
    expect(importItem).toBeInTheDocument()
    fireEvent.click(importItem)
    expect(onImport).toHaveBeenCalledTimes(1)
  })

  test('collapsed: dropdown shows short labels Tạo / Excel', () => {
    render(<CreateMenu onCreate={() => {}} onImport={() => {}} collapsed />)
    fireEvent.click(screen.getByLabelText('Thêm tùy chọn'))
    expect(screen.getByText('Tạo')).toBeInTheDocument()
    expect(screen.getByText('Excel')).toBeInTheDocument()
    expect(screen.queryByText('Nhập từ Excel')).not.toBeInTheDocument()
  })

  test('renders nothing when no actions provided', () => {
    const { container } = render(<CreateMenu />)
    expect(container.firstChild).toBeNull()
  })
})
