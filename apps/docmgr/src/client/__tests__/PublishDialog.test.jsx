import { screen, fireEvent, waitFor } from '@testing-library/react'
import PublishDialog from '../components/documents/PublishDialog.jsx'
import { renderWithProviders } from './helpers/render.jsx'
import { MOCK_USERS, MOCK_LOOKUPS } from './helpers/mockData.js'

const onPublish = jest.fn()
const onClose   = jest.fn()

const DEFAULT_PROPS = {
  users:       MOCK_USERS,
  phongBan:    MOCK_LOOKUPS.phongBan,
  assignments: MOCK_LOOKUPS.assignments,
  onPublish,
  onClose,
  loading: false,
}

function renderDialog(overrides = {}) {
  return renderWithProviders(<PublishDialog {...DEFAULT_PROPS} {...overrides} />)
}

beforeEach(() => {
  onPublish.mockReset()
  onClose.mockReset()
})

// Test 1: renders users — Admin and Viewer One are visible in the recipient columns
test('renders users in recipient columns', () => {
  renderDialog()
  // Both users should appear at least once (two RecipientColumn instances render the same user list)
  const adminItems = screen.getAllByText('Admin')
  const viewerItems = screen.getAllByText('Viewer One')
  expect(adminItems.length).toBeGreaterThanOrEqual(1)
  expect(viewerItems.length).toBeGreaterThanOrEqual(1)
})

// Test 2: cancel button calls onClose
test('cancel button calls onClose', () => {
  renderDialog()
  // Footer cancel button (there are two close triggers: icon button in header + "Hủy" text button in footer)
  fireEvent.click(screen.getByText('Hủy'))
  expect(onClose).toHaveBeenCalledTimes(1)
})

// Test 3: submit without selecting any recipient shows validation error, onPublish NOT called
test('submit without recipient shows validation error and does not call onPublish', () => {
  renderDialog()
  fireEvent.click(screen.getByText('Phát hành'))
  expect(screen.getByText('Vui lòng chọn ít nhất 1 người nhận')).toBeInTheDocument()
  expect(onPublish).not.toHaveBeenCalled()
})

// Test 4: select a recipient in the first column then submit — onPublish called with that user's ID
test('selecting recipient and submitting calls onPublish with selected IDs', () => {
  renderDialog()
  // The dialog renders two RecipientColumn instances (Người nhận + CC).
  // Each column has a "Chọn tất cả" global checkbox. The first one belongs to the first column.
  const checkboxes = screen.getAllByRole('checkbox')
  // checkboxes[0] is the "Chọn tất cả" checkbox for the first column (Người nhận)
  // Clicking it selects all visible users
  fireEvent.click(checkboxes[0])

  fireEvent.click(screen.getByText('Phát hành'))
  expect(onPublish).toHaveBeenCalledTimes(1)
  // onPublish(toIds: string[], ccIds: string[])
  // After clicking "Chọn tất cả" in the first column both visible users should be selected
  const [toIds, ccIds] = onPublish.mock.calls[0]
  expect(toIds.length).toBeGreaterThanOrEqual(1)
  expect(Array.isArray(toIds)).toBe(true)
  expect(Array.isArray(ccIds)).toBe(true)
})
