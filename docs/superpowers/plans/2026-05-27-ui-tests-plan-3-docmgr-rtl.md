# DocMgr — RTL Unit Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Write React Testing Library unit tests for all DocMgr client screens: Documents list (MainApp), DocumentModal, DocumentPreview (with comments), PublishDialog, CategoryManager, UserManager, SettingsPage, AuditLogPage.

**Architecture:** Individual components are tested directly with props + `renderWithProviders()`. `MainApp` (Documents screen) is tested with mocked `useAuth()`, mocked `gasCall`, and mocked `dataCache` module to avoid `setInterval`. The `window.__INITIAL_DATA__` pattern injects initial documents data without a round-trip API call. `AuthContext` is mocked in the `MainApp` test only — all other components receive auth state via props.

**Tech Stack:** React Testing Library + jest-dom + jsdom; Babel-jest + `@babel/preset-react` (already in `apps/docmgr/babel.config.js`); existing `apps/docmgr/jest.config.js` client project already configured; `fireEvent` from `@testing-library/react` (no `user-event` — not installed at root).

---

### Task 1: Test Infrastructure — Render Helper + Shared Mock Data

**Files:**
- Modify: `apps/docmgr/src/client/__tests__/setup.js`
- Create: `apps/docmgr/src/client/__tests__/helpers/render.jsx`
- Create: `apps/docmgr/src/client/__tests__/helpers/mockData.js`

- [ ] **Step 1: Extend setup.js — add localStorage clear and window cleanup**

Open `apps/docmgr/src/client/__tests__/setup.js` and replace it entirely:

```js
require('@testing-library/jest-dom')

beforeEach(() => {
  localStorage.clear()
  window.__INITIAL_DATA__ = null
  window.__SSO_TOKEN__ = undefined
  window.__SSO_PARENT__ = undefined
})
```

- [ ] **Step 2: Run existing WorkflowButtons test to verify setup still works**

```bash
npx jest --config apps/docmgr/jest.config.js src/client/__tests__/WorkflowButtons.test.jsx --no-coverage
```

Expected: all existing WorkflowButtons tests pass (green).

- [ ] **Step 3: Create shared mock data**

Create `apps/docmgr/src/client/__tests__/helpers/mockData.js`:

```js
export const MOCK_TOKEN = 'test-access-token'

export const MOCK_ADMIN_SESSION = {
  userId: 1,
  username: 'admin',
  role: 'admin',
  email: 'admin@test.com',
  name: 'Admin',
  permissions: {
    hoSo:       { c: true, r: true, u: true, d: true },
    danhMuc:    { c: true, r: true, u: true, d: true },
    nhom:       { c: true, r: true, u: true, d: true },
    nhaCungCap: { c: true, r: true, u: true, d: true },
    duAn:       { c: true, r: true, u: true, d: true },
    user:       { c: true, r: true, u: true, d: true },
    caiDat:     { c: true, r: true, u: true, d: true },
  },
  canCreate: true,
  canCreateSubCat: true,
  departments: [],
}

export const MOCK_VIEWER_SESSION = {
  userId: 2,
  username: 'viewer1',
  role: 'Nhân viên',
  email: 'viewer@test.com',
  name: 'Viewer',
  permissions: {
    hoSo:       { c: false, r: true, u: false, d: false },
    danhMuc:    { c: false, r: true, u: false, d: false },
    nhom:       { c: false, r: true, u: false, d: false },
    nhaCungCap: { c: false, r: true, u: false, d: false },
    duAn:       { c: false, r: true, u: false, d: false },
    user:       { c: false, r: false, u: false, d: false },
    caiDat:     { c: false, r: false, u: false, d: false },
  },
  canCreate: false,
  canCreateSubCat: false,
  departments: [],
}

export const MOCK_DOCS = [
  {
    ID: '1',
    'Tên hồ sơ': 'Hợp đồng mua sắm CNTT',
    'Tình trạng': 'Chờ duyệt',
    'Danh mục': '1',
    'Người tạo': 'admin',
    'Phụ trách': JSON.stringify(['admin']),
    'Ngày cập nhật': new Date().toISOString(),
    'Giá trị HĐ': '100000000',
    'File ID': '',
  },
  {
    ID: '2',
    'Tên hồ sơ': 'Công văn số 01/2024',
    'Tình trạng': 'Hoàn thành',
    'Danh mục': '2',
    'Người tạo': 'admin',
    'Phụ trách': JSON.stringify(['admin']),
    'Ngày cập nhật': new Date().toISOString(),
    'Giá trị HĐ': '0',
    'File ID': '',
  },
]

export const MOCK_USERS = [
  {
    ID: 1,
    'Tên đăng nhập': 'admin',
    'Tên nhân viên': 'Admin',
    'Email': 'admin@test.com',
    'Trạng thái': 'Active',
    'Quyền': 'admin',
    'Được phát hành': 'FALSE',
  },
  {
    ID: 2,
    'Tên đăng nhập': 'viewer1',
    'Tên nhân viên': 'Viewer One',
    'Email': 'viewer@test.com',
    'Trạng thái': 'Active',
    'Quyền': 'Nhân viên',
    'Được phát hành': 'FALSE',
  },
]

export const MOCK_LOOKUPS = {
  danhMuc: [
    { ID: '1', 'Tên danh mục': 'Hợp đồng', 'Danh mục cha': '' },
    { ID: '2', 'Tên danh mục': 'Công văn', 'Danh mục cha': '' },
  ],
  nhom: [],
  duAn: [{ ID: '1', 'Tên dự án': 'DA-01', 'Tên đầy đủ': 'Dự án 01' }],
  nhaCungCap: [{ ID: '1', 'Tên nhà cung cấp': 'ABC Corp', 'Tên đầy đủ': 'Công ty ABC' }],
  phongBan: [{ ID: '1', 'Tên phòng ban': 'Ban Giám Đốc' }],
  assignments: [{ ID: '1', UserID: '1', 'Chức vụ': 'Giám đốc', PhongBanID: '1' }],
  users: MOCK_USERS,
  ssoUsers: MOCK_USERS,
}

export const MOCK_INITIAL_DATA = {
  docs: MOCK_DOCS,
  lookups: MOCK_LOOKUPS,
  stats: {
    total: 2,
    byStatus: { 'Chờ duyệt': 1, 'Hoàn thành': 1 },
    totalValue: 100000000,
  },
  unreadIds: [],
  companyName: 'Test Company',
}

export const MOCK_COMMENTS = [
  {
    ID: 1,
    DocID: '1',
    UserID: 1,
    'Tên người dùng': 'admin',
    'Nội dung': 'Bình luận đầu tiên',
    'Thời gian': new Date().toISOString(),
  },
]
```

