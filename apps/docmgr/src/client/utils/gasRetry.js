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
const DELAYS = [2000, 3000, 5000]
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
      if (e.message && e.message !== TRANSPORT_ERROR) {
        return { ok: false, error: e.message }
      }
      const retryVerified = await verify()
      if (retryVerified) return { ok: true, data: retryVerified }
    }
  }
  return { ok: false, error: lastErr?.message || TRANSPORT_ERROR }
}
