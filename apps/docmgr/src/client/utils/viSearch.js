export function viNormalize(str) {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase()
}

export function viMatch(haystack, needle) {
  if (!needle) return true
  return viNormalize(haystack).includes(viNormalize(needle))
}
