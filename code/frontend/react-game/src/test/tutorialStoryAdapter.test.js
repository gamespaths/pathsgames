import { describe, it, expect } from 'vitest'
import tutorialDoc from '../mock/tutorial_story.json'
import { adaptTutorialStory, adaptTutorialStoryList } from '../mock/tutorialStoryAdapter'

describe('tutorialStoryAdapter', () => {
  it('adaptTutorialStoryList returns a non-empty array', () => {
    const list = adaptTutorialStoryList(tutorialDoc)
    expect(Array.isArray(list)).toBe(true)
    expect(list.length).toBe(1)
  })

  it('adapted story has required frontend fields', () => {
    const story = adaptTutorialStory(tutorialDoc)
    expect(story).toHaveProperty('uuid', 'story-001')
    expect(story).toHaveProperty('title')
    expect(story.title.length).toBeGreaterThan(0)
    expect(story).toHaveProperty('description')
    expect(story).toHaveProperty('author')
    expect(story).toHaveProperty('card')
  })

  it('adapted story card has urlImage and title', () => {
    const { card } = adaptTutorialStory(tutorialDoc)
    expect(card).not.toBeNull()
    expect(card).toHaveProperty('urlImage')
    expect(card).toHaveProperty('title')
    expect(card.title.length).toBeGreaterThan(0)
  })

  it('adapted characterTemplates are non-empty and have required fields', () => {
    const { characterTemplates } = adaptTutorialStory(tutorialDoc)
    expect(Array.isArray(characterTemplates)).toBe(true)
    expect(characterTemplates.length).toBeGreaterThan(0)
    for (const tpl of characterTemplates) {
      expect(tpl).toHaveProperty('uuid')
      expect(tpl).toHaveProperty('name')
    }
  })

  it('adapted difficulties are non-empty and have required fields', () => {
    const { difficulties } = adaptTutorialStory(tutorialDoc)
    expect(Array.isArray(difficulties)).toBe(true)
    expect(difficulties.length).toBeGreaterThan(0)
    for (const d of difficulties) {
      expect(d).toHaveProperty('uuid')
      expect(d).toHaveProperty('name')
    }
  })

  it('adapted traits are non-empty and have bonuses object', () => {
    const { traits } = adaptTutorialStory(tutorialDoc)
    expect(Array.isArray(traits)).toBe(true)
    expect(traits.length).toBeGreaterThan(0)
    for (const t of traits) {
      expect(t).toHaveProperty('uuid')
      expect(t).toHaveProperty('name')
      expect(t).toHaveProperty('bonuses')
      expect(t).toHaveProperty('cost')
    }
  })

  it('adapted classes are non-empty and have stats object', () => {
    const { classes } = adaptTutorialStory(tutorialDoc)
    expect(Array.isArray(classes)).toBe(true)
    expect(classes.length).toBeGreaterThan(0)
    for (const c of classes) {
      expect(c).toHaveProperty('uuid')
      expect(c).toHaveProperty('name')
      expect(c).toHaveProperty('stats')
      expect(c.stats).toHaveProperty('dexterityBase')
    }
  })
})
