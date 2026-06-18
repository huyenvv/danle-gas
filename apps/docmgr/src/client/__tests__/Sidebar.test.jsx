import { render, screen } from '@testing-library/react'
import Sidebar from '../components/Sidebar.jsx'

function renderSidebar(props = {}) {
  return render(
    <Sidebar
      page="documents"
      onPage={() => {}}
      isAdmin={false}
      isSuperAdmin={false}
      collapsed={false}
      role="Nhân viên"
      canCreateSubCat={false}
      {...props}
    />
  )
}

describe('Sidebar — "Danh mục" visibility', () => {
  test('Văn thư does NOT see Danh mục without canCreateSubCat', () => {
    renderSidebar({ role: 'Văn thư', canCreateSubCat: false })
    expect(screen.queryByText('Danh mục')).not.toBeInTheDocument()
  })

  test('Văn thư SEES Danh mục when granted canCreateSubCat', () => {
    renderSidebar({ role: 'Văn thư', canCreateSubCat: true })
    expect(screen.getByText('Danh mục')).toBeInTheDocument()
  })

  test('Văn thư SEES Danh mục when granted canCreateRootCat only', () => {
    renderSidebar({ role: 'Văn thư', canCreateSubCat: false, canCreateRootCat: true })
    expect(screen.getByText('Danh mục')).toBeInTheDocument()
  })

  test('Nhân viên sees Danh mục only with canCreateSubCat', () => {
    const { rerender } = renderSidebar({ role: 'Nhân viên', canCreateSubCat: false })
    expect(screen.queryByText('Danh mục')).not.toBeInTheDocument()
    rerender(
      <Sidebar page="documents" onPage={() => {}} isAdmin={false} isSuperAdmin={false}
        collapsed={false} role="Nhân viên" canCreateSubCat={true} />
    )
    expect(screen.getByText('Danh mục')).toBeInTheDocument()
  })

  test('Phó GĐ always sees Danh mục regardless of canCreateSubCat', () => {
    renderSidebar({ role: 'Phó GĐ', canCreateSubCat: false })
    expect(screen.getByText('Danh mục')).toBeInTheDocument()
  })
})
