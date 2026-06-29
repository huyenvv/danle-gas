// Test tầng queue/retry của gasClient (đường google.script.run thật, IS_GAS=true).
// Trọng tâm: MUTATION không được auto-retry khi transport lỗi (tránh double-execute → xung đột);
// READ-ONLY vẫn tự thử lại (idempotent).

function makeRunner(handler) {
  let success, failure
  const target = {}
  const proxy = new Proxy(target, {
    get(_t, prop) {
      if (prop === 'withSuccessHandler') return (fn) => { success = fn; return proxy }
      if (prop === 'withFailureHandler') return (fn) => { failure = fn; return proxy }
      if (prop === 'withUserObject') return () => proxy
      if (typeof prop === 'string') return (...args) => handler(prop, args, { success, failure })
      return undefined
    },
  })
  return proxy
}

function loadGasCall(handler) {
  let gasCall
  jest.isolateModules(() => {
    global.google = { script: { run: makeRunner(handler) } }
    gasCall = require('../gasClient.js').default
  })
  return gasCall
}

afterEach(() => { delete global.google; jest.useRealTimers() })

describe('gasClient queue/retry', () => {
  test('MUTATION (api_transitionDocument): transport lỗi → gọi ĐÚNG 1 lần, reject "Lỗi không xác định"', async () => {
    let calls = 0
    const gasCall = loadGasCall((_fn, _args, { failure }) => {
      calls++
      failure(new Error('Internal error'))   // lỗi "retryable" — trước đây sẽ bị gọi lại
    })
    await expect(gasCall('api_transitionDocument', 'tok', '1', 'thuHoi', {})).rejects.toThrow('Lỗi không xác định')
    expect(calls).toBe(1)   // KHÔNG gọi lại → server không double-execute → không xung đột
  })

  test('MUTATION: res rỗng (success handler, res=null) → reject "Lỗi không xác định", 1 lần', async () => {
    let calls = 0
    const gasCall = loadGasCall((_fn, _args, { success }) => {
      calls++
      success(null)   // response rớt → res falsy
    })
    await expect(gasCall('api_createDocument', 'tok', {})).rejects.toThrow('Lỗi không xác định')
    expect(calls).toBe(1)
  })

  test('READ-ONLY (api_getDocuments): transport lỗi → TỰ thử lại tới khi thành công', async () => {
    jest.useFakeTimers()
    let calls = 0
    const gasCall = loadGasCall((_fn, _args, { success, failure }) => {
      calls++
      if (calls < 2) failure(new Error('Internal error'))
      else success({ success: true, payload: { ok: true } })
    })
    const p = gasCall('api_getDocuments', 'tok', {})
    await jest.advanceTimersByTimeAsync(3000)   // qua delay backoff của lần retry
    await expect(p).resolves.toEqual({ ok: true })
    expect(calls).toBe(2)
  })
})
