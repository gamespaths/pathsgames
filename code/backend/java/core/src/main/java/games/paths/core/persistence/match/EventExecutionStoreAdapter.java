package games.paths.core.persistence.match;

import games.paths.core.entity.match.GamingCharacterInstanceEntity;
import games.paths.core.entity.match.GamingCharacterInstanceEntityId;
import games.paths.core.entity.match.GamingCharacterTraitsEntity;
import games.paths.core.entity.match.GamingInventoryItemsEntity;
import games.paths.core.entity.match.GamingStateRegistryEntity;
import games.paths.core.entity.match.LogEventsEntity;
import games.paths.core.entity.match.LogMovementEntity;
import games.paths.core.entity.story.ChoiceConditionEntity;
import games.paths.core.entity.story.ChoiceEntity;
import games.paths.core.entity.story.EventEffectEntity;
import games.paths.core.entity.story.EventEntity;
import games.paths.core.entity.story.ItemEntity;
import games.paths.core.entity.story.LocationEntity;
import games.paths.core.entity.story.StoryEntity;
import games.paths.core.entity.story.TextEntity;
import games.paths.core.entity.story.TraitEntity;
import games.paths.core.port.match.EventExecutionStorePort;
import games.paths.core.port.match.WeatherStorePort;
import games.paths.core.port.story.StoryReadPort;
import games.paths.core.repository.match.GamingBackpackResourcesRepository;
import games.paths.core.repository.match.GamingCharacterInstanceRepository;
import games.paths.core.repository.match.GamingCharacterTraitsRepository;
import games.paths.core.repository.match.GamingInventoryItemsRepository;
import games.paths.core.repository.match.GamingMatchRepository;
import games.paths.core.repository.match.GamingStateRegistryRepository;
import games.paths.core.repository.match.LogEventsRepository;
import games.paths.core.repository.match.LogMovementRepository;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * EventExecutionStoreAdapter - JPA adapter implementing {@link EventExecutionStorePort}
 * for the Step 29 event engine.
 *
 * <p>This is the first writer of {@code gaming_inventory_items}, the first to upsert a
 * single {@code gaming_state_registry} key, the first to add or remove a trait after join,
 * and the first to ever set {@code is_coma = true}.</p>
 *
 * <p>The match-scoped tables have a composite {@code (id, id_match)} primary key whose id
 * is allocated by the application, so a new row takes the match-wide max plus one — never
 * a global max and never a row count (which would collide after a delete).</p>
 */
@Repository
@Transactional
public class EventExecutionStoreAdapter implements EventExecutionStorePort {

    private final GamingMatchRepository matchRepository;
    private final GamingCharacterInstanceRepository characterRepository;
    private final GamingBackpackResourcesRepository backpackRepository;
    private final GamingInventoryItemsRepository inventoryRepository;
    private final GamingCharacterTraitsRepository traitsRepository;
    private final GamingStateRegistryRepository registryRepository;
    private final LogEventsRepository logEventsRepository;
    private final LogMovementRepository logMovementRepository;
    private final StoryReadPort storyReadPort;
    private final WeatherStorePort weatherStorePort;

    @SuppressWarnings("java:S107") // one collaborator per table the event engine touches
    public EventExecutionStoreAdapter(GamingMatchRepository matchRepository,
                                      GamingCharacterInstanceRepository characterRepository,
                                      GamingBackpackResourcesRepository backpackRepository,
                                      GamingInventoryItemsRepository inventoryRepository,
                                      GamingCharacterTraitsRepository traitsRepository,
                                      GamingStateRegistryRepository registryRepository,
                                      LogEventsRepository logEventsRepository,
                                      LogMovementRepository logMovementRepository,
                                      StoryReadPort storyReadPort,
                                      WeatherStorePort weatherStorePort) {
        this.matchRepository = matchRepository;
        this.characterRepository = characterRepository;
        this.backpackRepository = backpackRepository;
        this.inventoryRepository = inventoryRepository;
        this.traitsRepository = traitsRepository;
        this.registryRepository = registryRepository;
        this.logEventsRepository = logEventsRepository;
        this.logMovementRepository = logMovementRepository;
        this.storyReadPort = storyReadPort;
        this.weatherStorePort = weatherStorePort;
    }

