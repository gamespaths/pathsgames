/**
 * tutorialStoryAdapter.js
 *
 * Transforms a tutorial_story.json (backend import format) into the
 * frontend story-summary format used by the mock stories array in stories.js.
 *
 * Backend format:  { story, texts[], cards[], characterTemplates[], difficulties[], ... }
 * Frontend format: [{ uuid, title, description, author, card{}, characterTemplates[], difficulties[], ... }]
 */

/**
 * Resolves a text entry by idText from the texts array.
 * Returns shortText, or the fallback string if not found.
 * @param {Array}  texts
 * @param {number} id
 * @param {string} [fallback='']
 */
function getText(texts, id, fallback = '') {
  if (!id) return fallback
  const entry = texts.find(t => t.idText === id)
  return entry?.shortText ?? fallback
}

/**
 * Builds a frontend card object from a raw card + texts lookup.
 * @param {Object|null} rawCard
 * @param {Array}       texts
 * @param {string}      [uuidPrefix='card']
 */
function buildCard(rawCard, texts, uuidPrefix = 'card') {
  if (!rawCard) return null
  return {
    uuid:          `${uuidPrefix}-${rawCard.id}`,
    urlImage:      rawCard.urlImage ?? null,
    alternativeImage: rawCard.alternativeImage ?? null,
    title:         getText(texts, rawCard.idTextTitle),
    description:   getText(texts, rawCard.idTextDescription),
    awesomeIcon:   rawCard.awesomeIcon ?? null,
    copyrightText: getText(texts, rawCard.idTextCopyright),
    linkCopyright: rawCard.linkCopyright ?? null,
  }
}

/**
 * Converts a single tutorial_story.json document into a frontend story summary.
 * @param {Object} doc  — parsed contents of tutorial_story.json
 * @returns {Object}    — frontend story summary (same shape as stories.json entries)
 */
export function adaptTutorialStory(doc) {
  const { story, texts = [], cards = [], characterTemplates = [], difficulties = [], traits = [], classes = [] } = doc

  // Index lookup maps
  const cardById = Object.fromEntries(cards.map(c => [c.id, c]))

  // Story card
  const rawStoryCard = cardById[story.idCard] ?? null
  const card = buildCard(rawStoryCard, texts, 'card-story')

  // Character templates
  const mappedTemplates = characterTemplates.map(tpl => {
    const rawCard = cardById[tpl.idCard] ?? null
    return {
      uuid:  `char-${tpl.id}`,
      name:  getText(texts, tpl.idTextName, `Character ${tpl.id}`),
      sub:   getText(texts, tpl.idTextDescription, ''),
      icon:  rawCard?.awesomeIcon ?? 'fas fa-user',
      card:  buildCard(rawCard, texts, `card-char-${tpl.id}`),
      stats: {
        lifeMax:             tpl.lifeMax,
        energyMax:           tpl.energyMax,
        sadMax:              tpl.sadMax,
        dexterityStart:      tpl.dexterityStart,
        intelligenceStart:   tpl.intelligenceStart,
        constitutionStart:   tpl.constitutionStart,
      },
    }
  })

  // Difficulties
  const mappedDifficulties = difficulties.map(d => ({
    uuid:        `diff-${d.id}`,
    name:        getText(texts, d.idTextName, `Difficulty ${d.id}`),
    description: getText(texts, d.idTextDescription, ''),
    icon:        d.awesomeIcon ?? 'fas fa-star',
    card:        buildCard(cardById[d.idCard] ?? null, texts, `card-diff-${d.id}`),
  }))

  // Traits
  const mappedTraits = traits.map(t => {
    const rawCard = cardById[t.idCard] ?? null
    return {
      uuid:        `trait-${t.id}`,
      name:        getText(texts, t.idTextName, `Trait ${t.id}`),
      description: getText(texts, t.idTextDescription, ''),
      icon:        rawCard?.awesomeIcon ?? 'fas fa-star',
      card:        buildCard(rawCard, texts, `card-trait-${t.id}`),
      cost: {
        positive: t.costPositive ?? 0,
        negative: t.costNegative ?? null,
      },
      bonuses: {
        life:          t.life ?? null,
        energy:        t.energy ?? null,
        sad:           t.sad ?? null,
        dexterity:     t.dexterity ?? null,
        intelligence:  t.intelligence ?? null,
        constitution:  t.constitution ?? null,
      },
      idClassPermitted:  t.idClassPermitted ?? null,
      idClassProhibited: t.idClassProhibited ?? null,
    }
  })

  // Classes
  const mappedClasses = classes.map(c => {
    const rawCard = cardById[c.idCard] ?? null
    return {
      uuid:        `class-${c.id}`,
      name:        getText(texts, c.idTextName, `Class ${c.id}`),
      description: getText(texts, c.idTextDescription, ''),
      icon:        rawCard?.awesomeIcon ?? 'fas fa-shield-alt',
      card:        buildCard(rawCard, texts, `card-class-${c.id}`),
      stats: {
        weightMax:        c.weightMax ?? null,
        dexterityBase:    c.dexterityBase ?? 0,
        intelligenceBase: c.intelligenceBase ?? 0,
        constitutionBase: c.constitutionBase ?? 0,
      },
    }
  })

  return {
    uuid:            story.uuid,
    title:           getText(texts, story.idTextTitle, 'Untitled'),
    description:     getText(texts, story.idTextDescription, ''),
    author:          story.author ?? '',
    category:        story.category ?? '',
    group:           story.group ?? '',
    visibility:      story.visibility ?? 'PUBLIC',
    priority:        story.priority ?? 0,
    copyrightText:   getText(texts, story.idTextCopyright),
    linkCopyright:   story.linkCopyright ?? null,
    card,
    characterTemplates: mappedTemplates,
    difficulties:       mappedDifficulties,
    traits:             mappedTraits,
    classes:            mappedClasses,
  }
}

/**
 * Converts a tutorial_story.json document to the full array format
 * expected by the mock stories list (wraps the single story in an array).
 * @param {Object} doc
 * @returns {Array}
 */
export function adaptTutorialStoryList(doc) {
  return [adaptTutorialStory(doc)]
}
