# Permissions

## Permission Object

```js
{ hoSo:{c,r,u,d}, danhMuc:{c,r,u,d}, nhom:{c,r,u,d},
  nhaCungCap:{c,r,u,d}, duAn:{c,r,u,d}, user:{c,r,u,d},
  caiDat:{c,r,u,d}, allowedCategories:[] }
```

## Default Roles

| Role | Docs | Lookups | Users | Settings |
|---|---|---|---|---|
| admin/Quản trị viên/Giám đốc | CRUD | CRUD | CRUD | CRUD |
| Biên tập viên/Văn thư/Trưởng phòng | CRU | R | — | — |
| Nhân viên | R | R | — | — |
| Xem | R | — | — | — |

Only admin deletes docs. Custom perms: JSON in `_Phân Quyền.Phân quyền chi tiết` overrides defaults.

## Role Source

From SSO `_Phân Bổ` (highest wins): GĐ(6)>PGĐ(5)>VT(4)>admin(3)>TP(2)>PP(1)>NV(0).

## Flags (per user, server-checked)

| Column | Controls |
|---|---|
| Được tạo hồ sơ | Create docs |
| Được tạo danh mục con | Create sub-categories |
| Được phát hành | Publish docs |

Full-access roles get all 3 by default (not editable in UI).

## Visibility

- Admin/GĐ/VT: all docs. Others: only Phụ trách or Phối hợp docs.
- Category: `Người/Nhóm được xem` (empty=all).

## Comments

Admin/GĐ/VT/PT/PH: can comment. NV/TP: cannot.
