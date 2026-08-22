package games.paths.core.port.match;

import games.paths.core.entity.story.ChoiceConditionEntity;
import games.paths.core.entity.story.ChoiceEffectEntity;
import games.paths.core.entity.story.ChoiceEntity;
import games.paths.core.entity.story.EventEffectEntity;
import games.paths.core.entity.story.EventEntity;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * EventExecutionStorePort - outbound port used by {@code EventExecutionService} (Step 29)
 * to read the story's events and the live match state, and to persist everything an event
 * effect can touch: stats, backpack, inventory, traits, characteristics, registry, weather
 * and the {@code log_events} audit row.
 *
 * <p>Step 29 is the first writer of {@code gaming_inventory_items}, the first to upsert a
 * single {@code gaming_state_registry} key, and the first to add or remove a trait after
 * join. The coma and sadness writes moved to {@link EdgeStateStorePort} in Step 30, where
 * the recovery and admin paths can reach them too.</p>
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

    /**
     * Marker of a resolved choice-event cycle. Step 31 only READS it: a choice-event is
     * "open" (serve the options again, charge nothing) while its
     * {@link #MSG_EVENT_EXECUTED} rows outnumber its {@code MSG_CHOICE_SELECTED} rows.
     *
     * <p>Contract for Step 32, the first writer: the {@code log_events} row's message
     * starts with this prefix and its {@code id_event} column carries the OWNING EVENT id
     * (not the choice id) — {@link #countLogMarkers} pairs the two markers by event, and
     * a row stamped with the choice id would never close the cycle it belongs to.</p>
     */
    String MSG_CHOICE_SELECTED = "CHOICE_SELECTED";

    // ── resolve ─────────────────────────────────────────────────────────────

    Optional<MatchEventView> findMatchByUuid(String uuid);

    /**
     * Step 33 — the same view by primary key. The location engine is triggered by the
     * engine itself (an arrival, a counter reaching zero) and never holds a uuid.
     */
    Optional<MatchEventView> findMatchById(long idMatch);

    /** The character instance owned by {@code idUser} in {@code idMatch}, if any. */
    Optional<EventActorView> findCharacterByMatchAndUser(long idMatch, long idUser);

    /**
     * Step 33 — a character by its own id, for the nominal actor of an automatic
     * event: no user asked for it, so there is no user to look it up by.
     */
    Optional<EventActorView> findCharacterByMatchAndId(long idMatch, long idCharacter);

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

    /**
     * {@code list_stories.id_event_all_player_coma} — the Step 30 epilogue, run when every
     * character of the match is comatose. Empty is legal: a story need not author one.
     */
    Optional<Long> findIdEventAllPlayerComa(long idStory);

    /** Story item id → uuid, for the response payload. */
    Map<Long, String> findItemUuidsById(long idStory);

    /**
     * v0.35.2 — story trait id → its stat deltas, so a trait granted mid-game can move the
     * character's maxima the moment it lands rather than only at character creation.
     */
    Map<Long, TraitStats> findTraitStatsById(long idStory);

    /** Story trait id → uuid, for the response payload. */
    Map<Long, String> findTraitUuidsById(long idStory);

    /**
     * Story location id → uuid. Doubles as the existence check of a forced-movement
     * effect (v0.29.3): an {@code id_location} absent from this map is authored noise
     * and the move is skipped.
     */
    Map<Long, String> findLocationUuidsById(long idStory);

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

    /** Overwrites the CSV of characteristics (null clears it). */
    void setCharacterCharacteristics(long idMatch, long idCharacter, String csv);

    /**
     * +1 amount on the character's ONE row for this item, or a new row when there is none.
     *
     * <p>v0.35.1 — {@code maxPerCharacter} (0 or null = no limit) is the cap the unit would
     * cross: the add is then refused and this answers false. A refusal is not an error —
     * the event that asked for it keeps running — so the caller reports it rather than
     * throwing.</p>
     *
     * @return true when a unit was actually added
     */
    boolean addItem(long idMatch, long idCharacter, long idItem, Integer maxPerCharacter);

    /**
     * Removes the character's whole row for this item — v0.35.1: EVERY unit, not one.
     * "The story takes it away from you" has never meant "takes one of them", and a
     * partial removal also left the engine's owned-items set claiming the item was gone
     * while the bag still held two.
     *
     * @return false when the character did not carry it
     */
    boolean removeItem(long idMatch, long idCharacter, long idItem);

    /** Story item id → max_per_character (null when the item sets no cap). */
    Map<Long, Integer> findItemMaxPerCharacterById(long idStory);

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

    /** Sets the character's {@code id_location} — forced movement (v0.29.3), energy untouched. */
    void updateCharacterLocation(long idMatch, long idCharacter, long idLocation);

    /**
     * Append a {@code log_movements} row. Forced movement writes it with cost 0, so the
     * Step 28.7 timeline and the Step 28.6 visited set stay truthful.
     */
    void insertMovementLog(long idMatch, long idCharacter, Long fromLocation, long toLocation, int energyCost);

    /**
     * Append the {@code log_events} row of an executed event. The message MUST start with
     * {@link #MSG_EVENT_EXECUTED} — see that constant.
     */
    void logEventExecuted(long idMatch, Long idCharacter, long idEvent, int clock, String message);

    // ── choices (Step 31) ───────────────────────────────────────────────────

    /** The event's {@code list_choices} rows; empty for a plain (Step 29) event. */
    List<ChoiceEntity> findChoicesByEventId(long idStory, long idEvent);

    /**
     * Every {@code list_choices_conditions} row of the story grouped by {@code idChoices},
     * each list ordered by row id — one read no matter how many options the event has.
     */
    Map<Long, List<ChoiceConditionEntity>> findChoiceConditionsByChoiceId(long idStory);

    /**
     * How many {@code log_events} rows of {@code idEvent} carry a message starting with
     * {@code prefix}. Drives the open-cycle detection — see {@link #MSG_CHOICE_SELECTED}.
     */
    int countLogMarkers(long idMatch, long idEvent, String prefix);

    /** The story-local trait ids the character holds — the {@code traits} condition input. */
    Set<Long> findTraitIdsByCharacter(long idMatch, long idCharacter);

    /**
     * The short text of {@code idText} in {@code lang}, falling back to "en", null when
     * the text does not exist (or {@code idText} is null). Mirrors the resolution the
     * content APIs use, so an option reads the same everywhere.
     */
    String resolveShortText(long idStory, Integer idText, String lang);

    // ── choice resolution (Step 32) ─────────────────────────────────────────

    /** The option {@code select-choice} names, resolved inside the match's own story. */
    Optional<ChoiceEntity> findChoiceByStoryAndUuid(long idStory, String choiceUuid);

    /**
     * The {@code list_choices_effects} rows of one option, ordered by row id — a later
     * row can therefore build on what an earlier one wrote, the same guarantee
     * {@link #findEffectsByEventId} gives the event effects.
     */
    List<ChoiceEffectEntity> findChoiceEffectsByChoiceId(long idStory, long idChoice);

    /**
     * Append the {@code log_choices_executed} row of a resolved option. {@code idEvent} is
     * the OWNING event, matching the {@link #MSG_CHOICE_SELECTED} marker written alongside.
     */
    void logChoiceExecuted(long idMatch, long idEvent, long idChoice, int clock, String message);

    /**
     * Append a {@code gaming_story_progress} row — the narrative milestone of an option
     * carrying {@code is_progress = 1}. Ordinary options never reach this.
     */
    void insertStoryProgress(long idMatch, long idEvent, long idChoice, int clock);

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
                          /** v0.35.2 — carry capacity, moved by a trait's weight delta. */
                          int weightMax,
                          boolean isSleeping,
                          boolean isComa,
                          String characteristics) {
    }

    /**
     * v0.35.2 — the four maxima ride along with the current values.
     *
     * <p>A trait granted mid-game moves them: they are a plain sum of template, class,
     * difficulty, traits and class bonuses, so adding the trait's own deltas gives exactly
     * what a full recomputation would, without loading that whole graph again.</p>
     */
    record CharacterStats(int dexterity,
                          int intelligence,
                          int constitution,
                          int energy,
                          int life,
                          int sad,
                          int exp,
                          int lifeMax,
                          int energyMax,
                          int sadMax,
                          int weightMax) {
    }

    /** v0.35.2 — the stat deltas a trait carries, as the engine applies them. */
    record TraitStats(int life,
                      int energy,
                      int sad,
                      int dexterity,
                      int intelligence,
                      int constitution,
                      int weight) {
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
