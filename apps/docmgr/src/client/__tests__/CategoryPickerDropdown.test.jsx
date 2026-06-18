import { render, screen, fireEvent } from '@testing-library/react'
import CategoryPickerDropdown from '../components/common/CategoryPickerDropdown.jsx'

const CATS = [
  { ID: '1', 'Tên danh mục': 'Hợp đồng', 'Danh mục cha': '' },
  { ID: '10', 'Tên danh mục': 'Hợp đồng mua', 'Danh mục cha': '1' },
  { ID: '11', 'Tên danh mục': 'Hợp đồng bán', 'Danh mục cha': '1' },
  { ID: '2', 'Tên danh mục': 'Công văn', 'Danh mục cha': '' },
]

function setup(props = {}) {
  const onChange = jest.fn()
  render(<CategoryPickerDropdown testId="cat" categories={CATS} value="" onChange={onChange} {...props} />)
  return { onChange }
}

test('trigger shows placeholder, opens to reveal the tree expanded by default', () => {
  setup()
  fireEvent.click(screen.getByTestId('cat'))
  // Parents expanded by default → children visible without clicking
  expect(screen.getByTestId('cat-opt-1')).toBeInTheDocument()
  expect(screen.getByTestId('cat-opt-10')).toBeInTheDocument()
  expect(screen.getByTestId('cat-opt-11')).toBeInTheDocument()
})

test('collapsing a parent hides its children; expanding shows them again', () => {
  setup()
  fireEvent.click(screen.getByTestId('cat'))

  // The chevron lives inside the option row; collapse "Hợp đồng"
  fireEvent.click(screen.getByRole('button', { name: 'Thu gọn' }))
  expect(screen.queryByTestId('cat-opt-10')).not.toBeInTheDocument()
  expect(screen.queryByTestId('cat-opt-11')).not.toBeInTheDocument()
  // Parent itself stays visible
  expect(screen.getByTestId('cat-opt-1')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Mở rộng' }))
  expect(screen.getByTestId('cat-opt-10')).toBeInTheDocument()
})

test('search filters to matches and keeps ancestor context', () => {
  setup()
  fireEvent.click(screen.getByTestId('cat'))
  fireEvent.change(screen.getByPlaceholderText('Tìm danh mục...'), { target: { value: 'mua' } })

  expect(screen.getByTestId('cat-opt-10')).toBeInTheDocument()  // match
  expect(screen.getByTestId('cat-opt-1')).toBeInTheDocument()   // ancestor kept for context
  expect(screen.queryByTestId('cat-opt-11')).not.toBeInTheDocument() // sibling hidden
  expect(screen.queryByTestId('cat-opt-2')).not.toBeInTheDocument()  // unrelated root hidden
})

test('search is accent-insensitive', () => {
  setup()
  fireEvent.click(screen.getByTestId('cat'))
  fireEvent.change(screen.getByPlaceholderText('Tìm danh mục...'), { target: { value: 'cong van' } })
  expect(screen.getByTestId('cat-opt-2')).toBeInTheDocument()
})

test('selecting an option calls onChange with the id and closes the dropdown', () => {
  const { onChange } = setup()
  fireEvent.click(screen.getByTestId('cat'))
  fireEvent.click(screen.getByTestId('cat-opt-10'))
  expect(onChange).toHaveBeenCalledWith('10')
  expect(screen.queryByPlaceholderText('Tìm danh mục...')).not.toBeInTheDocument()
})

test('rootOption renders and selects empty value', () => {
  const { onChange } = setup({ rootOption: '— Không có (gốc) —' })
  fireEvent.click(screen.getByTestId('cat'))
  fireEvent.click(screen.getByTestId('cat-opt-root'))
  expect(onChange).toHaveBeenCalledWith('')
})

test('excludeIds hides the given categories', () => {
  setup({ excludeIds: new Set(['10']) })
  fireEvent.click(screen.getByTestId('cat'))
  expect(screen.queryByTestId('cat-opt-10')).not.toBeInTheDocument()
  expect(screen.getByTestId('cat-opt-11')).toBeInTheDocument()
})
