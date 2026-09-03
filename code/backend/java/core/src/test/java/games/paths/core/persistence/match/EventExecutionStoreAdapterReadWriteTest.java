package games.paths.core.persistence.match;

import games.paths.core.entity.match.GamingBackpackResourcesEntity;
import games.paths.core.entity.match.GamingCharacterInstanceEntity;
import games.paths.core.entity.match.GamingCharacterTraitsEntity;
import games.paths.core.entity.match.GamingInventoryItemsEntity;
import games.paths.core.entity.match.GamingMatchEntity;
import games.paths.core.entity.match.GamingStateRegistryEntity;
import games.paths.core.entity.match.GamingStoryProgressEntity;
import games.paths.core.entity.match.LogChoicesExecutedEntity;
import games.paths.core.entity.match.LogEventsEntity;
import games.paths.core.entity.story.ChoiceConditionEntity;
import games.paths.core.entity.story.ChoiceEffectEntity;
import games.paths.core.entity.story.ChoiceEntity;
import games.paths.core.entity.story.EventEffectEntity;
import games.paths.core.entity.story.EventEntity;
import games.paths.core.entity.story.ItemEntity;
import games.paths.core.entity.story.LocationEntity;
import games.paths.core.entity.story.StoryEntity;
import games.paths.core.entity.story.TextEntity;
import games.paths.core.entity.story.TraitEntity;
import games.paths.core.port.match.EventExecutionStorePort;
import games.paths.core.port.match.EventExecutionStorePort.BackpackStats;
import games.paths.core.port.match.EventExecutionStorePort.CharacterStats;
import games.paths.core.port.match.EventExecutionStorePort.EventActorView;
import games.paths.core.port.match.EventExecutionStorePort.EventCheckContext;
import games.paths.core.port.match.EventExecutionStorePort.MatchEventView;
import games.paths.core.port.match.WeatherStorePort;
import games.paths.core.port.story.StoryReadPort;
import games.paths.core.repository.match.GamingBackpackResourcesRepository;
import games.paths.core.repository.match.GamingCharacterInstanceRepository;
import games.paths.core.repository.match.GamingCharacterTraitsRepository;
import games.paths.core.repository.match.GamingInventoryItemsRepository;
import games.paths.core.repository.match.GamingMatchRepository;
import games.paths.core.repository.match.GamingStateRegistryRepository;
import games.paths.core.repository.match.GamingStoryProgressRepository;
import games.paths.core.repository.match.LogChoicesExecutedRepository;
import games.paths.core.repository.match.LogEventsRepository;
import games.paths.core.repository.match.LogItemUsageRepository;
import games.paths.core.repository.match.LogMovementRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static games.paths.core.port.match.EventExecutionStorePort.MSG_CHOICE_SELECTED;
import static games.paths.core.port.match.EventExecutionStorePort.MSG_EVENT_EXECUTED;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * EventExecutionStoreAdapter — the Step 29/30 reads (match, actors, backpack, story lookups,
 * the one-shot check context) and the writes (stats, backpack, inventory, traits, registry,
 * weather, event log).
 */
class EventExecutionStoreAdapterReadWriteTest {

    private GamingMatchRepository matchRepository;
    private GamingCharacterInstanceRepository characterRepository;
    private GamingBackpackResourcesRepository backpackRepository;
    private GamingInventoryItemsRepository inventoryRepository;
    private GamingCharacterTraitsRepository traitsRepository;
    private games.paths.core.port.match.RegistryStorePort registryStorePort;
    private LogEventsRepository logEventsRepository;
    private LogMovementRepository logMovementRepository;
    private LogItemUsageRepository logItemUsageRepository;
    private LogChoicesExecutedRepository logChoicesRepository;
    private GamingStoryProgressRepository storyProgressRepository;
    private StoryReadPort storyReadPort;
    private WeatherStorePort weatherStorePort;
    private EventExecutionStoreAdapter adapter;

    @BeforeEach
    void setUp() {
        matchRepository = mock(GamingMatchRepository.class);
        characterRepository = mock(GamingCharacterInstanceRepository.class);
        backpackRepository = mock(GamingBackpackResourcesRepository.class);
        inventoryRepository = mock(GamingInventoryItemsRepository.class);
        traitsRepository = mock(GamingCharacterTraitsRepository.class);
        registryStorePort = mock(games.paths.core.port.match.RegistryStorePort.class);
        logEventsRepository = mock(LogEventsRepository.class);
        logMovementRepository = mock(LogMovementRepository.class);
        logItemUsageRepository = mock(LogItemUsageRepository.class);
        logChoicesRepository = mock(LogChoicesExecutedRepository.class);
        storyProgressRepository = mock(GamingStoryProgressRepository.class);
        storyReadPort = mock(StoryReadPort.class);
        weatherStorePort = mock(WeatherStorePort.class);
        adapter = new EventExecutionStoreAdapter(matchRepository, characterRepository,
                backpackRepository, inventoryRepository, traitsRepository, registryStorePort,
                logEventsRepository, logItemUsageRepository, logMovementRepository,
                logChoicesRepository, storyProgressRepository, storyReadPort, weatherStorePort);
    }

    // ── fixtures ────────────────────────────────────────────────────────────

