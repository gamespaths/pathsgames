package games.paths.core.persistence.match;

import games.paths.core.entity.match.GamingBackpackResourcesEntity;
import games.paths.core.entity.match.GamingCharacterInstanceEntity;
import games.paths.core.entity.match.GamingCharacterTraitsEntity;
import games.paths.core.entity.match.GamingInventoryItemsEntity;
import games.paths.core.entity.match.GamingMatchEntity;
import games.paths.core.entity.match.GamingStateRegistryEntity;
import games.paths.core.entity.match.LogEventsEntity;
import games.paths.core.entity.story.EventEffectEntity;
import games.paths.core.entity.story.EventEntity;
import games.paths.core.entity.story.ItemEntity;
import games.paths.core.entity.story.LocationEntity;
import games.paths.core.entity.story.StoryEntity;
import games.paths.core.entity.story.TraitEntity;
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
import games.paths.core.repository.match.LogEventsRepository;
import games.paths.core.repository.match.LogMovementRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Map;
import java.util.Optional;

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
    private GamingStateRegistryRepository registryRepository;
    private LogEventsRepository logEventsRepository;
    private LogMovementRepository logMovementRepository;
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
        registryRepository = mock(GamingStateRegistryRepository.class);
        logEventsRepository = mock(LogEventsRepository.class);
        logMovementRepository = mock(LogMovementRepository.class);
        storyReadPort = mock(StoryReadPort.class);
        weatherStorePort = mock(WeatherStorePort.class);
        adapter = new EventExecutionStoreAdapter(matchRepository, characterRepository,
                backpackRepository, inventoryRepository, traitsRepository, registryRepository,
                logEventsRepository, logMovementRepository, storyReadPort, weatherStorePort);
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
        when(registryRepository.findByIdMatch(1L)).thenReturn(List.of(
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

    private static GamingStateRegistryEntity registryRow(String key, String s, Integer i) {
        GamingStateRegistryEntity r = new GamingStateRegistryEntity();
        r.setKey(key);
        r.setStringValue(s);
        r.setIntValue(i);
        return r;
    }

    // ── writes ──────────────────────────────────────────────────────────────

    @Test
    void updateCharacterStats_writesEveryStat() {
        GamingCharacterInstanceEntity c = character();
        when(characterRepository.findById(any())).thenReturn(Optional.of(c));

        adapter.updateCharacterStats(1L, 3L, new CharacterStats(9, 8, 7, 6, 5, 4, 3));

        assertEquals(9, c.getDexterity());
        assertEquals(8, c.getIntelligence());
        assertEquals(7, c.getConstitution());
        assertEquals(6, c.getEnergy());
        assertEquals(5, c.getLife());
        assertEquals(4, c.getSad());
        assertEquals(3, c.getExp());
        verify(characterRepository).save(c);
    }

    @Test
    void updateCharacterStats_missingCharacterIsANoOp() {
        when(characterRepository.findById(any())).thenReturn(Optional.empty());
        adapter.updateCharacterStats(1L, 3L, new CharacterStats(1, 1, 1, 1, 1, 1, 1));
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

        adapter.addItem(1L, 3L, 500L);

        assertEquals(3, owned.getAmount());
        verify(inventoryRepository).save(owned);
        verify(inventoryRepository, never()).findByIdMatch(anyLong());
    }

    @Test
    void addItem_nullAmountCountsAsZero() {
        GamingInventoryItemsEntity owned = inventoryRow(1L, 500L, null);
        when(inventoryRepository.findByIdMatchAndIdCharacterMatch(1L, 3L)).thenReturn(List.of(owned));

        adapter.addItem(1L, 3L, 500L);

        assertEquals(1, owned.getAmount());
    }

    @Test
    void addItem_newRowTakesTheMatchWideMaxIdPlusOne() {
        when(inventoryRepository.findByIdMatchAndIdCharacterMatch(1L, 3L))
                .thenReturn(List.of(inventoryRow(1L, 501L, 1)));
        when(inventoryRepository.findByIdMatch(1L)).thenReturn(List.of(
                inventoryRow(4L, 501L, 1), inventoryRow(9L, 502L, 1)));

        adapter.addItem(1L, 3L, 500L);

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

        adapter.addItem(1L, 3L, 500L);

        ArgumentCaptor<GamingInventoryItemsEntity> cap =
                ArgumentCaptor.forClass(GamingInventoryItemsEntity.class);
        verify(inventoryRepository).save(cap.capture());
        assertEquals(1L, cap.getValue().getId());
    }

    @Test
    void removeItem_decrementsWhenMoreThanOne() {
        GamingInventoryItemsEntity owned = inventoryRow(1L, 500L, 3);
        when(inventoryRepository.findByIdMatchAndIdCharacterMatch(1L, 3L)).thenReturn(List.of(owned));

        assertTrue(adapter.removeItem(1L, 3L, 500L));

        assertEquals(2, owned.getAmount());
        verify(inventoryRepository).save(owned);
        verify(inventoryRepository, never()).delete(any());
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
                inventoryRow(2L, 500L, 0),
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
    void upsertRegistry_ignoresNullAndBlankKeys() {
        adapter.upsertRegistry(1L, null, "v", null, null, 0);
        adapter.upsertRegistry(1L, "   ", "v", null, null, 0);
        verifyNoInteractions(registryRepository);
    }

    @Test
    void upsertRegistry_updatesTheExistingKey_numericGoesToIntValue() {
        GamingStateRegistryEntity existing = registryRow("count", "old", null);
        when(registryRepository.findByIdMatch(1L)).thenReturn(List.of(existing));

        adapter.upsertRegistry(1L, "count", " 42 ", 3L, 12L, 5);

        assertEquals(42, existing.getIntValue());
        assertNull(existing.getStringValue());
        assertEquals(3L, existing.getIdCharacter());
        assertEquals(12L, existing.getIdEvent());
        assertEquals(5, existing.getClock());
        verify(registryRepository).save(existing);
    }

    @Test
    void upsertRegistry_nonNumericGoesToStringValue_andNullClearsBoth() {
        GamingStateRegistryEntity existing = registryRow("flag", null, 1);
        when(registryRepository.findByIdMatch(1L)).thenReturn(List.of(existing));

        adapter.upsertRegistry(1L, "flag", "yes", null, null, 1);
        assertEquals("yes", existing.getStringValue());
        assertNull(existing.getIntValue());

        adapter.upsertRegistry(1L, "flag", null, null, null, 2);
        assertNull(existing.getStringValue());
        assertNull(existing.getIntValue());
    }

    @Test
    void upsertRegistry_insertsANewKeyWithTheNextId() {
        when(registryRepository.findByIdMatch(1L)).thenReturn(List.of(
                registryRow("other", "x", null), registryWithId(4L)));

        adapter.upsertRegistry(1L, "fresh", "hello", 3L, 12L, 6);

        ArgumentCaptor<GamingStateRegistryEntity> cap =
                ArgumentCaptor.forClass(GamingStateRegistryEntity.class);
        verify(registryRepository).save(cap.capture());
        GamingStateRegistryEntity row = cap.getValue();
        assertEquals(5L, row.getId());
        assertEquals(1L, row.getIdMatch());
        assertEquals("fresh", row.getKey());
        assertEquals("hello", row.getStringValue());
        assertEquals(6, row.getClock());
    }

    private static GamingStateRegistryEntity registryWithId(long id) {
        GamingStateRegistryEntity r = registryRow("with-id", "y", null);
        r.setId(id);
        return r;
    }

    @Test
    void setCurrentWeather_delegatesToTheWeatherPort() {
        adapter.setCurrentWeather(1L, 77L);
        verify(weatherStorePort).setCurrentWeather(1L, 77L);
    }

    @Test
    void logEventExecuted_writesTheAuditRowWithTheNextId() {
        when(logEventsRepository.findMaxId()).thenReturn(6L);

        adapter.logEventExecuted(1L, 3L, 12L, 5, MSG_EVENT_EXECUTED + "#12");

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
}
