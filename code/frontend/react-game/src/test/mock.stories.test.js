import { describe, it, expect } from 'vitest'
import stories from '../mock/stories.json'

describe('stories mock data', () => {
  it('should be a non-empty array', () => {
    expect(Array.isArray(stories)).toBe(true)
    expect(stories.length).toBeGreaterThan(0)
  })

  it('each story has required fields', () => {
    for (const story of stories) {
      expect(story).toHaveProperty('uuid')
      expect(story).toHaveProperty('title')
      expect(story).toHaveProperty('card')
    }
  })

  it('each story card has imageUrl and title', () => {
    for (const story of stories) {
      expect(story.card).toHaveProperty('imageUrl')
      expect(story.card).toHaveProperty('title')
    }
  })

  it('stories have characters or difficulties', () => {
    for (const story of stories) {
      const hasCharacters = Array.isArray(story.characters) && story.characters.length > 0
      const hasDifficulties = Array.isArray(story.difficulties) && story.difficulties.length > 0
      expect(hasCharacters || hasDifficulties).toBe(true)
    }
  })

  it('story uuids are unique', () => {
    const uuids = stories.map((s) => s.uuid)
    const unique = new Set(uuids)
    expect(unique.size).toBe(uuids.length)
  })
})
