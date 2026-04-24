package games.paths.core.service.story;

import games.paths.core.entity.story.*;
import games.paths.core.port.story.StoryCrudPort;
import games.paths.core.port.story.StoryPersistencePort;
import games.paths.core.port.story.StoryReadPort;

import java.util.*;
import java.util.stream.Collectors;

/**
 * StoryCrudService - Domain service implementing admin CRUD for all story entities.
 * Step 17: Provides create, read, update, delete for every story sub-table.
 */
public class StoryCrudService implements StoryCrudPort {

    private final StoryReadPort readPort;
    private final StoryPersistencePort persistencePort;

    public StoryCrudService(StoryReadPort readPort, StoryPersistencePort persistencePort) {
        this.readPort = readPort;
        this.persistencePort = persistencePort;
    }

    @Override
    public List<Map<String, Object>> listEntities(String storyUuid, String entityType) {
        if (isBlank(storyUuid) || isBlank(entityType)) return null;
        Optional<StoryEntity> storyOpt = readPort.findStoryByUuid(storyUuid);
        if (storyOpt.isEmpty()) return null;
        Long sid = storyOpt.get().getId();
        return listByType(sid, entityType);
    }

    @Override
    public Map<String, Object> getEntity(String storyUuid, String entityType, String entityUuid) {
        if (isBlank(storyUuid) || isBlank(entityType) || isBlank(entityUuid)) return null;
        Optional<StoryEntity> storyOpt = readPort.findStoryByUuid(storyUuid);
        if (storyOpt.isEmpty()) return null;
        Long sid = storyOpt.get().getId();
        return getByType(sid, entityType, entityUuid);
    }

    @Override
    public Map<String, Object> createEntity(String storyUuid, String entityType, Map<String, Object> data) {
        if (isBlank(storyUuid) || isBlank(entityType) || data == null || data.isEmpty()) return null;
        Optional<StoryEntity> storyOpt = readPort.findStoryByUuid(storyUuid);
        if (storyOpt.isEmpty()) return null;
        Long sid = storyOpt.get().getId();
        return createByType(sid, entityType, data);
    }

    @Override
    public Map<String, Object> updateEntity(String storyUuid, String entityType, String entityUuid, Map<String, Object> data) {
        if (isBlank(storyUuid) || isBlank(entityType) || isBlank(entityUuid) || data == null || data.isEmpty()) return null;
        Optional<StoryEntity> storyOpt = readPort.findStoryByUuid(storyUuid);
        if (storyOpt.isEmpty()) return null;
        Long sid = storyOpt.get().getId();
        return updateByType(sid, entityType, entityUuid, data);
    }

    @Override
    public boolean deleteEntity(String storyUuid, String entityType, String entityUuid) {
        if (isBlank(storyUuid) || isBlank(entityType) || isBlank(entityUuid)) return false;
        Optional<StoryEntity> storyOpt = readPort.findStoryByUuid(storyUuid);
        if (storyOpt.isEmpty()) return false;
        Long sid = storyOpt.get().getId();
        return deleteByType(sid, entityType, entityUuid);
    }

    @Override
    public Map<String, Object> updateStory(String storyUuid, Map<String, Object> data) {
        if (isBlank(storyUuid) || data == null || data.isEmpty()) return null;
        Optional<StoryEntity> storyOpt = readPort.findStoryByUuid(storyUuid);
        if (storyOpt.isEmpty()) return null;
        StoryEntity s = storyOpt.get();
        applyStoryFields(s, data);
        return storyToMap(persistencePort.saveStory(s));
    }

    @Override
    public Map<String, Object> createStory(Map<String, Object> data) {
        if (data == null || data.isEmpty()) return null;
        StoryEntity s = new StoryEntity();
        applyStoryFields(s, data);
        return storyToMap(persistencePort.saveStory(s));
    }

