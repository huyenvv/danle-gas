import { render, screen, fireEvent } from '@testing-library/react'
import ViewerPickerModal from '../components/common/ViewerPickerModal.jsx'

const USERS = [
  { ID: '1', 'Tên nhân viên': 'An', 'Email': 'an@x.com' },
  { ID: '2', 'Tên nhân viên': 'Bình', 'Email': 'binh@x.com' },
  { ID: '3', 'Tên nhân viên': 'Cường', 'Email': 'cuong@x.com' },
]
const PHONGBAN = [
  { ID: '10', 'Tên phòng ban': 'Kế toán' },
  { ID: '20', 'Tên phòng ban': 'Kỹ thuật' },
]
const ASSIGNMENTS = [
  { UserID: '1', 'Chức vụ': 'NV', PhongBanID: '10' },
  { UserID: '2', 'Chức vụ': 'NV', PhongBanID: '10' },
  { UserID: '3', 'Chức vụ': 'NV', PhongBanID: '20' },
]

function setup(extra = {}) {
  const onConfirm = jest.fn()
  const onClose = jest.fn()
  render(
    <ViewerPickerModal
      testId="vpm"
      users={USERS}
      phongBan={PHONGBAN}
      assignments={ASSIGNMENTS}
      value={extra.value || []}
      categoryViewerIds={extra.categoryViewerIds || ['1']}
      catName={extra.catName || 'Con 1'}
      saving={extra.saving || false}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  )
  return { onConfirm, onClose }
}
const sortedConfirm = (fn) => [...fn.mock.calls[fn.mock.calls.length - 1][0]].map(String).sort()

describe('ViewerPickerModal', () => {
  test('render gom theo phòng ban + người', () => {
    setup()
    expect(screen.getByText('Kế toán')).toBeInTheDocument()
    expect(screen.getByText('Kỹ thuật')).toBeInTheDocument()
    expect(screen.getByText(/An/)).toBeInTheDocument()
    expect(screen.getByText(/Cường/)).toBeInTheDocument()
  })

  test('chế độ "Theo danh mục" → tích đúng người của danh mục', () => {
    const { onConfirm } = setup({ categoryViewerIds: ['2'] })
    fireEvent.click(screen.getByTestId('vpm-bycat'))
    expect(screen.getByTestId('vpm-count')).toHaveTextContent('1')
    fireEvent.click(screen.getByTestId('vpm-confirm'))
    expect(onConfirm).toHaveBeenCalledWith(['2'])
  })

  test('chế độ "Tất cả" → tích toàn bộ', () => {
    const { onConfirm } = setup()
    fireEvent.click(screen.getByTestId('vpm-all'))
    expect(screen.getByTestId('vpm-count')).toHaveTextContent('3')
    fireEvent.click(screen.getByTestId('vpm-confirm'))
    expect(sortedConfirm(onConfirm)).toEqual(['1', '2', '3'])
  })

  test('"Chọn tất cả" một phòng → chỉ người phòng đó', () => {
    const { onConfirm } = setup()
    fireEvent.click(screen.getByTestId('vpm-deptall-0')) // Kế toán: 1,2
    fireEvent.click(screen.getByTestId('vpm-confirm'))
    expect(sortedConfirm(onConfirm)).toEqual(['1', '2'])
  })

  test('tích từng người + đếm; Chọn commit draft', () => {
    const { onConfirm } = setup()
    fireEvent.click(screen.getByTestId('vpm-u-3'))
    expect(screen.getByTestId('vpm-count')).toHaveTextContent('1')
    fireEvent.click(screen.getByTestId('vpm-confirm'))
    expect(onConfirm).toHaveBeenCalledWith(['3'])
  })

  test('saving=true → nút Chọn disabled + "Đang lưu..."', () => {
    setup({ saving: true })
    const btn = screen.getByTestId('vpm-confirm')
    expect(btn).toBeDisabled()
    expect(btn).toHaveTextContent('Đang lưu')
    expect(screen.getByTestId('vpm-cancel')).toBeDisabled()
    expect(screen.getByTestId('vpm-close')).toBeDisabled()
  })

  test('Hủy → onClose, KHÔNG commit', () => {
    const { onConfirm, onClose } = setup({ value: ['1'] })
    fireEvent.click(screen.getByTestId('vpm-u-2')) // sửa draft
    fireEvent.click(screen.getByTestId('vpm-cancel'))
    expect(onClose).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })
})