    private static GamingMatchEntity match() {
        GamingMatchEntity m = new GamingMatchEntity();
        m.setId(1L);
        m.setUuid("match-uuid");
        m.setStatus("RUNNING");
        m.setCurrentClock(5);
        m.setIdStory(9L);
        m.setIdUserCreator(4L);
        m.setIdCurrentWeather(77L);
        return m;
    }

    private static GamingCharacterInstanceEntity character() {
        GamingCharacterInstanceEntity c = new GamingCharacterInstanceEntity();
        c.setId(3L);
        c.setIdMatch(1L);
        c.setUuid("char-uuid");
        c.setIdUser(4L);
        c.setIdClass(2L);
        c.setIdLocation(100L);
        c.setDexterity(1);
        c.setIntelligence(2);
        c.setConstitution(3);
        c.setEnergy(4);
        c.setLife(5);
        c.setSad(6);
        c.setExp(7);
        c.setEnergyMax(10);
        c.setLifeMax(11);
        c.setSadMax(12);
        c.setIsSleeping(true);
        c.setIsComa(false);
        c.setCharacteristics("brave,tall");
        return c;
    }

    private static GamingInventoryItemsEntity inventoryRow(long id, Long idItem, Integer amount) {
        GamingInventoryItemsEntity i = new GamingInventoryItemsEntity();
        i.setId(id);
        i.setIdMatch(1L);
        i.setIdCharacterMatch(3L);
        i.setIdItem(idItem);
        i.setAmount(amount);
        return i;
    }

    private static GamingCharacterTraitsEntity traitRow(long id, Long idTrait) {
        GamingCharacterTraitsEntity t = new GamingCharacterTraitsEntity();
        t.setId(id);
        t.setIdMatch(1L);
        t.setIdCharacterMatch(3L);
        t.setIdTraits(idTrait);
        return t;
    }

    // ── resolve ─────────────────────────────────────────────────────────────

    @Test
    void findMatchByUuid_mapsEveryColumn() {
        when(matchRepository.findByUuid("match-uuid")).thenReturn(Optional.of(match()));

        MatchEventView v = adapter.findMatchByUuid("match-uuid").orElseThrow();

        assertEquals(1L, v.id());
        assertEquals("match-uuid", v.uuid());
        assertEquals("RUNNING", v.status());
        assertEquals(5, v.currentClock());
        assertEquals(9L, v.idStory());
        assertEquals(4L, v.idUserCreator());
        assertEquals(77L, v.idCurrentWeather());
    }

    @Test
    void findMatchByUuid_nullClockAndStoryDegradeToZero_andMissingIsEmpty() {
        GamingMatchEntity m = match();
        m.setCurrentClock(null);
        m.setIdStory(null);
        when(matchRepository.findByUuid("bare")).thenReturn(Optional.of(m));

        MatchEventView v = adapter.findMatchByUuid("bare").orElseThrow();
        assertEquals(0, v.currentClock());
        assertEquals(0L, v.idStory());

        when(matchRepository.findByUuid("nope")).thenReturn(Optional.empty());
        assertTrue(adapter.findMatchByUuid("nope").isEmpty());
    }

    @Test
    void findCharacterByMatchAndUser_mapsTheActor() {
        when(characterRepository.findByIdMatchAndIdUser(1L, 4L))
                .thenReturn(Optional.of(character()));

        EventActorView a = adapter.findCharacterByMatchAndUser(1L, 4L).orElseThrow();

        assertEquals(3L, a.id());
        assertEquals("char-uuid", a.uuid());
        assertEquals(4L, a.idUser());
        assertEquals(2L, a.idClass());
        assertEquals(100L, a.idLocation());
        assertEquals(1, a.dexterity());
        assertEquals(2, a.intelligence());
        assertEquals(3, a.constitution());
        assertEquals(4, a.energy());
        assertEquals(5, a.life());
        assertEquals(6, a.sad());
        assertEquals(7, a.exp());
        assertEquals(10, a.energyMax());
        assertEquals(11, a.lifeMax());
        assertEquals(12, a.sadMax());
        assertTrue(a.isSleeping());
        assertFalse(a.isComa());
        assertEquals("brave,tall", a.characteristics());
    }

    @Test
    void findCharacterByMatchAndUser_emptyWhenNoCharacter() {
        when(characterRepository.findByIdMatchAndIdUser(1L, 99L)).thenReturn(Optional.empty());
        assertTrue(adapter.findCharacterByMatchAndUser(1L, 99L).isEmpty());
    }

    @Test
    void findCharactersByMatchId_nullNumericsBecomeZero() {
        GamingCharacterInstanceEntity bare = new GamingCharacterInstanceEntity();
        bare.setId(8L);
        bare.setUuid("bare");
        bare.setIdUser(4L);
        when(characterRepository.findByIdMatch(1L)).thenReturn(List.of(character(), bare));

        List<EventActorView> out = adapter.findCharactersByMatchId(1L);

        assertEquals(2, out.size());
        EventActorView b = out.get(1);
        assertEquals(0, b.dexterity());
        assertEquals(0, b.energy());
        assertEquals(0, b.sadMax());
        assertFalse(b.isSleeping());
        assertFalse(b.isComa());
        assertNull(b.characteristics());
    }

