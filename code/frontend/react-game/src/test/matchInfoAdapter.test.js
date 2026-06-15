import { describe, it, expect } from 'vitest'
import { matchInfoToGameData } from '../api/matchInfoAdapter'
import mockMatchInfo from '../mock/matchInfo.json'

describe('matchInfoToGameData', () => {
  it('returns empty board for null info', () => {
    const gd = matchInfoToGameData(null)
    expect(gd.startLocation).toBeNull()
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

  it('builds startLocation from the current location', () => {
    const gd = matchInfoToGameData(mockMatchInfo)
    expect(gd.startLocation).toMatchObject({ uuid: 'loc-001', name: 'The Old Tavern' })
  })

  it('does not surface /info visited locations as board move-targets (left card stays the story card)', () => {
    const gd = matchInfoToGameData(mockMatchInfo)
    expect(gd.locations).toEqual([])
  })

  it('merges events + choices into actions and flags END_GAME', () => {
    const gd = matchInfoToGameData(mockMatchInfo)
    // 1 event + 2 choices
    expect(gd.actions).toHaveLength(3)
    const endAction = gd.actions.find(a => a.uuid === 'end-event-uuid')
    expect(endAction).toMatchObject({ endGame: true, uuidEvent: 'end-event-uuid' })
    const choice = gd.actions.find(a => a.uuid === 'choice-002')
    expect(choice.endGame).toBe(false)
  })

  it('enriches startLocation image and endGameCard from the story when present', () => {
    const story = { card: { urlImage: 'http://img/x.png', awesomeIcon: 'fas fa-book' }, endGameCard: { title: 'The End' } }
    const gd = matchInfoToGameData(mockMatchInfo, story)
    expect(gd.startLocation.urlImage).toBe('http://img/x.png')
    expect(gd.endGameCard).toEqual({ title: 'The End' })
  })

  it('tolerates a minimal info object without players/events', () => {
    const gd = matchInfoToGameData({ locations: [] })
    expect(gd.playerStats).toMatchObject({ life: 0, energy: 0 })
    expect(gd.actions).toEqual([])
  })
})