    // === Dispatch: list ===
    private List<Map<String, Object>> listByType(Long sid, String type) {
        switch (type) {
            case "difficulties": return toMaps(readPort.findDifficultiesByStoryId(sid));
            case "locations": return toMaps(readPort.findLocationsByStoryId(sid));
            case "events": return toMaps(readPort.findEventsByStoryId(sid));
            case "items": return toMaps(readPort.findItemsByStoryId(sid));
            case "character-templates": return toMaps(readPort.findCharacterTemplatesByStoryId(sid));
            case "classes": return toMaps(readPort.findClassesByStoryId(sid));
            case "traits": return toMaps(readPort.findTraitsByStoryId(sid));
            case "creators": return toMaps(readPort.findCreatorsByStoryId(sid));
            case "cards": return toMaps(readPort.findCardsByStoryId(sid));
            case "texts": return toMaps(readPort.findTextsByStoryId(sid));
            default: return List.of();
        }
    }

    // === Dispatch: get ===
    private Map<String, Object> getByType(Long sid, String type, String uuid) {
        switch (type) {
            case "difficulties": return optMap(readPort.findDifficultyByStoryIdAndUuid(sid, uuid));
            case "locations": return optMap(readPort.findLocationByStoryIdAndUuid(sid, uuid));
            case "events": return optMap(readPort.findEventByStoryIdAndUuid(sid, uuid));
            case "items": return optMap(readPort.findItemByStoryIdAndUuid(sid, uuid));
            case "character-templates": return optMap(readPort.findCharacterTemplateByStoryIdAndUuid(sid, uuid));
            case "classes": return optMap(readPort.findClassByStoryIdAndUuid(sid, uuid));
            case "traits": return optMap(readPort.findTraitByStoryIdAndUuid(sid, uuid));
            case "creators": return optMap(readPort.findCreatorByStoryIdAndUuid(sid, uuid));
            case "cards": return optMap(readPort.findCardByStoryIdAndUuid(sid, uuid));
            case "texts": return optMap(readPort.findTextByStoryIdAndUuid(sid, uuid));
            default: return null;
        }
    }

    // === Dispatch: create ===
    private Map<String, Object> createByType(Long sid, String type, Map<String, Object> d) {
        switch (type) {
            case "locations": return createLocation(sid, d);
            case "events": return createEvent(sid, d);
            case "items": return createItem(sid, d);
            case "difficulties": return createDifficulty(sid, d);
            case "character-templates": return createCharacterTemplate(sid, d);
            case "classes": return createClass(sid, d);
            case "traits": return createTrait(sid, d);
            case "texts": return createText(sid, d);
            case "cards": return createCard(sid, d);
            case "creators": return createCreator(sid, d);
            default: return null;
        }
    }

    // === Dispatch: update ===
    private Map<String, Object> updateByType(Long sid, String type, String uuid, Map<String, Object> d) {
        switch (type) {
            case "locations": return updateLocation(sid, uuid, d);
            case "events": return updateEvent(sid, uuid, d);
            case "items": return updateItem(sid, uuid, d);
            case "difficulties": return updateDifficulty(sid, uuid, d);
            case "character-templates": return updateCharacterTemplate(sid, uuid, d);
            case "classes": return updateClass(sid, uuid, d);
            case "traits": return updateTrait(sid, uuid, d);
            case "texts": return updateText(sid, uuid, d);
            case "cards": return updateCard(sid, uuid, d);
            case "creators": return updateCreator(sid, uuid, d);
            default: return null;
        }
    }

