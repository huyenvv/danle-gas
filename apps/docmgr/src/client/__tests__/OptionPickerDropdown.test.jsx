import { render, screen, fireEvent } from '@testing-library/react'
import OptionPickerDropdown from '../components/common/OptionPickerDropdown.jsx'

const OPTIONS = [
  { value: 'DA-01', label: 'Dự án 1 (DA-01)' },
  { value: 'DA-02', label: 'Dự án 2 (DA-02)' },
  { value: 'DA-03', label: 'Khác (DA-03)' },
]

function setup(value = []) {
  const onChange = jest.fn()
  render(<OptionPickerDropdown testId="pk" options={OPTIONS} value={value} onChange={onChange} placeholder="-- Chọn dự án --" />)
  return onChange
}

describe('OptionPickerDropdown', () => {
  test('options are hidden until the trigger is opened', () => {
    setup()
    expect(screen.getByText('-- Chọn dự án --')).toBeInTheDocument()
    expect(screen.queryByTestId('pk-opt-DA-01')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('pk'))
    expect(screen.getByTestId('pk-opt-DA-01')).toBeInTheDocument()
  })

  test('clicking an option adds it (onChange with array)', () => {
    const onChange = setup(['DA-01'])
    fireEvent.click(screen.getByTestId('pk'))
    fireEvent.click(screen.getByTestId('pk-opt-DA-02'))
    expect(onChange).toHaveBeenCalledWith(['DA-01', 'DA-02'])
  })

  test('clicking a selected option removes it', () => {
    const onChange = setup(['DA-01', 'DA-02'])
    fireEvent.click(screen.getByTestId('pk'))
    fireEvent.click(screen.getByTestId('pk-opt-DA-01'))
    expect(onChange).toHaveBeenCalledWith(['DA-02'])
  })

  test('search filters the option list by label', () => {
    setup()
    fireEvent.click(screen.getByTestId('pk'))
    fireEvent.change(screen.getByPlaceholderText('Tìm kiếm...'), { target: { value: 'khác' } })
    expect(screen.getByTestId('pk-opt-DA-03')).toBeInTheDocument()
    expect(screen.queryByTestId('pk-opt-DA-01')).not.toBeInTheDocument()
  })

  test('selected values render as chips and can be removed', () => {
    const onChange = setup(['DA-01'])
    expect(screen.getByText('Dự án 1 (DA-01)')).toBeInTheDocument()
    fireEvent.click(screen.getByText('close')) // the × icon
    expect(onChange).toHaveBeenCalledWith([])
  })
})
