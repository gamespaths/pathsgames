import images from '@/data/images.json'
import { comingSoonStories } from './comingSoonStories'

/**
 * Step 40 — the credits book: one entry per credited work, `{ key, kind, card }`.
 * `kind` is 'story' | 'image' | 'audio'; 'audio' has no items yet, the kind is already
 * here for when they land. The stories come first, then every image.
 */

// images.json mixes {urlImage, copyrightText, linkCopyright, description} and {url, author, authorLink}.
export function creditCard(img) {
  return {
    urlImage: img.urlImage ?? img.url ?? null,
    title: img.title ?? img.id,
    copyrightText: img.copyrightText ?? img.author ?? null,
    linkCopyright: img.linkCopyright ?? img.authorLink ?? null,
    description: img.description ?? (img.author ? `Photo by ${img.author}` : null),
    styleImageLarge: img.styleImageLarge ?? '',
  }
}

/** A story (service catalog or shipped teaser): its own picture, its author credited. */
export function creditStory(story) {
  return {
    key: `story:${story.uuid}`,
    kind: 'story',
    card: {
      urlImage: story.card?.urlImage ?? null,
      title: story.title ?? story.uuid,
      description: story.description ?? null,
      copyrightText: story.author ?? null,
      linkCopyright: story.card?.linkCopyright ?? null,
      styleImageLarge: story.card?.styleImageLarge ?? '',
    },
  }
}

/** Every story of the credits book: the service catalog first, then the shipped teasers, once each. */
export function creditStories(services = [], lang = 'en') {
  const entries = []
  const seen = new Set()
  for (const story of [...(Array.isArray(services) ? services : []), ...comingSoonStories(lang)]) {
    if (!story?.uuid || seen.has(story.uuid)) continue
    seen.add(story.uuid)
    entries.push(creditStory(story))
  }
  return entries
}

/** Every image of data/images.json as a credits entry. */
export function creditImages(list = images) {
  return (Array.isArray(list) ? list : []).map(img => ({
    key: `image:${img.id}`, kind: 'image', card: creditCard(img),
  }))
}

/** The whole credits book: the stories, then all the images. */
export function creditsEntries({ stories = [], lang = 'en', imageList = images } = {}) {
  return [...creditStories(stories, lang), ...creditImages(imageList)]
}