    // ── resolve ─────────────────────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public Optional<MatchEventView> findMatchByUuid(String uuid) {
        return matchRepository.findByUuid(uuid).map(m -> new MatchEventView(
                m.getId(), m.getUuid(), m.getStatus(), nz(m.getCurrentClock()),
                m.getIdStory() == null ? 0L : m.getIdStory(), m.getIdUserCreator(),
                m.getIdCurrentWeather()));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<EventActorView> findCharacterByMatchAndUser(long idMatch, long idUser) {
        return characterRepository.findByIdMatchAndIdUser(idMatch, idUser)
                .map(EventExecutionStoreAdapter::toActor);
    }

    @Override
    @Transactional(readOnly = true)
    public List<EventActorView> findCharactersByMatchId(long idMatch) {
        List<EventActorView> out = new ArrayList<>();
        for (GamingCharacterInstanceEntity c : characterRepository.findByIdMatch(idMatch)) {
            out.add(toActor(c));
        }
        return out;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<BackpackStats> findBackpack(long idMatch, long idCharacter) {
        return backpackRepository.findByIdMatchAndIdCharacterMatch(idMatch, idCharacter)
                .map(b -> new BackpackStats(nz(b.getFood()), nz(b.getMagic()), nz(b.getCoin())));
    }

    // ── story reads ─────────────────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public Optional<EventEntity> findEventByStoryAndUuid(long idStory, String eventUuid) {
        return storyReadPort.findEventByStoryIdAndUuid(idStory, eventUuid);
    }

