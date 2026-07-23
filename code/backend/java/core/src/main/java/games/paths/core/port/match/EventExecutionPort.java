package games.paths.core.port.match;

import games.paths.core.model.story.CardInfo;

import java.util.List;

/**
 * EventExecutionPort - inbound port for normal (player-triggered) events (Step 29).
 * Implemented by {@code EventExecutionService}; called by the REST controller.
 *
 * <p>An event is executable when {@code EventAvailabilityChecker} says so. The very
 * same verdict drives the {@code available} flag that {@code /api/match/{uuid}/info}
 * reports for every event of the player's location, so what the board shows and what
 * the endpoint accepts can never drift apart.</p>
 *
 * <p><b>Turns.</b> v0.29.0 deliberately does not touch {@code gaming_turn_queue}: an
 * event neither requires nor consumes a turn, exactly like Step 28 movement.
 * {@link EventExecutionResult#turnConsumed()} is part of the contract but is always
 * {@code false}; turn semantics are revisited in Step 61 (multiplayer turn engine).</p>
 *
 * <p><b>Choices (Step 31).</b> An event owning at least one {@code list_choices} row is a
 * choice-event: executing it pays the cost and writes the executed marker as usual, but
 * instead of applying effects it answers {@link #STATUS_CHOICES_PENDING} with every option
 * and its {@code ChoiceAvailabilityChecker} verdict. Re-executing an open choice-event
 * serves the options again without re-charging. Closing the card without choosing is
 * purely client-side — the cost stays paid.</p>
 *
 * <p><b>Resolution (Step 32).</b> {@link #selectChoice} closes the cycle the open left
 * ajar: it applies the option's {@code list_choices_effects}, runs the linked events, and
 * writes the {@code CHOICE_SELECTED} marker. It charges nothing — energy, coins and the
 * ONCE were all spent when the event was opened — so its only gate is that a cycle really
 * is open for that event.</p>
 *
 * <p>See {@code documentation_v0/Step29_NormalEvents.md} and
 * {@code documentation_v0/Step32_ChoiceResolution.md}.</p>
 */
public interface EventExecutionPort {

    /** The 0-choice flow: the event's effects were applied (Step 29, unchanged). */
    String STATUS_APPLIED = "APPLIED";

    /**
     * The choice-event flow: cost paid, marker written, effects withheld — the player
     * must now choose among {@link EventExecutionResult#pendingChoices()} (or walk away).
     */
    String STATUS_CHOICES_PENDING = "CHOICES_PENDING";

    /**
     * Execute {@code eventUuid} for the caller's character: check, pay, apply the
     * effects of the whole {@code idEventNext} chain, log. {@code lang} localizes the
     * returned cards (null → "en").
     */
    EventExecutionResult executeEvent(String matchUuid, String userUuid, String eventUuid, String lang);

    /**
     * Resolve {@code choiceUuid} — the option the player picked out of an open
     * choice-event (Step 32): apply its {@code list_choices_effects}, run its
     * {@code idEventTorun} chain, record the milestone and close the cycle.
     *
     * <p>Nothing is charged here. The energy, the coins and the ONCE were spent when the
     * event was opened, which is exactly why the guard is "a cycle is open for this
     * event" rather than the Step 29 availability procedure — re-running that would
     * reject the very event the player has already paid for.</p>
     */
    ChoiceResolutionResult selectChoice(String matchUuid, String userUuid, String choiceUuid, String lang);

    /**
     * Outcome of the check procedure. {@code reason} reuses {@link EventExecutionException.Code}
     * so the flag on {@code /info} and the error of {@code execute-event} can never
     * disagree about why an event is impossible.
     */
    record EventAvailability(boolean available, EventExecutionException.Code reason) {

        public static final EventAvailability OK = new EventAvailability(true, null);

        public static EventAvailability no(EventExecutionException.Code reason) {
            return new EventAvailability(false, reason);
        }

        /** The reason as it travels on the wire, or null when the event is available. */
        public String reasonName() {
            return reason == null ? null : reason.name();
        }
    }