    // === Dispatch: delete ===
    private boolean deleteByType(Long sid, String type, String uuid) {
        switch (type) {
            case "locations": return delIf(readPort.findLocationByStoryIdAndUuid(sid, uuid), () -> persistencePort.deleteLocationByUuid(uuid));
            case "events": return delIf(readPort.findEventByStoryIdAndUuid(sid, uuid), () -> persistencePort.deleteEventByUuid(uuid));
            case "items": return delIf(readPort.findItemByStoryIdAndUuid(sid, uuid), () -> persistencePort.deleteItemByUuid(uuid));
            case "difficulties": return delIf(readPort.findDifficultyByStoryIdAndUuid(sid, uuid), () -> persistencePort.deleteDifficultyByUuid(uuid));
            case "character-templates": return delIf(readPort.findCharacterTemplateByStoryIdAndUuid(sid, uuid), () -> persistencePort.deleteCharacterTemplateByUuid(uuid));
            case "classes": return delIf(readPort.findClassByStoryIdAndUuid(sid, uuid), () -> persistencePort.deleteClassByUuid(uuid));
            case "traits": return delIf(readPort.findTraitByStoryIdAndUuid(sid, uuid), () -> persistencePort.deleteTraitByUuid(uuid));
            case "texts": return delIf(readPort.findTextByStoryIdAndUuid(sid, uuid), () -> persistencePort.deleteTextByUuid(uuid));
            case "cards": return delIf(readPort.findCardByStoryIdAndUuid(sid, uuid), () -> persistencePort.deleteCardByUuid(uuid));
            case "creators": return delIf(readPort.findCreatorByStoryIdAndUuid(sid, uuid), () -> persistencePort.deleteCreatorByUuid(uuid));
            default: return false;
        }
    }

    private boolean delIf(Optional<?> opt, Runnable action) {
        if (opt.isEmpty()) return false;
        action.run();
        return true;
    }

    // === Create helpers ===
    private Map<String, Object> createLocation(Long sid, Map<String, Object> d) {
        LocationEntity e = new LocationEntity();
        e.setIdStory(sid);
        applyBaseFields(e, d);
        if (d.containsKey("isSafe")) e.setIsSafe(intVal(d, "isSafe"));
        if (d.containsKey("costEnergyEnter")) e.setCostEnergyEnter(intVal(d, "costEnergyEnter"));
        if (d.containsKey("counterTime")) e.setCounterTime(intVal(d, "counterTime"));
        if (d.containsKey("maxCharacters")) e.setMaxCharacters(intVal(d, "maxCharacters"));
        return toMap(persistencePort.saveLocation(e));
    }

    private Map<String, Object> createEvent(Long sid, Map<String, Object> d) {
        EventEntity e = new EventEntity();
        e.setIdStory(sid);
        applyBaseFields(e, d);
        if (d.containsKey("type")) e.setType(str(d, "type"));
        if (d.containsKey("costEnery")) e.setCostEnery(intVal(d, "costEnery"));
        if (d.containsKey("flagEndTime")) e.setFlagEndTime(intVal(d, "flagEndTime"));
        return toMap(persistencePort.saveEvent(e));
    }

    private Map<String, Object> createItem(Long sid, Map<String, Object> d) {
        ItemEntity e = new ItemEntity();
        e.setIdStory(sid);
        applyBaseFields(e, d);
        if (d.containsKey("weight")) e.setWeight(intVal(d, "weight"));
        if (d.containsKey("isConsumabile")) e.setIsConsumabile(intVal(d, "isConsumabile"));
        return toMap(persistencePort.saveItem(e));
    }

    private Map<String, Object> createDifficulty(Long sid, Map<String, Object> d) {
        StoryDifficultyEntity e = new StoryDifficultyEntity();
        e.setIdStory(sid);
        applyBaseFields(e, d);
        if (d.containsKey("expCost")) e.setExpCost(intVal(d, "expCost"));
        if (d.containsKey("maxWeight")) e.setMaxWeight(intVal(d, "maxWeight"));
        if (d.containsKey("minCharacter")) e.setMinCharacter(intVal(d, "minCharacter"));
        if (d.containsKey("maxCharacter")) e.setMaxCharacter(intVal(d, "maxCharacter"));
        return toMap(persistencePort.saveDifficulty(e));
    }