    @Test
    void findBackpack_mapsAndDefaultsNullsToZero() {
        GamingBackpackResourcesEntity b = new GamingBackpackResourcesEntity();
        b.setFood(3);
        b.setMagic(null);
        b.setCoin(9);
        when(backpackRepository.findByIdMatchAndIdCharacterMatch(1L, 3L)).thenReturn(Optional.of(b));

        BackpackStats s = adapter.findBackpack(1L, 3L).orElseThrow();
        assertEquals(3, s.food());
        assertEquals(0, s.magic());
        assertEquals(9, s.coin());

        when(backpackRepository.findByIdMatchAndIdCharacterMatch(1L, 99L)).thenReturn(Optional.empty());
        assertTrue(adapter.findBackpack(1L, 99L).isEmpty());
    }

    // ── story reads ─────────────────────────────────────────────────────────

    @Test
    void findEventByStoryAndUuid_delegatesToStoryReadPort() {
        EventEntity e = new EventEntity();
        e.setId(12L);
        when(storyReadPort.findEventByStoryIdAndUuid(9L, "ev")).thenReturn(Optional.of(e));

        assertSame(e, adapter.findEventByStoryAndUuid(9L, "ev").orElseThrow());
    }

    @Test
    void findEventsById_keysOnIdAndSkipsNullIds() {
        EventEntity a = new EventEntity();
        a.setId(12L);
        EventEntity broken = new EventEntity();
        when(storyReadPort.findEventsByStoryId(9L)).thenReturn(List.of(a, broken));

        Map<Long, EventEntity> out = adapter.findEventsById(9L);

        assertEquals(1, out.size());
        assertSame(a, out.get(12L));
    }

    @Test
    void findEffectsByEventId_groupsByEventAndOrdersByEffectId() {
        EventEffectEntity second = effect(20L, 5);
        EventEffectEntity first = effect(10L, 5);
        EventEffectEntity other = effect(15L, 6);
        EventEffectEntity orphan = effect(1L, null);
        when(storyReadPort.findEventEffectsByStoryId(9L))
                .thenReturn(List.of(second, other, first, orphan));

        Map<Long, List<EventEffectEntity>> out = adapter.findEffectsByEventId(9L);

        assertEquals(2, out.size());
        assertEquals(List.of(first, second), out.get(5L));
        assertEquals(List.of(other), out.get(6L));
    }

    @Test
    void findEffectsByEventId_nullEffectIdSortsFirst() {
        EventEffectEntity withId = effect(10L, 5);
        EventEffectEntity noId = effect(null, 5);
        when(storyReadPort.findEventEffectsByStoryId(9L)).thenReturn(List.of(withId, noId));

        assertEquals(List.of(noId, withId), adapter.findEffectsByEventId(9L).get(5L));
    }

    private static EventEffectEntity effect(Long id, Integer idEvent) {
        EventEffectEntity e = new EventEffectEntity();
        e.setId(id);
        e.setIdEvent(idEvent);
        return e;
    }

    @Test
    void findIdEventEndGame_andAllPlayerComa_widenToLongOrEmpty() {
        StoryEntity s = new StoryEntity();
        s.setId(9L);
        s.setIdEventEndGame(42);
        s.setIdEventAllPlayerComa(null);
        when(storyReadPort.findStoryById(9L)).thenReturn(Optional.of(s));

        assertEquals(42L, adapter.findIdEventEndGame(9L).orElseThrow());
        assertTrue(adapter.findIdEventAllPlayerComa(9L).isEmpty());

        when(storyReadPort.findStoryById(8L)).thenReturn(Optional.empty());
        assertTrue(adapter.findIdEventEndGame(8L).isEmpty());
        assertTrue(adapter.findIdEventAllPlayerComa(8L).isEmpty());
    }

    @Test
    void findIdEventAllPlayerComa_presentWhenAuthored() {
        StoryEntity s = new StoryEntity();
        s.setId(9L);
        s.setIdEventAllPlayerComa(66);
        when(storyReadPort.findStoryById(9L)).thenReturn(Optional.of(s));

        assertEquals(66L, adapter.findIdEventAllPlayerComa(9L).orElseThrow());
    }

    @Test
    void findItemUuidsById_mapsAndSkipsNullIds() {
        ItemEntity a = new ItemEntity();
        a.setId(1L);
        a.setUuid("item-a");
        ItemEntity broken = new ItemEntity();
        broken.setUuid("no-id");
        when(storyReadPort.findItemsByStoryId(9L)).thenReturn(List.of(a, broken));

        assertEquals(Map.of(1L, "item-a"), adapter.findItemUuidsById(9L));
    }

    @Test
    void findTraitUuidsById_mapsAndSkipsNullIds() {
        TraitEntity a = new TraitEntity();
        a.setId(2L);
        a.setUuid("trait-a");
        TraitEntity broken = new TraitEntity();
        broken.setUuid("no-id");
        when(storyReadPort.findTraitsByStoryId(9L)).thenReturn(List.of(a, broken));

        assertEquals(Map.of(2L, "trait-a"), adapter.findTraitUuidsById(9L));
    }

