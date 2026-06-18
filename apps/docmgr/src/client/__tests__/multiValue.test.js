import { parseMulti, formatMulti } from '../utils/multiValue.js'

describe('multiValue.parseMulti', () => {
  test('empty → []', () => { expect(parseMulti('')).toEqual([]) })
  test('legacy single value → [value]', () => { expect(parseMulti('DA-01')).toEqual(['DA-01']) })
  test('JSON array → array of strings', () => { expect(parseMulti('["DA-01","DA-02"]')).toEqual(['DA-01', 'DA-02']) })
  test('malformed JSON falls back to single', () => { expect(parseMulti('[oops')).toEqual(['[oops']) })
})

describe('multiValue.formatMulti', () => {
  test('joins with comma', () => { expect(formatMulti('["DA-01","DA-02"]')).toBe('DA-01, DA-02') })
  test('legacy single value', () => { expect(formatMulti('DA-01')).toBe('DA-01') })
  test('empty → ""', () => { expect(formatMulti('')).toBe('') })
})