    @Override
    @Transactional(readOnly = true)
    public Map<Long, EventEntity> findEventsById(long idStory) {
        Map<Long, EventEntity> out = new HashMap<>();
        for (EventEntity e : storyReadPort.findEventsByStoryId(idStory)) {
            if (e.getId() != null) {
                out.put(e.getId(), e);
            }
        }
        return out;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<Long, List<EventEffectEntity>> findEffectsByEventId(long idStory) {
        List<EventEffectEntity> all = new ArrayList<>(storyReadPort.findEventEffectsByStoryId(idStory));
        // Effects of one event apply in authored order, so a later effect can build on an
        // earlier one (e.g. write a registry key that the next effect's event reads).
        all.sort((a, b) -> Long.compare(nzL(a.getId()), nzL(b.getId())));
        Map<Long, List<EventEffectEntity>> out = new LinkedHashMap<>();
        for (EventEffectEntity ee : all) {
            if (ee.getIdEvent() != null) {
                out.computeIfAbsent(ee.getIdEvent().longValue(), k -> new ArrayList<>()).add(ee);
            }
        }
        return out;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Long> findIdEventEndGame(long idStory) {
        return storyReadPort.findStoryById(idStory)
                .map(StoryEntity::getIdEventEndGame)
                .filter(java.util.Objects::nonNull)
                .map(Integer::longValue);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Long> findIdEventAllPlayerComa(long idStory) {
        return storyReadPort.findStoryById(idStory)
                .map(StoryEntity::getIdEventAllPlayerComa)
                .filter(java.util.Objects::nonNull)
                .map(Integer::longValue);
    }

    @Override
    @Transactional(readOnly = true)
    public Map<Long, String> findItemUuidsById(long idStory) {
        Map<Long, String> out = new HashMap<>();
        for (ItemEntity i : storyReadPort.findItemsByStoryId(idStory)) {
            if (i.getId() != null) {
                out.put(i.getId(), i.getUuid());
            }
        }
        return out;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<Long, String> findTraitUuidsById(long idStory) {
        Map<Long, String> out = new HashMap<>();
        for (TraitEntity t : storyReadPort.findTraitsByStoryId(idStory)) {
            if (t.getId() != null) {
                out.put(t.getId(), t.getUuid());
            }
        }
        return out;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<Long, String> findLocationUuidsById(long idStory) {
        Map<Long, String> out = new HashMap<>();
        for (LocationEntity l : storyReadPort.findLocationsByStoryId(idStory)) {
            if (l.getId() != null) {
                out.put(l.getId(), l.getUuid());
            }
        }
        return out;
    }

    // ── the check context ───────────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public EventCheckContext loadCheckContext(long idMatch, Long idCharacter) {
        if (idCharacter == null) {
            return EventCheckContext.noCharacter();
        }
        GamingCharacterInstanceEntity c = characterRepository
                .findById(new GamingCharacterInstanceEntityId(idCharacter, idMatch))
                .orElse(null);
        if (c == null) {
            return EventCheckContext.noCharacter();
        }

        int coin = backpackRepository.findByIdMatchAndIdCharacterMatch(idMatch, idCharacter)
                .map(b -> nz(b.getCoin()))
                .orElse(0);

        Set<Long> ownedItems = new HashSet<>();
        for (GamingInventoryItemsEntity i : inventoryRepository
                .findByIdMatchAndIdCharacterMatch(idMatch, idCharacter)) {
            if (i.getIdItem() != null && nz(i.getAmount()) > 0) {
                ownedItems.add(i.getIdItem());
            }
        }

        Map<String, String> registry = new HashMap<>();
        for (GamingStateRegistryEntity r : registryRepository.findByIdMatch(idMatch)) {
            if (r.getKey() != null) {
                registry.put(r.getKey(), registryValue(r));
            }
        }

        Long currentWeather = matchRepository.findById(idMatch)
                .map(games.paths.core.entity.match.GamingMatchEntity::getIdCurrentWeather)
                .orElse(null);

        return new EventCheckContext(idCharacter, c.getIdLocation(),
                Boolean.TRUE.equals(c.getIsSleeping()), Boolean.TRUE.equals(c.getIsComa()),
                nz(c.getEnergy()), coin, c.getIdClass(), ownedItems, currentWeather,
                consumedEventIds(idMatch), registry);
    }

    /**
     * The ONCE events already spent in this match.
     *
     * <p>Only rows written by an actual execution count. {@code logCounterZero} (Step 26) and
     * {@code logWeatherEvent} (Step 27) also stamp {@code id_event} on {@code log_events}
     * rows — for events that merely got <em>referenced</em>, never run. Trusting
     * {@code id_event} alone would burn a ONCE event the player never triggered, so the scan
     * is anchored on the {@link #MSG_EVENT_EXECUTED} marker.</p>
     */
    private Set<Long> consumedEventIds(long idMatch) {
        Set<Long> consumed = new HashSet<>();
        for (LogEventsEntity l : logEventsRepository.findByIdMatchOrderByIdAsc(idMatch)) {
            String msg = l.getLogMessage();
            if (msg != null && msg.startsWith(MSG_EVENT_EXECUTED) && l.getIdEvent() != null) {
                consumed.add(l.getIdEvent());
            }
        }
        return consumed;
    }

    // ── writes ──────────────────────────────────────────────────────────────

    @Override
    public void updateCharacterStats(long idMatch, long idCharacter, CharacterStats stats) {
        characterRepository.findById(new GamingCharacterInstanceEntityId(idCharacter, idMatch))
                .ifPresent(c -> {
                    c.setDexterity(stats.dexterity());
                    c.setIntelligence(stats.intelligence());
                    c.setConstitution(stats.constitution());
                    c.setEnergy(stats.energy());
                    c.setLife(stats.life());
                    c.setSad(stats.sad());
                    c.setExp(stats.exp());
                    characterRepository.save(c);
                });
    }

    @Override
    public void updateBackpack(long idMatch, long idCharacter, BackpackStats stats) {
        backpackRepository.findByIdMatchAndIdCharacterMatch(idMatch, idCharacter)
                .ifPresent(b -> {
                    b.setFood(stats.food());
                    b.setMagic(stats.magic());
                    b.setCoin(stats.coin());
                    backpackRepository.save(b);
                });
    }

    @Override
    public void setCharacterCharacteristics(long idMatch, long idCharacter, String csv) {
        characterRepository.findById(new GamingCharacterInstanceEntityId(idCharacter, idMatch))
                .ifPresent(c -> {
                    c.setCharacteristics(csv);
                    characterRepository.save(c);
                });
    }

    @Override
    public void addItem(long idMatch, long idCharacter, long idItem) {
        for (GamingInventoryItemsEntity i : inventoryRepository
                .findByIdMatchAndIdCharacterMatch(idMatch, idCharacter)) {
            if (i.getIdItem() != null && i.getIdItem() == idItem) {
                i.setAmount(nz(i.getAmount()) + 1);
                inventoryRepository.save(i);
                return;
            }
        }
        GamingInventoryItemsEntity e = new GamingInventoryItemsEntity();
        e.setId(nextInventoryId(idMatch));
        e.setIdMatch(idMatch);
        e.setIdCharacterMatch(idCharacter);
        e.setIdItem(idItem);
        e.setAmount(1);
        inventoryRepository.save(e);
    }

    @Override
    public boolean removeItem(long idMatch, long idCharacter, long idItem) {
        for (GamingInventoryItemsEntity i : inventoryRepository
                .findByIdMatchAndIdCharacterMatch(idMatch, idCharacter)) {
            if (i.getIdItem() != null && i.getIdItem() == idItem && nz(i.getAmount()) > 0) {
                int left = nz(i.getAmount()) - 1;
                if (left <= 0) {
                    inventoryRepository.delete(i);
                } else {
                    i.setAmount(left);
                    inventoryRepository.save(i);
                }
                return true;
            }
        }
        return false;
    }

    @Override
    public boolean addTrait(long idMatch, long idCharacter, long idTrait, Long idEvent) {
        for (GamingCharacterTraitsEntity t : traitsRepository
                .findByIdMatchAndIdCharacterMatch(idMatch, idCharacter)) {
            if (t.getIdTraits() != null && t.getIdTraits() == idTrait) {
                return false;
            }
        }
        GamingCharacterTraitsEntity e = new GamingCharacterTraitsEntity();
        e.setId(nextTraitId(idMatch));
        e.setIdMatch(idMatch);
        e.setIdCharacterMatch(idCharacter);
        e.setIdTraits(idTrait);
        e.setIdEvent(idEvent);
        traitsRepository.save(e);
        return true;
    }

    @Override
    public boolean removeTrait(long idMatch, long idCharacter, long idTrait) {
        for (GamingCharacterTraitsEntity t : traitsRepository
                .findByIdMatchAndIdCharacterMatch(idMatch, idCharacter)) {
            if (t.getIdTraits() != null && t.getIdTraits() == idTrait) {
                traitsRepository.delete(t);
                return true;
            }
        }
        return false;
    }

    @Override
    public void upsertRegistry(long idMatch, String key, String value,
                               Long idCharacter, Long idEvent, int clock) {
        if (key == null || key.isBlank()) {
            return;
        }
        List<GamingStateRegistryEntity> rows = registryRepository.findByIdMatch(idMatch);
        for (GamingStateRegistryEntity r : rows) {
            if (key.equals(r.getKey())) {
                applyValue(r, value);
                r.setIdCharacter(idCharacter);
                r.setIdEvent(idEvent);
                r.setClock(clock);
                registryRepository.save(r);
                return;
            }
        }
        GamingStateRegistryEntity e = new GamingStateRegistryEntity();
        e.setId(nextId(rows.stream().map(GamingStateRegistryEntity::getId)));
        e.setIdMatch(idMatch);
        e.setKey(key);
        applyValue(e, value);
        e.setIdCharacter(idCharacter);
        e.setIdEvent(idEvent);
        e.setClock(clock);
        registryRepository.save(e);
    }

    @Override
    public void setCurrentWeather(long idMatch, Long idWeather) {
        weatherStorePort.setCurrentWeather(idMatch, idWeather);
    }

    @Override
    public void updateCharacterLocation(long idMatch, long idCharacter, long idLocation) {
        characterRepository.findById(new GamingCharacterInstanceEntityId(idCharacter, idMatch))
                .ifPresent(c -> {
                    c.setIdLocation(idLocation);
                    characterRepository.save(c);
                });
    }

    @Override
    public void insertMovementLog(long idMatch, long idCharacter, Long fromLocation, long toLocation, int energyCost) {
        LogMovementEntity e = new LogMovementEntity();
        e.setId(logMovementRepository.findMaxId() + 1);
        e.setIdMatch(idMatch);
        e.setIdCharacterMatch(idCharacter);
        e.setIdLocationFrom(fromLocation);
        e.setIdLocationTo(toLocation);
        e.setEnergy(energyCost);
        logMovementRepository.save(e);
    }

    @Override
    public void logEventExecuted(long idMatch, Long idCharacter, long idEvent, int clock, String message) {
        LogEventsEntity e = new LogEventsEntity();
        e.setId(logEventsRepository.findMaxId() + 1);
        e.setIdMatch(idMatch);
        e.setIdCharacterMatch(idCharacter);
        e.setIdEvent(idEvent);
        e.setClock(clock);
        e.setLogMessage(message);
        logEventsRepository.save(e);
    }

    // ── choices (Step 31) ───────────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public List<ChoiceEntity> findChoicesByEventId(long idStory, long idEvent) {
        List<ChoiceEntity> out = new ArrayList<>();
        for (ChoiceEntity c : storyReadPort.findChoicesByStoryId(idStory)) {
            if (c.getIdEvent() != null && c.getIdEvent().longValue() == idEvent) {
                out.add(c);
            }
        }
        return out;
    }

    @Override
    @Transactional(readOnly = true)
    public Map<Long, List<ChoiceConditionEntity>> findChoiceConditionsByChoiceId(long idStory) {
        List<ChoiceConditionEntity> all =
                new ArrayList<>(storyReadPort.findChoiceConditionsByStoryId(idStory));
        // Deterministic order inside each option: under AND the FIRST failing row names
        // the reason the player sees, so it must not depend on the read order.
        all.sort((a, b) -> Long.compare(nzL(a.getId()), nzL(b.getId())));
        Map<Long, List<ChoiceConditionEntity>> out = new LinkedHashMap<>();
        for (ChoiceConditionEntity cc : all) {
            if (cc.getIdChoices() != null) {
                out.computeIfAbsent(cc.getIdChoices().longValue(), k -> new ArrayList<>()).add(cc);
            }
        }
        return out;
    }

    @Override
    @Transactional(readOnly = true)
    public int countLogMarkers(long idMatch, long idEvent, String prefix) {
        int count = 0;
        for (LogEventsEntity l : logEventsRepository.findByIdMatchOrderByIdAsc(idMatch)) {
            String msg = l.getLogMessage();
            if (msg != null && msg.startsWith(prefix)
                    && l.getIdEvent() != null && l.getIdEvent() == idEvent) {
                count++;
            }
        }
        return count;
    }

    @Override
    @Transactional(readOnly = true)
    public Set<Long> findTraitIdsByCharacter(long idMatch, long idCharacter) {
        Set<Long> out = new HashSet<>();
        for (GamingCharacterTraitsEntity t : traitsRepository
                .findByIdMatchAndIdCharacterMatch(idMatch, idCharacter)) {
            if (t.getIdTraits() != null) {
                out.add(t.getIdTraits());
            }
        }
        return out;
    }

    @Override
    @Transactional(readOnly = true)
    public String resolveShortText(long idStory, Integer idText, String lang) {
        if (idText == null) {
            return null;
        }
        // Same resolution as ContentQueryService.resolveText: requested lang, then "en".
        String effectiveLang = (lang == null || lang.isBlank()) ? "en" : lang;
        Optional<TextEntity> text =
                storyReadPort.findTextByStoryIdTextAndLang(idStory, idText, effectiveLang);
        if (text.isEmpty() && !"en".equals(effectiveLang)) {
            text = storyReadPort.findTextByStoryIdTextAndLang(idStory, idText, "en");
        }
        return text.map(TextEntity::getShortText).orElse(null);
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    /** A numeric value lands in int_value, anything else in string_value (never both). */
    private static void applyValue(GamingStateRegistryEntity r, String value) {
        if (value == null) {
            r.setStringValue(null);
            r.setIntValue(null);
            return;
        }
        try {
            r.setIntValue(Integer.valueOf(value.trim()));
            r.setStringValue(null);
        } catch (NumberFormatException notNumeric) {
            r.setStringValue(value);
            r.setIntValue(null);
        }
    }

    /** Mirrors WeatherStoreAdapter.findRegistryValue: the string wins, else the int. */
    private static String registryValue(GamingStateRegistryEntity r) {
        if (r.getStringValue() != null) {
            return r.getStringValue();
        }
        return r.getIntValue() == null ? null : String.valueOf(r.getIntValue());
    }

    private long nextInventoryId(long idMatch) {
        return nextId(inventoryRepository.findByIdMatch(idMatch).stream()
                .map(GamingInventoryItemsEntity::getId));
    }

    private long nextTraitId(long idMatch) {
        return nextId(traitsRepository.findByIdMatch(idMatch).stream()
                .map(GamingCharacterTraitsEntity::getId));
    }

    private static long nextId(java.util.stream.Stream<Long> ids) {
        return ids.filter(java.util.Objects::nonNull).mapToLong(Long::longValue).max().orElse(0L) + 1L;
    }

    private static EventActorView toActor(GamingCharacterInstanceEntity c) {
        return new EventActorView(
                c.getId(), c.getUuid(), c.getIdUser(), c.getIdClass(), c.getIdLocation(),
                nz(c.getDexterity()), nz(c.getIntelligence()), nz(c.getConstitution()),
                nz(c.getEnergy()), nz(c.getLife()), nz(c.getSad()), nz(c.getExp()),
                nz(c.getEnergyMax()), nz(c.getLifeMax()), nz(c.getSadMax()),
                Boolean.TRUE.equals(c.getIsSleeping()), Boolean.TRUE.equals(c.getIsComa()),
                c.getCharacteristics());
    }

    private static int nz(Integer v) {
        return v == null ? 0 : v;
    }

    private static long nzL(Long v) {
        return v == null ? 0L : v;
    }
}
