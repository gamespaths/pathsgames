import { describe, it, expect } from 'vitest'
import { matchInfoToGameData } from '../api/matchInfoAdapter'

/**
 * The adapter defaults every field /info can omit. A backend one version behind
 * sends exactly that: a character with no max statistics, a neighbour with no
 * cost and no card, an event with no card at all. This suite pins those defaults.
 */

describe('matchInfoToGameData over a minimal /info payload', () => {
  const bare = {
    players: [{ uuid: 'c1', idLocation: 1 }],   // no stats, no uuids, no items
    currentLocationUuid: 'loc-1',
    locations: [],
    locationsActive: [{
      idLocation: 1,
      neighbors: [{ idLocationFrom: 1, idLocationTo: 2 }],   // no uuid, no cost, no cards
      events: [{ uuid: 'ev-1' }],                            // no card, no type, no energy
    }],
    events: [{ uuid: 'lean-1', name: 'Lean' }],              // no type
  }

  it('zeroes every statistic the character does not carry', () => {
    const gd = matchInfoToGameData(bare, null, (k) => k)

    expect(gd.playerStats).toMatchObject({
      life: 0, energy: 0, sadness: 0,
      lifeMax: 0, energyMax: 0, sadnessMax: 0,
      weight: 0, weightMax: 0, constitution: 0,
      intelligence: 0, dexterity: 0,
      isComa: false, isSleeping: false,
    })
    expect(gd.playerStats.items).toEqual([])
    expect(gd.playerStats.traitUuids).toEqual([])
    expect(gd.playerStats.characterTemplateUuid).toBeNull()
    expect(gd.playerStats.classUuid).toBeNull()
  })

  it('keeps the item and trait lists only when they really are lists', () => {
    const gd = matchInfoToGameData({
      ...bare,
      players: [{ uuid: 'c1', idLocation: 1, items: 'nope', traitUuids: { a: 1 } }],
    }, null, (k) => k)

    expect(gd.playerStats.items).toEqual([])
    expect(gd.playerStats.traitUuids).toEqual([])
  })

  it('builds the placeholder location card when the active location has none', () => {
    const gd = matchInfoToGameData(bare, null, (k) => k)

    expect(gd.actualLocationCard).toMatchObject({
      uuid: 'loc-1',
      name: '',
      urlImage: null,
      awesomeIcon: 'fas fa-map-marker-alt',
    })
  })

  it('takes the placeholder image and icon from the story card when there is one', () => {
    const story = { card: { urlImage: 'story.png', awesomeIcon: 'fas fa-book' } }
    const gd = matchInfoToGameData(bare, story, (k) => k)

    expect(gd.actualLocationCard).toMatchObject({
      urlImage: 'story.png',
      awesomeIcon: 'fas fa-book',
    })
  })

  it('defaults every neighbour field the backend omits', () => {
    const gd = matchInfoToGameData(bare, null, (k) => k)
    const neighbor = gd.locations[0]

    expect(neighbor.uuid).toBeNull()
    expect(neighbor.idLocation).toBeNull()
    expect(neighbor.energyCost).toBeNull()
    expect(neighbor.available).toBeNull()
    expect(neighbor.reason).toBeNull()
    // With no card of any kind the generic neighbour card is built instead.
    expect(neighbor.card).not.toBeNull()
    expect(neighbor.name).toBe(neighbor.card.title)
  })

  it('defaults every action field, lean and enriched alike', () => {
    const gd = matchInfoToGameData(bare, null, (k) => k)
    const [lean, enriched] = gd.actions

    expect(lean).toMatchObject({ uuid: 'lean-1', type: null, endGame: false, card: null })
    expect(enriched).toMatchObject({
      uuid: 'ev-1', name: '', description: '', type: null,
      awesomeIcon: 'fas fa-bolt', endGame: false, card: null,
      available: false, reason: null, energy: 0,
    })
  })

  it('names the move from the origin location card when the player card has no title', () => {
    const info = {
      ...bare,
      players: [{ uuid: 'c1', idLocation: 2 }],
      locationsActive: [{
        idLocation: 2,
        // The player stands on the edge's `to` endpoint: this is a return move, so the
        // origin card is the edge's `to` card.
        neighbors: [{
          idLocation: 1, idLocationFrom: 1, idLocationTo: 2, direction: 'NORTH',
          cardLocationTo: { title: 'The Cellar' },
        }],
      }],
    }

    const gd = matchInfoToGameData(info, null, (k) => k)

    expect(gd.locations[0].card.description).toContain('The Cellar')
    expect(gd.locations[0].direction).toBe('SOUTH')
  })

  it('returns the empty board for a payload with nothing in it', () => {
    const gd = matchInfoToGameData({}, null, (k) => k)

    expect(gd.locations).toEqual([])
    expect(gd.actions).toEqual([])
    expect(gd.actualLocationCard).toBeNull()
    expect(gd.match).toBeNull()
  })
})
