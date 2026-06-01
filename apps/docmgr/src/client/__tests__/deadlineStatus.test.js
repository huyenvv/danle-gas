import { getDeadlineStatus } from '../utils/deadlineStatus.js'

function daysFromNow(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString()
}

describe('getDeadlineStatus', () => {
  test('returns null when no date', () => {
    expect(getDeadlineStatus(null)).toBeNull()
    expect(getDeadlineStatus(undefined)).toBeNull()
    expect(getDeadlineStatus('')).toBeNull()
  })

  test('overdue: past date', () => {
    const r = getDeadlineStatus(daysFromNow(-5))
    expect(r.level).toBe('overdue')
    expect(r.daysLeft).toBe(-5)
    expect(r.label).toBe('Quá hạn 5 ngày')
  })

  test('overdue: yesterday', () => {
    const r = getDeadlineStatus(daysFromNow(-1))
    expect(r.level).toBe('overdue')
    expect(r.daysLeft).toBe(-1)
    expect(r.label).toBe('Quá hạn 1 ngày')
  })

  test('urgent: today (0 days left)', () => {
    const r = getDeadlineStatus(daysFromNow(0))
    expect(r.level).toBe('urgent')
    expect(r.daysLeft).toBe(0)
    expect(r.label).toBe('Hết hạn hôm nay')
  })

  test('urgent: 1 day left', () => {
    const r = getDeadlineStatus(daysFromNow(1))
    expect(r.level).toBe('urgent')
    expect(r.daysLeft).toBe(1)
    expect(r.label).toBe('Còn 1 ngày')
  })

  test('urgent: 3 days left', () => {
    const r = getDeadlineStatus(daysFromNow(3))
    expect(r.level).toBe('urgent')
    expect(r.daysLeft).toBe(3)
    expect(r.label).toBe('Còn 3 ngày')
  })

  test('warning: 4 days left', () => {
    const r = getDeadlineStatus(daysFromNow(4))
    expect(r.level).toBe('warning')
    expect(r.daysLeft).toBe(4)
    expect(r.label).toBe('Còn 4 ngày')
  })

  test('warning: 7 days left', () => {
    const r = getDeadlineStatus(daysFromNow(7))
    expect(r.level).toBe('warning')
    expect(r.daysLeft).toBe(7)
    expect(r.label).toBe('Còn 7 ngày')
  })

  test('normal: 8 days left', () => {
    const r = getDeadlineStatus(daysFromNow(8))
    expect(r.level).toBe('normal')
    expect(r.daysLeft).toBe(8)
    expect(r.label).toBe('')
  })

  test('normal: 30 days left', () => {
    const r = getDeadlineStatus(daysFromNow(30))
    expect(r.level).toBe('normal')
    expect(r.label).toBe('')
  })

  test('parses YYYY-MM-DD string', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 2)
    const s = yesterday.toISOString().slice(0, 10) // YYYY-MM-DD
    const r = getDeadlineStatus(s)
    expect(r.level).toBe('overdue')
  })

  test('parses dd/mm/yyyy Vietnamese format', () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const d = String(tomorrow.getDate()).padStart(2, '0')
    const m = String(tomorrow.getMonth() + 1).padStart(2, '0')
    const y = tomorrow.getFullYear()
    const r = getDeadlineStatus(`${d}/${m}/${y}`)
    expect(r.level).toBe('urgent')
    expect(r.daysLeft).toBe(1)
  })
})