    @Test
    void findLocationUuidsById_mapsLocations() {
        LocationEntity a = new LocationEntity();
        a.setId(100L);
        a.setUuid("loc-a");
        when(storyReadPort.findLocationsByStoryId(9L)).thenReturn(List.of(a));

        assertEquals(Map.of(100L, "loc-a"), adapter.findLocationUuidsById(9L));
    }

    // ── the check context ───────────────────────────────────────────────────

    @Test
    void loadCheckContext_nullCharacterYieldsTheEmptyContext() {
        EventCheckContext ctx = adapter.loadCheckContext(1L, null);

        assertNull(ctx.idCharacter());
        assertNull(ctx.idLocation());
        assertFalse(ctx.sleeping());
        assertFalse(ctx.coma());
        assertEquals(0, ctx.energy());
        assertEquals(0, ctx.coin());
        assertTrue(ctx.ownedItemIds().isEmpty());
        assertTrue(ctx.registry().isEmpty());
        verifyNoInteractions(characterRepository);
    }

    @Test
    void loadCheckContext_unknownCharacterYieldsTheEmptyContext() {
        when(characterRepository.findById(any())).thenReturn(Optional.empty());

        assertNull(adapter.loadCheckContext(1L, 3L).idCharacter());
    }

    @Test
    void loadCheckContext_loadsEverythingInOneShot() {
        when(characterRepository.findById(any())).thenReturn(Optional.of(character()));
        GamingBackpackResourcesEntity b = new GamingBackpackResourcesEntity();
        b.setCoin(30);
        when(backpackRepository.findByIdMatchAndIdCharacterMatch(1L, 3L)).thenReturn(Optional.of(b));
        when(inventoryRepository.findByIdMatchAndIdCharacterMatch(1L, 3L)).thenReturn(List.of(
                inventoryRow(1L, 500L, 2),
                inventoryRow(2L, 501L, 0),      // amount 0 → not owned
                inventoryRow(3L, null, 5)));    // no item id → skipped
        when(registryStorePort.findByMatch(1L)).thenReturn(List.of(
                registryRow("flag", "yes", null),
                registryRow("count", null, 7),
                registryRow("empty", null, null),
                registryRow(null, "orphan", null)));
        LogEventsEntity executed = new LogEventsEntity();
        executed.setLogMessage(MSG_EVENT_EXECUTED + "#12");
        executed.setIdEvent(12L);
        LogEventsEntity referencedOnly = new LogEventsEntity();
        referencedOnly.setLogMessage("WEATHER_EVENT");
        referencedOnly.setIdEvent(13L);
        LogEventsEntity noMessage = new LogEventsEntity();
        noMessage.setIdEvent(14L);
        LogEventsEntity executedNoId = new LogEventsEntity();
        executedNoId.setLogMessage(MSG_EVENT_EXECUTED + "#none");
        when(logEventsRepository.findByIdMatchOrderByIdAsc(1L))
                .thenReturn(List.of(executed, referencedOnly, noMessage, executedNoId));
        when(matchRepository.findById(1L)).thenReturn(Optional.of(match()));

        EventCheckContext ctx = adapter.loadCheckContext(1L, 3L);

        assertEquals(3L, ctx.idCharacter());
        assertEquals(100L, ctx.idLocation());
        assertTrue(ctx.sleeping());
        assertFalse(ctx.coma());
        assertEquals(4, ctx.energy());
        assertEquals(30, ctx.coin());
        assertEquals(2L, ctx.idClass());
        assertEquals(java.util.Set.of(500L), ctx.ownedItemIds());
        assertEquals(77L, ctx.currentWeatherId());
        assertEquals(java.util.Set.of(12L), ctx.consumedEventIds());
        assertEquals("yes", ctx.registry().get("flag"));
        assertEquals("7", ctx.registry().get("count"));
        assertNull(ctx.registry().get("empty"));
        assertEquals(3, ctx.registry().size());
    }

    @Test
    void loadCheckContext_missingBackpackAndMatchDegradeGracefully() {
        when(characterRepository.findById(any())).thenReturn(Optional.of(character()));
        when(backpackRepository.findByIdMatchAndIdCharacterMatch(1L, 3L)).thenReturn(Optional.empty());
        when(matchRepository.findById(1L)).thenReturn(Optional.empty());

        EventCheckContext ctx = adapter.loadCheckContext(1L, 3L);

        assertEquals(0, ctx.coin());
        assertNull(ctx.currentWeatherId());
        assertTrue(ctx.consumedEventIds().isEmpty());
    }

    private static games.paths.core.port.match.RegistryStorePort.RegistryRow registryRow(
            String key, String s, Integer i) {
        return games.paths.core.port.match.RegistryStorePort.RegistryRow.of(key, s, i);
    }

    // ── writes ──────────────────────────────────────────────────────────────

    @Test
    void updateCharacterStats_writesEveryStat() {
        GamingCharacterInstanceEntity c = character();
        when(characterRepository.findById(any())).thenReturn(Optional.of(c));

        adapter.updateCharacterStats(1L, 3L, new CharacterStats(9, 8, 7, 6, 5, 4, 3, 22, 21, 20, 19));

        assertEquals(9, c.getDexterity());
        assertEquals(8, c.getIntelligence());
        assertEquals(7, c.getConstitution());
        assertEquals(6, c.getEnergy());
        assertEquals(5, c.getLife());
        assertEquals(4, c.getSad());
        assertEquals(3, c.getExp());
        // v0.35.2 — the four maxima are written too: a trait granted mid-game moves them.
        assertEquals(22, c.getLifeMax());
        assertEquals(21, c.getEnergyMax());
        assertEquals(20, c.getSadMax());
        assertEquals(19, c.getWeightMax());
        verify(characterRepository).save(c);
    }

