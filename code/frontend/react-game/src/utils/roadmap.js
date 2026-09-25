import images from '@/data/images.json'

// Step 40 — the roadmap book's versions: completed first, then the current one, then planned.
const STATUS_ORDER = { completed: 0, current: 1, planned: 2 }

/** The status a card is sorted and badged by; anything unknown counts as planned. */
export function roadmapStatus(entry) {
  const status = String(entry?.status ?? '').trim().toLowerCase()
  return status in STATUS_ORDER ? status : 'planned'
}

/** The versions in book order; json order is kept inside each status group. */
export function sortRoadmap(entries) {
  return (Array.isArray(entries) ? entries : [])
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => STATUS_ORDER[roadmapStatus(a.entry)] - STATUS_ORDER[roadmapStatus(b.entry)]
      || a.index - b.index)
    .map(x => x.entry)
}

/** The card of a version: its images.json picture (`home` when missing or unknown). */
export function roadmapCard(entry) {
  const img = images.find(x => x.id === entry?.imgId) ?? images.find(x => x.id === 'home') ?? {}
  return {
    urlImage: img.urlImage ?? null,
    styleImageLittle: img.styleImageLittle ?? '',
    styleImageLarge: img.styleImageLarge ?? '',
    awesomeIcon: img.awesomeIcon ?? 'fas fa-map',
    title: entry?.title ?? entry?.id ?? '',
  }
}
