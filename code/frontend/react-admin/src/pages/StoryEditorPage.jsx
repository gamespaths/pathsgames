import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getStory, listEntities, updateStory, deleteEntity, createEntity, updateEntity } from '../api/storyApi'
import LoadingSpinner from '../components/common/LoadingSpinner'
import ErrorAlert from '../components/common/ErrorAlert'
import EntityTable from '../components/common/story/EntityTable'
import EntityForm from '../components/common/story/EntityForm'
import ConfirmModal from '../components/common/ConfirmModal'
import PathsSelector from '../components/common/story/PathsSelector'
import FastTextSelectorModal from '../components/common/story/FastTextSelectorModal'
import PathsOptionsSelectorModal from '../components/common/story/PathsOptionsSelectorModal'
import {
  STORIES_ENTITIES_TABS as TABS,
  STORIES_ENTITIES_COLUMNS as COLUMNS,
  STORIES_ENTITIES_FIELDS as FIELDS
} from '../constants/story/storiesEntities'

import {
  LOCATION_NEIGHBOR_DIRECTIONS,
} from '../constants/story/locationNeighbors'



export default function StoryEditorPage() {
  const { uuid } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('metadata')
  const [story, setStory] = useState(null)
  const [entities, setEntities] = useState([])
  const [texts, setTexts] = useState([]) // All texts for resolution
  const [locations, setLocations] = useState([])
  const [eventsRef, setEventsRef] = useState([])
  const [traitsRef, setTraitsRef] = useState([])
  const [itemsRef, setItemsRef] = useState([])
  const [classesRef, setClassesRef] = useState([])
  const [choicesRef, setChoicesRef] = useState([])
  const [missionsRef, setMissionsRef] = useState([])
  const [keysRef, setKeysRef] = useState([])
  const [cardsRef, setCardsRef] = useState([])
  const [weatherRulesRef, setWeatherRulesRef] = useState([])
  const [creators, setCreators] = useState([])
  const [storyOptions, setStoryOptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [modal, setModal] = useState(null) // { type, entity }
  const [storyTextSelector, setStoryTextSelector] = useState(null)
  const [storyCardSelectorOpen, setStoryCardSelectorOpen] = useState(false)
  const [storyCreatorSelectorOpen, setStoryCreatorSelectorOpen] = useState(false)
  const [storyStartLocationSelectorOpen, setStoryStartLocationSelectorOpen] = useState(false)
  const [storyAllPlayerComaLocationSelectorOpen, setStoryAllPlayerComaLocationSelectorOpen] = useState(false)
  const [storyAllPlayerComaEventSelectorOpen, setStoryAllPlayerComaEventSelectorOpen] = useState(false)
  const [storyEndGameEventSelectorOpen, setStoryEndGameEventSelectorOpen] = useState(false)

  const refreshTexts = async (storyUuid = uuid) => {
    const txts = await listEntities(storyUuid, 'texts')
    if (storyUuid === uuid) {
      setTexts(txts)
    }
    return txts
  }

  const refreshCreators = async (storyUuid = uuid) => {
    const creatorEntities = await listEntities(storyUuid, 'creators')
    if (storyUuid === uuid) {
      setCreators(creatorEntities)
    }
    return creatorEntities
  }

  const refreshLocations = async (storyUuid = uuid) => {
    const locationEntities = await listEntities(storyUuid, 'locations')
    if (storyUuid === uuid) {
      setLocations(locationEntities)
    }
    return locationEntities
  }

  const refreshReferenceEntities = async (storyUuid = uuid) => {
    const [eventsData, traitsData, itemsData, classesData, choicesData, missionsData, keysData, cardsData, weatherRulesData] = await Promise.all([
      listEntities(storyUuid, 'events'),
      listEntities(storyUuid, 'traits'),
      listEntities(storyUuid, 'items'),
      listEntities(storyUuid, 'classes'),
      listEntities(storyUuid, 'choices'),
      listEntities(storyUuid, 'missions'),
      listEntities(storyUuid, 'keys'),
      listEntities(storyUuid, 'cards'),
      listEntities(storyUuid, 'weather-rules'),
    ])

    if (storyUuid === uuid) {
      setEventsRef(eventsData)
      setTraitsRef(traitsData)
      setItemsRef(itemsData)
      setClassesRef(classesData)
      setChoicesRef(choicesData)
      setMissionsRef(missionsData)
      setKeysRef(keysData)
      setCardsRef(cardsData)
      setWeatherRulesRef(weatherRulesData)
    }

    return {
      eventsData,
      traitsData,
      itemsData,
      classesData,
      choicesData,
      missionsData,
      keysData,
      cardsData,
      weatherRulesData,
    }
  }

  const loadStory = async () => {
    try {
      const data = await getStory(uuid)
      setStory(data)
      setStoryOptions([
        {
          value: data.uuid,
          label: `${data.author || 'Story'} (${data.uuid.slice(0, 8)})`,
        },
      ])
      await refreshTexts(uuid)
      await refreshCreators(uuid)
      await refreshLocations(uuid)
      await refreshReferenceEntities(uuid)
      setLoading(false)
    } catch (e) {
      setError(e.message)
      setLoading(false)
    }
  }

  const loadEntities = async () => {
    if (activeTab === 'metadata') return
    try {
      const data = await listEntities(uuid, activeTab)
      setEntities(data)
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => { loadStory() }, [uuid])
  useEffect(() => { loadEntities() }, [activeTab])

  const handleUpdateStory = async (e) => {
    e.preventDefault()
    try {
      await updateStory(uuid, story)
      setSuccess('Story metadata updated successfully')
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) { setError(e.message) }
  }

  const handleDeleteEntity = async () => {
    const entityTab = modal?.entityTab || activeTab
    const { entity } = modal
    setModal(null)
    try {
      await deleteEntity(uuid, entityTab, entity.uuid)
      setSuccess(`${entityTab} entity deleted`)
      loadEntities()
      if (entityTab === 'texts') {
        await refreshTexts(uuid)
      }
      if (entityTab === 'locations') {
        await refreshLocations(uuid)
      }
      if (['events', 'traits', 'items', 'classes', 'choices', 'missions', 'keys', 'cards', 'weather-rules'].includes(entityTab)) {
        await refreshReferenceEntities(uuid)
      }
    } catch (e) { setError(e.message) }
  }

  const handleSaveEntity = async (data) => {
    const entityTab = modal?.entityTab || activeTab
    try {
      const payload = { ...data }

      const hasCardKey = Object.prototype.hasOwnProperty.call(payload, 'idCard')
        || Object.prototype.hasOwnProperty.call(payload, 'id_card')
      if (hasCardKey) {
        const rawIdCard = payload.idCard ?? payload.id_card
        const normalizedIdCard = Number(rawIdCard)
        if (rawIdCard === '' || rawIdCard === null || rawIdCard === undefined) {
          payload.idCard = ''
          payload.id_card = null
        } else if (Number.isFinite(normalizedIdCard)) {
          payload.idCard = normalizedIdCard
          payload.id_card = normalizedIdCard
        }
      }

      if (modal.entity?.uuid) {
        await updateEntity(uuid, entityTab, modal.entity.uuid, payload)
      } else {
        await createEntity(uuid, entityTab, payload)
      }
      setSuccess(`${entityTab} saved`)
      setModal(null)
      loadEntities()
      if (entityTab === 'texts') {
        await refreshTexts(uuid)
      }
      if (entityTab === 'locations') {
        await refreshLocations(uuid)
      }
      if (['events', 'traits', 'items', 'classes', 'choices', 'missions', 'keys', 'cards', 'weather-rules'].includes(entityTab)) {
        await refreshReferenceEntities(uuid)
      }
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) { setError(e.message) }
  }

  const handleExportStory = async () => {
    try {
      setLoading(true)
      const fullStory = {
        story: {
          uuid: story.uuid,
          author: story.author,
          category: story.category,
          group: story.group,
          visibility: story.visibility,
          priority: story.priority,
          peghi: story.peghi,
          versionMin: story.versionMin,
          versionMax: story.versionMax,
          idTextTitle: story.idTextTitle,
          idTextDescription: story.idTextDescription,
          idLocationStart: story.idLocationStart,
          idImage: story.idImage,
          idLocationAllPlayerComa: story.idLocationAllPlayerComa,
          idEventAllPlayerComa: story.idEventAllPlayerComa,
          idTextClockSingular: story.idTextClockSingular,
          idTextClockPlural: story.idTextClockPlural,
          idEventEndGame: story.idEventEndGame,
          idTextCopyright: story.idTextCopyright,
          linkCopyright: story.linkCopyright,
          idCreator: story.idCreator,
          idCard: story.idCard,
        },
        texts: texts.map(t => ({ idText: t.idText, lang: t.lang, shortText: t.shortText, longText: t.longText })),
        locations: locations.map(l => ({ ...l })),
        events: eventsRef.map(e => ({ ...e })),
        difficulties: await listEntities(uuid, 'difficulties'),
        keys: keysRef.map(k => ({ ...k })),
        items: itemsRef.map(i => ({ ...i })),
        classes: classesRef.map(c => ({ ...c })),
        traits: traitsRef.map(t => ({ ...t })),
        characterTemplates: await listEntities(uuid, 'character-templates'),
        locationNeighbors: await listEntities(uuid, 'location-neighbors'),
        eventEffects: await listEntities(uuid, 'event-effects'),
        choices: choicesRef.map(c => ({ ...c })),
        choiceConditions: await listEntities(uuid, 'choice-conditions'),
        choiceEffects: await listEntities(uuid, 'choice-effects'),
        weatherRules: weatherRulesRef.map(w => ({ ...w })),
        globalRandomEvents: await listEntities(uuid, 'global-random-events'),
        missions: missionsRef.map(m => ({ ...m })),
        missionSteps: await listEntities(uuid, 'mission-steps'),
        creators: creators.map(c => ({ ...c })),
        cards: cardsRef.map(c => ({ ...c })),
        itemEffects: await listEntities(uuid, 'item-effects'),
        classBonuses: await listEntities(uuid, 'class-bonuses'),
      }

      // Cleanup: remove fields that shouldn't be in the export (like id, ts_insert, etc.)
      const cleanup = (obj) => {
        if (Array.isArray(obj)) return obj.map(cleanup)
        if (obj !== null && typeof obj === 'object') {
          const { id, ts_insert, ts_update, ...rest } = obj
          const cleaned = {}
          for (const k in rest) {
            cleaned[k] = cleanup(rest[k])
          }
          return cleaned
        }
        return obj
      }

      const finalJson = cleanup(fullStory)
      const blob = new Blob([JSON.stringify(finalJson, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `story_${story.uuid.slice(0, 8)}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      setSuccess('Story exported successfully')
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      setError(`Export failed: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenCardFromEntityTable = async (idCard) => {
    const parsedIdCard = Number(idCard)
    if (!Number.isFinite(parsedIdCard)) return

    let availableCards = cardsRef
    if (!availableCards?.length) {
      availableCards = await listEntities(uuid, 'cards')
      setCardsRef(availableCards)
    }

    const targetCard = availableCards.find(card => Number(card.idCard ?? card.id ?? card.id_card) === parsedIdCard)
    if (!targetCard) {
      setError(`Card #${parsedIdCard} not found`)
      return
    }

    setModal({ type: 'form', entity: targetCard, entityTab: 'cards' })
  }

  const handleSaveFastText = async ({ uuidStory, idText, translations, mode }) => {
    const targetStoryUuid = uuidStory || uuid
    const existingTexts = await refreshTexts(targetStoryUuid)
    const creatorEntities = await refreshCreators(targetStoryUuid)
    const firstCreator = creatorEntities.find(item => item?.idCreator !== null && item?.idCreator !== undefined)
    const firstCreatorId = firstCreator?.idCreator
    const storyCreatorId = Number(story?.idCreator)
    const storyCopyrightTextId = Number(story?.idTextCopyright)

    let finalIdText = Number(idText)
    if (mode === 'input-generator') {
      const existingIds = existingTexts
        .map(item => Number(item.idText))
        .filter(value => !Number.isNaN(value))
      finalIdText = existingIds.length ? Math.max(...existingIds) + 1 : 1
    }

    const languagesToSave = mode === 'input-generator' ? ['en'] : ['en', 'it']

    for (const lang of languagesToSave) {
      const translation = translations?.[lang] || { shortText: '', longText: '' }
      const existing = existingTexts.find(
        item => Number(item.idText) === Number(finalIdText) && item.lang === lang
      )

      if (existing?.uuid) {
        await updateEntity(targetStoryUuid, 'texts', existing.uuid, {
          ...existing,
          idText: Number(finalIdText),
          lang,
          shortText: translation.shortText || '',
          longText: translation.longText || '',
          idTextCopyright: Number.isFinite(storyCopyrightTextId)
            ? storyCopyrightTextId
            : (existing?.idTextCopyright ?? null),
          idCreator: Number.isFinite(storyCreatorId)
            ? storyCreatorId
            : (existing?.idCreator ?? firstCreatorId),
        })
      } else {
        await createEntity(targetStoryUuid, 'texts', {
          idText: Number(finalIdText),
          lang,
          shortText: translation.shortText || '',
          longText: translation.longText || '',
          idTextCopyright: Number.isFinite(storyCopyrightTextId) ? storyCopyrightTextId : null,
          idCreator: Number.isFinite(storyCreatorId) ? storyCreatorId : firstCreatorId,
        })
      }
    }

    await refreshTexts(targetStoryUuid)
    setSuccess(`Text #${finalIdText} saved`)
    setTimeout(() => setSuccess(''), 3000)

    return { idText: Number(finalIdText), uuidStory: targetStoryUuid }
  }

  const handleCreateFastCard = async ({ storyUuid, formData }) => {
    const targetStoryUuid = storyUuid || uuid
    const parseTextId = (value) => {
      const parsed = Number(value)
      return Number.isFinite(parsed) ? parsed : null
    }

    const isKeysEntityForm =
      formData
      && Object.prototype.hasOwnProperty.call(formData, 'idTextDescription')
      && Object.prototype.hasOwnProperty.call(formData, 'name')
      && Object.prototype.hasOwnProperty.call(formData, 'value')

    const preferredTextIdKeys = [
      'idTextName',
      'idTextDescription',
      'idTextNarrative',
      'idTextTitle',
      'idText',
      'idTextGo',
      'idTextBack',
    ]

    const titleTextIdFromPreferredKeys = preferredTextIdKeys
      .map(key => parseTextId(formData?.[key]))
      .find(value => value !== null)

    const titleTextIdFromAnyIdTextField = Object.entries(formData || {})
      .filter(([key]) => /^idText/i.test(key))
      .map(([, value]) => parseTextId(value))
      .find(value => value !== null)

    const keysDescriptionTextId = isKeysEntityForm ? parseTextId(formData?.idTextDescription) : null
    const titleTextId = keysDescriptionTextId ?? titleTextIdFromPreferredKeys ?? titleTextIdFromAnyIdTextField ?? null

    if (titleTextId === null) {
      setError('A text id is required to create a fast card (Name/Desc/Narrative/Text)')
      return null
    }

    const descTextId = parseTextId(formData?.idTextDescription) ?? titleTextId

    const cardsEntities = await listEntities(targetStoryUuid, 'cards')
    const existingCardIds = (cardsEntities || [])
      .map(item => Number(item.idCard ?? item.id ?? item.id_card))
      .filter(value => Number.isFinite(value))
    const nextCardId = existingCardIds.length ? Math.max(...existingCardIds) + 1 : 1

    let creatorEntities = creators
    if (!creatorEntities?.length) {
      creatorEntities = await refreshCreators(targetStoryUuid)
    }
    const firstCreator = creatorEntities.find(item => item?.idCreator !== null && item?.idCreator !== undefined)
    const firstCreatorId = firstCreator?.idCreator ?? null
    const storyCreatorId = Number(story?.idCreator)
    const storyCopyrightTextId = Number(story?.idTextCopyright)

    await createEntity(targetStoryUuid, 'cards', {
      idCard: nextCardId,
      idTextName: titleTextId,
      idTextTitle: titleTextId,
      idTextDescription: descTextId,
      idTextCopyright: Number.isFinite(storyCopyrightTextId) ? storyCopyrightTextId : 33,
      idCreator: Number.isFinite(storyCreatorId) ? storyCreatorId : firstCreatorId,
    })

    await refreshReferenceEntities(targetStoryUuid)
    setSuccess(`Card #${nextCardId} created`)
    setTimeout(() => setSuccess(''), 3000)

    return nextCardId
  }

  if (loading) return <LoadingSpinner text="Loading story data..." />

  // Column definitions for each entity type



  const defaultCols = [
    { key: 'idTextName', label: 'Name', type: 'idTextName' },
    { key: 'uuid', label: 'UUID', render: e => <small className="text-white/20">{e.uuid?.slice(0, 8)}...</small> }
  ]

  const getTextDisplay = (idText) => {
    if (idText === null || idText === undefined || idText === '') return ''
    const target = texts.find(item => Number(item.idText) === Number(idText) && item.lang === 'en')
    if (!target) return `Text #${idText} (EN not found)`
    return `#${idText} ${target.shortText || '(empty)'}`
  }

  const extractNumericId = (entity, keys = []) => {
    for (const key of keys) {
      const value = entity?.[key]
      if (value === null || value === undefined || value === '') continue
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
    return null
  }

  const getEnShortTextByEntity = (entity, textIdKeys = ['idTextName']) => {
    const textId = extractNumericId(entity, textIdKeys)
    if (textId === null) return ''
    const textEntity = texts.find(item => Number(item.idText) === textId && item.lang === 'en')
    return textEntity?.shortText || ''
  }

  const makeReferenceOptions = ({ entities, idKeys, textIdKeys = ['idTextName'] }) => {
    return (entities || [])
      .map(entity => {
        const id = extractNumericId(entity, idKeys)
        if (id === null) return null
        const shortText = getEnShortTextByEntity(entity, textIdKeys)
        return {
          value: id,
          label: shortText ? `#${id} ${shortText}` : `#${id}`,
        }
      })
      .filter(Boolean)
  }

  const setStoryTextField = (key, idText) => {
    setStory(prev => ({ ...prev, [key]: Number(idText) }))
  }

  const getCardDisplay = (idCard) => {
    if (idCard === null || idCard === undefined || idCard === '') return ''
    const match = cardsOptions.find(option => String(option.value) === String(idCard))
    return match?.label || `#${idCard}`
  }

  const getCreatorDisplay = (idCreator) => {
    if (idCreator === null || idCreator === undefined || idCreator === '') return ''
    const match = creatorsOptions.find(option => String(option.value) === String(idCreator))
    return match?.label || `#${idCreator}`
  }

  const getLocationDisplay = (idLocation) => {
    if (idLocation === null || idLocation === undefined || idLocation === '') return ''
    const match = locationOptions.find(option => String(option.value) === String(idLocation))
    return match?.label || `#${idLocation}`
  }

  const getEventDisplay = (idEvent) => {
    if (idEvent === null || idEvent === undefined || idEvent === '') return ''
    const match = eventOptions.find(option => String(option.value) === String(idEvent))
    return match?.label || `#${idEvent}`
  }

  const locationOptions = locations.map(location => {
    const locationId = location.idLocation ?? location.id ?? location.id_location
    const nameText = texts.find(item => Number(item.idText) === Number(location.idTextName) && item.lang === 'en')
    return {
      value: Number(locationId),
      label: `#${locationId} ${nameText?.shortText || '(no name text)'}`,
    }
  }).filter(option => !Number.isNaN(option.value))

  const eventOptions = makeReferenceOptions({
    entities: eventsRef,
    idKeys: ['idEvent', 'id', 'id_event'],
    textIdKeys: ['idTextName', 'idTextDescription'],
  })

  const traitsOptions = makeReferenceOptions({
    entities: traitsRef,
    idKeys: ['idTraits', 'idTrait', 'id', 'id_traits'],
    textIdKeys: ['idTextName', 'idTextDescription'],
  })

  const itemsOptions = makeReferenceOptions({
    entities: itemsRef,
    idKeys: ['idItem', 'id', 'id_item'],
    textIdKeys: ['idTextName', 'idTextDescription'],
  })

  const classesOptions = makeReferenceOptions({
    entities: classesRef,
    idKeys: ['idClass', 'id', 'id_class'],
    textIdKeys: ['idTextName', 'idTextDescription'],
  })

  const creatorsOptions = makeReferenceOptions({
    entities: creators,
    idKeys: ['idCreator', 'id', 'id_creator'],
    textIdKeys: ['idTextName', 'idText'],
  })

  const cardsOptions = makeReferenceOptions({
    entities: cardsRef,
    idKeys: ['idCard', 'id', 'id_card'],
    textIdKeys: ['idTextTitle', 'idTextDescription'],
  })

  const choicesOptions = makeReferenceOptions({
    entities: choicesRef,
    idKeys: ['idChoices', 'idChoice', 'idScelta', 'id', 'id_choices'],
    textIdKeys: ['idTextNarrative', 'idTextName', 'idTextDescription'],
  })

  const missionsOptions = makeReferenceOptions({
    entities: missionsRef,
    idKeys: ['idMission', 'id', 'id_mission'],
    textIdKeys: ['idTextName', 'idTextDescription'],
  })

  const weatherRulesOptions = makeReferenceOptions({
    entities: weatherRulesRef,
    idKeys: ['idCard', 'idWeather', 'id', 'id_weather'],
    textIdKeys: ['idText', 'idTextDescription'],
  })

  const keysOptions = (keysRef || [])
    .map(keyEntity => {
      const keyName = keyEntity?.name
      if (!keyName) return null
      const keyValue = keyEntity?.value
      return {
        value: keyName,
        label: keyValue ? `${keyName} = ${keyValue}` : keyName,
      }
    })
    .filter(Boolean)

  const pathSelectorOptionsByTab = {
    difficulties: {
      idCard: {
        options: cardsOptions,
      },
    },
    locations: {
      idCard: {
        options: cardsOptions,
      },
      idEventIfCounterZero: {
        options: eventOptions,
      },
      idEventIfCharacterStartTime: {
        options: eventOptions,
      },
      idEventIfCharacterEnterFirstTime: {
        options: eventOptions,
      },
      idEventIfFirstTime: {
        options: eventOptions,
      },
      idEventNotFirstTime: {
        options: eventOptions,
      },
    },
    events: {
      idCard: {
        options: cardsOptions,
      },
      idSpecificLocation: {
        options: locationOptions,
      },
      keyToAdd: {
        options: keysOptions,
        valueType: 'string',
      },
      characteristicToAdd: {
        options: [
          { value: 'DEXTERITY', label: 'DEXTERITY' },
          { value: 'INTELLIGENCE', label: 'INTELLIGENCE' },
          { value: 'CONSTITUTION', label: 'CONSTITUTION' },
          { value: 'LIFE', label: 'LIFE' },
          { value: 'ENERGY', label: 'ENERGY' },
          { value: 'SAD', label: 'SAD' },
          { value: 'COINS', label: 'COINS' },
          { value: 'TIME', label: 'TIME' },
        ],
        valueType: 'string',
      },
      characteristicToRemove: {
        options: [
          { value: 'DEXTERITY', label: 'DEXTERITY' },
          { value: 'INTELLIGENCE', label: 'INTELLIGENCE' },
          { value: 'CONSTITUTION', label: 'CONSTITUTION' },
          { value: 'LIFE', label: 'LIFE' },
          { value: 'ENERGY', label: 'ENERGY' },
          { value: 'SAD', label: 'SAD' },
          { value: 'COINS', label: 'COINS' },
          { value: 'TIME', label: 'TIME' },
        ],
        valueType: 'string',
      },
      idItemToAdd: {
        options: itemsOptions,
      },
      idWeather: {
        options: weatherRulesOptions,
      },
      idEventNext: {
        options: eventOptions,
      },
    },
    'event-effects': {
      idEvent: {
        options: eventOptions,
      },
      traitsToAdd: {
        options: traitsOptions,
      },
      traitsToRemove: {
        options: traitsOptions,
      },
      idItemTarget: {
        options: itemsOptions,
      },
      targetClass: {
        options: classesOptions,
      },
    },
    items: {
      idCard: {
        options: cardsOptions,
      },
      idClassPermitted: {
        options: classesOptions,
      },
      idClassProhibited: {
        options: classesOptions,
      },
    },
    'item-effects': {
      idItem: {
        options: itemsOptions,
      },
    },
    'class-bonuses': {
      idClass: {
        options: classesOptions,
      },
    },
    traits: {
      idCard: {
        options: cardsOptions,
      },
      idClassPermitted: {
        options: classesOptions,
      },
      idClassProhibited: {
        options: classesOptions,
      },
    },
    classes: {
      idCard: {
        options: cardsOptions,
      },
    },
    creators: {
      idCard: {
        options: cardsOptions,
      },
    },
    keys: {
      idCard: {
        options: cardsOptions,
      },
    },
    cards: {
      idCreator: {
        options: creatorsOptions,
      },
    },
    texts: {
      idCreator: {
        options: creatorsOptions,
      },
    },
    choices: {
      idCard: {
        options: cardsOptions,
      },
      idEvent: {
        options: eventOptions,
      },
      idLocation: {
        options: locationOptions,
      },
      idEventTorun: {
        options: eventOptions,
      },
    },
    'choice-conditions': {
      idChoices: {
        options: choicesOptions,
      },
      key: {
        options: keysOptions,
        valueType: 'string',
      },
    },
    'choice-effects': {
      idCard: {
        options: cardsOptions,
      },
      idChoices: {
        options: choicesOptions,
      },
      idScelta: {
        options: choicesOptions,
      },
      key: {
        options: keysOptions,
        valueType: 'string',
      },
    },
    'weather-rules': {
      idCard: {
        options: cardsOptions,
      },
      idEvent: {
        options: eventOptions,
      },
      conditionKey: {
        options: keysOptions,
        valueType: 'string',
      },
    },
    'global-random-events': {
      idCard: {
        options: cardsOptions,
      },
      idEvent: {
        options: eventOptions,
      },
      conditionKey: {
        options: keysOptions,
        valueType: 'string',
      },
    },
    'mission-steps': {
      idMission: {
        options: missionsOptions,
      },
      idEventCompleted: {
        options: eventOptions,
      },
      conditionKey: {
        options: keysOptions,
        valueType: 'string',
      },
    },
    'location-neighbors': {
      idCard: {
        options: cardsOptions,
      },
      idLocationFrom: {
        options: locationOptions,
      },
      idLocationTo: {
        options: locationOptions,
      },
      conditionRegistryKey: {
        options: keysOptions,
        valueType: 'string',
      },
    },
    missions: {
      idCard: {
        options: cardsOptions,
      },
      conditionKey: {
        options: keysOptions,
        valueType: 'string',
      },
      idEventCompleted: {
        options: eventOptions,
      },
    },
  }

  const getNewEntityDefaults = () => {
    if (activeTab === 'location-neighbors') {
      return {
        direction: LOCATION_NEIGHBOR_DIRECTIONS[0],
        flagBack: 1,
      }
    }
    return null
  }

  const normalizeEntityForForm = (entity, entityTab) => {
    if (!entity) return entity

    const normalizedEntity = { ...entity }
    if (Object.prototype.hasOwnProperty.call(normalizedEntity, 'idCard')
      || Object.prototype.hasOwnProperty.call(normalizedEntity, 'id_card')) {
      const normalizedIdCard = Number(normalizedEntity.idCard ?? normalizedEntity.id_card)
      normalizedEntity.idCard = Number.isFinite(normalizedIdCard) ? normalizedIdCard : ''
      normalizedEntity.id_card = Number.isFinite(normalizedIdCard) ? normalizedIdCard : null
    }

    return normalizedEntity
  }

  return (
    <div className="flex flex-col md:flex-row gap-6 align-item-start">
      {/* Sidebar Tabs */}
      <div className="w-full md:w-64 flex-shrink-0">
        <div className="pg-card sticky top-4" style={{ padding: '0.5rem' }}>
          <nav className="flex flex-col gap-05">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1 px-1 py-1 rounded transition-all text-sm ${activeTab === tab.id ? 'bg-gold-dark/20 text-gold-light' : 'text-ash hover:bg-white/5'
                  }`}
              >
                <i className={`fas ${tab.icon} w-5 text-center`} />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-grow min-w-0">
        <div className="flex items-center justify-between mb-4">
          {success && (
            <div className="pg-alert pg-alert-success position-absolute left-1/2 z-10 px-4">
              <i className="fas fa-check-circle me-2" />{success}
            </div>
          )}
          <h2 className="pg-page-title" style={{ marginBottom: 0 }}>
            {TABS.find(t => t.id === activeTab)?.label}
          </h2>
          {activeTab !== 'metadata' && (
            <button className="pg-btn pg-btn-gold pg-btn-sm" onClick={() => setModal({ type: 'form', entity: null, initialData: getNewEntityDefaults() })}>
              <i className="fas fa-plus me-1" /> Add {TABS.find(t => t.id === activeTab)?.label.slice(0, -1)}
            </button>
          )}
          {activeTab === 'metadata' && (
            <div className="flex gap-2">
              <button type="button" className="pg-btn pg-btn-ghost pg-btn-sm" onClick={handleExportStory}>
                <i className="fas fa-download me-2" /> Export JSON
              </button>
              <button type="submit" form="story-metadata-form" className="pg-btn pg-btn-gold pg-btn-sm">
                <i className="fas fa-save me-2" /> Save Changes
              </button>
            </div>
          )}
          <ErrorAlert message={error} onClose={() => setError('')} />
        </div>

        {activeTab === 'metadata' ? (
          <form id="story-metadata-form" onSubmit={handleUpdateStory} className="pg-card flex flex-col gap-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
              <div>
                <label className="pg-label">Author</label>
                <input className="pg-input" value={story?.author || ''} onChange={e => setStory({ ...story, author: e.target.value })} />
              </div>
              <div>
                <label className="pg-label">Category</label>
                <input className="pg-input" value={story?.category || ''} onChange={e => setStory({ ...story, category: e.target.value })} />
              </div>
              <div>
                <label className="pg-label">Group</label>
                <input className="pg-input" value={story?.group || ''} onChange={e => setStory({ ...story, group: e.target.value })} />
              </div>
              <div>
                <label className="pg-label">Visibility</label>
                <select className="pg-input" value={story?.visibility || 'DRAFT'} onChange={e => setStory({ ...story, visibility: e.target.value })}>
                  <option value="DRAFT">DRAFT</option>
                  <option value="PUBLIC">PUBLIC</option>
                  <option value="PRIVATE">PRIVATE</option>
                </select>
              </div>
              <div>
                <label className="pg-label">Priority</label>
                <input type="number" className="pg-input" value={story?.priority || 0} onChange={e => setStory({ ...story, priority: parseInt(e.target.value) })} />
              </div>
              <div>
                <label className="pg-label">PEGHI</label>
                <input type="number" className="pg-input" value={story?.peghi || 0} onChange={e => setStory({ ...story, peghi: parseInt(e.target.value) })} />
              </div>
              <div>
                <label className="pg-label">Version Min</label>
                <input className="pg-input" value={story?.versionMin || ''} onChange={e => setStory({ ...story, versionMin: e.target.value })} />
              </div>
              <div>
                <label className="pg-label">Version Max</label>
                <input className="pg-input" value={story?.versionMax || ''} onChange={e => setStory({ ...story, versionMax: e.target.value })} />
              </div>
              <div>
                <PathsSelector
                  label="Title Text ID"
                  name="idTextTitle"
                  value={story?.idTextTitle ?? ''}
                  displayValue={getTextDisplay(story?.idTextTitle)}
                  placeholder="No text selected"
                  onOpenSelector={() => setStoryTextSelector({ fieldKey: 'idTextTitle', startMode: 'list' })}
                  onOpenCreator={() => setStoryTextSelector({ fieldKey: 'idTextTitle', startMode: 'input-generator' })}
                  onClear={() => setStory(prev => ({ ...prev, idTextTitle: '' }))}
                />
              </div>
              <div>
                <PathsSelector
                  label="Card ID"
                  name="idCard"
                  value={story?.idCard ?? ''}
                  displayValue={getCardDisplay(story?.idCard)}
                  placeholder="No card selected"
                  onOpenSelector={() => setStoryCardSelectorOpen(true)}
                  onClear={() => setStory(prev => ({ ...prev, idCard: '' }))}
                  showNewButton={false}
                />
              </div>
              <div>
                <PathsSelector
                  label="Start Location ID"
                  name="idLocationStart"
                  value={story?.idLocationStart ?? ''}
                  displayValue={getLocationDisplay(story?.idLocationStart)}
                  placeholder="No location selected"
                  onOpenSelector={() => setStoryStartLocationSelectorOpen(true)}
                  onClear={() => setStory(prev => ({ ...prev, idLocationStart: '' }))}
                  showNewButton={false}
                />
              </div>
              <div>
                <PathsSelector
                  label="Image ID"
                  name="idImage"
                  value={story?.idImage ?? ''}
                  displayValue={getTextDisplay(story?.idImage)}
                  placeholder="No image text selected"
                  onOpenSelector={() => setStoryTextSelector({ fieldKey: 'idImage', startMode: 'list' })}
                  onOpenCreator={() => setStoryTextSelector({ fieldKey: 'idImage', startMode: 'input-generator' })}
                  onClear={() => setStory(prev => ({ ...prev, idImage: '' }))}
                />
              </div>
              <div>
                <PathsSelector
                  label="All-Player Coma Location ID"
                  name="idLocationAllPlayerComa"
                  value={story?.idLocationAllPlayerComa ?? ''}
                  displayValue={getLocationDisplay(story?.idLocationAllPlayerComa)}
                  placeholder="No location selected"
                  onOpenSelector={() => setStoryAllPlayerComaLocationSelectorOpen(true)}
                  onClear={() => setStory(prev => ({ ...prev, idLocationAllPlayerComa: '' }))}
                  showNewButton={false}
                />
              </div>
              <div>
                <PathsSelector
                  label="All-Player Coma Event ID"
                  name="idEventAllPlayerComa"
                  value={story?.idEventAllPlayerComa ?? ''}
                  displayValue={getEventDisplay(story?.idEventAllPlayerComa)}
                  placeholder="No event selected"
                  onOpenSelector={() => setStoryAllPlayerComaEventSelectorOpen(true)}
                  onClear={() => setStory(prev => ({ ...prev, idEventAllPlayerComa: '' }))}
                  showNewButton={false}
                />
              </div>
              <div>
                <PathsSelector
                  label="End Game Event ID"
                  name="idEventEndGame"
                  value={story?.idEventEndGame ?? ''}
                  displayValue={getEventDisplay(story?.idEventEndGame)}
                  placeholder="No event selected"
                  onOpenSelector={() => setStoryEndGameEventSelectorOpen(true)}
                  onClear={() => setStory(prev => ({ ...prev, idEventEndGame: '' }))}
                  showNewButton={false}
                />
              </div>
              <div>
                <PathsSelector
                  label="Clock (singular) Text ID"
                  name="idTextClockSingular"
                  value={story?.idTextClockSingular ?? ''}
                  displayValue={getTextDisplay(story?.idTextClockSingular)}
                  placeholder="No text selected"
                  onOpenSelector={() => setStoryTextSelector({ fieldKey: 'idTextClockSingular', startMode: 'list' })}
                  onOpenCreator={() => setStoryTextSelector({ fieldKey: 'idTextClockSingular', startMode: 'input-generator' })}
                  onClear={() => setStory(prev => ({ ...prev, idTextClockSingular: '' }))}
                />
              </div>
              <div>
                <PathsSelector
                  label="Clock (plural) Text ID"
                  name="idTextClockPlural"
                  value={story?.idTextClockPlural ?? ''}
                  displayValue={getTextDisplay(story?.idTextClockPlural)}
                  placeholder="No text selected"
                  onOpenSelector={() => setStoryTextSelector({ fieldKey: 'idTextClockPlural', startMode: 'list' })}
                  onOpenCreator={() => setStoryTextSelector({ fieldKey: 'idTextClockPlural', startMode: 'input-generator' })}
                  onClear={() => setStory(prev => ({ ...prev, idTextClockPlural: '' }))}
                />
              </div>
              <div>
                <PathsSelector
                  label="Copyright Text ID"
                  name="idTextCopyright"
                  value={story?.idTextCopyright ?? ''}
                  displayValue={getTextDisplay(story?.idTextCopyright)}
                  placeholder="No text selected"
                  onOpenSelector={() => setStoryTextSelector({ fieldKey: 'idTextCopyright', startMode: 'list' })}
                  onOpenCreator={() => setStoryTextSelector({ fieldKey: 'idTextCopyright', startMode: 'input-generator' })}
                  onClear={() => setStory(prev => ({ ...prev, idTextCopyright: '' }))}
                />
              </div>
              <div>
                <label className="pg-label">Copyright Link</label>
                <input className="pg-input" value={story?.linkCopyright || ''} onChange={e => setStory({ ...story, linkCopyright: e.target.value })} />
              </div>
              <div>
                <PathsSelector
                  label="Creator ID"
                  name="idCreator"
                  value={story?.idCreator ?? ''}
                  displayValue={getCreatorDisplay(story?.idCreator)}
                  placeholder="No creator selected"
                  onOpenSelector={() => setStoryCreatorSelectorOpen(true)}
                  onClear={() => setStory(prev => ({ ...prev, idCreator: '' }))}
                  showNewButton={false}
                />
              </div>
            </div>
          </form>
        ) : (
          <EntityTable
            entities={entities}
            columns={COLUMNS[activeTab] || defaultCols}
            texts={texts}
            relationOptionsByField={pathSelectorOptionsByTab[activeTab] || {}}
            onOpenIdCardForm={handleOpenCardFromEntityTable}
            onEdit={(ent) => setModal({ type: 'form', entity: normalizeEntityForForm(ent, activeTab), entityTab: activeTab })}
            onDelete={(ent) => setModal({ type: 'delete', entity: ent, entityTab: activeTab })}
          />
        )}


      </div>

      <FastTextSelectorModal
        open={!!storyTextSelector}
        onClose={() => setStoryTextSelector(null)}
        texts={texts}
        selectedId={storyTextSelector ? story?.[storyTextSelector.fieldKey] : ''}
        storyOptions={storyOptions}
        storyUuid={uuid}
        onSaveFastText={handleSaveFastText}
        startMode={storyTextSelector?.startMode || 'list'}
        onSelect={(idText) => {
          if (!storyTextSelector) return
          setStoryTextField(storyTextSelector.fieldKey, idText)
          setStoryTextSelector(null)
        }}
      />

      <PathsOptionsSelectorModal
        open={storyCardSelectorOpen}
        onClose={() => setStoryCardSelectorOpen(false)}
        selectedValue={story?.idCard ?? ''}
        title="Select Card"
        searchPlaceholder="Search by id or label"
        options={cardsOptions}
        onSelect={(value) => {
          const numericValue = Number(value)
          setStory(prev => ({ ...prev, idCard: Number.isFinite(numericValue) ? numericValue : '' }))
          setStoryCardSelectorOpen(false)
        }}
      />

      <PathsOptionsSelectorModal
        open={storyCreatorSelectorOpen}
        onClose={() => setStoryCreatorSelectorOpen(false)}
        selectedValue={story?.idCreator ?? ''}
        title="Select Creator"
        searchPlaceholder="Search by id or label"
        options={creatorsOptions}
        onSelect={(value) => {
          const numericValue = Number(value)
          setStory(prev => ({ ...prev, idCreator: Number.isFinite(numericValue) ? numericValue : '' }))
          setStoryCreatorSelectorOpen(false)
        }}
      />

      <PathsOptionsSelectorModal
        open={storyStartLocationSelectorOpen}
        onClose={() => setStoryStartLocationSelectorOpen(false)}
        selectedValue={story?.idLocationStart ?? ''}
        title="Select Start Location"
        searchPlaceholder="Search by id or label"
        options={locationOptions}
        onSelect={(value) => {
          const numericValue = Number(value)
          setStory(prev => ({ ...prev, idLocationStart: Number.isFinite(numericValue) ? numericValue : '' }))
          setStoryStartLocationSelectorOpen(false)
        }}
      />

      <PathsOptionsSelectorModal
        open={storyAllPlayerComaLocationSelectorOpen}
        onClose={() => setStoryAllPlayerComaLocationSelectorOpen(false)}
        selectedValue={story?.idLocationAllPlayerComa ?? ''}
        title="Select All-Player Coma Location"
        searchPlaceholder="Search by id or label"
        options={locationOptions}
        onSelect={(value) => {
          const numericValue = Number(value)
          setStory(prev => ({ ...prev, idLocationAllPlayerComa: Number.isFinite(numericValue) ? numericValue : '' }))
          setStoryAllPlayerComaLocationSelectorOpen(false)
        }}
      />

      <PathsOptionsSelectorModal
        open={storyAllPlayerComaEventSelectorOpen}
        onClose={() => setStoryAllPlayerComaEventSelectorOpen(false)}
        selectedValue={story?.idEventAllPlayerComa ?? ''}
        title="Select All-Player Coma Event"
        searchPlaceholder="Search by id or label"
        options={eventOptions}
        onSelect={(value) => {
          const numericValue = Number(value)
          setStory(prev => ({ ...prev, idEventAllPlayerComa: Number.isFinite(numericValue) ? numericValue : '' }))
          setStoryAllPlayerComaEventSelectorOpen(false)
        }}
      />

      <PathsOptionsSelectorModal
        open={storyEndGameEventSelectorOpen}
        onClose={() => setStoryEndGameEventSelectorOpen(false)}
        selectedValue={story?.idEventEndGame ?? ''}
        title="Select End Game Event"
        searchPlaceholder="Search by id or label"
        options={eventOptions}
        onSelect={(value) => {
          const numericValue = Number(value)
          setStory(prev => ({ ...prev, idEventEndGame: Number.isFinite(numericValue) ? numericValue : '' }))
          setStoryEndGameEventSelectorOpen(false)
        }}
      />

      {modal?.type === 'form' && (
        <EntityForm
          entity={modal.entity}
          initialData={modal.initialData}
          fields={FIELDS[modal?.entityTab || activeTab] || [{ key: 'idTextName', label: 'Name Text ID', type: 'number' }]}
          onSave={handleSaveEntity}
          onCancel={() => setModal(null)}
          storyUuid={uuid}
          storyOptions={storyOptions}
          texts={texts}
          onSaveFastText={handleSaveFastText}
          onCreateFastCard={handleCreateFastCard}
          pathSelectorOptions={pathSelectorOptionsByTab[modal?.entityTab || activeTab] || {}}
        />
      )}

      {modal?.type === 'delete' && (
        <ConfirmModal
          title={`Delete ${activeTab.slice(0, -1)}`}
          message={`Are you sure you want to delete this ${activeTab.slice(0, -1)}?`}
          onConfirm={handleDeleteEntity}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  )
}
