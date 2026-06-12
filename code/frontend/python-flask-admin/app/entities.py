"""Story sub-entity metadata — Python port of react-admin
``src/constants/story/storiesEntities.jsx`` + ``storyFieldOptions.js`` +
``locationNeighbors.js``.

Drives the Story Editor: which tabs exist, which columns each table shows, and
which fields each create/edit form renders (with type + select options).
"""


def _opts(values):
    return [{"value": v, "label": v} for v in values]


# --- option lists (storyFieldOptions.js) ---
CARD_TYPE_OPTIONS = _opts([
    "story", "difficulty", "creator", "card", "text", "key", "class",
    "classBonus", "trait", "character", "location", "locationNeighbor",
    "item", "itemEffect", "event", "eventEffect", "choice", "choiceCondition",
    "choiceEffect", "weatherRule", "globalRandomEvent", "mission", "missionStep",
])
EVENT_TYPE_OPTIONS = _opts(["AUTOMATIC", "FIRST", "NORMAL"])
EVENT_EFFECT_TARGET_OPTIONS = _opts(["ALL", "ONLY_ONE"])
POSSIBLE_STATISTICS_OPTIONS = _opts([
    "LIFE", "ENERGY", "SAD", "DEXTERITY", "INTELLIGENCE", "CONSTITUTION", "COINS", "TIME",
])
ITEM_ACTION_OPTIONS = _opts(["REMOVE", "ADD"])
LOGIC_OPERATOR_OPTIONS = _opts(["AND", "OR"])
CHOICE_CONDITION_TYPE_OPTIONS = _opts([
    "KEYS", "ITEM", "CLASS", "LOCATION", "ALL_IN_SAME_LOC", "TRAITS", "STATISTICS", "STATISTICS_SUM",
])
CHOICE_CONDITION_OPERATOR_OPTIONS = _opts(["=", ">", "<", "!="])
LOCATION_NEIGHBOR_DIRECTION_OPTIONS = _opts(["NORTH", "SOUTH", "EAST", "WEST", "ABOVE", "BELOW", "SKY"])
LOCATION_NEIGHBOR_FLAG_BACK_OPTIONS = [{"value": 1, "label": "YES"}, {"value": 0, "label": "NO"}]


# --- editor tabs ---
STORIES_ENTITIES_TABS = [
    {"id": "metadata", "label": "Story Info", "icon": "fa-info-circle"},
    {"id": "cards", "label": "Cards", "icon": "fa-id-card"},
    {"id": "creators", "label": "Creators", "icon": "fa-paint-brush"},
    {"id": "texts", "label": "Texts", "icon": "fa-font"},
    {"id": "keys", "label": "Keys", "icon": "fa-key"},
    {"id": "difficulties", "label": "Difficulties", "icon": "fa-layer-group"},
    {"id": "locations", "label": "Locations", "icon": "fa-map-marker-alt"},
    {"id": "location-neighbors", "label": "Loc Neighbors", "icon": "fa-project-diagram"},
    {"id": "events", "label": "Events", "icon": "fa-bolt"},
    {"id": "event-effects", "label": "Event Effects", "icon": "fa-magic"},
    {"id": "items", "label": "Items", "icon": "fa-flask"},
    {"id": "item-effects", "label": "Item Effects", "icon": "fa-cogs"},
    {"id": "character-templates", "label": "Templates", "icon": "fa-user-tag"},
    {"id": "classes", "label": "Classes", "icon": "fa-hat-wizard"},
    {"id": "class-bonuses", "label": "Class Bonuses", "icon": "fa-star-half-alt"},
    {"id": "traits", "label": "Traits", "icon": "fa-star"},
    {"id": "choices", "label": "Choices", "icon": "fa-code-branch"},
    {"id": "choice-conditions", "label": "Choice Cond.", "icon": "fa-filter"},
    {"id": "choice-effects", "label": "Choice Effects", "icon": "fa-random"},
    {"id": "weather-rules", "label": "Weather Rules", "icon": "fa-cloud-sun"},
    {"id": "global-random-events", "label": "Random Events", "icon": "fa-dice"},
    {"id": "missions", "label": "Missions", "icon": "fa-tasks"},
    {"id": "mission-steps", "label": "Mission Steps", "icon": "fa-list-ol"},
]


def _f(key, label, type="number", **extra):
    d = {"key": key, "label": label, "type": type}
    d.update(extra)
    return d


