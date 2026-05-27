import { screen, fireEvent, waitFor } from '@testing-library/react'
import SettingsPage from '../components/SettingsPage.jsx'
import gasCall from '../gasClient.js'
import { renderWithProviders } from './helpers/render.jsx'
import { MOCK_TOKEN } from './helpers/mockData.js'

jest.mock('../gasClient.js')

// SettingsPage uses initialConfigs prop to skip the gasCall fetch on mount.
// The save button is disabled when rootFolderId is empty, so we must supply ROOT_FOLDER_ID.
const MOCK_CONFIGS = {
  ROOT_FOLDER_ID:   'folder-123',
  ROOT_FOLDER_NAME: 'Documents Root',
  COMPANY_NAME:     'Test Company',
  APP_URL:          'https://test.example.com',
}

beforeEach(() => {
  gasCall.mockReset()
  gasCall.mockResolvedValue({})
})

test('renders COMPANY_NAME value in an input', () => {
  renderWithProviders(
    <SettingsPage token={MOCK_TOKEN} initialConfigs={MOCK_CONFIGS} />
  )
  const input = screen.getByDisplayValue('Test Company')
  expect(input).toBeInTheDocument()
})

test('save button calls api_setConfig with updated company name', async () => {
  renderWithProviders(
    <SettingsPage token={MOCK_TOKEN} initialConfigs={MOCK_CONFIGS} />
  )

  // Change company name
  const input = screen.getByDisplayValue('Test Company')
  fireEvent.change(input, { target: { value: 'New Company Name' } })

  // Click save
  const saveBtn = screen.getByRole('button', { name: /lưu cài đặt/i })
  fireEvent.click(saveBtn)

  await waitFor(() => {
    expect(gasCall).toHaveBeenCalledWith('api_setConfig', MOCK_TOKEN, 'COMPANY_NAME', 'New Company Name')
    // also verify total call count (one call per config field saved)
    expect(gasCall).toHaveBeenCalledTimes(4)
  })
})