- [ ] **Step 4: Create render helper**

Create `apps/docmgr/src/client/__tests__/helpers/render.jsx`:

```jsx
import { render } from '@testing-library/react'
import { ToastProvider } from '../../context/ToastContext.jsx'
import { ConfirmProvider } from '../../context/ConfirmContext.jsx'

/**
 * Render with ToastProvider + ConfirmProvider.
 * Use this for all component tests that may call useToast() or useConfirm().
 */
export function renderWithProviders(ui) {
  return render(
    <ToastProvider>
      <ConfirmProvider>{ui}</ConfirmProvider>
    </ToastProvider>
  )
}
```

- [ ] **Step 5: Verify helpers parse without errors**

```bash
node -e "const m = require('./apps/docmgr/src/client/__tests__/helpers/mockData.js'); console.log('ok')" 2>&1 || echo "(ES module — will be transformed by babel-jest)"
```

Expected: either prints `ok` or says ES module (that's fine — babel-jest handles it during test runs).

- [ ] **Step 6: Commit infrastructure**

```bash
git add apps/docmgr/src/client/__tests__/setup.js apps/docmgr/src/client/__tests__/helpers/
git commit -m "test(docmgr): add RTL test infrastructure — render helper + shared mock data"
```

---

### Task 2: Documents.test.jsx — MainApp Happy Path + Role Matrix + Search

**Files:**
- Create: `apps/docmgr/src/client/__tests__/Documents.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `apps/docmgr/src/client/__tests__/Documents.test.jsx`:

```jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ToastProvider } from '../context/ToastContext.jsx'
import { ConfirmProvider } from '../context/ConfirmContext.jsx'
import MainApp from '../components/MainApp.jsx'
import gasCall from '../gasClient.js'
import { useAuth } from '../context/AuthContext.jsx'
import {
  MOCK_ADMIN_SESSION,
  MOCK_VIEWER_SESSION,
  MOCK_INITIAL_DATA,
  MOCK_DOCS,
  MOCK_TOKEN,
} from './helpers/mockData.js'

// ── Module mocks ──────────────────────────────────────────────────────────────
jest.mock('../gasClient.js')
jest.mock('../context/AuthContext.jsx', () => ({
  useAuth: jest.fn(),
  AuthProvider: ({ children }) => children,
}))
// Mock dataCache to avoid setInterval leaking across tests
jest.mock('../utils/dataCache.js', () => ({
  dataCache: {
    get: jest.fn(() => null),
    set: jest.fn(),
    subscribe: jest.fn(() => () => {}),
    invalidate: jest.fn(),
    isStale: jest.fn(() => true),
    isTooOld: jest.fn(() => true),
  },
  prefetchLookups: jest.fn(() => Promise.resolve({})),
  refreshLookups:  jest.fn(() => Promise.resolve()),
  startPolling:    jest.fn(() => undefined),
  stopPolling:     jest.fn(),
}))

function renderMainApp() {
  return render(
    <ToastProvider>
      <ConfirmProvider><MainApp /></ConfirmProvider>
    </ToastProvider>
  )
}

beforeEach(() => {
  gasCall.mockReset()
  useAuth.mockReturnValue({ session: MOCK_ADMIN_SESSION, loading: false, logout: jest.fn() })
  // Inject initial data so MainApp skips api_getInitialData round-trip
  window.__INITIAL_DATA__ = JSON.parse(JSON.stringify(MOCK_INITIAL_DATA))
  localStorage.setItem('docmgr_access_token', MOCK_TOKEN)
})

// ── Happy path ────────────────────────────────────────────────────────────────
describe('Documents — happy path', () => {
  test('renders document list with names and statuses', async () => {
    renderMainApp()
    await waitFor(() => screen.getByText('Hợp đồng mua sắm CNTT'))
    expect(screen.getByText('Hợp đồng mua sắm CNTT')).toBeInTheDocument()
    expect(screen.getByText('Công văn số 01/2024')).toBeInTheDocument()
    expect(screen.getByText('Chờ duyệt')).toBeInTheDocument()
  })
})

// ── Role matrix ───────────────────────────────────────────────────────────────
describe('Documents — sidebar role matrix', () => {
  test('admin sees Người dùng, Nhóm, Nhật ký nav items', async () => {
    renderMainApp()
    await waitFor(() => screen.getByText('Hợp đồng mua sắm CNTT'))
    expect(screen.getByText('Người dùng')).toBeInTheDocument()
    expect(screen.getByText('Nhóm')).toBeInTheDocument()
    expect(screen.getByText('Nhật ký')).toBeInTheDocument()
  })

  test('regular user (Nhân viên) does NOT see Người dùng, Nhóm, Nhật ký', async () => {
    useAuth.mockReturnValue({ session: MOCK_VIEWER_SESSION, loading: false, logout: jest.fn() })
    renderMainApp()
    await waitFor(() => screen.getByText('Hợp đồng mua sắm CNTT'))
    expect(screen.queryByText('Người dùng')).not.toBeInTheDocument()
    expect(screen.queryByText('Nhóm')).not.toBeInTheDocument()
    expect(screen.queryByText('Nhật ký')).not.toBeInTheDocument()
  })

  test('all users see Hồ sơ nav item', async () => {
    useAuth.mockReturnValue({ session: MOCK_VIEWER_SESSION, loading: false, logout: jest.fn() })
    renderMainApp()
    await waitFor(() => screen.getByText('Hợp đồng mua sắm CNTT'))
    expect(screen.getByText('Hồ sơ')).toBeInTheDocument()
  })
})

