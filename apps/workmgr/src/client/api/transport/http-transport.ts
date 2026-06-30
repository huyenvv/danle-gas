/// <reference types="vite/client" />
// Transport HTTP — POST /api {method,args} tới dev-server (server ngoài tương lai).
// DEV → dev-server cục bộ; BUILD → '/api' (tương đối). Nhánh localhost bị Vite
// tree-shake khỏi bản prod nhờ import.meta.env.DEV (=false lúc build) — không
// ship URL localhost. (Trên GAS, httpTransport không được chọn, nhưng vẫn giữ
// bundle sạch.)
const BASE = import.meta.env.DEV ? 'http://localhost:3100/api' : '/api'

export function httpTransport(method: string, args: unknown[]): Promise<unknown> {
  return fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, args }),
  })
    .then((r) => r.json())
    .then((res: { success: boolean; payload?: unknown; error?: string }) => {
      if (res && res.success) return res.payload
      throw new Error((res && res.error) || 'Lỗi không xác định')
    })
}
