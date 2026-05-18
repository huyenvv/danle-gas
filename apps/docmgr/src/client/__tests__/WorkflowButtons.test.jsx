import { render, screen, fireEvent } from '@testing-library/react'
import WorkflowButtons from '../components/documents/WorkflowButtons.jsx'

const doc = (overrides) => Object.assign({ 'Tình trạng': '', 'Phụ trách': '' }, overrides)
const session = (overrides) => Object.assign({ role: 'Nhân viên', userId: 1, username: 'u1' }, overrides)

describe('<WorkflowButtons />', () => {
  test('renders no buttons when role/status combo has no available action', () => {
    const { container } = render(
      <WorkflowButtons doc={doc({ 'Tình trạng': 'Hoàn thành' })} session={session()} onAction={() => {}} />
    )
    expect(container.querySelectorAll('button').length).toBe(0)
  })

  test('Phụ trách user sees "Nhận việc" when status="Chờ xử lý"', () => {
    render(
      <WorkflowButtons
        doc={doc({ 'Tình trạng': 'Chờ xử lý', 'Phụ trách': '["tpkythuat@gmail.com"]' })}
        session={session({ role: 'Trưởng phòng', userId: 10, username: 'tpkythuat@gmail.com' })}
        onAction={() => {}}
      />
    )
    expect(screen.getByTestId('action-nhanViec')).toBeInTheDocument()
    expect(screen.getByTestId('action-nhanViec')).toHaveTextContent('Nhận việc')
  })

  test('REGRESSION: tpkehoach does NOT see "Nhận việc" when doc assigned to tpkythuat', () => {
    render(
      <WorkflowButtons
        doc={doc({ 'Tình trạng': 'Chờ xử lý', 'Phụ trách': '["tpkythuat@gmail.com"]' })}
        session={session({ role: 'Trưởng phòng', userId: 11, username: 'tpkehoach@gmail.com' })}
        onAction={() => {}}
      />
    )
    expect(screen.queryByTestId('action-nhanViec')).not.toBeInTheDocument()
  })

  test('Giám đốc sees only "Thu hồi" when status="Chờ xử lý" — never "Nhận việc"', () => {
    render(
      <WorkflowButtons
        doc={doc({ 'Tình trạng': 'Chờ xử lý', 'Phụ trách': '["gd"]' })}
        session={session({ role: 'Giám đốc', userId: 1, username: 'gd' })}
        onAction={() => {}}
      />
    )
    expect(screen.getByTestId('action-thuHoi')).toBeInTheDocument()
    expect(screen.queryByTestId('action-nhanViec')).not.toBeInTheDocument()
  })

  test('admin sees both "Thu hồi" and "Nhận việc" when status="Chờ xử lý"', () => {
    render(
      <WorkflowButtons
        doc={doc({ 'Tình trạng': 'Chờ xử lý' })}
        session={session({ role: 'admin' })}
        onAction={() => {}}
      />
    )
    expect(screen.getByTestId('action-thuHoi')).toBeInTheDocument()
    expect(screen.getByTestId('action-nhanViec')).toBeInTheDocument()
  })

  test('clicking "Nhận việc" invokes onAction with key "nhanViec"', () => {
    const onAction = jest.fn()
    render(
      <WorkflowButtons
        doc={doc({ 'Tình trạng': 'Chờ xử lý', 'Phụ trách': '["alice"]' })}
        session={session({ role: 'Nhân viên', username: 'alice' })}
        onAction={onAction}
      />
    )
    fireEvent.click(screen.getByTestId('action-nhanViec'))
    expect(onAction).toHaveBeenCalledWith('nhanViec')
  })

  test('disabled=true disables all buttons', () => {
    render(
      <WorkflowButtons
        doc={doc({ 'Tình trạng': 'Chờ xử lý', 'Phụ trách': '["alice"]' })}
        session={session({ role: 'Nhân viên', username: 'alice' })}
        onAction={() => {}}
        disabled
      />
    )
    expect(screen.getByTestId('action-nhanViec')).toBeDisabled()
  })

  test('Phụ trách sees "Hoàn thành" when status="Đang xử lý"', () => {
    render(
      <WorkflowButtons
        doc={doc({ 'Tình trạng': 'Đang xử lý', 'Phụ trách': '["alice"]' })}
        session={session({ role: 'Nhân viên', username: 'alice' })}
        onAction={() => {}}
      />
    )
    expect(screen.getByTestId('action-hoanThanh')).toBeInTheDocument()
  })
})