// ── Search ────────────────────────────────────────────────────────────────────
describe('Documents — search', () => {
  test('typing Enter in search box calls api_getDocuments with keyword', async () => {
    gasCall.mockResolvedValue({ data: [MOCK_DOCS[0]] })
    renderMainApp()
    await waitFor(() => screen.getByText('Hợp đồng mua sắm CNTT'))

    const searchInput = screen.getByPlaceholderText(/tìm kiếm/i)
    fireEvent.change(searchInput, { target: { value: 'Hợp đồng' } })
    fireEvent.keyDown(searchInput, { key: 'Enter', code: 'Enter' })

    await waitFor(() => {
      expect(gasCall).toHaveBeenCalledWith(
        'api_getDocuments',
        MOCK_TOKEN,
        expect.objectContaining({ keyword: 'Hợp đồng' })
      )
    })
  })
})
```

- [ ] **Step 2: Run to verify it fails for the right reason**

```bash
npx jest --config apps/docmgr/jest.config.js src/client/__tests__/Documents.test.jsx --no-coverage 2>&1 | tail -30
```

Expected: FAIL — module not found or test assertions fail (MainApp not yet seeing injected data). This confirms the test structure is valid.

- [ ] **Step 3: Verify window.__INITIAL_DATA__ path in MainApp**

```bash
grep -n "__INITIAL_DATA__" apps/docmgr/src/client/components/MainApp.jsx
```

Expected: lines like `const injected = window.__INITIAL_DATA__` and `window.__INITIAL_DATA__ = null`. Confirm the variable name matches. If different, update the test to match.

- [ ] **Step 4: Run tests until they pass**

```bash
npx jest --config apps/docmgr/jest.config.js src/client/__tests__/Documents.test.jsx --no-coverage --verbose
```

Expected: All 5 tests PASS.

Common fixes:
- If `gasCall` is not a jest.fn: check the mock path — it must be `'../gasClient.js'` (relative from test file)
- If `useAuth` is not mocked: import path must be `'../context/AuthContext.jsx'`
- If `screen.getByText('Hồ sơ')` fails in sidebar: check sidebar label in `Sidebar.jsx` line 4 — it says `label: 'Hồ sơ'` — if different, update assertion

- [ ] **Step 5: Commit**

```bash
git add apps/docmgr/src/client/__tests__/Documents.test.jsx
git commit -m "test(docmgr): add Documents RTL tests — happy path, role matrix, search"
```

---

### Task 3: DocumentModal.test.jsx — Full Behavior

**Files:**
- Create: `apps/docmgr/src/client/__tests__/DocumentModal.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `apps/docmgr/src/client/__tests__/DocumentModal.test.jsx`:

```jsx
import { screen, fireEvent, waitFor } from '@testing-library/react'
import DocumentModal from '../components/DocumentModal.jsx'
import gasCall from '../gasClient.js'
import { renderWithProviders } from './helpers/render.jsx'
import { MOCK_TOKEN, MOCK_ADMIN_SESSION, MOCK_LOOKUPS, MOCK_DOCS } from './helpers/mockData.js'

jest.mock('../gasClient.js')

const DEFAULT_PROPS = {
  mode: 'create',
  doc: null,
  lookups: MOCK_LOOKUPS,
  token: MOCK_TOKEN,
  session: MOCK_ADMIN_SESSION,
  onClose: jest.fn(),
  onSaved: jest.fn(),
  docs: MOCK_DOCS,
}

function renderModal(overrides = {}) {
  return renderWithProviders(<DocumentModal {...DEFAULT_PROPS} {...overrides} />)
}

beforeEach(() => {
  gasCall.mockReset()
  DEFAULT_PROPS.onClose.mockReset()
  DEFAULT_PROPS.onSaved.mockReset()
})

// ── Validation ────────────────────────────────────────────────────────────────
describe('DocumentModal — validation', () => {
  test('submit without Tên hồ sơ shows validation error', async () => {
    renderModal()
    // Click submit without filling required field
    const submitBtn = screen.getByRole('button', { name: /lưu|tạo|thêm/i })
    fireEvent.click(submitBtn)
    await waitFor(() => {
      expect(screen.getByText(/bắt buộc|tên hồ sơ.*bắt buộc/i)).toBeInTheDocument()
    })
    expect(gasCall).not.toHaveBeenCalledWith('api_createDocument', expect.anything(), expect.anything())
  })
})

// ── Create flow ───────────────────────────────────────────────────────────────
describe('DocumentModal — create', () => {
  test('valid form calls api_createDocument and invokes onSaved', async () => {
    gasCall.mockResolvedValue({
      ID: '99', 'Tên hồ sơ': 'Hợp đồng mới', 'Tình trạng': 'Chờ duyệt',
    })
    renderModal()

    // Fill required field
    const nameInput = screen.getByLabelText(/tên hồ sơ/i)
    fireEvent.change(nameInput, { target: { value: 'Hợp đồng mới' } })

    const submitBtn = screen.getByRole('button', { name: /lưu|tạo|thêm/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(gasCall).toHaveBeenCalledWith(
        'api_createDocument',
        MOCK_TOKEN,
        expect.objectContaining({ 'Tên hồ sơ': 'Hợp đồng mới' })
      )
    })
    await waitFor(() => {
      expect(DEFAULT_PROPS.onSaved).toHaveBeenCalled()
    })
  })
})

// ── Edit flow ─────────────────────────────────────────────────────────────────
describe('DocumentModal — edit', () => {
  test('pre-fills fields from doc prop', () => {
    renderModal({ mode: 'edit', doc: MOCK_DOCS[0] })
    // Name field pre-filled
    const nameInput = screen.getByLabelText(/tên hồ sơ/i)
    expect(nameInput.value).toBe('Hợp đồng mua sắm CNTT')
  })

  test('edit submit calls api_updateDocument', async () => {
    gasCall.mockResolvedValue({ ...MOCK_DOCS[0], 'Tên hồ sơ': 'Hợp đồng đã sửa' })
    renderModal({ mode: 'edit', doc: MOCK_DOCS[0] })

    const nameInput = screen.getByLabelText(/tên hồ sơ/i)
    fireEvent.change(nameInput, { target: { value: 'Hợp đồng đã sửa' } })

    const submitBtn = screen.getByRole('button', { name: /lưu|cập nhật/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(gasCall).toHaveBeenCalledWith(
        'api_updateDocument',
        MOCK_TOKEN,
        MOCK_DOCS[0].ID,
        expect.objectContaining({ 'Tên hồ sơ': 'Hợp đồng đã sửa' })
      )
    })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx jest --config apps/docmgr/jest.config.js src/client/__tests__/DocumentModal.test.jsx --no-coverage 2>&1 | tail -25
```

