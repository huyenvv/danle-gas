# Permissions

> Abbreviations: see constitution.md

## Object

`{hoSo,danhMuc,nhom,nhaCungCap,duAn,user,caiDat}` each `{c,r,u,d}` + `allowedCategories[]`

## Defaults

| Role | Docs | Lookups | Users | Settings |
|---|---|---|---|---|
| admin/GĐ | CRUD | CRUD | CRUD | CRUD |
| VT/TP/Biên tập viên | CRU | R | — | — |
| NV | R | R | — | — |
| Xem | R | — | — | — |

Only admin deletes docs. Custom: JSON in `_Phân Quyền.Phân quyền chi tiết` overrides.

## Role Source

From SSO `_Phân Bổ` highest: GĐ(6)>PGĐ(5)>VT(4)>admin(3)>TP(2)>PP(1)>NV(0).

## Flags

`Được tạo hồ sơ`(create docs), `Được tạo danh mục con`(sub-categories), `Được phát hành`(publish). Full-access roles get all 3 default, not editable. Server re-checks each action.

## Visibility

Admin/GĐ/VT: all docs. Others: only PT or PH docs. Category: `Người/Nhóm được xem` (empty=all).
Comment: Admin/GĐ/VT/PT/PH can. NV/TP cannot.
