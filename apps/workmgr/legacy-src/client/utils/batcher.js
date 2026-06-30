// Tiny accumulator that buffers items for `delay` ms and flushes as a single
// batch. Cuts down on GAS round-trips when the user does rapid actions.
//
//   const b = new Batcher(async items => await gasCall('api_batch...', token, items))
//   b.add({ id, status, deptId })   // returns immediately; flushed later

export class Batcher {
  constructor(flushFn, { delay = 300, maxSize = 25 } = {}) {
    this.queue = []
    this.flushFn = flushFn
    this.delay = delay
    this.maxSize = maxSize
    this.timer = null
  }

  add(item) {
    this.queue.push(item)
    if (this.queue.length >= this.maxSize) {
      this.flush()
    } else {
      clearTimeout(this.timer)
      this.timer = setTimeout(() => this.flush(), this.delay)
    }
  }

  flush() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null }
    if (this.queue.length === 0) return
    const items = this.queue.splice(0)
    Promise.resolve(this.flushFn(items)).catch(err => {
      console.error('Batcher flush failed:', err)
    })
  }

  // Call on unmount so pending items aren't dropped.
  dispose() {
    this.flush()
  }
}
