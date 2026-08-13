import { describe, it, expect } from 'vitest'
import { matchInfoToGameData } from '../api/matchInfoAdapter'
import mockMatchInfo from './fixtures/matchInfo.json'
import images from '../data/images.json'

const NEIGHBOR_IMG = images.find(i => i.id === 'neighbor')?.urlImage

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
    // The edge is authored 1002→1001 NORTH; the player walks it the other way,
    // so the board reports the TRAVERSAL direction (SOUTH), not the authored one.
    expect(cave).toMatchObject({ uuid: 'loc-002', name: 'Back to the Dark Cave', energyCost: 2, direction: 'SOUTH' })
    // For the forest neighbor the player is on the `from` side → forward card.
    const forest = gd.locations.find(l => l.idLocation === 1003)
    expect(forest).toMatchObject({ name: 'Ancient Forest' })
  })

  // The backend's move verdict must reach MovementCard: it knows causes the board cannot
  // compute on its own (coma, sleep, a barred way, a full destination).
  it('carries the neighbor move verdict (available + reason) through to the board', () => {
    const info = JSON.parse(JSON.stringify(mockMatchInfo))
    const nb = info.locationsActive[0].neighbors.find(n => n.idLocation === 1003)
    nb.available = false
    nb.reason = 'MOVEMENT_CONDITION_NOT_MET'

    const gd = matchInfoToGameData(info)
    expect(gd.locations.find(l => l.idLocation === 1003))
      .toMatchObject({ available: false, reason: 'MOVEMENT_CONDITION_NOT_MET' })
  })

  it('leaves the verdict null when the backend sends none (older payload)', () => {
    const gd = matchInfoToGameData(mockMatchInfo)
    // null, not false: an absent verdict must not read as "refused"
    expect(gd.locations[0].available).toBeNull()
    expect(gd.locations[0].reason).toBeNull()
  })

  it('shows the forward card (not cardBack) when no cardBack is present', () => {
    const info = JSON.parse(JSON.stringify(mockMatchInfo))
    // Active 1001 is the `to` side but the edge has no cardBack → keep forward card.
    const nb = info.locationsActive[0].neighbors.find(n => n.idLocation === 1002)
    nb.cardBack = null
    const gd = matchInfoToGameData(info)
    expect(gd.locations.find(l => l.idLocation === 1002).name).toBe('Dark Cave')
  })

  it('shows the destination LOCATION card when the link has no card but the destination is visited', () => {
    // Step 0.28.6 — cardLocationTo is the destination's own card, resolved only
    // once that location has been visited. It outranks the generic fallback.
    const info = JSON.parse(JSON.stringify(mockMatchInfo))
    const nb = info.locationsActive[0].neighbors.find(n => n.idLocation === 1003)
    nb.card = null
    nb.cardBack = null
    nb.cardLocationTo = { title: 'Ancient Forest', description: 'Towering trees.', urlImage: 'forest.png' }
    const gd = matchInfoToGameData(info, null, (k) => k)
    const forest = gd.locations.find(l => l.idLocation === 1003)
    expect(forest.name).toBe('Ancient Forest')
    expect(forest.urlImage).toBe('forest.png')
    expect(forest.urlImage).not.toBe(NEIGHBOR_IMG)
  })

  it('falls back to the fixed "neighbor" card when there is no card anywhere', () => {
    // No LINK card, no return card, and the destination is still under fog of war
    // (cardLocationTo null) → the generic direction card, with the destination
    // described as unexplored.
    const info = JSON.parse(JSON.stringify(mockMatchInfo))
    const nb = info.locationsActive[0].neighbors.find(n => n.idLocation === 1003)
    nb.card = null
    nb.cardBack = null
    nb.cardLocationTo = null
    nb.direction = 'NORTH'
    const gd = matchInfoToGameData(info, null, (k) => k)
    const forest = gd.locations.find(l => l.idLocation === 1003)
    // uses the fixed neighbor image from data/images.json
    expect(forest.urlImage).toBe(NEIGHBOR_IMG)
    expect(forest.card.urlImage).toBe(NEIGHBOR_IMG)
    // title = "Move to North" (identity translator → game.moveToDirection + dir)
    expect(forest.card.title).toBe('game.moveToDirection North')
    expect(forest.card.description).toContain('game.moveToDirection North')
    // From = the current location's card title; To = unexplored (not visited yet)
    expect(forest.card.description).toContain('game.from: The Old Tavern')
    expect(forest.card.description).toContain('game.to: game.map.unexploredLocation')
  })

  it('uses "Back to" with the OPPOSITE direction for a return to an explored destination', () => {
    const info = JSON.parse(JSON.stringify(mockMatchInfo))
    // Cave neighbor 1002: from=1002, to=1001, authored NORTH; player stands on
    // 1001 (=to) → return move, actually walked SOUTHwards. 1002 is in the visited
    // set (info.locations), so the party knows the place and "Back to" is honest.
    // Strip every card so the generic fallback card is the one under test — which
    // leaves the destination explored but unnamed, the only shape in which the
    // generic card and "Back to" ever meet.
    const nb = info.locationsActive[0].neighbors.find(n => n.idLocation === 1002)
    nb.card = null
    nb.cardBack = null
    nb.cardLocationFrom = null   // the move DESTINATION when playerAtTo
    const gd = matchInfoToGameData(info, null, (k) => k)
    const cave = gd.locations.find(l => l.idLocation === 1002)
    // the authored NORTH is flipped: the character walks South
    expect(cave.card.title).toBe('game.backTo South')
    expect(cave.direction).toBe('SOUTH')
    // From is always where the character stands, To always the destination —
    // a return move does NOT swap them.
    expect(cave.card.description).toContain('game.from: The Old Tavern')
    expect(cave.card.description).toContain('game.to: game.map.unexploredLocation')
  })

  it('says "Move to", not "Back to", when the return leads somewhere never explored', () => {
    // Same return move, but 1002 is NOT in the visited set: the edge is authored
    // 1002→1001 and walked against that, yet the party has never been there. "Back
    // to" would promise a homecoming to a place the card itself calls unexplored.
    const info = JSON.parse(JSON.stringify(mockMatchInfo))
    info.locations = info.locations.filter(l => l.idLocation !== 1002)
    const nb = info.locationsActive[0].neighbors.find(n => n.idLocation === 1002)
    nb.card = null
    nb.cardBack = null
    nb.cardLocationFrom = null
    const gd = matchInfoToGameData(info, null, (k) => k)
    const cave = gd.locations.find(l => l.idLocation === 1002)
    expect(cave.card.title).toBe('game.moveToDirection South')
    // the direction is still the flipped one — only the promise changed
    expect(cave.direction).toBe('SOUTH')
    expect(cave.card.description).toContain('game.from: The Old Tavern')
    expect(cave.card.description).toContain('game.to: game.map.unexploredLocation')
  })

  it('says "Move to" on a forward move even when the destination is already explored', () => {
    // Option B only: an explored destination alone is not a return. The edge is
    // authored 1001→1003 and walked that way, so it stays a "Move to".
    const info = JSON.parse(JSON.stringify(mockMatchInfo))
    info.locations.push({ idLocation: 1003, uuid: 'loc-003', clockCounter: 0 })
    const nb = info.locationsActive[0].neighbors.find(n => n.idLocation === 1003)
    nb.card = null
    nb.cardBack = null
    nb.cardLocationTo = null
    const gd = matchInfoToGameData(info, null, (k) => k)
    const forest = gd.locations.find(l => l.idLocation === 1003)
    expect(forest.card.title).toBe('game.moveToDirection East')
  })

  it('keeps From = current location and To = destination on a forward move', () => {
    const info = JSON.parse(JSON.stringify(mockMatchInfo))
    // Forest neighbor 1003: from=1001 (where the player stands), to=1003, EAST.
    const nb = info.locationsActive[0].neighbors.find(n => n.idLocation === 1003)
    nb.card = null
    nb.cardBack = null
    nb.cardLocationTo = { title: 'Ancient Forest' }
    const gd = matchInfoToGameData(info, null, (k) => k)
    const forest = gd.locations.find(l => l.idLocation === 1003)
    expect(forest.direction).toBe('EAST')
    // the LOCATION card outranks the generic one, so rebuild the check on the
    // generic card by stripping the destination card as well
    const info2 = JSON.parse(JSON.stringify(info))
    info2.locationsActive[0].neighbors.find(n => n.idLocation === 1003).cardLocationTo = null
    const gd2 = matchInfoToGameData(info2, null, (k) => k)
    const forest2 = gd2.locations.find(l => l.idLocation === 1003)
    expect(forest2.card.title).toBe('game.moveToDirection East')
    expect(forest2.card.description).toContain('game.from: The Old Tavern')
    expect(forest2.card.description).toContain('game.to: game.map.unexploredLocation')
  })

  it('drops the direction on a return move whose direction has no opposite (SKY)', () => {
    const info = JSON.parse(JSON.stringify(mockMatchInfo))
    const nb = info.locationsActive[0].neighbors.find(n => n.idLocation === 1002)
    nb.card = null
    nb.cardBack = null
    nb.cardLocationFrom = null
    nb.direction = 'SKY'
    const gd = matchInfoToGameData(info, null, (k) => k)
    const cave = gd.locations.find(l => l.idLocation === 1002)
    // no opposite for SKY → no direction rather than a wrong one
    expect(cave.direction).toBeNull()
    expect(cave.card.title).toBe('game.backTo')
  })

  it('takes the return-move destination name from cardLocationFrom when playerAtTo', () => {
    // Player on the edge's `to` side → the destination is `from`, so its name must
    // come from cardLocationFrom (not cardLocationTo).
    const info = JSON.parse(JSON.stringify(mockMatchInfo))
    const nb = info.locationsActive[0].neighbors.find(n => n.idLocation === 1002)
    nb.card = null
    nb.cardBack = null
    const gd = matchInfoToGameData(info, null, (k) => k)
    const cave = gd.locations.find(l => l.idLocation === 1002)
    // fixture: cardLocationFrom is the Dark Cave card (1002 is visited)
    expect(cave.name).toBe('Dark Cave')
  })

  it('keeps the real card when only cardBack is missing (no fallback)', () => {
    const info = JSON.parse(JSON.stringify(mockMatchInfo))
    const nb = info.locationsActive[0].neighbors.find(n => n.idLocation === 1003)
    nb.cardBack = null // card still present → no neighbor fallback
    const gd = matchInfoToGameData(info)
    const forest = gd.locations.find(l => l.idLocation === 1003)
    expect(forest.name).toBe('Ancient Forest')
    expect(forest.urlImage).not.toBe(NEIGHBOR_IMG)
  })

  it('falls back to a currentLocation* card (with story image) when locationsActive is absent', () => {
    const { locationsActive, ...lean } = mockMatchInfo
    const story = { card: { urlImage: 'http://img/x.png', awesomeIcon: 'fas fa-book' } }
    const gd = matchInfoToGameData(lean, story)
    // v0.28.6 — currentLocationName is gone, so the fallback card has no name.
    expect(gd.actualLocationCard).toMatchObject({
      uuid: 'loc-001',
      name: '',
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