    @Test
    void updateCharacterStats_missingCharacterIsANoOp() {
        when(characterRepository.findById(any())).thenReturn(Optional.empty());
        adapter.updateCharacterStats(1L, 3L, new CharacterStats(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1));
        verify(characterRepository, never()).save(any());
    }

    @Test
    void updateBackpack_writesAllThreeResources_andNoOpsWhenMissing() {
        GamingBackpackResourcesEntity b = new GamingBackpackResourcesEntity();
        when(backpackRepository.findByIdMatchAndIdCharacterMatch(1L, 3L)).thenReturn(Optional.of(b));

        adapter.updateBackpack(1L, 3L, new BackpackStats(1, 2, 3));

        assertEquals(1, b.getFood());
        assertEquals(2, b.getMagic());
        assertEquals(3, b.getCoin());
        verify(backpackRepository).save(b);

        when(backpackRepository.findByIdMatchAndIdCharacterMatch(1L, 99L)).thenReturn(Optional.empty());
        adapter.updateBackpack(1L, 99L, new BackpackStats(0, 0, 0));
        verify(backpackRepository, times(1)).save(any());
    }

    @Test
    void setCharacterCharacteristics_overwritesTheCsv_andNoOpsWhenMissing() {
        GamingCharacterInstanceEntity c = character();
        when(characterRepository.findById(any())).thenReturn(Optional.of(c));

        adapter.setCharacterCharacteristics(1L, 3L, "wise");
        assertEquals("wise", c.getCharacteristics());

        adapter.setCharacterCharacteristics(1L, 3L, null);
        assertNull(c.getCharacteristics());
        verify(characterRepository, times(2)).save(c);
    }

    @Test
    void setCharacterCharacteristics_missingCharacterIsANoOp() {
        when(characterRepository.findById(any())).thenReturn(Optional.empty());
        adapter.setCharacterCharacteristics(1L, 3L, "x");
        verify(characterRepository, never()).save(any());
    }

    @Test
    void addItem_incrementsTheExistingRow() {
        GamingInventoryItemsEntity owned = inventoryRow(1L, 500L, 2);
        when(inventoryRepository.findByIdMatchAndIdCharacterMatch(1L, 3L)).thenReturn(List.of(owned));

        assertTrue(adapter.addItem(1L, 3L, 500L, null));

        assertEquals(3, owned.getAmount());
        verify(inventoryRepository).save(owned);
        verify(inventoryRepository, never()).findByIdMatch(anyLong());
    }

    @Test
    void addItem_nullAmountCountsAsZero() {
        GamingInventoryItemsEntity owned = inventoryRow(1L, 500L, null);
        when(inventoryRepository.findByIdMatchAndIdCharacterMatch(1L, 3L)).thenReturn(List.of(owned));

        assertTrue(adapter.addItem(1L, 3L, 500L, null));

        assertEquals(1, owned.getAmount());
    }

    @Test
    void addItem_newRowTakesTheMatchWideMaxIdPlusOne() {
        when(inventoryRepository.findByIdMatchAndIdCharacterMatch(1L, 3L))
                .thenReturn(List.of(inventoryRow(1L, 501L, 1)));
        when(inventoryRepository.findByIdMatch(1L)).thenReturn(List.of(
                inventoryRow(4L, 501L, 1), inventoryRow(9L, 502L, 1)));

        assertTrue(adapter.addItem(1L, 3L, 500L, null));

        ArgumentCaptor<GamingInventoryItemsEntity> cap =
                ArgumentCaptor.forClass(GamingInventoryItemsEntity.class);
        verify(inventoryRepository).save(cap.capture());
        GamingInventoryItemsEntity row = cap.getValue();
        assertEquals(10L, row.getId());
        assertEquals(1L, row.getIdMatch());
        assertEquals(3L, row.getIdCharacterMatch());
        assertEquals(500L, row.getIdItem());
        assertEquals(1, row.getAmount());
    }

    @Test
    void addItem_firstEverRowStartsAtOne() {
        when(inventoryRepository.findByIdMatchAndIdCharacterMatch(1L, 3L)).thenReturn(List.of());
        when(inventoryRepository.findByIdMatch(1L)).thenReturn(List.of());

        assertTrue(adapter.addItem(1L, 3L, 500L, null));

        ArgumentCaptor<GamingInventoryItemsEntity> cap =
                ArgumentCaptor.forClass(GamingInventoryItemsEntity.class);
        verify(inventoryRepository).save(cap.capture());
        assertEquals(1L, cap.getValue().getId());
    }

    @Test
    void addItem_refusedAtTheCapAndTheRowIsLeftAlone() {
        // v0.35.1 — max_per_character: the unit does not go in, and it is not an error.
        GamingInventoryItemsEntity owned = inventoryRow(1L, 500L, 2);
        when(inventoryRepository.findByIdMatchAndIdCharacterMatch(1L, 3L)).thenReturn(List.of(owned));

        assertFalse(adapter.addItem(1L, 3L, 500L, 2));

        assertEquals(2, owned.getAmount());
    }

