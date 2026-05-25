/**
 * Validates that icon_names in Google Fonts Material Symbols URLs
 * are sorted alphabetically. The API returns 400 if they aren't.
 */
const fs = require('fs')
const path = require('path')
const glob = require('glob')

const HTML_FILES = glob.sync('apps/*/src/client/index.html', { cwd: path.resolve(__dirname, '..') })
  .map(f => path.resolve(__dirname, '..', f))

const ICON_NAMES_RE = /icon_names=([^&"]+)/g

describe('Google Fonts icon_names', () => {
  if (HTML_FILES.length === 0) {
    it('should find at least one index.html', () => { throw new Error('No index.html files found') })
    return
  }

  HTML_FILES.forEach(filePath => {
    const label = filePath.replace(path.resolve(__dirname, '..') + '/', '')

    describe(label, () => {
      const html = fs.readFileSync(filePath, 'utf8')
      let match
      const regex = new RegExp(ICON_NAMES_RE)
      const urls = []
      while ((match = regex.exec(html)) !== null) urls.push(match[1])

      if (urls.length === 0) {
        it.skip('no icon_names found — skipping', () => {})
        return
      }

      urls.forEach((iconStr, i) => {
        const icons = iconStr.split(',').map(s => s.trim()).filter(Boolean)

        it(`icon_names${urls.length > 1 ? ' #' + (i + 1) : ''} must be sorted alphabetically`, () => {
          const sorted = [...icons].sort()
          const misplaced = []
          icons.forEach((name, j) => {
            if (name !== sorted[j]) misplaced.push({ index: j, got: name, expected: sorted[j] })
          })
          if (misplaced.length > 0) {
            const details = misplaced.slice(0, 5).map(m =>
              `  [${m.index}] got "${m.got}", expected "${m.expected}"`
            ).join('\n')
            throw new Error(
              `icon_names not sorted! ${misplaced.length} icon(s) out of order:\n${details}\n\n` +
              `Sorted list:\n  ${sorted.join(',')}`
            )
          }
        })

        it(`icon_names${urls.length > 1 ? ' #' + (i + 1) : ''} must have no duplicates`, () => {
          const seen = new Set()
          const dups = []
          icons.forEach(name => {
            if (seen.has(name)) dups.push(name)
            seen.add(name)
          })
          if (dups.length > 0) {
            throw new Error(`Duplicate icon names: ${dups.join(', ')}`)
          }
        })
      })
    })
  })
})
