# Quickstart: Bulk Import Data

## Prerequisites

- Node.js + npm installed
- `npm install` đã chạy ở root
- Có file Excel mẫu (.xlsx) với 18 cột theo format spec

## Dev Setup

```bash
# 1. Start dev server
npm run dev:docmgr    # port 5173

# 2. Run tests
npm run test:docmgr
```

## File Locations

| File | Purpose |
|------|---------|
| `apps/docmgr/src/server/import.js` | Server: parse uploaded file + validate + create docs |
| `apps/docmgr/src/client/components/ImportManager.jsx` | Client: upload, preview, results UI |
| `apps/docmgr/src/client/utils/importResolver.js` | Client: group rows + resolve lookups |
| `apps/docmgr/src/server/__tests__/import.test.js` | Server tests |

## Build & Deploy

```bash
npm run build:docmgr    # Build client + server bundle
npm run deploy:docmgr   # Deploy to GAS (never bare clasp push)
```

## Testing the Feature

1. Prepare Excel file với dữ liệu mẫu (3-4 documents, 8-10 files)
2. Login docmgr với role Văn thư hoặc Quản trị
3. Navigate đến menu "Nhập hồ sơ"
4. Upload file Excel → kiểm tra preview
5. Nhấn Import → kiểm tra kết quả
6. Verify documents xuất hiện trong danh sách Hồ sơ với đúng file đính kèm

## Key Constraints

- Server file dùng ES5 (`var`, `function`, no arrow functions)
- Client dùng React + Tailwind + MD3 tokens
- GAS 6-minute execution limit
- `google.script.run` payload ~50MB max
- Concat order: gas-core → config → sheets → auth → documents → **import** → main
- Không thêm npm dependency — Excel parsing hoàn toàn bằng native GAS APIs
