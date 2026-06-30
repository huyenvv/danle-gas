// Transport GAS — gọi google.script.run, giải envelope {success,payload}.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const google: any

export function gasTransport(method: string, args: unknown[]): Promise<unknown> {
  return new Promise((resolve, reject) => {
    google.script.run
      .withSuccessHandler((res: { success: boolean; payload?: unknown; error?: string }) => {
        if (res && res.success) resolve(res.payload)
        else reject(new Error((res && res.error) || 'Lỗi không xác định'))
      })
      .withFailureHandler((err: { message?: string } | string) => {
        const msg = typeof err === 'object' && err !== null ? err.message : String(err)
        reject(new Error(msg || String(err)))
      })
      [method](...args)
  })
}