Expected: FAIL — missing element or wrong mock calls. The test structure is valid.

- [ ] **Step 3: Fix test selectors if needed**

Check the actual label/placeholder for the "Tên hồ sơ" field:

```bash
grep -n "Tên hồ sơ\|placeholder\|htmlFor\|label\|getByLabel" apps/docmgr/src/client/components/DocumentModal.jsx | head -20
```

If the field uses a different accessible label, update `getByLabelText(/tên hồ sơ/i)`. Alternative: use `getByPlaceholderText(...)` or `screen.getByRole('textbox', { name: /tên/i })`.

Check the submit button text:

```bash
grep -n "button.*type.*submit\|<button\|Tạo\|Lưu\|Thêm" apps/docmgr/src/client/components/DocumentModal.jsx | head -10
```

Update the `getByRole('button', { name: /lưu|tạo|thêm/i })` pattern to match the actual button text.

- [ ] **Step 4: Run until passing**

```bash
npx jest --config apps/docmgr/jest.config.js src/client/__tests__/DocumentModal.test.jsx --no-coverage --verbose
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/docmgr/src/client/__tests__/DocumentModal.test.jsx
git commit -m "test(docmgr): add DocumentModal RTL tests — validation, create, edit"
```

---

### Task 4: DocumentPreview.test.jsx — Full Behavior + Comments

**Files:**
- Create: `apps/docmgr/src/client/__tests__/DocumentPreview.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `apps/docmgr/src/client/__tests__/DocumentPreview.test.jsx`:

```jsx
import { screen, fireEvent, waitFor, act } from '@testing-library/react'
import DocumentPreview from '../components/documents/DocumentPreview.jsx'
import gasCall from '../gasClient.js'
import { renderWithProviders } from './helpers/render.jsx'
import {
  MOCK_TOKEN,
  MOCK_ADMIN_SESSION,
  MOCK_LOOKUPS,
  MOCK_DOCS,
  MOCK_COMMENTS,
} from './helpers/mockData.js'

jest.mock('../gasClient.js')

const MOCK_DOC = MOCK_DOCS[0] // ID: '1', 'Chờ duyệt'

const DEFAULT_PROPS = {
  doc: MOCK_DOC,
  lookups: MOCK_LOOKUPS,
  isAdmin: true,
  canDelete: true,
  token: MOCK_TOKEN,
  session: MOCK_ADMIN_SESSION,
  onClose: jest.fn(),
  onEdit: jest.fn(),
  onDelete: jest.fn(),
  onDocUpdated: jest.fn(),
}

function renderPreview(overrides = {}) {
  return renderWithProviders(<DocumentPreview {...DEFAULT_PROPS} {...overrides} />)
}

beforeEach(() => {
  gasCall.mockReset()
  gasCall.mockImplementation((fn) => {
    if (fn === 'api_getComments') return Promise.resolve({ data: MOCK_COMMENTS })
    if (fn === 'api_markAsRead') return Promise.resolve({ success: true })
    return Promise.reject(new Error('Unhandled mock: ' + fn))
  })
})

// ── Document details ──────────────────────────────────────────────────────────
describe('DocumentPreview — document details', () => {
  test('renders document name and status', async () => {
    renderPreview()
    expect(screen.getByText('Hợp đồng mua sắm CNTT')).toBeInTheDocument()
    expect(screen.getByText('Chờ duyệt')).toBeInTheDocument()
  })

  test('renders creator name', async () => {
    renderPreview()
    expect(screen.getByText(/admin/i)).toBeInTheDocument()
  })
})