    /**
     * What the execution did. The booleans are the "something changed" flags the board
     * reacts to; {@link #refreshRecommended()} is true when any of them fired, telling
     * the frontend to reload match-info.
     */
    record EventExecutionResult(String matchUuid,
                                String eventUuid,
                                String eventType,
                                /** {@link #STATUS_APPLIED} or {@link #STATUS_CHOICES_PENDING}. */
                                String status,
                                CardInfo card,
                                /** Chain execution order; index 0 is always {@code eventUuid}. */
                                List<String> executedEventUuids,
                                int energySpent,
                                int coinSpent,
                                int newEnergy,
                                int newCoin,
                                int currentClock,
                                /** Always false in v0.29.0 — see the type javadoc. */
                                boolean turnConsumed,
                                boolean timeEnded,
                                boolean itemAdded,
                                boolean itemRemoved,
                                boolean weatherApplied,
                                /** True when a forced-movement effect (v0.29.3) moved somebody. */
                                boolean movementApplied,
                                boolean forcedSleep,
                                boolean comaTriggered,
                                boolean gameOver,
                                boolean refreshRecommended,
                                List<StatChange> statChanges,
                                List<RegistryChange> registryChanges,
                                List<TraitChange> traitChanges,
                                List<ItemChange> itemChanges,
                                List<CharacteristicChange> characteristicChanges,
                                List<LocationChange> locationChanges,
                                List<AppliedEffect> effects,
                                /** The options of a choice-event; empty when {@code status} is APPLIED. */
                                List<PendingChoice> pendingChoices,
                                /** Step 30. Never null; see {@link EdgeStateOutcome#none()}. */
                                EdgeStateOutcome edgeState) {
    }

    /**
     * What resolving one option did (Step 32).
     *
     * <p>{@code execution} is the very same payload {@code execute-event} returns — the
     * effects, the stat/registry/item/trait changes, the flags, the edge states — because a
     * resolved choice does all the same things to the world; only the trigger differs. The
     * fields around it are what is specific to a choice.</p>
     *
     * <p>{@code narrative} is the option's {@code idTextNarrative}, deliberately withheld by
     * Step 31 (returning it with the options would have leaked the consequence of a choice
     * not yet made) and revealed here, once the choice is irreversible.</p>
     *
     * <p>{@code choiceEventUuid}/{@code choiceEventCard} describe the event an effect's
     * {@code idEvent} ran inline. It is the card the board shows on its right page: the
     * event already happened, so the card narrates rather than offers.</p>
     */
    record ChoiceResolutionResult(EventExecutionResult execution,
                                  String choiceUuid,
                                  /** The event that owned the option. */
                                  String eventUuid,
                                  String narrative,
                                  CardInfo choiceCard,
                                  /** Null unless an effect row carried an {@code idEvent}. */
                                  String choiceEventUuid,
                                  CardInfo choiceEventCard,
                                  /** True when {@code is_progress} put a milestone row on record. */
                                  boolean progressRecorded) {
    }

    /**
     * What the Step 30 edge rules did (sadness overflow, coma) and, when the whole party is
     * down, the story epilogue that was run for it.
     *
     * <p>The epilogue is kept apart from {@code executedEventUuids} / {@code effects} on
     * purpose: merged in, the frontend would render it as if it were part of the chain the
     * player chose, when in fact it is the engine answering their collapse.</p>
     */
    record EdgeStateOutcome(List<String> sadnessOverflowUuids,
                            List<String> comaUuids,
                            boolean allPlayersInComa,
                            /** Null when the story authors no epilogue, or it was already spent. */
                            String comaEventUuid,
                            CardInfo comaEventCard,
                            List<String> comaExecutedEventUuids,
                            List<AppliedEffect> comaEffects) {

        public static EdgeStateOutcome none() {
            return new EdgeStateOutcome(List.of(), List.of(), false, null, null,
                    List.of(), List.of());
        }

        /** True when anything at all happened — the frontend shows a card only then. */
        public boolean anything() {
            return !sadnessOverflowUuids.isEmpty() || !comaUuids.isEmpty() || allPlayersInComa;
        }
    }