    private Map<String, Object> createCharacterTemplate(Long sid, Map<String, Object> d) {
        CharacterTemplateEntity e = new CharacterTemplateEntity();
        e.setIdStory(sid);
        applyBaseFields(e, d);
        if (d.containsKey("lifeMax")) e.setLifeMax(intVal(d, "lifeMax"));
        if (d.containsKey("energyMax")) e.setEnergyMax(intVal(d, "energyMax"));
        if (d.containsKey("sadMax")) e.setSadMax(intVal(d, "sadMax"));
        return toMap(persistencePort.saveCharacterTemplate(e));
    }

    private Map<String, Object> createClass(Long sid, Map<String, Object> d) {
        ClassEntity e = new ClassEntity();
        e.setIdStory(sid);
        applyBaseFields(e, d);
        if (d.containsKey("weightMax")) e.setWeightMax(intVal(d, "weightMax"));
        if (d.containsKey("dexterityBase")) e.setDexterityBase(intVal(d, "dexterityBase"));
        if (d.containsKey("intelligenceBase")) e.setIntelligenceBase(intVal(d, "intelligenceBase"));
        if (d.containsKey("constitutionBase")) e.setConstitutionBase(intVal(d, "constitutionBase"));
        return toMap(persistencePort.saveClass(e));
    }

    private Map<String, Object> createTrait(Long sid, Map<String, Object> d) {
        TraitEntity e = new TraitEntity();
        e.setIdStory(sid);
        applyBaseFields(e, d);
        if (d.containsKey("costPositive")) e.setCostPositive(intVal(d, "costPositive"));
        if (d.containsKey("costNegative")) e.setCostNegative(intVal(d, "costNegative"));
        return toMap(persistencePort.saveTrait(e));
    }

    private Map<String, Object> createText(Long sid, Map<String, Object> d) {
        TextEntity e = new TextEntity();
        e.setIdStory(sid);
        if (d.containsKey("idText")) e.setIdText(intVal(d, "idText"));
        if (d.containsKey("lang")) e.setLang(str(d, "lang"));
        if (d.containsKey("shortText")) e.setShortText(str(d, "shortText"));
        if (d.containsKey("longText")) e.setLongText(str(d, "longText"));
        return toMap(persistencePort.saveText(e));
    }

    private Map<String, Object> createCard(Long sid, Map<String, Object> d) {
        CardEntity e = new CardEntity();
        e.setIdStory(sid);
        if (d.containsKey("urlImmage")) e.setUrlImmage(str(d, "urlImmage"));
        if (d.containsKey("alternativeImage")) e.setAlternativeImage(str(d, "alternativeImage"));
        if (d.containsKey("awesomeIcon")) e.setAwesomeIcon(str(d, "awesomeIcon"));
        if (d.containsKey("styleMain")) e.setStyleMain(str(d, "styleMain"));
        if (d.containsKey("styleDetail")) e.setStyleDetail(str(d, "styleDetail"));
        return toMap(persistencePort.saveCard(e));
    }

    private Map<String, Object> createCreator(Long sid, Map<String, Object> d) {
        CreatorEntity e = new CreatorEntity();
        e.setIdStory(sid);
        if (d.containsKey("link")) e.setLink(str(d, "link"));
        if (d.containsKey("url")) e.setUrl(str(d, "url"));
        if (d.containsKey("urlImage")) e.setUrlImage(str(d, "urlImage"));
        return toMap(persistencePort.saveCreator(e));
    }

    // === Update helpers (find + apply + save) ===
    private Map<String, Object> updateLocation(Long sid, String uuid, Map<String, Object> d) {
        return readPort.findLocationByStoryIdAndUuid(sid, uuid).map(e -> {
            applyBaseFields(e, d);
            if (d.containsKey("isSafe")) e.setIsSafe(intVal(d, "isSafe"));
            if (d.containsKey("costEnergyEnter")) e.setCostEnergyEnter(intVal(d, "costEnergyEnter"));
            if (d.containsKey("counterTime")) e.setCounterTime(intVal(d, "counterTime"));
            if (d.containsKey("maxCharacters")) e.setMaxCharacters(intVal(d, "maxCharacters"));
            return toMap(persistencePort.saveLocation(e));
        }).orElse(null);
    }

