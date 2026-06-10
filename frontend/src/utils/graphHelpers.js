export const LANGUAGE_COLORS = {
  Python: '#AFA9EC',
  JavaScript: '#85B7EB',
  TypeScript: '#5DCAA5',
  Java: '#F0997B',
  Go: '#67C3A8',
  Rust: '#EF9F27',
  Ruby: '#F18B8B',
  'C++': '#9AC4D4',
  C: '#88C0D0',
  'C#': '#8BC4A8',
  PHP: '#B4A7D6',
  default: '#6B7280',
}

/** Node radius based on lines of code. Minimum 6px, scales with sqrt(size). */
export function nodeRadius(d) {
  return Math.max(6, Math.sqrt(d.size || 1) * 1.2)
}

export function getNodeColor(language) {
  return LANGUAGE_COLORS[language] || LANGUAGE_COLORS.default
}

/** Returns unique, sorted language list from node array. */
export function getLanguages(nodes) {
  return [...new Set(nodes.map((n) => n.language).filter(Boolean))].sort()
}