STORIES_ENTITIES_FIELDS = {
    "difficulties": [
        _f("idCard", "Card ID"), _f("idTextName", "Name Text ID"), _f("idTextDescription", "Desc Text ID"),
        _f("expCost", "EXP Cost"), _f("maxWeight", "Max Weight"), _f("minCharacter", "Min Characters"),
        _f("maxCharacter", "Max Characters"), _f("costHelpComa", "Cost Help Coma"),
        _f("costMaxCharacteristics", "Cost Max Characteristics"), _f("numberMaxFreeAction", "Max Free Actions"),
        _f("traitCostPositiveBudget", "Trait Cost Budget (+)"), _f("traitCostNegativeBudget", "Trait Cost Budget (-)"),
        _f("life", "Life"), _f("energy", "Energy"), _f("sad", "Sad"), _f("dexterity", "Dexterity"),
        _f("intelligence", "Intelligence"), _f("constitution", "Constitution"), _f("weight", "Weight"),
    ],
    "locations": [
        _f("idCard", "Card ID"), _f("idTextName", "Name Text ID"), _f("idTextDescription", "Desc Text ID"),
        _f("idTextNarrative", "Narrative Text ID"), _f("idImage", "Image ID"),
        _f("isSafe", "Safe Location", type="checkbox"), _f("costEnergyEnter", "Energy Cost to Enter"),
        _f("counterTime", "Counter Time"), _f("idEventIfCounterZero", "Event if Counter = 0"),
        _f("secureParam", "Secure Param"), _f("idEventIfCharacterStartTime", "Event if Start Time"),
        _f("idEventIfCharacterEnterFirstTime", "Event if Enter First"), _f("idEventIfFirstTime", "Event if First Time"),
        _f("idEventNotFirstTime", "Event if Not First Time"), _f("priorityAutomaticEvent", "Auto Event Priority"),
        _f("idAudio", "Audio ID"), _f("maxCharacters", "Max Characters"),
    ],
    "location-neighbors": [
        _f("idCard", "Card ID"), _f("idTextName", "Name Text ID"), _f("idLocationFrom", "Location From ID"),
        _f("idLocationTo", "Location To ID"),
        _f("direction", "Direction", type="select", options=LOCATION_NEIGHBOR_DIRECTION_OPTIONS),
        _f("flagBack", "Flag Back", type="select", valueType="number", options=LOCATION_NEIGHBOR_FLAG_BACK_OPTIONS),
        _f("conditionRegistryKey", "Condition Registry Key", type="text"),
        _f("conditionRegistryValue", "Condition Registry Value", type="text"),
        _f("idTextGo", "Text Go ID"), _f("idTextBack", "Text Back ID"), _f("energyCost", "Energy Cost"),
    ],
    "events": [
        _f("idCard", "Card ID"), _f("idTextName", "Name Text ID"), _f("idTextDescription", "Desc Text ID"),
        _f("idSpecificLocation", "Specific Location ID"),
        _f("type", "Event Type", type="select", options=EVENT_TYPE_OPTIONS),
        _f("costEnery", "Energy Cost"), _f("flagEndTime", "Flag End Time"),
        _f("characteristicToAdd", "Characteristic to Add", type="text"),
        _f("characteristicToRemove", "Characteristic to Remove", type="text"),
        _f("keyToAdd", "Key to Add", type="text"), _f("keyValueToAdd", "Key Value to Add", type="text"),
        _f("idItemToAdd", "Item to Add ID"), _f("idWeather", "Weather ID"), _f("idEventNext", "Next Event ID"),
        _f("coinCost", "Coin Cost"),
    ],
    "event-effects": [
        _f("idEvent", "Event ID"),
        _f("statistics", "Statistic", type="select", options=POSSIBLE_STATISTICS_OPTIONS),
        _f("value", "Value"), _f("target", "Target", type="select", options=EVENT_EFFECT_TARGET_OPTIONS),
        _f("traitsToAdd", "Traits to Add"), _f("traitsToRemove", "Traits to Remove"),
        _f("targetClass", "Target Class"), _f("idItemTarget", "Item Target ID"),
        _f("itemAction", "Item Action", type="select", options=ITEM_ACTION_OPTIONS),
    ],
    "items": [
        _f("idCard", "Card ID"), _f("idTextName", "Name Text ID"), _f("idTextDescription", "Desc Text ID"),
        _f("weight", "Weight"), _f("isConsumabile", "Consumable", type="checkbox"),
        _f("idClassPermitted", "Class Permitted ID"), _f("idClassProhibited", "Class Prohibited ID"),
    ],
    "item-effects": [
        _f("idItem", "Item ID"), _f("effectCode", "Effect Code", type="text"), _f("effectValue", "Effect Value"),
    ],
    "character-templates": [
        _f("idCard", "Card ID"), _f("idTextName", "Name Text ID"), _f("idTextDescription", "Desc Text ID"),
        _f("lifeMax", "Max Life"), _f("energyMax", "Max Energy"), _f("sadMax", "Max Sad"),
        _f("dexterityStart", "Dexterity Start"), _f("intelligenceStart", "Intelligence Start"),
        _f("constitutionStart", "Constitution Start"), _f("idClassPermitted", "Class Permitted ID"),
        _f("idClassProhibited", "Class Prohibited ID"),
    ],
    "classes": [
        _f("idCard", "Card ID"), _f("idTextName", "Name Text ID"), _f("idTextDescription", "Desc Text ID"),
        _f("weightMax", "Max Weight"), _f("dexterityBase", "Dexterity Base"),
        _f("intelligenceBase", "Intelligence Base"), _f("constitutionBase", "Constitution Base"),
    ],
    "class-bonuses": [
        _f("idClass", "Class ID"),
        _f("statistic", "Statistic", type="select", options=POSSIBLE_STATISTICS_OPTIONS), _f("value", "Value"),
    ],
    "traits": [
        _f("idCard", "Card ID"), _f("idTextName", "Name Text ID"), _f("idTextDescription", "Desc Text ID"),
        _f("costPositive", "Positive Cost"), _f("costNegative", "Negative Cost"),
        _f("idClassPermitted", "Class Permitted ID"), _f("idClassProhibited", "Class Prohibited ID"),
        _f("life", "Life D"), _f("energy", "Energy D"), _f("sad", "Happiness D"), _f("dexterity", "Dexterity D"),
        _f("intelligence", "Intelligence D"), _f("constitution", "Physique D"), _f("weight", "Carry D"),
    ],
    "creators": [
        _f("idCard", "Card ID"), _f("idText", "Text ID"), _f("link", "Link", type="text"),
        _f("url", "URL", type="text"), _f("urlImage", "Image URL", type="text"),
        _f("urlEmote", "Emote URL", type="text"), _f("urlInstagram", "Instagram URL", type="text"),
    ],
    "cards": [
        _f("cardType", "Card Type", type="select", options=CARD_TYPE_OPTIONS),
        _f("idTextTitle", "Title Text ID"), _f("idTextDescription", "Desc Text ID"),
        _f("idTextCopyright", "Copyright Text ID"), _f("linkCopyright", "Copyright Link", type="text"),
        _f("idCreator", "Creator ID"), _f("urlImage", "Image URL", type="text"),
        _f("alternativeImage", "Alternative Image", type="text"), _f("awesomeIcon", "Awesome Icon", type="text"),
        _f("styleMain", "Style Main", type="text"), _f("styleDetail", "Style Detail", type="text"),
        _f("styleImageLittle", "Style Image Little", type="text"),
        _f("styleImageMedium", "Style Image Medium", type="text"),
        _f("styleImageLarge", "Style Image Large", type="text"),
    ],
    "texts": [
        _f("idText", "Text ID"), _f("lang", "Language", type="text"), _f("shortText", "Short Text", type="text"),
        _f("longText", "Long Text", type="textarea"), _f("idTextCopyright", "Copyright Text ID"),
        _f("linkCopyright", "Copyright Link", type="text"), _f("idCreator", "Creator ID"),
    ],
    "keys": [
        _f("idCard", "Card ID"), _f("idTextDescription", "Desc Text ID"), _f("name", "Name", type="text"),
        _f("value", "Value", type="text"), _f("group", "Group", type="text"), _f("priority", "Priority"),
        _f("visibility", "Visibility", type="text"),
    ],
    "choices": [
        _f("idCard", "Card ID"), _f("idEvent", "Event ID"), _f("idLocation", "Location ID"),
        _f("priority", "Priority"), _f("idTextNarrative", "Narrative Text ID"), _f("idEventTorun", "Event to Run ID"),
        _f("limitSad", "Sad Limit"), _f("limitDex", "Dex Limit"), _f("limitInt", "Int Limit"),
        _f("limitCos", "Cos Limit"), _f("otherwiseFlag", "Otherwise Flag"), _f("isProgress", "Is Progress"),
        _f("logicOperator", "Logic Operator", type="select", options=LOGIC_OPERATOR_OPTIONS),
    ],
    "choice-conditions": [
        _f("idChoices", "Choice ID"),
        _f("type", "Type", type="select", options=CHOICE_CONDITION_TYPE_OPTIONS),
        _f("key", "Key", type="text"), _f("value", "Value", type="text"),
        _f("operator", "Operator", type="select", options=CHOICE_CONDITION_OPERATOR_OPTIONS),
    ],
    "choice-effects": [
        _f("idCard", "Card ID"), _f("idChoices", "Choice ID"), _f("idScelta", "Scelta ID"),
        _f("flagGroup", "Flag Group"), _f("statistics", "Statistic", type="text"), _f("value", "Value"),
        _f("idText", "Text ID"), _f("key", "Key", type="text"), _f("valueToAdd", "Value to Add", type="text"),
        _f("valueToRemove", "Value to Remove", type="text"),
    ],
    "weather-rules": [
        _f("idCard", "Card ID"), _f("probability", "Probability"), _f("costMoveSafeLocation", "Cost Move Safe"),
        _f("costMoveNotSafeLocation", "Cost Move Not Safe"), _f("conditionKey", "Condition Key", type="text"),
        _f("conditionKeyValue", "Condition Key Value", type="text"), _f("timeFrom", "Time From"),
        _f("timeTo", "Time To"), _f("idText", "Text ID"), _f("active", "Active"), _f("priority", "Priority"),
        _f("deltaEnergy", "Delta Energy"), _f("idEvent", "Event ID"),
    ],
    "global-random-events": [
        _f("idCard", "Card ID"), _f("conditionKey", "Condition Key", type="text"),
        _f("conditionValue", "Condition Value", type="text"), _f("probability", "Probability"),
        _f("idText", "Text ID"), _f("idEvent", "Event ID"),
    ],
    "missions": [
        _f("idCard", "Card ID"), _f("idTextName", "Name Text ID"), _f("idTextDescription", "Desc Text ID"),
        _f("conditionKey", "Condition Key", type="text"), _f("conditionValueFrom", "Condition Value From"),
        _f("conditionValueTo", "Condition Value To"), _f("idEventCompleted", "Completed Event ID"),
    ],
    "mission-steps": [
        _f("idMission", "Mission ID"), _f("step", "Step Number"), _f("idTextName", "Name Text ID"),
        _f("idTextDescription", "Desc Text ID"), _f("conditionKey", "Condition Key", type="text"),
        _f("conditionValueFrom", "Condition Value From"), _f("conditionValueTo", "Condition Value To"),
        _f("idEventCompleted", "Completed Event ID"),
    ],
}


