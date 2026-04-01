/**
 * WriteBuffer — batches write calls, flushing every FLUSH_MS ms or when MAX_BATCH items queued.
 * Each item: { fn, args, resolve, reject }
 */
const FLUSH_MS  = 5000
const MAX_BATCH = 10

import gasCall from '../gasClient.js'

class WriteBuffer {
  constructor() {
    this._queue = []
    this._timer = null
  }

  add(fn, args) {
    return new Promise((resolve, reject) => {
      this._queue.push({ fn, args, resolve, reject })
      if (this._queue.length >= MAX_BATCH) {
        this._flush()
      } else if (!this._timer) {
        this._timer = setTimeout(() => this._flush(), FLUSH_MS)
      }
    })
  }

  _flush() {
    clearTimeout(this._timer)
    this._timer = null
    const batch = this._queue.splice(0, this._queue.length)
    // Execute sequentially — GAS doesn't support true parallel writes
    batch.reduce((chain, item) => {
      return chain.then(() =>
        gasCall(item.fn, ...item.args)
          .then(item.resolve)
          .catch(item.reject)
      )
    }, Promise.resolve())
  }

  flush() {
    if (this._queue.length) this._flush()
  }
}

export const writeBuffer = new WriteBuffer()

// Flush remaining writes before page unload
window.addEventListener('beforeunload', () => writeBuffer.flush())