    @Test
    void addItem_underTheCapStillGoesIn() {
        GamingInventoryItemsEntity owned = inventoryRow(1L, 500L, 1);
        when(inventoryRepository.findByIdMatchAndIdCharacterMatch(1L, 3L)).thenReturn(List.of(owned));

        assertTrue(adapter.addItem(1L, 3L, 500L, 2));

        assertEquals(2, owned.getAmount());
    }

    @Test
    void addItem_capOfZeroIsNoCapAtAll() {
        GamingInventoryItemsEntity owned = inventoryRow(1L, 500L, 9);
        when(inventoryRepository.findByIdMatchAndIdCharacterMatch(1L, 3L)).thenReturn(List.of(owned));

        assertTrue(adapter.addItem(1L, 3L, 500L, 0));

        assertEquals(10, owned.getAmount());
    }

    @Test
    void addItem_foldsTheDuplicateRowsAPreV0351DatabaseMayCarry() {
        // The schema forbids them now; a database written before it did may still hold a
        // pair, and the two amounts have to become one before the cap can mean anything.
        GamingInventoryItemsEntity first = inventoryRow(1L, 500L, 2);
        GamingInventoryItemsEntity second = inventoryRow(2L, 500L, 3);
        when(inventoryRepository.findByIdMatchAndIdCharacterMatch(1L, 3L))
                .thenReturn(List.of(first, second));

        assertTrue(adapter.addItem(1L, 3L, 500L, null));

        assertEquals(6, first.getAmount());
        verify(inventoryRepository).delete(second);
    }

    @Test
    void removeItem_takesEveryUnit() {
        // v0.35.1 — a story that takes an item away takes all of it, not one.
        GamingInventoryItemsEntity owned = inventoryRow(1L, 500L, 3);
        when(inventoryRepository.findByIdMatchAndIdCharacterMatch(1L, 3L)).thenReturn(List.of(owned));

        assertTrue(adapter.removeItem(1L, 3L, 500L));

        verify(inventoryRepository).delete(owned);
        verify(inventoryRepository, never()).save(any());
    }

    @Test
    void removeItem_deletesTheRowAtZero() {
        GamingInventoryItemsEntity owned = inventoryRow(1L, 500L, 1);
        when(inventoryRepository.findByIdMatchAndIdCharacterMatch(1L, 3L)).thenReturn(List.of(owned));

        assertTrue(adapter.removeItem(1L, 3L, 500L));

        verify(inventoryRepository).delete(owned);
        verify(inventoryRepository, never()).save(any());
    }

    @Test
    void removeItem_falseWhenNotCarried() {
        when(inventoryRepository.findByIdMatchAndIdCharacterMatch(1L, 3L)).thenReturn(List.of(
                inventoryRow(1L, 501L, 1),
                inventoryRow(3L, null, 1)));

        assertFalse(adapter.removeItem(1L, 3L, 500L));
        verify(inventoryRepository, never()).delete(any());
    }

    @Test
    void addTrait_writesTheRowWithTheNextMatchWideId() {
        when(traitsRepository.findByIdMatchAndIdCharacterMatch(1L, 3L))
                .thenReturn(List.of(traitRow(1L, 900L), traitRow(2L, null)));
        when(traitsRepository.findByIdMatch(1L)).thenReturn(List.of(traitRow(6L, 900L)));

        assertTrue(adapter.addTrait(1L, 3L, 901L, 12L));

        ArgumentCaptor<GamingCharacterTraitsEntity> cap =
                ArgumentCaptor.forClass(GamingCharacterTraitsEntity.class);
        verify(traitsRepository).save(cap.capture());
        GamingCharacterTraitsEntity row = cap.getValue();
        assertEquals(7L, row.getId());
        assertEquals(1L, row.getIdMatch());
        assertEquals(3L, row.getIdCharacterMatch());
        assertEquals(901L, row.getIdTraits());
        assertEquals(12L, row.getIdEvent());
    }

    @Test
    void addTrait_falseAndNoWriteWhenAlreadyHeld() {
        when(traitsRepository.findByIdMatchAndIdCharacterMatch(1L, 3L))
                .thenReturn(List.of(traitRow(1L, 900L)));

        assertFalse(adapter.addTrait(1L, 3L, 900L, null));
        verify(traitsRepository, never()).save(any());
    }

    @Test
    void removeTrait_deletesTheRow_orFalseWhenNotHeld() {
        GamingCharacterTraitsEntity held = traitRow(1L, 900L);
        when(traitsRepository.findByIdMatchAndIdCharacterMatch(1L, 3L)).thenReturn(List.of(held));

        assertTrue(adapter.removeTrait(1L, 3L, 900L));
        verify(traitsRepository).delete(held);

        assertFalse(adapter.removeTrait(1L, 3L, 901L));
        verify(traitsRepository, times(1)).delete(any());
    }

    @Test
    void removeTrait_falseWhenNoRows() {
        when(traitsRepository.findByIdMatchAndIdCharacterMatch(1L, 3L)).thenReturn(List.of());
        assertFalse(adapter.removeTrait(1L, 3L, 900L));
    }






