package games.paths.core.port.match;

import games.paths.core.entity.story.EventEffectEntity;
import games.paths.core.entity.story.EventEntity;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * EventExecutionStorePort - outbound port used by {@code EventExecutionService} (Step 29)
 * to read the story's events and the live match state, and to persist everything an event
 * effect can touch: stats, backpack, inventory, traits, characteristics, registry, weather,
 * coma and the {@code log_events} audit row.
 *
 * <p>Step 29 is the first writer of {@code gaming_inventory_items}, the first to upsert a
 * single {@code gaming_state_registry} key, the first to add or remove a trait after join,
 * and the first to ever set {@code is_coma = true}.</p>
 *
 * <p>Read-then-write like the other Step 24-28 store ports, keeping the event domain logic
 * framework-free and unit-testable.</p>
 */
public interface EventExecutionStorePort {

    /**
     * Marker every {@code log_events} row written by an executed event starts with.
     *
     * <p>Load-bearing: {@code logCounterZero} (Step 26) and {@code logWeatherEvent}
     * (Step 27) already write {@code log_events} rows carrying an {@code id_event} for
     * events that were never executed. Deciding "this ONCE event is spent" by scanning
     * {@code id_event} alone would therefore consume events the player never triggered,
     * so {@link EventCheckContext#consumedEventIds()} must be built from rows bearing
     * this prefix and nothing else.</p>
     */
    String MSG_EVENT_EXECUTED = "EVENT_EXECUTED";

    // ── resolve ─────────────────────────────────────────────────────────────

    Optional<MatchEventView> findMatchByUuid(String uuid);

    /** The character instance owned by {@code idUser} in {@code idMatch}, if any. */
    Optional<EventActorView> findCharacterByMatchAndUser(long idMatch, long idUser);

    /** Every character instance of the match — recipient resolution for {@code target=ALL}. */
    List<EventActorView> findCharactersByMatchId(long idMatch);

    /**
     * The food/magic/coin of one character. Needed for every recipient of a resource effect:
     * {@code updateBackpack} writes all three columns, so the engine must start from the real
     * values or it would silently zero the ones the effect does not mention.
     */
    Optional<BackpackStats> findBackpack(long idMatch, long idCharacter);

    // ── story reads ─────────────────────────────────────────────────────────

    Optional<EventEntity> findEventByStoryAndUuid(long idStory, String eventUuid);

    /** Every event of the story keyed by id — walks the {@code idEventNext} chain in one read. */
    Map<Long, EventEntity> findEventsById(long idStory);

    /** Every effect of the story grouped by {@code idEvent}, each list ordered by effect id. */
    Map<Long, List<EventEffectEntity>> findEffectsByEventId(long idStory);

    /** {@code list_stories.id_event_end_game} — drives the {@code gameOver} flag. */
    Optional<Long> findIdEventEndGame(long idStory);

    /** Story item id → uuid, for the response payload. */
    Map<Long, String> findItemUuidsById(long idStory);

    /** Story trait id → uuid, for the response payload. */
    Map<Long, String> findTraitUuidsById(long idStory);

    // ── the check context ───────────────────────────────────────────────────

    /**
     * Everything the check procedure needs, in ONE call: {@code /info} evaluates N events
     * against a single context, so adding events never adds queries.
     *
     * <p>{@code idCharacter} null (the caller owns no character) yields a context whose
     * only possible verdict is {@code CHARACTER_CANNOT_ACT}.</p>
     */
    EventCheckContext loadCheckContext(long idMatch, Long idCharacter);

    // ── writes ──────────────────────────────────────────────────────────────

    void updateCharacterStats(long idMatch, long idCharacter, CharacterStats stats);

    void updateBackpack(long idMatch, long idCharacter, BackpackStats stats);

    /** Sets {@code is_coma = true} and {@code is_sleeping = true}. */
    void setCharacterComa(long idMatch, long idCharacter);

    /** Overwrites the CSV of characteristics (null clears it). */
    void setCharacterCharacteristics(long idMatch, long idCharacter, String csv);

    /** +1 amount when the character already carries the item, else a new row. */
    void addItem(long idMatch, long idCharacter, long idItem);

    /** -1 amount, deleting the row at zero. False when the character did not carry it. */
    boolean removeItem(long idMatch, long idCharacter, long idItem);

    /** False when the trait was already held (no duplicate row is written). */
    boolean addTrait(long idMatch, long idCharacter, long idTrait, Long idEvent);

    /** False when the trait was not held. */
    boolean removeTrait(long idMatch, long idCharacter, long idTrait);

    /**
     * Upsert a {@code gaming_state_registry} key of the match. A numeric {@code value}
     * lands in {@code int_value}, anything else in {@code string_value}.
     */
    void upsertRegistry(long idMatch, String key, String value, Long idCharacter, Long idEvent, int clock);

    /** Sets {@code gaming_match.id_current_weather} (null clears it). */
    void setCurrentWeather(long idMatch, Long idWeather);

    /**
     * Append the {@code log_events} row of an executed event. The message MUST start with
     * {@link #MSG_EVENT_EXECUTED} — see that constant.
     */
    void logEventExecuted(long idMatch, Long idCharacter, long idEvent, int clock, String message);

    // ── records ─────────────────────────────────────────────────────────────

    record MatchEventView(long id,
                          String uuid,
                          String status,
                          int currentClock,
                          long idStory,
                          long idUserCreator,
                          Long idCurrentWeather) {
    }

    record EventActorView(long id,
                          String uuid,
                          long idUser,
                          Long idClass,
                          Long idLocation,
                          int dexterity,
                          int intelligence,
                          int constitution,
                          int energy,
                          int life,
                          int sad,
                          int exp,
                          int energyMax,
                          int lifeMax,
                          int sadMax,
                          boolean isSleeping,
                          boolean isComa,
                          String characteristics) {
    }

    record CharacterStats(int dexterity,
                          int intelligence,
                          int constitution,
                          int energy,
                          int life,
                          int sad,
                          int exp) {
    }

    record BackpackStats(int food, int magic, int coin) {
    }

    /**
     * Immutable-ish snapshot the pure check procedure runs against. Loaded once per
     * request; {@code registry} and {@code consumedEventIds} are mutable on purpose, so a
     * chain of effects sees what the effects before it just wrote.
     */
    record EventCheckContext(Long idCharacter,
                             Long idLocation,
                             boolean sleeping,
                             boolean coma,
                             int energy,
                             int coin,
                             Long idClass,
                             Set<Long> ownedItemIds,
                             Long currentWeatherId,
                             Set<Long> consumedEventIds,
                             Map<String, String> registry) {

        /** The context of a caller with no character: nothing is ever executable. */
        public static EventCheckContext noCharacter() {
            return new EventCheckContext(null, null, false, false, 0, 0, null,
                    Set.of(), null, new java.util.HashSet<>(), new java.util.HashMap<>());
        }
    }
}
