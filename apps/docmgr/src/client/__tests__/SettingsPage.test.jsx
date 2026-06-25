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

test('Email tab lists the new sender/recipient role & department variables', () => {
  renderWithProviders(
    <SettingsPage token={MOCK_TOKEN} initialConfigs={MOCK_CONFIGS} />
  )
  fireEvent.click(screen.getByText('Email thông báo'))
  expect(screen.getByText(/\{vaiTròNgườiGửi\}/)).toBeInTheDocument()
  expect(screen.getByText(/\{phòngBanNgườiGửi\}/)).toBeInTheDocument()
  expect(screen.getByText(/\{phòngBanNgườiNhận\}/)).toBeInTheDocument()
})

test('Email tab có tab "Phối hợp" và biến {nộiDungPhoiHop} (feature 010)', () => {
  renderWithProviders(
    <SettingsPage token={MOCK_TOKEN} initialConfigs={MOCK_CONFIGS} />
  )
  fireEvent.click(screen.getByText('Email thông báo'))
  // Tab cấu hình email "Phối hợp" xuất hiện (FR-017)
  expect(screen.getByRole('button', { name: /Phối hợp/ })).toBeInTheDocument()
  // Biến mới có trong danh sách biến khả dụng
  expect(screen.getByText(/\{nộiDungPhoiHop\}/)).toBeInTheDocument()
})

test('Email tab có biến người kiểm soát cho mẫu giao việc (feature 013)', () => {
  renderWithProviders(
    <SettingsPage token={MOCK_TOKEN} initialConfigs={MOCK_CONFIGS} />
  )
  fireEvent.click(screen.getByText('Email thông báo'))
  // Không còn tab/mẫu email riêng "Kiểm soát" — NKS nhận email giao việc chung
  expect(screen.queryByRole('button', { name: /Kiểm soát/ })).not.toBeInTheDocument()
  // Biến NKS vẫn có trong danh sách (dùng cho đoạn [[...]] của mẫu giao việc)
  expect(screen.getByText(/\{tênNgườiKiểmSoát\}/)).toBeInTheDocument()
  expect(screen.getByText(/\{vaiTròNgườiKiểmSoát\}/)).toBeInTheDocument()
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
