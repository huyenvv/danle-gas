/**
 * Verify-then-retry wrapper for gasCall mutations.
 *
 * When a gasCall fails with a GAS transport error ("Lỗi không xác định"),
 * the server may have actually succeeded. This utility:
 *   1. Verifies if the mutation already took effect
 *   2. If not, retries the call up to 3 times with escalating delays
 *   3. After each failed retry, verifies again
 *   4. Stops immediately on real server errors (permissions, validation)
 *
 * @param {Object} opts
 * @param {() => Promise<any>}  opts.fn       — the gasCall to retry
 * @param {() => Promise<any>}  opts.verify   — returns truthy (e.g. fresh doc) if mutation succeeded, falsy otherwise
 * @param {(attempt: number, total: number) => void} [opts.onRetry] — called before each retry wait
 * @returns {Promise<{ok: true, data: any} | {ok: false, error: string}>}
 */
// Retry đầu ngắn: thường server ĐÃ xong (response rớt) → gọi lại là phát hiện ngay qua xung đột-tại-đích
// (LockService nối tiếp nên an toàn). Lùi dần cho ca server thật sự còn chậm.
const DELAYS = [500, 1500, 3000]
const MAX_RETRIES = 3
const TRANSPORT_ERROR = 'Lỗi không xác định'

export async function retryWithVerify({ fn, verify, onRetry }) {
  const verified = await verify()
  if (verified) return { ok: true, data: verified }

  let lastErr = null
  for (let i = 0; i < MAX_RETRIES; i++) {
    if (onRetry) onRetry(i + 1, MAX_RETRIES)
    await new Promise(r => setTimeout(r, DELAYS[i]))
    try {
      const res = await fn()
      return { ok: true, data: res }
    } catch (e) {
      lastErr = e
      // LUÔN verify trước khi xử lý lỗi: lần gọi TRƯỚC có thể đã thành công (chậm) rồi lần này
      // xung đột trạng thái (vd "Hồ sơ đang ở trạng thái Từ chối, không thể tuChoi") — đó là lỗi
      // non-transport nhưng thực chất thao tác ĐÃ hiệu lực → phải coi là thành công.
      const retryVerified = await verify()
      if (retryVerified) return { ok: true, data: retryVerified }
      // State chưa đổi → lỗi thật: non-transport (quyền/validation) dừng ngay; transport thì thử tiếp.
      if (e.message && e.message !== TRANSPORT_ERROR) {
        return { ok: false, error: e.message }
      }
    }
  }
  return { ok: false, error: lastErr?.message || TRANSPORT_ERROR }
}