    @Test
    void setCurrentWeather_delegatesToTheWeatherPort() {
        adapter.setCurrentWeather(1L, 77L);
        verify(weatherStorePort).setCurrentWeather(1L, 77L);
    }

    @Test
    void logEventExecuted_writesTheAuditRowWithTheNextId() {
        when(logEventsRepository.findMaxId()).thenReturn(6L);

        adapter.logEventExecuted(1L, 3L, 12L, 5, MSG_EVENT_EXECUTED + "#12",
                new EventExecutionStorePort.SpentResources(2, 1, 0, 3),
                new EventExecutionStorePort.ResourceDelta(0, 4, 0, 5));

        ArgumentCaptor<LogEventsEntity> cap = ArgumentCaptor.forClass(LogEventsEntity.class);
        verify(logEventsRepository).save(cap.capture());
        LogEventsEntity row = cap.getValue();
        assertEquals(7L, row.getId());
        assertEquals(1L, row.getIdMatch());
        assertEquals(3L, row.getIdCharacterMatch());
        assertEquals(12L, row.getIdEvent());
        assertEquals(5, row.getClock());
        assertEquals(MSG_EVENT_EXECUTED + "#12", row.getLogMessage());
    }

    // ── choices (Step 31) ───────────────────────────────────────────────────

    private static ChoiceEntity choiceRow(long id, Integer idEvent) {
        ChoiceEntity c = new ChoiceEntity();
        c.setId(id);
        c.setIdEvent(idEvent);
        return c;
    }

    private static ChoiceConditionEntity conditionRow(long id, Integer idChoices) {
        ChoiceConditionEntity c = new ChoiceConditionEntity();
        c.setId(id);
        c.setIdChoices(idChoices);
        return c;
    }

    private static LogEventsEntity marker(Long idEvent, String message) {
        LogEventsEntity l = new LogEventsEntity();
        l.setIdEvent(idEvent);
        l.setLogMessage(message);
        return l;
    }

    @Test
    void findChoicesByEventId_filtersOnTheEventAndSkipsUnbound() {
        when(storyReadPort.findChoicesByStoryId(4L)).thenReturn(List.of(
                choiceRow(1, 12), choiceRow(2, 13), choiceRow(3, 12), choiceRow(4, null)));

        List<ChoiceEntity> out = adapter.findChoicesByEventId(4L, 12L);

        assertEquals(2, out.size());
        assertEquals(1L, out.get(0).getId());
        assertEquals(3L, out.get(1).getId());
    }

    @Test
    void findChoiceConditionsByChoiceId_groupsAndOrdersById() {
        when(storyReadPort.findChoiceConditionsByStoryId(4L)).thenReturn(List.of(
                conditionRow(3, 7), conditionRow(1, 7), conditionRow(2, 8), conditionRow(4, null)));

        Map<Long, List<ChoiceConditionEntity>> out = adapter.findChoiceConditionsByChoiceId(4L);

        assertEquals(2, out.size());
        // Ordered by row id: under AND the FIRST failing row names the reason.
        assertEquals(List.of(1L, 3L), out.get(7L).stream().map(ChoiceConditionEntity::getId).toList());
        assertEquals(List.of(2L), out.get(8L).stream().map(ChoiceConditionEntity::getId).toList());
    }

    @Test
    void countLogMarkers_countsOnlyThePrefixOfTheEvent() {
        when(logEventsRepository.findByIdMatchOrderByIdAsc(1L)).thenReturn(List.of(
                marker(12L, MSG_EVENT_EXECUTED + " 12"),
                marker(12L, MSG_EVENT_EXECUTED + " 12"),      // a second cycle
                marker(12L, MSG_CHOICE_SELECTED + " 12"),     // other prefix: not counted here
                marker(13L, MSG_EVENT_EXECUTED + " 13"),      // other event
                marker(12L, "WEATHER something"),             // unrelated row on the event
                marker(12L, null),                            // no message
                marker(null, MSG_EVENT_EXECUTED + " ?")));    // no event id

        assertEquals(2, adapter.countLogMarkers(1L, 12L, MSG_EVENT_EXECUTED));
        assertEquals(1, adapter.countLogMarkers(1L, 12L, MSG_CHOICE_SELECTED));
        assertEquals(0, adapter.countLogMarkers(1L, 14L, MSG_EVENT_EXECUTED));
    }

    @Test
    void findTraitIdsByCharacter_collectsTheHeldIds() {
        GamingCharacterTraitsEntity held = new GamingCharacterTraitsEntity();
        held.setIdTraits(9L);
        GamingCharacterTraitsEntity broken = new GamingCharacterTraitsEntity();
        broken.setIdTraits(null);
        when(traitsRepository.findByIdMatchAndIdCharacterMatch(1L, 3L))
                .thenReturn(List.of(held, broken));

        assertEquals(java.util.Set.of(9L), adapter.findTraitIdsByCharacter(1L, 3L));
    }