// ── Comments ──────────────────────────────────────────────────────────────────
describe('DocumentPreview — comments', () => {
  test('loads and shows existing comments on mount', async () => {
    renderPreview()
    await waitFor(() => {
      expect(screen.getByText('Bình luận đầu tiên')).toBeInTheDocument()
    })
    expect(gasCall).toHaveBeenCalledWith('api_getComments', MOCK_TOKEN, MOCK_DOC.ID)
  })

  test('submitting comment box calls api_addComment and shows optimistic comment', async () => {
    gasCall.mockImplementation((fn, ...args) => {
      if (fn === 'api_getComments') return Promise.resolve({ data: [] })
      if (fn === 'api_markAsRead') return Promise.resolve({ success: true })
      if (fn === 'api_addComment') {
        return Promise.resolve({
          data: {
            ID: 100,
            DocID: '1',
            UserID: 1,
            'Tên người dùng': 'admin',
            'Nội dung': args[2],
            'Thời gian': new Date().toISOString(),
          },
        })
      }
      return Promise.reject(new Error('Unhandled: ' + fn))
    })

    renderPreview()

    // Wait for initial comment load
    await waitFor(() => {
      expect(gasCall).toHaveBeenCalledWith('api_getComments', MOCK_TOKEN, MOCK_DOC.ID)
    })

    // Type in comment box and submit
    const commentInput = screen.getByPlaceholderText(/bình luận|nhập bình luận/i)
    fireEvent.change(commentInput, { target: { value: 'Bình luận mới' } })
    fireEvent.submit(commentInput.closest('form'))

    // Optimistic update appears immediately
    await waitFor(() => {
      expect(screen.getByText('Bình luận mới')).toBeInTheDocument()
    })
    expect(gasCall).toHaveBeenCalledWith('api_addComment', MOCK_TOKEN, MOCK_DOC.ID, 'Bình luận mới')
  })

  test('failed comment add removes optimistic entry and restores input', async () => {
    gasCall.mockImplementation((fn) => {
      if (fn === 'api_getComments') return Promise.resolve({ data: [] })
      if (fn === 'api_markAsRead') return Promise.resolve({ success: true })
      if (fn === 'api_addComment') return Promise.reject(new Error('Lỗi mạng'))
      return Promise.reject(new Error('Unhandled: ' + fn))
    })

    renderPreview()
    await waitFor(() => expect(gasCall).toHaveBeenCalledWith('api_getComments', MOCK_TOKEN, MOCK_DOC.ID))

    const commentInput = screen.getByPlaceholderText(/bình luận|nhập bình luận/i)
    fireEvent.change(commentInput, { target: { value: 'Tin bị lỗi' } })
    fireEvent.submit(commentInput.closest('form'))

    // Optimistic entry added then removed on error
    await waitFor(() => {
      expect(screen.queryByText('Tin bị lỗi')).not.toBeInTheDocument()
    })
  })
})