    private Map<String, Object> updateEvent(Long sid, String uuid, Map<String, Object> d) {
        return readPort.findEventByStoryIdAndUuid(sid, uuid).map(e -> {
            applyBaseFields(e, d);
            if (d.containsKey("type")) e.setType(str(d, "type"));
            if (d.containsKey("costEnery")) e.setCostEnery(intVal(d, "costEnery"));
            if (d.containsKey("flagEndTime")) e.setFlagEndTime(intVal(d, "flagEndTime"));
            return toMap(persistencePort.saveEvent(e));
        }).orElse(null);
    }

    private Map<String, Object> updateItem(Long sid, String uuid, Map<String, Object> d) {
        return readPort.findItemByStoryIdAndUuid(sid, uuid).map(e -> {
            applyBaseFields(e, d);
            if (d.containsKey("weight")) e.setWeight(intVal(d, "weight"));
            if (d.containsKey("isConsumabile")) e.setIsConsumabile(intVal(d, "isConsumabile"));
            return toMap(persistencePort.saveItem(e));
        }).orElse(null);
    }

    private Map<String, Object> updateDifficulty(Long sid, String uuid, Map<String, Object> d) {
        return readPort.findDifficultyByStoryIdAndUuid(sid, uuid).map(e -> {
            applyBaseFields(e, d);
            if (d.containsKey("expCost")) e.setExpCost(intVal(d, "expCost"));
            if (d.containsKey("maxWeight")) e.setMaxWeight(intVal(d, "maxWeight"));
            if (d.containsKey("minCharacter")) e.setMinCharacter(intVal(d, "minCharacter"));
            if (d.containsKey("maxCharacter")) e.setMaxCharacter(intVal(d, "maxCharacter"));
            return toMap(persistencePort.saveDifficulty(e));
        }).orElse(null);
    }

    private Map<String, Object> updateCharacterTemplate(Long sid, String uuid, Map<String, Object> d) {
        return readPort.findCharacterTemplateByStoryIdAndUuid(sid, uuid).map(e -> {
            applyBaseFields(e, d);
            if (d.containsKey("lifeMax")) e.setLifeMax(intVal(d, "lifeMax"));
            if (d.containsKey("energyMax")) e.setEnergyMax(intVal(d, "energyMax"));
            if (d.containsKey("sadMax")) e.setSadMax(intVal(d, "sadMax"));
            return toMap(persistencePort.saveCharacterTemplate(e));
        }).orElse(null);
    }

    private Map<String, Object> updateClass(Long sid, String uuid, Map<String, Object> d) {
        return readPort.findClassByStoryIdAndUuid(sid, uuid).map(e -> {
            applyBaseFields(e, d);
            if (d.containsKey("weightMax")) e.setWeightMax(intVal(d, "weightMax"));
            if (d.containsKey("dexterityBase")) e.setDexterityBase(intVal(d, "dexterityBase"));
            if (d.containsKey("intelligenceBase")) e.setIntelligenceBase(intVal(d, "intelligenceBase"));
            if (d.containsKey("constitutionBase")) e.setConstitutionBase(intVal(d, "constitutionBase"));
            return toMap(persistencePort.saveClass(e));
        }).orElse(null);
    }

    private Map<String, Object> updateTrait(Long sid, String uuid, Map<String, Object> d) {
        return readPort.findTraitByStoryIdAndUuid(sid, uuid).map(e -> {
            applyBaseFields(e, d);
            if (d.containsKey("costPositive")) e.setCostPositive(intVal(d, "costPositive"));
            if (d.containsKey("costNegative")) e.setCostNegative(intVal(d, "costNegative"));
            return toMap(persistencePort.saveTrait(e));
        }).orElse(null);
    }