def _c(key, label, **extra):
    d = {"key": key, "label": label}
    d.update(extra)
    return d


STORIES_ENTITIES_COLUMNS = {
    "difficulties": [
        _c("idTextName", "Name", type="idTextName"), _c("expCost", "EXP Cost"), _c("maxWeight", "Max Weight"),
        _c("minCharacter", "Min Chars"), _c("maxCharacter", "Max Chars"), _c("costHelpComa", "Help COMA"),
        _c("costMaxCharacteristics", "Max Char Cost"), _c("numberMaxFreeAction", "Max Free Actions"),
        _c("life", "Life"), _c("energy", "Energy"), _c("sad", "Sad"), _c("dexterity", "Dex"),
        _c("intelligence", "Int"), _c("constitution", "Cos"), _c("weight", "Wei"),
    ],
    "locations": [
        _c("idTextName", "Name", type="idTextName"), _c("idTextDescription", "Desc", type="idTextDescription"),
        _c("isSafe", "Safe", type="boolean"), _c("idImage", "Image"), _c("maxCharacters", "Max Chars"),
    ],
    "location-neighbors": [
        _c("idLocationFrom", "From"), _c("idLocationTo", "To"), _c("direction", "Direction"), _c("flagBack", "Back"),
    ],
    "events": [
        _c("idTextName", "Name", type="idTextName"), _c("type", "Type"), _c("costEnery", "Energy Cost"),
        _c("flagEndTime", "End Time"), _c("coinCost", "Coin Cost"),
    ],
    "event-effects": [
        _c("idEvent", "Event ID"), _c("statistics", "Statistic"), _c("value", "Value"), _c("target", "Target"),
    ],
    "items": [
        _c("idTextName", "Name", type="idTextName"), _c("weight", "Weight"), _c("isConsumabile", "Consumable"),
        _c("idClassPermitted", "Class Permitted"), _c("idClassProhibited", "Class Prohibited"),
    ],
    "item-effects": [_c("idItem", "Item ID"), _c("effectCode", "Effect Code"), _c("effectValue", "Value")],
    "character-templates": [
        _c("idTextName", "Name", type="idTextName"), _c("lifeMax", "Max Life"), _c("energyMax", "Max Energy"),
        _c("sadMax", "Max Sad"), _c("dexterityStart", "Dex Start"), _c("intelligenceStart", "Int Start"),
        _c("constitutionStart", "Con Start"), _c("idClassPermitted", "Class Permitted"),
        _c("idClassProhibited", "Class Prohibited"),
    ],
    "classes": [
        _c("idTextName", "Name", type="idTextName"), _c("weightMax", "Max Weight"), _c("dexterityBase", "Dex Base"),
        _c("intelligenceBase", "Int Base"), _c("constitutionBase", "Con Base"),
    ],
    "class-bonuses": [_c("idClass", "Class ID"), _c("statistic", "Statistic"), _c("value", "Value")],
    "traits": [
        _c("idTextName", "Name", type="idTextName"), _c("costPositive", "Cost (+)"), _c("costNegative", "Cost (-)"),
        _c("idClassPermitted", "Class Permitted"), _c("idClassProhibited", "Class Prohibited"),
        _c("life", "Life D"), _c("energy", "Energy D"), _c("sad", "Happiness D"), _c("dexterity", "Dex D"),
        _c("intelligence", "Int D"), _c("constitution", "Phys D"), _c("weight", "Carry D"),
    ],
    "creators": [
        _c("idTextName", "Name", type="idTextName"), _c("link", "Link"), _c("url", "URL"),
        _c("urlEmote", "Emote URL"), _c("urlInstagram", "Instagram URL"),
    ],
    "cards": [_c("idTextTitle", "Title", type="idTextTitle"), _c("awesomeIcon", "Icon")],
    "texts": [
        _c("idText", "ID Text", type="monoId"), _c("lang", "Lang", type="langBadge"),
        _c("shortText", "Short Text"), _c("longText", "Long Text", type="longTextIcon"),
        _c("idTextCopyright", "Copyright ID"), _c("idCreator", "Creator ID"),
    ],
    "keys": [
        _c("name", "Name"), _c("value", "Value"), _c("group", "Group"), _c("priority", "Priority"),
        _c("visibility", "Visibility"),
    ],
    "choices": [
        _c("idEvent", "Event ID"), _c("idLocation", "Location ID"), _c("priority", "Priority"),
        _c("idTextNarrative", "Narrative Text ID"), _c("logicOperator", "Logic Op."),
    ],
    "choice-conditions": [
        _c("idChoices", "Choice ID"), _c("type", "Type"), _c("key", "Key"), _c("value", "Value"),
        _c("operator", "Operator"),
    ],
    "choice-effects": [
        _c("idChoices", "Choice ID"), _c("statistics", "Statistic"), _c("value", "Value"), _c("key", "Key"),
    ],
    "weather-rules": [
        _c("probability", "Probability"), _c("conditionKey", "Condition Key"), _c("timeFrom", "Time From"),
        _c("timeTo", "Time To"), _c("deltaEnergy", "Delta Energy"),
    ],
    "global-random-events": [
        _c("conditionKey", "Condition Key"), _c("conditionValue", "Condition Value"),
        _c("probability", "Probability"), _c("idEvent", "Event ID"),
    ],
    "missions": [
        _c("idTextName", "Name", type="idTextName"), _c("conditionKey", "Condition Key"),
        _c("idEventCompleted", "Completed Event"),
    ],
    "mission-steps": [
        _c("idMission", "Mission ID"), _c("step", "Step"), _c("conditionKey", "Condition Key"),
        _c("idEventCompleted", "Completed Event"),
    ],
}

# Entity tab ids that hold real sub-entities (everything except the metadata tab).
ENTITY_TYPES = [t["id"] for t in STORIES_ENTITIES_TABS if t["id"] != "metadata"]