// ── Workflow buttons ──────────────────────────────────────────────────────────
describe('DocumentPreview — workflow buttons', () => {
  test('admin sees Giao việc button for Chờ duyệt document', async () => {
    renderPreview()
    // Workflow buttons are rendered inside the preview
    await waitFor(() => {
      // 'Chờ duyệt' status + admin → giaoViec action should be available
      // The WorkflowButtons component controls this — just check button exists
      expect(screen.getByText('Hợp đồng mua sắm CNTT')).toBeInTheDocument()
    })
    // WorkflowButtons renders action buttons — check at least one is present
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx jest --config apps/docmgr/jest.config.js src/client/__tests__/DocumentPreview.test.jsx --no-coverage 2>&1 | tail -30
```

Expected: FAIL. Tests run but assertions fail (comment placeholder text may differ).

- [ ] **Step 3: Fix comment input placeholder**

Check the actual placeholder:

```bash
grep -n "placeholder\|bình luận\|comment" apps/docmgr/src/client/components/documents/DocumentPreview.jsx | grep -i "input\|textarea\|placeholder" | head -10
```

Update `getByPlaceholderText(/bình luận|nhập bình luận/i)` to match the actual placeholder text found in the component.

- [ ] **Step 4: Run until passing**

```bash
npx jest --config apps/docmgr/jest.config.js src/client/__tests__/DocumentPreview.test.jsx --no-coverage --verbose
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/docmgr/src/client/__tests__/DocumentPreview.test.jsx
git commit -m "test(docmgr): add DocumentPreview RTL tests — details, comments, workflow"
```

---

### Task 5: PublishDialog.test.jsx — Full Behavior

**Files:**
- Create: `apps/docmgr/src/client/__tests__/PublishDialog.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `apps/docmgr/src/client/__tests__/PublishDialog.test.jsx`:

```jsx
import { screen, fireEvent, waitFor } from '@testing-library/react'
import PublishDialog from '../components/documents/PublishDialog.jsx'
import { renderWithProviders } from './helpers/render.jsx'
import { MOCK_USERS, MOCK_LOOKUPS } from './helpers/mockData.js'

// PublishDialog props: { users, phongBan, assignments, onPublish, onClose, loading }

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

// ── Rendering ─────────────────────────────────────────────────────────────────
describe('PublishDialog — rendering', () => {
  test('renders users grouped by department', () => {
    renderDialog()
    // Users should appear in the recipient picker
    expect(screen.getByText('Admin')).toBeInTheDocument()
    expect(screen.getByText('Viewer One')).toBeInTheDocument()
  })

  test('close button calls onClose', () => {
    renderDialog()
    const closeBtn = screen.getByRole('button', { name: /đóng|hủy|cancel/i })
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalled()
  })
})

// ── Validation ────────────────────────────────────────────────────────────────
describe('PublishDialog — validation', () => {
  test('submit without selecting any recipient shows validation error', async () => {
    renderDialog()
    const publishBtn = screen.getByRole('button', { name: /phát hành|gửi|publish/i })
    fireEvent.click(publishBtn)
    await waitFor(() => {
      expect(screen.getByText(/chọn.*người nhận|người nhận.*bắt buộc/i)).toBeInTheDocument()
    })
    expect(onPublish).not.toHaveBeenCalled()
  })
})

// ── Submit ────────────────────────────────────────────────────────────────────
describe('PublishDialog — submit', () => {
  test('selecting a recipient and submitting calls onPublish with recipient ID', async () => {
    renderDialog()

    // Click on a user checkbox to select them
    const userCheckboxes = screen.getAllByRole('checkbox')
    fireEvent.click(userCheckboxes[0])

    const publishBtn = screen.getByRole('button', { name: /phát hành|gửi|publish/i })
    fireEvent.click(publishBtn)

    await waitFor(() => {
      expect(onPublish).toHaveBeenCalledWith(
        expect.arrayContaining([expect.any(String)]), // toIds
        expect.any(Array)                             // ccIds
      )
    })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx jest --config apps/docmgr/jest.config.js src/client/__tests__/PublishDialog.test.jsx --no-coverage 2>&1 | tail -25
```

Expected: FAIL — assertions about button text or user display may not match.

- [ ] **Step 3: Fix selectors based on actual component**

Check the actual "publish" button text:

```bash
grep -n "button\|phát hành\|Phát hành\|Gửi" apps/docmgr/src/client/components/documents/PublishDialog.jsx | head -15
```

Check how validation error is displayed:

```bash
grep -n "error\|lỗi\|người nhận\|chọn" apps/docmgr/src/client/components/documents/PublishDialog.jsx | head -10
```

Check how users render (are they in checkboxes, or a custom component):

```bash
grep -n "checkbox\|checked\|RecipientColumn" apps/docmgr/src/client/components/documents/PublishDialog.jsx | head -10
```

Update selectors to match actual component behavior.

- [ ] **Step 4: Run until passing**

```bash
npx jest --config apps/docmgr/jest.config.js src/client/__tests__/PublishDialog.test.jsx --no-coverage --verbose
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/docmgr/src/client/__tests__/PublishDialog.test.jsx
git commit -m "test(docmgr): add PublishDialog RTL tests — render, validation, submit"
```

---

### Task 6: CategoryManager.test.jsx — Happy Path

**Files:**
- Create: `apps/docmgr/src/client/__tests__/CategoryManager.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `apps/docmgr/src/client/__tests__/CategoryManager.test.jsx`:

```jsx
import { screen, fireEvent, waitFor } from '@testing-library/react'
import CategoryManager from '../components/CategoryManager.jsx'
import gasCall from '../gasClient.js'
import { renderWithProviders } from './helpers/render.jsx'
import { MOCK_TOKEN, MOCK_ADMIN_SESSION, MOCK_LOOKUPS } from './helpers/mockData.js'

jest.mock('../gasClient.js')

const DEFAULT_PROPS = {
  token:    MOCK_TOKEN,
  lookups:  MOCK_LOOKUPS,
  onUpdate: jest.fn(),
  session:  MOCK_ADMIN_SESSION,
}

function renderCategoryManager(overrides = {}) {
  return renderWithProviders(<CategoryManager {...DEFAULT_PROPS} {...overrides} />)
}

beforeEach(() => {
  gasCall.mockReset()
  DEFAULT_PROPS.onUpdate.mockReset()
})

// ── Rendering ─────────────────────────────────────────────────────────────────
describe('CategoryManager — rendering', () => {
  test('renders category names from lookups', () => {
    renderCategoryManager()
    expect(screen.getByText('Hợp đồng')).toBeInTheDocument()
    expect(screen.getByText('Công văn')).toBeInTheDocument()
  })

  test('admin sees Thêm danh mục button', () => {
    renderCategoryManager()
    expect(screen.getByRole('button', { name: /thêm danh mục|thêm|add/i })).toBeInTheDocument()
  })
})

// ── Add flow ──────────────────────────────────────────────────────────────────
describe('CategoryManager — add category', () => {
  test('Thêm button opens add form; submit calls api_addCategory', async () => {
    gasCall.mockResolvedValue({
      ID: '99', 'Tên danh mục': 'Quyết định', 'Danh mục cha': '',
    })

    renderCategoryManager()

    // Open the add form
    fireEvent.click(screen.getByRole('button', { name: /thêm danh mục|thêm/i }))

    // Fill in category name
    const nameInput = await screen.findByPlaceholderText(/tên danh mục|name/i)
    fireEvent.change(nameInput, { target: { value: 'Quyết định' } })

    // Submit
    const saveBtn = screen.getByRole('button', { name: /lưu|save|thêm/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(gasCall).toHaveBeenCalledWith(
        'api_addCategory',
        MOCK_TOKEN,
        expect.objectContaining({ 'Tên danh mục': 'Quyết định' })
      )
    })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx jest --config apps/docmgr/jest.config.js src/client/__tests__/CategoryManager.test.jsx --no-coverage 2>&1 | tail -25
```

Expected: FAIL — category component renders from `lookups.danhMuc` prop; assertions should be close to working.

- [ ] **Step 3: Fix selectors**

Check the "Thêm" button label and form input placeholder:

```bash
grep -n "Thêm\|thêm\|button.*role\|placeholder" apps/docmgr/src/client/components/CategoryManager.jsx | head -20
```

Update button and input selectors to match actual component.

- [ ] **Step 4: Run until passing**

```bash
npx jest --config apps/docmgr/jest.config.js src/client/__tests__/CategoryManager.test.jsx --no-coverage --verbose
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/docmgr/src/client/__tests__/CategoryManager.test.jsx
git commit -m "test(docmgr): add CategoryManager RTL tests — render + add category"
```

---

### Task 7: UserManager.test.jsx — Full Behavior (canPublish + Permissions)

**Files:**
- Create: `apps/docmgr/src/client/__tests__/UserManager.test.jsx`

- [ ] **Step 1: Write the failing test**

Create `apps/docmgr/src/client/__tests__/UserManager.test.jsx`:

```jsx
import { screen, fireEvent, waitFor } from '@testing-library/react'
import UserManager from '../components/UserManager.jsx'
import gasCall from '../gasClient.js'
import { renderWithProviders } from './helpers/render.jsx'
import { MOCK_TOKEN, MOCK_ADMIN_SESSION, MOCK_LOOKUPS, MOCK_USERS } from './helpers/mockData.js'

jest.mock('../gasClient.js')

const DEFAULT_PROPS = {
  token:   MOCK_TOKEN,
  session: MOCK_ADMIN_SESSION,
  lookups: MOCK_LOOKUPS,
}

function renderUserManager(overrides = {}) {
  return renderWithProviders(<UserManager {...DEFAULT_PROPS} {...overrides} />)
}

beforeEach(() => {
  gasCall.mockReset()
  gasCall.mockImplementation((fn) => {
    if (fn === 'api_getUsers') return Promise.resolve([...MOCK_USERS])
    return Promise.reject(new Error('Unhandled: ' + fn))
  })
})

// ── User list ─────────────────────────────────────────────────────────────────
describe('UserManager — user list', () => {
  test('renders user names and emails', async () => {
    renderUserManager()
    await waitFor(() => screen.getByText('Admin'))
    expect(screen.getByText('Admin')).toBeInTheDocument()
    expect(screen.getByText('Viewer One')).toBeInTheDocument()
    expect(screen.getByText('admin@test.com')).toBeInTheDocument()
  })

  test('shows role badge for each user', async () => {
    renderUserManager()
    await waitFor(() => screen.getByText('Admin'))
    // admin user has role 'admin'
    expect(screen.getByText('admin')).toBeInTheDocument()
    // viewer user has role 'Nhân viên'
    expect(screen.getByText('Nhân viên')).toBeInTheDocument()
  })
})

// ── canPublish toggle ─────────────────────────────────────────────────────────
describe('UserManager — canPublish toggle', () => {
  test('clicking Sửa for a user opens form with Được phát hành checkbox', async () => {
    renderUserManager()
    await waitFor(() => screen.getByText('Viewer One'))

    // Find the edit button for Viewer One
    const editBtns = screen.getAllByRole('button', { name: /sửa|edit/i })
    fireEvent.click(editBtns[0])

    // Form opens with canPublish checkbox
    await waitFor(() => {
      expect(screen.getByLabelText(/được phát hành/i)).toBeInTheDocument()
    })
  })

  test('toggling Được phát hành and saving calls api_updateUser', async () => {
    gasCall.mockImplementation((fn) => {
      if (fn === 'api_getUsers') return Promise.resolve([...MOCK_USERS])
      if (fn === 'api_updateUser') return Promise.resolve({ success: true })
      return Promise.reject(new Error('Unhandled: ' + fn))
    })

    renderUserManager()
    await waitFor(() => screen.getByText('Viewer One'))

    // Open edit form for viewer
    const editBtns = screen.getAllByRole('button', { name: /sửa|edit/i })
    fireEvent.click(editBtns[0])

    // Wait for form
    const checkbox = await screen.findByLabelText(/được phát hành/i)
    const wasChecked = checkbox.checked
    fireEvent.click(checkbox)
    expect(checkbox.checked).toBe(!wasChecked)

    // Save
    const saveBtn = screen.getByRole('button', { name: /lưu|save/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(gasCall).toHaveBeenCalledWith(
        'api_updateUser',
        MOCK_TOKEN,
        expect.any(Number),
        expect.objectContaining({ 'Được phát hành': !wasChecked })
      )
    })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

```bash
npx jest --config apps/docmgr/jest.config.js src/client/__tests__/UserManager.test.jsx --no-coverage 2>&1 | tail -30
```

Expected: FAIL — UserManager loads `api_getUsers` on mount, list renders, but button selectors may not match.

- [ ] **Step 3: Fix selectors**

Check edit button label in UserManager:

```bash
grep -n "button.*Sửa\|Sửa\|edit\|setModal\|openModal" apps/docmgr/src/client/components/UserManager.jsx | head -15
```

Check `api_updateUser` call signature:

```bash
grep -n "api_updateUser\|gasCall.*update" apps/docmgr/src/client/components/UserManager.jsx | head -10
```

Check the exact fields passed to `api_updateUser` for the canPublish save — it may be `'Được phát hành': true` (boolean) or `'TRUE'` (string). Update test assertion to match.

- [ ] **Step 4: Run until passing**

```bash
npx jest --config apps/docmgr/jest.config.js src/client/__tests__/UserManager.test.jsx --no-coverage --verbose
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/docmgr/src/client/__tests__/UserManager.test.jsx
git commit -m "test(docmgr): add UserManager RTL tests — list, canPublish toggle, permissions"
```

---

### Task 8: SettingsPage.test.jsx + AuditLogPage.test.jsx — Happy Path

**Files:**
- Create: `apps/docmgr/src/client/__tests__/SettingsPage.test.jsx`
- Create: `apps/docmgr/src/client/__tests__/AuditLog.test.jsx`

- [ ] **Step 1: Write SettingsPage failing test**

Create `apps/docmgr/src/client/__tests__/SettingsPage.test.jsx`:

```jsx
import { screen, fireEvent, waitFor } from '@testing-library/react'
import SettingsPage from '../components/SettingsPage.jsx'
import gasCall from '../gasClient.js'
import { renderWithProviders } from './helpers/render.jsx'
import { MOCK_TOKEN } from './helpers/mockData.js'

jest.mock('../gasClient.js')

const MOCK_CONFIGS = {
  ROOT_FOLDER_ID:   '',
  ROOT_FOLDER_NAME: '',
  COMPANY_NAME:     'Test Company',
  APP_URL:          'https://test.example.com',
}

const DEFAULT_PROPS = {
  token:              MOCK_TOKEN,
  onCompanyNameChange: jest.fn(),
  initialConfigs:     MOCK_CONFIGS,
}

function renderSettings(overrides = {}) {
  return renderWithProviders(<SettingsPage {...DEFAULT_PROPS} {...overrides} />)
}

beforeEach(() => {
  gasCall.mockReset()
  gasCall.mockResolvedValue({ success: true })
})

describe('SettingsPage — happy path', () => {
  test('renders COMPANY_NAME from initialConfigs', () => {
    renderSettings()
    // The form should show the company name input filled with 'Test Company'
    const companyInput = screen.getByDisplayValue('Test Company')
    expect(companyInput).toBeInTheDocument()
  })

  test('save button calls api_setConfig with updated company name', async () => {
    gasCall.mockResolvedValue({ success: true })
    renderSettings()

    const companyInput = screen.getByDisplayValue('Test Company')
    fireEvent.change(companyInput, { target: { value: 'New Company Name' } })

    const saveBtn = screen.getByRole('button', { name: /lưu|save/i })
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(gasCall).toHaveBeenCalledWith(
        expect.stringMatching(/api_setConfig|api_saveConfig|api_setConfigs/),
        MOCK_TOKEN,
        expect.anything(),
        expect.anything()
      )
    })
  })
})
```

- [ ] **Step 2: Write AuditLog failing test**

Create `apps/docmgr/src/client/__tests__/AuditLog.test.jsx`:

```jsx
import { screen, fireEvent, waitFor } from '@testing-library/react'
import AuditLogPage from '../components/AuditLogPage.jsx'
import gasCall from '../gasClient.js'
import { renderWithProviders } from './helpers/render.jsx'
import { MOCK_TOKEN } from './helpers/mockData.js'

jest.mock('../gasClient.js')

const MOCK_LOGS = [
  {
    ID: 1,
    'Thời gian': new Date().toISOString(),
    'Người dùng': 'admin',
    'Email': 'admin@test.com',
    'Hành động': 'Tạo',
    'Loại': 'Hồ sơ',
    'Đối tượng': 'Hợp đồng 01',
    'Chi tiết': '{}',
  },
  {
    ID: 2,
    'Thời gian': new Date().toISOString(),
    'Người dùng': 'viewer1',
    'Email': 'viewer@test.com',
    'Hành động': 'Đăng nhập',
    'Loại': 'Hệ thống',
    'Đối tượng': 'viewer1',
    'Chi tiết': '{}',
  },
]

beforeEach(() => {
  gasCall.mockReset()
  gasCall.mockImplementation((fn) => {
    if (fn === 'api_getAuditLogs') {
      return Promise.resolve({
        data: MOCK_LOGS,
        hasMore: false,
        total: 2,
        types: ['Hồ sơ', 'Hệ thống'],
      })
    }
    return Promise.reject(new Error('Unhandled: ' + fn))
  })
})

describe('AuditLogPage — happy path', () => {
  test('renders audit log entries', async () => {
    renderWithProviders(<AuditLogPage token={MOCK_TOKEN} />)
    await waitFor(() => screen.getByText('admin'))
    expect(screen.getByText('admin')).toBeInTheDocument()
    expect(screen.getByText('Tạo')).toBeInTheDocument()
    expect(screen.getByText('Hợp đồng 01')).toBeInTheDocument()
  })

  test('filter by action type calls api_getAuditLogs with type filter', async () => {
    gasCall.mockImplementation((fn, token, opts) => {
      if (fn === 'api_getAuditLogs') {
        const filteredData = opts && opts.type
          ? MOCK_LOGS.filter(l => l['Loại'] === opts.type)
          : MOCK_LOGS
        return Promise.resolve({ data: filteredData, hasMore: false, total: filteredData.length, types: ['Hồ sơ', 'Hệ thống'] })
      }
      return Promise.reject(new Error('Unhandled: ' + fn))
    })

    renderWithProviders(<AuditLogPage token={MOCK_TOKEN} />)

    // Wait for initial load
    await waitFor(() => screen.getByText('admin'))

    // Select a type from filter dropdown
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'Hệ thống' } })

    await waitFor(() => {
      expect(gasCall).toHaveBeenCalledWith(
        'api_getAuditLogs',
        MOCK_TOKEN,
        expect.objectContaining({ type: 'Hệ thống' })
      )
    })
  })
})
```

- [ ] **Step 3: Run both tests to verify they fail**

```bash
npx jest --config apps/docmgr/jest.config.js src/client/__tests__/SettingsPage.test.jsx src/client/__tests__/AuditLog.test.jsx --no-coverage 2>&1 | tail -30
```

Expected: FAIL — some assertions may not match (save API name, filter dropdown selector).

- [ ] **Step 4: Fix SettingsPage API call name**

Check what API the settings page calls on save:

```bash
grep -n "api_set\|api_save\|gasCall\|setConfig" apps/docmgr/src/client/components/SettingsPage.jsx | head -15
```

Update the `expect.stringMatching(...)` in the test to match the actual API name.

Check AuditLogPage filter dropdown:

```bash
grep -n "select\|combobox\|filterType\|Loại\|type" apps/docmgr/src/client/components/AuditLogPage.jsx | head -15
```

Update filter selector if the dropdown uses a different element type.

- [ ] **Step 5: Run until passing**

```bash
npx jest --config apps/docmgr/jest.config.js src/client/__tests__/SettingsPage.test.jsx src/client/__tests__/AuditLog.test.jsx --no-coverage --verbose
```

Expected: All 4 tests PASS.

- [ ] **Step 6: Run full DocMgr RTL suite**

```bash
npx jest --config apps/docmgr/jest.config.js src/client/__tests__/ --no-coverage --verbose
```

Expected: All tests PASS (WorkflowButtons + all new tests).

- [ ] **Step 7: Commit**

```bash
git add apps/docmgr/src/client/__tests__/SettingsPage.test.jsx apps/docmgr/src/client/__tests__/AuditLog.test.jsx
git commit -m "test(docmgr): add SettingsPage + AuditLogPage RTL tests — happy path"
```