    private Map<String, Object> updateText(Long sid, String uuid, Map<String, Object> d) {
        return readPort.findTextByStoryIdAndUuid(sid, uuid).map(e -> {
            if (d.containsKey("idText")) e.setIdText(intVal(d, "idText"));
            if (d.containsKey("lang")) e.setLang(str(d, "lang"));
            if (d.containsKey("shortText")) e.setShortText(str(d, "shortText"));
            if (d.containsKey("longText")) e.setLongText(str(d, "longText"));
            return toMap(persistencePort.saveText(e));
        }).orElse(null);
    }

    private Map<String, Object> updateCard(Long sid, String uuid, Map<String, Object> d) {
        return readPort.findCardByStoryIdAndUuid(sid, uuid).map(e -> {
            if (d.containsKey("urlImmage")) e.setUrlImmage(str(d, "urlImmage"));
            if (d.containsKey("alternativeImage")) e.setAlternativeImage(str(d, "alternativeImage"));
            if (d.containsKey("awesomeIcon")) e.setAwesomeIcon(str(d, "awesomeIcon"));
            if (d.containsKey("styleMain")) e.setStyleMain(str(d, "styleMain"));
            if (d.containsKey("styleDetail")) e.setStyleDetail(str(d, "styleDetail"));
            return toMap(persistencePort.saveCard(e));
        }).orElse(null);
    }

    private Map<String, Object> updateCreator(Long sid, String uuid, Map<String, Object> d) {
        return readPort.findCreatorByStoryIdAndUuid(sid, uuid).map(e -> {
            if (d.containsKey("link")) e.setLink(str(d, "link"));
            if (d.containsKey("url")) e.setUrl(str(d, "url"));
            if (d.containsKey("urlImage")) e.setUrlImage(str(d, "urlImage"));
            return toMap(persistencePort.saveCreator(e));
        }).orElse(null);
    }

