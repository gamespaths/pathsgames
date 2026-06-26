import { describe, it, expect } from 'vitest'
import { matchInfoToGameData } from '../api/matchInfoAdapter'
import mockMatchInfo from './fixtures/matchInfo.json'

describe('matchInfoToGameData', () => {
  it('returns empty board for null info', () => {
    const gd = matchInfoToGameData(null)
    expect(gd.actualLocationCard).toBeNull()
    expect(gd.locations).toEqual([])
    expect(gd.actions).toEqual([])
    expect(gd.endGameCard).toBeNull()
    expect(gd.playerStats).toMatchObject({ life: 0, energy: 0, sadness: 0 })
  })

  it('maps players[0] stats (sad → sadness) into playerStats', () => {
    const gd = matchInfoToGameData(mockMatchInfo)
    expect(gd.playerStats.life).toBe(100)
    expect(gd.playerStats.energy).toBe(80)
    expect(gd.playerStats.sadness).toBe(20)
    // fields not projected by /info default to 0
    expect(gd.playerStats.food).toBe(0)
    expect(gd.playerStats.coins).toBe(0)
  })

  it('maps Step 27 max statistics, carried weight and items', () => {
    const gd = matchInfoToGameData(mockMatchInfo)
    expect(gd.playerStats.lifeMax).toBe(120)
    expect(gd.playerStats.energyMax).toBe(110)
    expect(gd.playerStats.sadnessMax).toBe(40)
    expect(gd.playerStats.weightMax).toBe(24)
    expect(gd.playerStats.weight).toBe(4)
    expect(gd.playerStats.items).toHaveLength(1)
    expect(gd.playerStats.items[0]).toMatchObject({ itemUuid: 'item-1', amount: 2 })
  })

  it('defaults max stats and items to empty when no player', () => {
    const gd = matchInfoToGameData({ locations: [] })
    expect(gd.playerStats.lifeMax).toBe(0)
    expect(gd.playerStats.weightMax).toBe(0)
    expect(gd.playerStats.items).toEqual([])
  })

  it('builds actualLocationCard from the active location card (player position)', () => {
    const gd = matchInfoToGameData(mockMatchInfo)
    // With an active location the raw card is passed through (title/awesomeIcon).
    expect(gd.actualLocationCard).toMatchObject({
      title: 'The Old Tavern',
      awesomeIcon: 'fas fa-beer',
    })
    expect(gd.actualLocationCard.description).toContain('warm hearth')
  })

  it('maps the active location neighbors into board move-target cards', () => {
    const gd = matchInfoToGameData(mockMatchInfo)
    expect(gd.locations).toHaveLength(2)
    // Step 0.28.2 — player stands on the edge's `to` location (1001) for the cave
    // neighbor, so its return card (cardBack) is shown instead of the forward card.
    const cave = gd.locations.find(l => l.idLocation === 1002)
    expect(cave).toMatchObject({ uuid: 'loc-002', name: 'Back to the Dark Cave', energyCost: 2, direction: 'N' })
    // For the forest neighbor the player is on the `from` side → forward card.
    const forest = gd.locations.find(l => l.idLocation === 1003)
    expect(forest).toMatchObject({ name: 'Ancient Forest' })
  })

  it('shows the forward card (not cardBack) when no cardBack is present', () => {
    const info = JSON.parse(JSON.stringify(mockMatchInfo))
    // Active 1001 is the `to` side but the edge has no cardBack → keep forward card.
    const nb = info.locationsActive[0].neighbors.find(n => n.idLocation === 1002)
    nb.cardBack = null
    const gd = matchInfoToGameData(info)
    expect(gd.locations.find(l => l.idLocation === 1002).name).toBe('Dark Cave')
  })

  it('falls back to a currentLocation* card (with story image) when locationsActive is absent', () => {
    const { locationsActive, ...lean } = mockMatchInfo
    const story = { card: { urlImage: 'http://img/x.png', awesomeIcon: 'fas fa-book' } }
    const gd = matchInfoToGameData(lean, story)
    expect(gd.actualLocationCard).toMatchObject({
      uuid: 'loc-001',
      name: 'The Old Tavern',
      urlImage: 'http://img/x.png',
    })
    expect(gd.locations).toEqual([])
  })

  it('merges lean events/choices and active event cards into actions, flags END_GAME', () => {
    const gd = matchInfoToGameData(mockMatchInfo)
    // 1 lean event + 2 choices + 1 active-location event card
    expect(gd.actions).toHaveLength(4)
    const endAction = gd.actions.find(a => a.uuid === 'end-event-uuid')
    expect(endAction).toMatchObject({ endGame: true, uuidEvent: 'end-event-uuid' })
    const choice = gd.actions.find(a => a.uuid === 'choice-002')
    expect(choice.endGame).toBe(false)
    const eventCard = gd.actions.find(a => a.uuid === 'evt-tavern-1')
    expect(eventCard).toMatchObject({ name: 'A Hooded Stranger', awesomeIcon: 'fas fa-user-secret' })
  })

  it('builds the end-game card via the i18n translator', () => {
    const story = { card: { urlImage: 'http://img/x.png', awesomeIcon: 'fas fa-book' } }
    const t = (k) => `tr:${k}`
    const gd = matchInfoToGameData(mockMatchInfo, story, t)
    expect(gd.endGameCard).toMatchObject({
      title: 'tr:game.endGameCard.title',
      description: 'tr:game.endGameCard.description',
    })
  })

  it('tolerates a minimal info object without players/events', () => {
    const gd = matchInfoToGameData({ locations: [] })
    expect(gd.playerStats).toMatchObject({ life: 0, energy: 0 })
    expect(gd.actions).toEqual([])
  })
})
