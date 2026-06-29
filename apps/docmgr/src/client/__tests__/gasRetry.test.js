import { retryWithVerify } from '../utils/gasRetry.js'

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

describe('retryWithVerify', () => {
  it('returns verified data immediately when verify passes', async () => {
    const fn = jest.fn()
    const verify = jest.fn().mockResolvedValue({ id: 1, saved: true })

    const r = await retryWithVerify({ fn, verify })

    expect(r).toEqual({ ok: true, data: { id: 1, saved: true } })
    expect(fn).not.toHaveBeenCalled()
    expect(verify).toHaveBeenCalledTimes(1)
  })

  it('retries and succeeds on first retry', async () => {
    const doc = { id: 1 }
    const verify = jest.fn().mockResolvedValue(null)
    const fn = jest.fn().mockResolvedValueOnce(doc)
    const onRetry = jest.fn()

    const promise = retryWithVerify({ fn, verify, onRetry })

    await jest.advanceTimersByTimeAsync(2000)

    const r = await promise
    expect(r).toEqual({ ok: true, data: doc })
    expect(onRetry).toHaveBeenCalledWith(1, 3)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('succeeds via post-retry verify when retry also fails', async () => {
    const freshDoc = { id: 1, status: 'ok' }
    let verifyCalls = 0
    const verify = jest.fn().mockImplementation(() => {
      verifyCalls++
      return verifyCalls >= 2 ? Promise.resolve(freshDoc) : Promise.resolve(null)
    })
    const fn = jest.fn().mockRejectedValue(new Error('Lỗi không xác định'))
    const onRetry = jest.fn()

    const promise = retryWithVerify({ fn, verify, onRetry })

    await jest.advanceTimersByTimeAsync(2000)

    const r = await promise
    expect(r).toEqual({ ok: true, data: freshDoc })
    expect(onRetry).toHaveBeenCalledWith(1, 3)
  })

  it('succeeds when retry throws a state-conflict but post-retry verify passes (slow-commit race)', async () => {
    // Bug thực tế: GĐ Từ chối → server chạy chậm (gửi email) → client "Lỗi không xác định".
    // verify ban đầu chạy SỚM (server chưa commit) → null. Sau 2s retry gọi lại → server đã commit
    // lần 1 → ném "đang ở trạng thái Từ chối, không thể tuChoi" (non-transport). Phải verify lại → OK.
    const freshDoc = { id: 1, 'Tình trạng': 'Từ chối' }
    let verifyCalls = 0
    const verify = jest.fn().mockImplementation(() => {
      verifyCalls++
      return verifyCalls >= 2 ? Promise.resolve(freshDoc) : Promise.resolve(null)
    })
    const fn = jest.fn().mockRejectedValue(new Error('Hồ sơ đang ở trạng thái "Từ chối", không thể tuChoi'))

    const promise = retryWithVerify({ fn, verify })
    await jest.advanceTimersByTimeAsync(2000)

    const r = await promise
    expect(r).toEqual({ ok: true, data: freshDoc })
    expect(fn).toHaveBeenCalledTimes(1)   // verify thành công → KHÔNG retry tiếp
  })

  it('stops immediately on real server error', async () => {
    const verify = jest.fn().mockResolvedValue(null)
    const fn = jest.fn().mockRejectedValue(new Error('Bạn không có quyền'))
    const onRetry = jest.fn()

    const promise = retryWithVerify({ fn, verify, onRetry })

    await jest.advanceTimersByTimeAsync(2000)

    const r = await promise
    expect(r).toEqual({ ok: false, error: 'Bạn không có quyền' })
    expect(fn).toHaveBeenCalledTimes(1)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('exhausts all 3 retries then returns last error', async () => {
    const verify = jest.fn().mockResolvedValue(null)
    const fn = jest.fn().mockRejectedValue(new Error('Lỗi không xác định'))
    const onRetry = jest.fn()

    const promise = retryWithVerify({ fn, verify, onRetry })

    await jest.advanceTimersByTimeAsync(2000) // retry 1
    await jest.advanceTimersByTimeAsync(3000) // retry 2
    await jest.advanceTimersByTimeAsync(5000) // retry 3

    const r = await promise
    expect(r).toEqual({ ok: false, error: 'Lỗi không xác định' })
    expect(fn).toHaveBeenCalledTimes(3)
    expect(onRetry).toHaveBeenCalledTimes(3)
    expect(onRetry).toHaveBeenNthCalledWith(1, 1, 3)
    expect(onRetry).toHaveBeenNthCalledWith(2, 2, 3)
    expect(onRetry).toHaveBeenNthCalledWith(3, 3, 3)
  })

  it('uses escalating delays: 0.5s, 1.5s, 3s', async () => {
    const verify = jest.fn().mockResolvedValue(null)
    const fn = jest.fn().mockRejectedValue(new Error('Lỗi không xác định'))
    const onRetry = jest.fn()

    const promise = retryWithVerify({ fn, verify, onRetry })

    // After 499ms — retry 1 not yet triggered
    await jest.advanceTimersByTimeAsync(499)
    expect(fn).toHaveBeenCalledTimes(0)

    // At 500ms — retry 1 fires
    await jest.advanceTimersByTimeAsync(1)
    expect(fn).toHaveBeenCalledTimes(1)

    // After 1499ms more — retry 2 not yet triggered
    await jest.advanceTimersByTimeAsync(1499)
    expect(fn).toHaveBeenCalledTimes(1)

    // At 1500ms — retry 2 fires
    await jest.advanceTimersByTimeAsync(1)
    expect(fn).toHaveBeenCalledTimes(2)

    // After 2999ms more — retry 3 not yet triggered
    await jest.advanceTimersByTimeAsync(2999)
    expect(fn).toHaveBeenCalledTimes(2)

    // At 3000ms — retry 3 fires
    await jest.advanceTimersByTimeAsync(1)
    expect(fn).toHaveBeenCalledTimes(3)

    await promise
  })

  it('works without onRetry callback', async () => {
    const verify = jest.fn().mockResolvedValue(null)
    const fn = jest.fn().mockResolvedValueOnce({ id: 1 })

    const promise = retryWithVerify({ fn, verify })

    await jest.advanceTimersByTimeAsync(2000)

    const r = await promise
    expect(r).toEqual({ ok: true, data: { id: 1 } })
  })
})