    @Test
    void resolveShortText_prefersTheLangAndFallsBackToEnglish() {
        TextEntity it = new TextEntity();
        it.setShortText("La Prova");
        TextEntity en = new TextEntity();
        en.setShortText("The Trial");
        when(storyReadPort.findTextByStoryIdTextAndLang(4L, 610, "it")).thenReturn(Optional.of(it));
        when(storyReadPort.findTextByStoryIdTextAndLang(4L, 611, "it")).thenReturn(Optional.empty());
        when(storyReadPort.findTextByStoryIdTextAndLang(4L, 611, "en")).thenReturn(Optional.of(en));
        when(storyReadPort.findTextByStoryIdTextAndLang(4L, 612, "it")).thenReturn(Optional.empty());
        when(storyReadPort.findTextByStoryIdTextAndLang(4L, 612, "en")).thenReturn(Optional.empty());

        assertEquals("La Prova", adapter.resolveShortText(4L, 610, "it"));
        assertEquals("The Trial", adapter.resolveShortText(4L, 611, "it"));
        assertNull(adapter.resolveShortText(4L, 612, "it"));
        assertNull(adapter.resolveShortText(4L, null, "it"));
    }

    @Test
    void resolveShortText_blankLangReadsAsEnglish() {
        TextEntity en = new TextEntity();
        en.setShortText("The Trial");
        when(storyReadPort.findTextByStoryIdTextAndLang(4L, 610, "en")).thenReturn(Optional.of(en));

        assertEquals("The Trial", adapter.resolveShortText(4L, 610, null));
        verify(storyReadPort, times(1)).findTextByStoryIdTextAndLang(4L, 610, "en");
    }

    // ── choice resolution (Step 32) ─────────────────────────────────────────

    private static ChoiceEffectEntity choiceEffectRow(long id, Integer idChoices) {
        ChoiceEffectEntity e = new ChoiceEffectEntity();
        e.setId(id);
        e.setIdChoices(idChoices);
        return e;
    }

    @Test
    void findChoiceByStoryAndUuid_findsTheOptionInsideItsOwnStory() {
        ChoiceEntity wanted = choiceRow(2L, 12);
        wanted.setUuid("wanted-uuid");
        ChoiceEntity other = choiceRow(3L, 12);
        other.setUuid("other-uuid");
        when(storyReadPort.findChoicesByStoryId(4L)).thenReturn(List.of(other, wanted));

        assertEquals(2L, adapter.findChoiceByStoryAndUuid(4L, "wanted-uuid").orElseThrow().getId());
        assertTrue(adapter.findChoiceByStoryAndUuid(4L, "nope").isEmpty());
    }

    @Test
    void findChoiceByStoryAndUuid_blankUuidNeverHitsTheStore() {
        assertTrue(adapter.findChoiceByStoryAndUuid(4L, null).isEmpty());
        assertTrue(adapter.findChoiceByStoryAndUuid(4L, "  ").isEmpty());
        verify(storyReadPort, never()).findChoicesByStoryId(anyLong());
    }

    @Test
    void findChoiceEffectsByChoiceId_keepsOnlyTheOptionsRowsInAuthoredOrder() {
        when(storyReadPort.findChoiceEffectsByStoryId(4L)).thenReturn(List.of(
                choiceEffectRow(9L, 20),
                choiceEffectRow(2L, 20),
                choiceEffectRow(5L, 21),      // another option
                choiceEffectRow(7L, null)));  // orphan row

        List<ChoiceEffectEntity> rows = adapter.findChoiceEffectsByChoiceId(4L, 20L);

        assertEquals(List.of(2L, 9L), rows.stream().map(ChoiceEffectEntity::getId).toList(),
                "authored order, so a later row builds on the earlier one");
    }

    @Test
    void logChoiceExecuted_writesTheHistoryRowWithTheNextId() {
        when(logChoicesRepository.findMaxId()).thenReturn(6L);

        adapter.logChoiceExecuted(1L, 12L, 20L, 5, MSG_CHOICE_SELECTED + " 20");

        ArgumentCaptor<LogChoicesExecutedEntity> cap =
                ArgumentCaptor.forClass(LogChoicesExecutedEntity.class);
        verify(logChoicesRepository).save(cap.capture());
        LogChoicesExecutedEntity row = cap.getValue();
        assertEquals(7L, row.getId());
        assertEquals(1L, row.getIdMatch());
        assertEquals(12L, row.getIdEvent(), "the OWNING event, not the option");
        assertEquals(20L, row.getIdChoise());
        assertEquals(5, row.getClock());
        assertEquals(MSG_CHOICE_SELECTED + " 20", row.getLogMessage());
    }

    @Test
    void insertStoryProgress_numbersTheMilestoneWithinItsMatch() {
        when(storyProgressRepository.findMaxIdByMatch(1L)).thenReturn(3L);

        adapter.insertStoryProgress(1L, 12L, 20L, 5);

        ArgumentCaptor<GamingStoryProgressEntity> cap =
                ArgumentCaptor.forClass(GamingStoryProgressEntity.class);
        verify(storyProgressRepository).save(cap.capture());
        GamingStoryProgressEntity row = cap.getValue();
        // The key is (id, id_match), so ids restart per match rather than running globally.
        assertEquals(4L, row.getId());
        assertEquals(1L, row.getIdMatch());
        assertEquals(12L, row.getIdEvent());
        assertEquals(20L, row.getIdChoise());
        assertEquals(5, row.getClock());
    }
}
