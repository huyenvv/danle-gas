# Permissions Reference

## Permission Object Shape

```js
{
  hoSo:       { c, r, u, d },   // Documents
  danhMuc:    { c, r, u, d },   // Categories
  nhom:       { c, r, u, d },   // Groups
  nhaCungCap: { c, r, u, d },   // Suppliers
  duAn:       { c, r, u, d },   // Projects
  user:       { c, r, u, d },   // Users
  caiDat:     { c, r, u, d },   // Settings
  allowedCategories: [],         // Empty = all categories
}
```

## Default Roles

| Role | Docs | Lookups | Users | Settings |
|---|---|---|---|---|
| admin / Quản trị viên / Giám đốc | Full CRUD | Full CRUD | Full CRUD | Full CRUD |
| Biên tập viên / Văn thư / Trưởng phòng | CRU (no delete) | R only | None | None |
| Nhân viên | R only | R only | None | None |
| Xem | R only | None | None | None |

Only Admin can delete documents.

## Role Source

DocMgr derives role from SSO Portal's `_Phân Bổ` assignments (highest wins).
Priority: Giám đốc(6) > Phó GĐ(5) > Văn thư(4) > admin(3) >
Trưởng phòng(2) > Phó phòng(1) > Nhân viên(0).

## Custom Permissions

JSON in `_Phân Quyền.Phân quyền chi tiết`. If present, overrides defaults.

## canCreate / canCreateSubCat / canPublish

| Column | Controls |
|---|---|
| `Được tạo hồ sơ` | Create new documents |
| `Được tạo danh mục con` | Create sub-categories |
| `Được phát hành` | Publish documents |

Full-access roles get all 3 flags by default (not editable in UI).
Server re-checks from sheet on every action (not cached).

## Document Visibility

- Admin / Giám đốc / Văn thư: see all documents
- Others: only docs where they are Phụ trách or Phối hợp
- Category visibility: `Người được xem` + `Nhóm được xem` (empty = all)

## Comment Permissions

| Role | View | Comment |
|---|---|---|
| Admin / Giám Đốc / Văn Thư | All docs | ✅ |
| Phụ trách / Phối hợp | Assigned docs | ✅ |
| Nhân viên / Trưởng phòng | Assigned folder docs | ❌ |