    // === Mapping ===
    private Map<String, Object> toMap(BaseStoryEntity e) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("uuid", e.getUuid());
        m.put("idStory", e.getIdStory());
        m.put("idCard", e.getIdCard());
        m.put("idTextName", e.getIdTextName());
        m.put("idTextDescription", e.getIdTextDescription());
        m.put("tsInsert", e.getTsInsert());
        m.put("tsUpdate", e.getTsUpdate());
        // Entity-specific fields
        if (e instanceof TextEntity) {
            TextEntity t = (TextEntity) e;
            m.put("idText", t.getIdText());
            m.put("lang", t.getLang());
            m.put("shortText", t.getShortText());
            m.put("longText", t.getLongText());
        } else if (e instanceof LocationEntity) {
            LocationEntity l = (LocationEntity) e;
            m.put("isSafe", l.getIsSafe());
            m.put("costEnergyEnter", l.getCostEnergyEnter());
            m.put("counterTime", l.getCounterTime());
            m.put("maxCharacters", l.getMaxCharacters());
        } else if (e instanceof EventEntity) {
            EventEntity ev = (EventEntity) e;
            m.put("type", ev.getType());
            m.put("costEnery", ev.getCostEnery());
            m.put("flagEndTime", ev.getFlagEndTime());
        } else if (e instanceof ItemEntity) {
            ItemEntity i = (ItemEntity) e;
            m.put("weight", i.getWeight());
            m.put("isConsumabile", i.getIsConsumabile());
        } else if (e instanceof StoryDifficultyEntity) {
            StoryDifficultyEntity d = (StoryDifficultyEntity) e;
            m.put("expCost", d.getExpCost());
            m.put("maxWeight", d.getMaxWeight());
            m.put("minCharacter", d.getMinCharacter());
            m.put("maxCharacter", d.getMaxCharacter());
        } else if (e instanceof CharacterTemplateEntity) {
            CharacterTemplateEntity ct = (CharacterTemplateEntity) e;
            m.put("lifeMax", ct.getLifeMax());
            m.put("energyMax", ct.getEnergyMax());
            m.put("sadMax", ct.getSadMax());
        } else if (e instanceof ClassEntity) {
            ClassEntity c = (ClassEntity) e;
            m.put("weightMax", c.getWeightMax());
            m.put("dexterityBase", c.getDexterityBase());
            m.put("intelligenceBase", c.getIntelligenceBase());
            m.put("constitutionBase", c.getConstitutionBase());
        } else if (e instanceof TraitEntity) {
            TraitEntity tr = (TraitEntity) e;
            m.put("costPositive", tr.getCostPositive());
            m.put("costNegative", tr.getCostNegative());
        } else if (e instanceof CardEntity) {
            CardEntity cd = (CardEntity) e;
            m.put("urlImmage", cd.getUrlImmage());
            m.put("alternativeImage", cd.getAlternativeImage());
            m.put("awesomeIcon", cd.getAwesomeIcon());
            m.put("styleMain", cd.getStyleMain());
            m.put("styleDetail", cd.getStyleDetail());
        } else if (e instanceof CreatorEntity) {
            CreatorEntity cr = (CreatorEntity) e;
            m.put("link", cr.getLink());
            m.put("url", cr.getUrl());
            m.put("urlImage", cr.getUrlImage());
        }
        return m;
    }

    private Map<String, Object> optMap(Optional<? extends BaseStoryEntity> opt) {
        return opt.map(this::toMap).orElse(null);
    }

    private List<Map<String, Object>> toMaps(List<? extends BaseStoryEntity> list) {
        if (list == null) return List.of();
        return list.stream().map(this::toMap).collect(Collectors.toList());
    }

    private Map<String, Object> storyToMap(StoryEntity s) {
        Map<String, Object> m = toMap(s);
        m.put("id", s.getId());
        m.put("author", s.getAuthor());
        m.put("category", s.getCategory());
        m.put("group", s.getGroup());
        m.put("visibility", s.getVisibility());
        m.put("priority", s.getPriority());
        m.put("peghi", s.getPeghi());
        return m;
    }

    private void applyBaseFields(BaseStoryEntity e, Map<String, Object> d) {
        if (d.containsKey("idTextName")) e.setIdTextName(intVal(d, "idTextName"));
        if (d.containsKey("idTextDescription")) e.setIdTextDescription(intVal(d, "idTextDescription"));
        if (d.containsKey("idCard")) e.setIdCard(intVal(d, "idCard"));
    }

    private void applyStoryFields(StoryEntity s, Map<String, Object> d) {
        applyBaseFields(s, d);
        if (d.containsKey("author")) s.setAuthor(str(d, "author"));
        if (d.containsKey("versionMin")) s.setVersionMin(str(d, "versionMin"));
        if (d.containsKey("versionMax")) s.setVersionMax(str(d, "versionMax"));
        if (d.containsKey("category")) s.setCategory(str(d, "category"));
        if (d.containsKey("group")) s.setGroup(str(d, "group"));
        if (d.containsKey("visibility")) s.setVisibility(str(d, "visibility"));
        if (d.containsKey("priority")) s.setPriority(intVal(d, "priority"));
        if (d.containsKey("peghi")) s.setPeghi(intVal(d, "peghi"));
        if (d.containsKey("idTextTitle")) s.setIdTextTitle(intVal(d, "idTextTitle"));
    }

    // === Utilities ===
    private boolean isBlank(String s) { return s == null || s.isBlank(); }
    private String str(Map<String, Object> d, String k) { Object v = d.get(k); return v != null ? v.toString() : null; }
    private Integer intVal(Map<String, Object> d, String k) {
        Object v = d.get(k);
        if (v instanceof Number) return ((Number) v).intValue();
        if (v instanceof String) { try { return Integer.parseInt((String) v); } catch (NumberFormatException e) { return null; } }
        return null;
    }
}