    record StatChange(String characterUuid, String statistic, int before, int after, int delta) {
    }

    record RegistryChange(String key, String oldValue, String newValue) {
    }

    /** {@code action} is ADD or REMOVE. */
    record TraitChange(String characterUuid, String traitUuid, String action) {
    }

    /** {@code action} is ADD or REMOVE. */
    record ItemChange(String characterUuid, String itemUuid, String action) {
    }

    /** One forced movement (v0.29.3): who moved, from where (null when unplaced), to where. */
    record LocationChange(String characterUuid, String fromLocationUuid, String toLocationUuid) {
    }

    /** {@code action} is ADD or REMOVE. */
    record CharacteristicChange(String characterUuid, String characteristic, String action) {
    }

    /**
     * One {@code list_events_effects} row that was applied. {@code card} is the row's own
     * card: that — not the event's card — is the narrative the board renders.
     * {@code characterUuids} may be empty when a class-targeted effect matches nobody.
     */
    record AppliedEffect(String eventUuid,
                         String effectUuid,
                         String statistic,
                         Integer value,
                         String target,
                         Integer targetClass,
                         List<String> characterUuids,
                         CardInfo card) {
    }

    /**
     * One option of a choice-event (Step 31), sorted by priority then id. {@code name}
     * and {@code description} are the resolved short texts; the choice's narrative text
     * is deliberately absent — it belongs to the resolution (Step 32), returning it here
     * would leak the outcome of a choice not yet made. {@code reason} is a
     * {@code ChoiceAvailabilityChecker} string, null exactly when {@code available}.
     */
    record PendingChoice(String uuid,
                         Integer priority,
                         String name,
                         String description,
                         CardInfo card,
                         boolean available,
                         String reason) {
    }

    /** Domain exception mapped to HTTP status codes by the controller. */
    class EventExecutionException extends RuntimeException {

        /**
         * Every way an event can be impossible. The values from
         * {@code EVENT_NOT_EXECUTABLE_TYPE} down are produced by the check procedure and
         * therefore also appear as the {@code reason} of an unavailable event on
         * {@code /info}.
         */
        public enum Code {
            MATCH_NOT_FOUND,
            MATCH_NOT_RUNNING,
            EVENT_NOT_FOUND,
            /** The caller owns no character in this match: nothing is executable. */
            CHARACTER_CANNOT_ACT,
            /** The character is asleep — it wakes up on its own, so the block is temporary. */
            SLEEPING,
            /** The character is in a coma: only a rescue can bring it back. */
            COMA,
            EVENT_NOT_EXECUTABLE_TYPE,
            ONCE_ALREADY_CONSUMED,
            WRONG_LOCATION,
            NOT_ENOUGH_ENERGY,
            NOT_ENOUGH_COINS,
            REGISTRY_CONDITION_NOT_MET,
            WEATHER_CONDITION_NOT_MET,
            ITEM_CONDITION_NOT_MET,
            CLASS_CONDITION_NOT_MET,
            // ── Step 32, produced by select-choice only ──
            /** No option of this story carries that uuid. */
            CHOICE_NOT_FOUND,
            /**
             * No cycle is open for the option's event: it was never opened, or it has
             * already been resolved. This is the cost-bypass guard — without it a player
             * could apply an option's effects without ever paying to open its event, and
             * apply them again on every call.
             */
            CHOICE_NOT_OPEN,
            /**
             * The option's own {@code ChoiceAvailabilityChecker} verdict, re-evaluated at
             * resolution: the world may have moved since the options were served.
             */
            CHOICE_NOT_AVAILABLE
        }

        private final transient Code code;

        public EventExecutionException(Code code, String message) {
            super(message);
            this.code = code;
        }

        public Code getCode() {
            return code;
        }
    }
}
