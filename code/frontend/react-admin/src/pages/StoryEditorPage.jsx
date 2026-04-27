import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getStory, listEntities, updateStory, deleteEntity, createEntity, updateEntity } from '../api/storyApi'
import LoadingSpinner from '../components/common/LoadingSpinner'
import ErrorAlert from '../components/common/ErrorAlert'
import EntityTable from '../components/common/EntityTable'
import EntityForm from '../components/common/EntityForm'
import ConfirmModal from '../components/common/ConfirmModal'

const TABS = [
  { id: 'metadata', label: 'Story Info', icon: 'fa-info-circle' },
  { id: 'difficulties', label: 'Difficulties', icon: 'fa-layer-group' },
  { id: 'locations', label: 'Locations', icon: 'fa-map-marker-alt' },
  { id: 'location-neighbors', label: 'Loc Neighbors', icon: 'fa-project-diagram' },
  { id: 'events', label: 'Events', icon: 'fa-bolt' },
  { id: 'event-effects', label: 'Event Effects', icon: 'fa-magic' },
  { id: 'items', label: 'Items', icon: 'fa-flask' },
  { id: 'item-effects', label: 'Item Effects', icon: 'fa-cogs' },
  { id: 'character-templates', label: 'Templates', icon: 'fa-user-tag' },
  { id: 'classes', label: 'Classes', icon: 'fa-hat-wizard' },
  { id: 'class-bonuses', label: 'Class Bonuses', icon: 'fa-star-half-alt' },
  { id: 'traits', label: 'Traits', icon: 'fa-star' },
  { id: 'creators', label: 'Creators', icon: 'fa-paint-brush' },
  { id: 'cards', label: 'Cards', icon: 'fa-id-card' },
  { id: 'texts', label: 'Texts', icon: 'fa-font' },
  { id: 'keys', label: 'Keys', icon: 'fa-key' },
  { id: 'choices', label: 'Choices', icon: 'fa-code-branch' },
  { id: 'choice-conditions', label: 'Choice Cond.', icon: 'fa-filter' },
  { id: 'choice-effects', label: 'Choice Effects', icon: 'fa-random' },
  { id: 'weather-rules', label: 'Weather Rules', icon: 'fa-cloud-sun' },
  { id: 'global-random-events', label: 'Random Events', icon: 'fa-dice' },
  { id: 'missions', label: 'Missions', icon: 'fa-tasks' },
  { id: 'mission-steps', label: 'Mission Steps', icon: 'fa-list-ol' },
]

export default function StoryEditorPage() {
  const { uuid } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('metadata')
  const [story, setStory] = useState(null)
  const [entities, setEntities] = useState([])
  const [texts, setTexts] = useState([]) // All texts for resolution
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [modal, setModal] = useState(null) // { type, entity }

  const loadStory = async () => {
    try {
      const data = await getStory(uuid)
      setStory(data)
      const txts = await listEntities(uuid, 'texts')
      setTexts(txts)
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
    const { entity } = modal
    setModal(null)
    try {
      await deleteEntity(uuid, activeTab, entity.uuid)
      setSuccess(`${activeTab} entity deleted`)
      loadEntities()
      if (activeTab === 'texts') {
        const txts = await listEntities(uuid, 'texts')
        setTexts(txts)
      }
    } catch (e) { setError(e.message) }
  }

  const handleSaveEntity = async (data) => {
    try {
      if (modal.entity) {
        await updateEntity(uuid, activeTab, modal.entity.uuid, data)
      } else {
        await createEntity(uuid, activeTab, data)
      }
      setSuccess(`${activeTab} saved`)
      setModal(null)
      loadEntities()
      if (activeTab === 'texts') {
        const txts = await listEntities(uuid, 'texts')
        setTexts(txts)
      }
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) { setError(e.message) }
  }

  if (loading) return <LoadingSpinner text="Loading story data..." />

  // Column definitions for each entity type
  const COLUMNS = {
    difficulties: [
      { key: 'idTextName', label: 'Name', type: 'idTextName' },
      { key: 'expCost', label: 'EXP Cost' },
      { key: 'maxWeight', label: 'Max Weight' },
      { key: 'minCharacter', label: 'Min Chars' },
      { key: 'maxCharacter', label: 'Max Chars' },
      { key: 'costHelpComa', label: 'Help COMA' },
      { key: 'costMaxCharacteristics', label: 'Max Char Cost' },
      { key: 'numberMaxFreeAction', label: 'Max Free Actions' },
    ],
    locations: [
      { key: 'idTextName', label: 'Name', type: 'idTextName' },
      { key: 'idTextDescription', label: 'Desc', type: 'idTextDescription' },
      { key: 'isSafe', label: 'Safe', render: e => e.isSafe ? 'Yes' : 'No' },
      { key: 'idImage', label: 'Image' },
      { key: 'maxCharacters', label: 'Max Chars' },
    ],
    'location-neighbors': [
      { key: 'idLocationFrom', label: 'From' },
      { key: 'idLocationTo', label: 'To' },
      { key: 'direction', label: 'Direction' },
      { key: 'flagBack', label: 'Back' },
    ],
    events: [
      { key: 'idTextName', label: 'Name', type: 'idTextName' },
      { key: 'type', label: 'Type' },
      { key: 'costEnery', label: 'Energy Cost' },
      { key: 'flagEndTime', label: 'End Time' },
      { key: 'coinCost', label: 'Coin Cost' },
    ],
    'event-effects': [
      { key: 'idEvent', label: 'Event ID' },
      { key: 'statistics', label: 'Statistic' },
      { key: 'value', label: 'Value' },
      { key: 'target', label: 'Target' },
    ],
    items: [
      { key: 'idTextName', label: 'Name', type: 'idTextName' },
      { key: 'weight', label: 'Weight' },
      { key: 'isConsumabile', label: 'Consumable' },
      { key: 'idClassPermitted', label: 'Class Permitted' },
      { key: 'idClassProhibited', label: 'Class Prohibited' },
    ],
    'item-effects': [
      { key: 'idItem', label: 'Item ID' },
      { key: 'effectCode', label: 'Effect Code' },
      { key: 'effectValue', label: 'Value' },
    ],
    'character-templates': [
      { key: 'idTextName', label: 'Name', type: 'idTextName' },
      { key: 'lifeMax', label: 'Max Life' },
      { key: 'energyMax', label: 'Max Energy' },
      { key: 'sadMax', label: 'Max Sad' },
      { key: 'dexterityStart', label: 'Dex Start' },
      { key: 'intelligenceStart', label: 'Int Start' },
      { key: 'constitutionStart', label: 'Con Start' },
    ],
    classes: [
      { key: 'idTextName', label: 'Name', type: 'idTextName' },
      { key: 'weightMax', label: 'Max Weight' },
      { key: 'dexterityBase', label: 'Dex Base' },
      { key: 'intelligenceBase', label: 'Int Base' },
      { key: 'constitutionBase', label: 'Con Base' },
    ],
    'class-bonuses': [
      { key: 'idClass', label: 'Class ID' },
      { key: 'statistic', label: 'Statistic' },
      { key: 'value', label: 'Value' },
    ],
    traits: [
      { key: 'idTextName', label: 'Name', type: 'idTextName' },
      { key: 'costPositive', label: 'Cost (+)' },
      { key: 'costNegative', label: 'Cost (-)' },
      { key: 'idClassPermitted', label: 'Class Permitted' },
      { key: 'idClassProhibited', label: 'Class Prohibited' },
    ],
    creators: [
      { key: 'idTextName', label: 'Name', type: 'idTextName' },
      { key: 'link', label: 'Link' },
      { key: 'url', label: 'URL' },
      { key: 'urlEmote', label: 'Emote URL' },
      { key: 'urlInstagram', label: 'Instagram URL' },
    ],
    cards: [
      { key: 'idTextName', label: 'Title', type: 'idTextName' },
      { key: 'idTextTitle', label: 'Title Text ID' },
      { key: 'urlImmage', label: 'Image URL' },
      { key: 'awesomeIcon', label: 'Icon' },
      { key: 'idCreator', label: 'Creator' },
    ],
    texts: [
      { key: 'idText', label: 'ID Text', render: e => <span className="font-mono text-gold-dark">#{e.idText}</span> },
      { key: 'lang', label: 'Lang', render: e => <span className="pg-badge pg-badge-info">{e.lang}</span> },
      { key: 'shortText', label: 'Short Text' },
      { key: 'longText', label: 'Long Text', render: e => e.longText ? <i className="fas fa-file-alt text-ash" title={e.longText} /> : '—' },
      { key: 'idTextCopyright', label: 'Copyright ID' },
      { key: 'idCreator', label: 'Creator ID' },
    ],
    keys: [
      { key: 'name', label: 'Name' },
      { key: 'value', label: 'Value' },
      { key: 'group', label: 'Group' },
      { key: 'priority', label: 'Priority' },
      { key: 'visibility', label: 'Visibility' },
    ],
    choices: [
      { key: 'idEvent', label: 'Event ID' },
      { key: 'idLocation', label: 'Location ID' },
      { key: 'priority', label: 'Priority' },
      { key: 'idTextNarrative', label: 'Narrative Text ID' },
      { key: 'logicOperator', label: 'Logic Op.' },
    ],
    'choice-conditions': [
      { key: 'idChoices', label: 'Choice ID' },
      { key: 'type', label: 'Type' },
      { key: 'key', label: 'Key' },
      { key: 'value', label: 'Value' },
      { key: 'operator', label: 'Operator' },
    ],
    'choice-effects': [
      { key: 'idChoices', label: 'Choice ID' },
      { key: 'statistics', label: 'Statistic' },
      { key: 'value', label: 'Value' },
      { key: 'key', label: 'Key' },
    ],
    'weather-rules': [
      { key: 'probability', label: 'Probability' },
      { key: 'conditionKey', label: 'Condition Key' },
      { key: 'timeFrom', label: 'Time From' },
      { key: 'timeTo', label: 'Time To' },
      { key: 'deltaEnergy', label: 'Delta Energy' },
    ],
    'global-random-events': [
      { key: 'conditionKey', label: 'Condition Key' },
      { key: 'conditionValue', label: 'Condition Value' },
      { key: 'probability', label: 'Probability' },
      { key: 'idEvent', label: 'Event ID' },
    ],
    missions: [
      { key: 'idTextName', label: 'Name', type: 'idTextName' },
      { key: 'conditionKey', label: 'Condition Key' },
      { key: 'idEventCompleted', label: 'Completed Event' },
    ],
    'mission-steps': [
      { key: 'idMission', label: 'Mission ID' },
      { key: 'step', label: 'Step' },
      { key: 'conditionKey', label: 'Condition Key' },
      { key: 'idEventCompleted', label: 'Completed Event' },
    ],
  }

  const FIELDS = {
    difficulties: [
      { key: 'idTextName', label: 'Name Text ID', type: 'number' },
      { key: 'idTextDescription', label: 'Desc Text ID', type: 'number' },
      { key: 'expCost', label: 'EXP Cost', type: 'number' },
      { key: 'maxWeight', label: 'Max Weight', type: 'number' },
      { key: 'minCharacter', label: 'Min Characters', type: 'number' },
      { key: 'maxCharacter', label: 'Max Characters', type: 'number' },
      { key: 'costHelpComa', label: 'Cost Help Coma', type: 'number' },
      { key: 'costMaxCharacteristics', label: 'Cost Max Characteristics', type: 'number' },
      { key: 'numberMaxFreeAction', label: 'Max Free Actions', type: 'number' },
    ],
    locations: [
      { key: 'idTextName', label: 'Name Text ID', type: 'number' },
      { key: 'idTextDescription', label: 'Desc Text ID', type: 'number' },
      { key: 'idTextNarrative', label: 'Narrative Text ID', type: 'number' },
      { key: 'idImage', label: 'Image ID', type: 'number' },
      { key: 'isSafe', label: 'Safe Location', type: 'checkbox' },
      { key: 'costEnergyEnter', label: 'Energy Cost to Enter', type: 'number' },
      { key: 'counterTime', label: 'Counter Time', type: 'number' },
      { key: 'idEventIfCounterZero', label: 'Event if Counter = 0', type: 'number' },
      { key: 'secureParam', label: 'Secure Param', type: 'number' },
      { key: 'idEventIfCharacterStartTime', label: 'Event if Start Time', type: 'number' },
      { key: 'idEventIfCharacterEnterFirstTime', label: 'Event if Enter First', type: 'number' },
      { key: 'idEventIfFirstTime', label: 'Event if First Time', type: 'number' },
      { key: 'idEventNotFirstTime', label: 'Event if Not First Time', type: 'number' },
      { key: 'priorityAutomaticEvent', label: 'Auto Event Priority', type: 'number' },
      { key: 'idAudio', label: 'Audio ID', type: 'number' },
      { key: 'maxCharacters', label: 'Max Characters', type: 'number' },
    ],
    'location-neighbors': [
      { key: 'idLocationFrom', label: 'Location From ID', type: 'number' },
      { key: 'idLocationTo', label: 'Location To ID', type: 'number' },
      { key: 'direction', label: 'Direction', type: 'text' },
      { key: 'flagBack', label: 'Flag Back', type: 'number' },
      { key: 'conditionRegistryKey', label: 'Condition Registry Key', type: 'text' },
      { key: 'conditionRegistryValue', label: 'Condition Registry Value', type: 'text' },
      { key: 'energyCost', label: 'Energy Cost', type: 'number' },
      { key: 'idTextGo', label: 'Text Go ID', type: 'number' },
      { key: 'idTextBack', label: 'Text Back ID', type: 'number' },
    ],
    events: [
      { key: 'idTextName', label: 'Name Text ID', type: 'number' },
      { key: 'idTextDescription', label: 'Desc Text ID', type: 'number' },
      { key: 'idSpecificLocation', label: 'Specific Location ID', type: 'number' },
      { key: 'type', label: 'Event Type', type: 'text' },
      { key: 'costEnery', label: 'Energy Cost', type: 'number' },
      { key: 'flagEndTime', label: 'Flag End Time', type: 'number' },
      { key: 'characteristicToAdd', label: 'Characteristic to Add', type: 'text' },
      { key: 'characteristicToRemove', label: 'Characteristic to Remove', type: 'text' },
      { key: 'keyToAdd', label: 'Key to Add', type: 'text' },
      { key: 'keyValueToAdd', label: 'Key Value to Add', type: 'text' },
      { key: 'idItemToAdd', label: 'Item to Add ID', type: 'number' },
      { key: 'idWeather', label: 'Weather ID', type: 'number' },
      { key: 'idEventNext', label: 'Next Event ID', type: 'number' },
      { key: 'coinCost', label: 'Coin Cost', type: 'number' },
    ],
    'event-effects': [
      { key: 'idEvent', label: 'Event ID', type: 'number' },
      { key: 'statistics', label: 'Statistic', type: 'text' },
      { key: 'value', label: 'Value', type: 'number' },
      { key: 'target', label: 'Target', type: 'text' },
      { key: 'traitsToAdd', label: 'Traits to Add', type: 'text' },
      { key: 'traitsToRemove', label: 'Traits to Remove', type: 'text' },
      { key: 'targetClass', label: 'Target Class', type: 'text' },
      { key: 'idItemTarget', label: 'Item Target ID', type: 'number' },
      { key: 'itemAction', label: 'Item Action', type: 'text' },
    ],
    items: [
      { key: 'idTextName', label: 'Name Text ID', type: 'number' },
      { key: 'idTextDescription', label: 'Desc Text ID', type: 'number' },
      { key: 'weight', label: 'Weight', type: 'number' },
      { key: 'isConsumabile', label: 'Consumable', type: 'checkbox' },
      { key: 'idClassPermitted', label: 'Class Permitted ID', type: 'number' },
      { key: 'idClassProhibited', label: 'Class Prohibited ID', type: 'number' },
    ],
    'item-effects': [
      { key: 'idItem', label: 'Item ID', type: 'number' },
      { key: 'effectCode', label: 'Effect Code', type: 'text' },
      { key: 'effectValue', label: 'Effect Value', type: 'number' },
    ],
    'character-templates': [
      { key: 'idTextName', label: 'Name Text ID', type: 'number' },
      { key: 'idTextDescription', label: 'Desc Text ID', type: 'number' },
      { key: 'lifeMax', label: 'Max Life', type: 'number' },
      { key: 'energyMax', label: 'Max Energy', type: 'number' },
      { key: 'sadMax', label: 'Max Sad', type: 'number' },
      { key: 'dexterityStart', label: 'Dexterity Start', type: 'number' },
      { key: 'intelligenceStart', label: 'Intelligence Start', type: 'number' },
      { key: 'constitutionStart', label: 'Constitution Start', type: 'number' },
    ],
    classes: [
      { key: 'idTextName', label: 'Name Text ID', type: 'number' },
      { key: 'idTextDescription', label: 'Desc Text ID', type: 'number' },
      { key: 'weightMax', label: 'Max Weight', type: 'number' },
      { key: 'dexterityBase', label: 'Dexterity Base', type: 'number' },
      { key: 'intelligenceBase', label: 'Intelligence Base', type: 'number' },
      { key: 'constitutionBase', label: 'Constitution Base', type: 'number' },
    ],
    'class-bonuses': [
      { key: 'idClass', label: 'Class ID', type: 'number' },
      { key: 'statistic', label: 'Statistic', type: 'text' },
      { key: 'value', label: 'Value', type: 'number' },
    ],
    traits: [
      { key: 'idTextName', label: 'Name Text ID', type: 'number' },
      { key: 'idTextDescription', label: 'Desc Text ID', type: 'number' },
      { key: 'costPositive', label: 'Positive Cost', type: 'number' },
      { key: 'costNegative', label: 'Negative Cost', type: 'number' },
      { key: 'idClassPermitted', label: 'Class Permitted ID', type: 'number' },
      { key: 'idClassProhibited', label: 'Class Prohibited ID', type: 'number' },
    ],
    creators: [
      { key: 'idTextName', label: 'Name Text ID', type: 'number' },
      { key: 'idText', label: 'Text ID', type: 'number' },
      { key: 'link', label: 'Link', type: 'text' },
      { key: 'url', label: 'URL', type: 'text' },
      { key: 'urlImage', label: 'Image URL', type: 'text' },
      { key: 'urlEmote', label: 'Emote URL', type: 'text' },
      { key: 'urlInstagram', label: 'Instagram URL', type: 'text' },
    ],
    cards: [
      { key: 'idTextName', label: 'Name Text ID', type: 'number' },
      { key: 'idTextTitle', label: 'Title Text ID', type: 'number' },
      { key: 'idTextDescription', label: 'Desc Text ID', type: 'number' },
      { key: 'idTextCopyright', label: 'Copyright Text ID', type: 'number' },
      { key: 'linkCopyright', label: 'Copyright Link', type: 'text' },
      { key: 'idCreator', label: 'Creator ID', type: 'number' },
      { key: 'urlImmage', label: 'Image URL', type: 'text' },
      { key: 'alternativeImage', label: 'Alternative Image', type: 'text' },
      { key: 'awesomeIcon', label: 'Awesome Icon', type: 'text' },
      { key: 'styleMain', label: 'Style Main', type: 'text' },
      { key: 'styleDetail', label: 'Style Detail', type: 'text' },
    ],
    texts: [
      { key: 'idText', label: 'Text ID', type: 'number' },
      { key: 'lang', label: 'Language', type: 'text' },
      { key: 'shortText', label: 'Short Text', type: 'text' },
      { key: 'longText', label: 'Long Text', type: 'textarea' },
      { key: 'idTextCopyright', label: 'Copyright Text ID', type: 'number' },
      { key: 'linkCopyright', label: 'Copyright Link', type: 'text' },
      { key: 'idCreator', label: 'Creator ID', type: 'number' },
    ],
    keys: [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'value', label: 'Value', type: 'text' },
      { key: 'group', label: 'Group', type: 'text' },
      { key: 'priority', label: 'Priority', type: 'number' },
      { key: 'visibility', label: 'Visibility', type: 'text' },
    ],
    choices: [
      { key: 'idEvent', label: 'Event ID', type: 'number' },
      { key: 'idLocation', label: 'Location ID', type: 'number' },
      { key: 'priority', label: 'Priority', type: 'number' },
      { key: 'idTextNarrative', label: 'Narrative Text ID', type: 'number' },
      { key: 'idEventTorun', label: 'Event to Run ID', type: 'number' },
      { key: 'limitSad', label: 'Sad Limit', type: 'number' },
      { key: 'limitDex', label: 'Dex Limit', type: 'number' },
      { key: 'limitInt', label: 'Int Limit', type: 'number' },
      { key: 'limitCos', label: 'Cos Limit', type: 'number' },
      { key: 'otherwiseFlag', label: 'Otherwise Flag', type: 'number' },
      { key: 'isProgress', label: 'Is Progress', type: 'number' },
      { key: 'logicOperator', label: 'Logic Operator', type: 'text' },
    ],
    'choice-conditions': [
      { key: 'idChoices', label: 'Choice ID', type: 'number' },
      { key: 'type', label: 'Type', type: 'text' },
      { key: 'key', label: 'Key', type: 'text' },
      { key: 'value', label: 'Value', type: 'text' },
      { key: 'operator', label: 'Operator', type: 'text' },
    ],
    'choice-effects': [
      { key: 'idChoices', label: 'Choice ID', type: 'number' },
      { key: 'idScelta', label: 'Scelta ID', type: 'number' },
      { key: 'flagGroup', label: 'Flag Group', type: 'number' },
      { key: 'statistics', label: 'Statistic', type: 'text' },
      { key: 'value', label: 'Value', type: 'number' },
      { key: 'idText', label: 'Text ID', type: 'number' },
      { key: 'key', label: 'Key', type: 'text' },
      { key: 'valueToAdd', label: 'Value to Add', type: 'text' },
      { key: 'valueToRemove', label: 'Value to Remove', type: 'text' },
    ],
    'weather-rules': [
      { key: 'probability', label: 'Probability', type: 'number' },
      { key: 'costMoveSafeLocation', label: 'Cost Move Safe', type: 'number' },
      { key: 'costMoveNotSafeLocation', label: 'Cost Move Not Safe', type: 'number' },
      { key: 'conditionKey', label: 'Condition Key', type: 'text' },
      { key: 'conditionKeyValue', label: 'Condition Key Value', type: 'text' },
      { key: 'timeFrom', label: 'Time From', type: 'number' },
      { key: 'timeTo', label: 'Time To', type: 'number' },
      { key: 'idText', label: 'Text ID', type: 'number' },
      { key: 'active', label: 'Active', type: 'number' },
      { key: 'priority', label: 'Priority', type: 'number' },
      { key: 'deltaEnergy', label: 'Delta Energy', type: 'number' },
      { key: 'idEvent', label: 'Event ID', type: 'number' },
    ],
    'global-random-events': [
      { key: 'conditionKey', label: 'Condition Key', type: 'text' },
      { key: 'conditionValue', label: 'Condition Value', type: 'text' },
      { key: 'probability', label: 'Probability', type: 'number' },
      { key: 'idText', label: 'Text ID', type: 'number' },
      { key: 'idEvent', label: 'Event ID', type: 'number' },
    ],
    missions: [
      { key: 'idTextName', label: 'Name Text ID', type: 'number' },
      { key: 'idTextDescription', label: 'Desc Text ID', type: 'number' },
      { key: 'conditionKey', label: 'Condition Key', type: 'text' },
      { key: 'conditionValueFrom', label: 'Condition Value From', type: 'number' },
      { key: 'conditionValueTo', label: 'Condition Value To', type: 'number' },
      { key: 'idEventCompleted', label: 'Completed Event ID', type: 'number' },
    ],
    'mission-steps': [
      { key: 'idMission', label: 'Mission ID', type: 'number' },
      { key: 'step', label: 'Step Number', type: 'number' },
      { key: 'idTextName', label: 'Name Text ID', type: 'number' },
      { key: 'idTextDescription', label: 'Desc Text ID', type: 'number' },
      { key: 'conditionKey', label: 'Condition Key', type: 'text' },
      { key: 'conditionValueFrom', label: 'Condition Value From', type: 'number' },
      { key: 'conditionValueTo', label: 'Condition Value To', type: 'number' },
      { key: 'idEventCompleted', label: 'Completed Event ID', type: 'number' },
    ],
  }

  const defaultCols = [
    { key: 'idTextName', label: 'Name', type: 'idTextName' },
    { key: 'uuid', label: 'UUID', render: e => <small className="text-white/20">{e.uuid?.slice(0, 8)}...</small> }
  ]

  return (
    <div className="flex flex-col md:flex-row gap-6">
      {/* Sidebar Tabs */}
      <div className="w-full md:w-64 flex-shrink-0">
        <div className="pg-card sticky top-4" style={{ padding: '0.5rem' }}>
          <div className="mb-4 p-3 border-b border-white/5">
            <button className="pg-btn pg-btn-ghost pg-btn-sm w-full justify-start mb-2" onClick={() => navigate('/stories')}>
              <i className="fas fa-arrow-left me-2" /> Back to list
            </button>
            <h3 className="pg-card-title text-gold-dark" style={{ fontSize: '0.9rem' }}>
              Editing Story
            </h3>
            <p className="text-xs text-white/40 truncate" title={uuid}>{uuid}</p>
          </div>
          <nav className="flex flex-col gap-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 px-3 py-2 rounded transition-all text-sm ${
                  activeTab === tab.id ? 'bg-gold-dark/20 text-gold-light' : 'text-ash hover:bg-white/5'
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
        <ErrorAlert message={error} onClose={() => setError('')} />
        {success && (
          <div className="pg-alert pg-alert-success mb-4">
            <i className="fas fa-check-circle me-2" />{success}
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <h2 className="pg-page-title" style={{ marginBottom: 0 }}>
            {TABS.find(t => t.id === activeTab)?.label}
          </h2>
          {activeTab !== 'metadata' && (
            <button className="pg-btn pg-btn-gold pg-btn-sm" onClick={() => setModal({ type: 'form', entity: null })}>
              <i className="fas fa-plus me-1" /> Add {TABS.find(t => t.id === activeTab)?.label.slice(0, -1)}
            </button>
          )}
        </div>

        {activeTab === 'metadata' ? (
          <form onSubmit={handleUpdateStory} className="pg-card flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="pg-label">Author</label>
                <input className="pg-input" value={story?.author || ''} onChange={e => setStory({...story, author: e.target.value})} />
              </div>
              <div>
                <label className="pg-label">Category</label>
                <input className="pg-input" value={story?.category || ''} onChange={e => setStory({...story, category: e.target.value})} />
              </div>
              <div>
                <label className="pg-label">Group</label>
                <input className="pg-input" value={story?.group || ''} onChange={e => setStory({...story, group: e.target.value})} />
              </div>
              <div>
                <label className="pg-label">Visibility</label>
                <select className="pg-input" value={story?.visibility || 'DRAFT'} onChange={e => setStory({...story, visibility: e.target.value})}>
                  <option value="DRAFT">DRAFT</option>
                  <option value="PUBLIC">PUBLIC</option>
                  <option value="PRIVATE">PRIVATE</option>
                </select>
              </div>
              <div>
                <label className="pg-label">Priority</label>
                <input type="number" className="pg-input" value={story?.priority || 0} onChange={e => setStory({...story, priority: parseInt(e.target.value)})} />
              </div>
              <div>
                <label className="pg-label">PEGHI</label>
                <input type="number" className="pg-input" value={story?.peghi || 0} onChange={e => setStory({...story, peghi: parseInt(e.target.value)})} />
              </div>
              <div>
                <label className="pg-label">Version Min</label>
                <input className="pg-input" value={story?.versionMin || ''} onChange={e => setStory({...story, versionMin: e.target.value})} />
              </div>
              <div>
                <label className="pg-label">Version Max</label>
                <input className="pg-input" value={story?.versionMax || ''} onChange={e => setStory({...story, versionMax: e.target.value})} />
              </div>
              <div>
                <label className="pg-label">Title Text ID</label>
                <input type="number" className="pg-input" value={story?.idTextTitle || ''} onChange={e => setStory({...story, idTextTitle: parseInt(e.target.value)})} />
              </div>
              <div>
                <label className="pg-label">Start Location ID</label>
                <input type="number" className="pg-input" value={story?.idLocationStart || ''} onChange={e => setStory({...story, idLocationStart: parseInt(e.target.value)})} />
              </div>
              <div>
                <label className="pg-label">Image ID</label>
                <input type="number" className="pg-input" value={story?.idImage || ''} onChange={e => setStory({...story, idImage: parseInt(e.target.value)})} />
              </div>
              <div>
                <label className="pg-label">All-Player Coma Location ID</label>
                <input type="number" className="pg-input" value={story?.idLocationAllPlayerComa || ''} onChange={e => setStory({...story, idLocationAllPlayerComa: parseInt(e.target.value)})} />
              </div>
              <div>
                <label className="pg-label">All-Player Coma Event ID</label>
                <input type="number" className="pg-input" value={story?.idEventAllPlayerComa || ''} onChange={e => setStory({...story, idEventAllPlayerComa: parseInt(e.target.value)})} />
              </div>
              <div>
                <label className="pg-label">End Game Event ID</label>
                <input type="number" className="pg-input" value={story?.idEventEndGame || ''} onChange={e => setStory({...story, idEventEndGame: parseInt(e.target.value)})} />
              </div>
              <div>
                <label className="pg-label">Clock (singular)</label>
                <input className="pg-input" value={story?.clockSingularDescription || ''} onChange={e => setStory({...story, clockSingularDescription: e.target.value})} />
              </div>
              <div>
                <label className="pg-label">Clock (plural)</label>
                <input className="pg-input" value={story?.clockPluralDescription || ''} onChange={e => setStory({...story, clockPluralDescription: e.target.value})} />
              </div>
              <div>
                <label className="pg-label">Copyright Text ID</label>
                <input type="number" className="pg-input" value={story?.idTextCopyright || ''} onChange={e => setStory({...story, idTextCopyright: parseInt(e.target.value)})} />
              </div>
              <div>
                <label className="pg-label">Copyright Link</label>
                <input className="pg-input" value={story?.linkCopyright || ''} onChange={e => setStory({...story, linkCopyright: e.target.value})} />
              </div>
              <div>
                <label className="pg-label">Creator ID</label>
                <input type="number" className="pg-input" value={story?.idCreator || ''} onChange={e => setStory({...story, idCreator: parseInt(e.target.value)})} />
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button type="submit" className="pg-btn pg-btn-gold px-8">
                <i className="fas fa-save me-2" /> Save Changes
              </button>
            </div>
          </form>
        ) : (
          <EntityTable
            entities={entities}
            columns={COLUMNS[activeTab] || defaultCols}
            texts={texts}
            onEdit={(ent) => setModal({ type: 'form', entity: ent })}
            onDelete={(ent) => setModal({ type: 'delete', entity: ent })}
          />
        )}
      </div>

      {modal?.type === 'form' && (
        <EntityForm
          entity={modal.entity}
          fields={FIELDS[activeTab] || [{ key: 'idTextName', label: 'Name Text ID', type: 'number' }]}
          onSave={handleSaveEntity}
          onCancel={() => setModal(null)}
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
