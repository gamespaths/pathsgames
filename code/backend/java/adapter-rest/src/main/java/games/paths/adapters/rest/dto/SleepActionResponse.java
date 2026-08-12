package games.paths.adapters.rest.dto;

import games.paths.core.port.match.TimeAdvancementPort;

import java.util.ArrayList;
import java.util.List;

/**
 * Response for {@code POST /api/gameplay/{uuidMatch}/action/sleep} (Step 25 +
 * Step 26 recovery recap).
 *
 * <p>Step 33 added {@code counterZero}: what happened in the world while the party slept.
 * A <b>list</b> — several location counters can run out on the same time-start — and already
 * filtered for this caller, who may not be allowed to know where it happened.</p>
 *
 * <p>v0.33.1 widened each entry from one card to three: the event's card, the cards of the
 * effects it applied, and the location's card. Until then only the location travelled, so the
 * player woke to the name of a place instead of the news of what had happened in it.</p>
 */
public class SleepActionResponse {

    private String matchUuid;
    private String characterUuid;
    private boolean isSleeping;
    private boolean timeEndTriggered;
    private int currentClock;
    private List<RecoveryItem> recovery = new ArrayList<>();
    private List<CounterZeroItem> counterZero = new ArrayList<>();

    public static SleepActionResponse fromModel(TimeAdvancementPort.SleepResult m) {
        SleepActionResponse r = new SleepActionResponse();
        r.matchUuid = m.matchUuid();
        r.characterUuid = m.characterUuid();
        r.isSleeping = m.isSleeping();
        r.timeEndTriggered = m.timeEndTriggered();
        r.currentClock = m.currentClock();
        if (m.recovery() != null) {
            for (TimeAdvancementPort.RecoveryItem item : m.recovery()) {
                r.recovery.add(new RecoveryItem(item.characterUuid(),
                        item.energyDelta(), item.lifeDelta(), item.sadDelta()));
            }
        }
        if (m.counterZero() != null) {
            for (TimeAdvancementPort.CounterZeroItem item : m.counterZero()) {
                List<ExecuteEventResponse.AppliedEffectDto> effects = new ArrayList<>();
                if (item.cardEffects() != null) {
                    item.cardEffects().forEach(e ->
                            effects.add(ExecuteEventResponse.AppliedEffectDto.fromModel(e)));
                }
                r.counterZero.add(new CounterZeroItem(item.trigger(), item.idLocation(),
                        CardInfoResponse.fromModel(item.card()),
                        CardInfoResponse.fromModel(item.cardLocation()), effects,
                        item.eventUuid(), item.clock(), item.visibility()));
            }
        }
        return r;
    }

    public String getMatchUuid() { return matchUuid; }
    public String getCharacterUuid() { return characterUuid; }
    public boolean getIsSleeping() { return isSleeping; }
    public boolean isTimeEndTriggered() { return timeEndTriggered; }
    public int getCurrentClock() { return currentClock; }
    public List<RecoveryItem> getRecovery() { return recovery; }
    public List<CounterZeroItem> getCounterZero() { return counterZero; }

    /**
     * One automatic event a time-start fired, as this caller is allowed to hear it (Step 33).
     *
     * <p>{@code visibility} is {@code FULL} when the caller is standing there, {@code NAMED}
     * when they have been there before, and {@code ANONYMOUS} when they never have — and in
     * that last case {@code card}, {@code cardLocation} and {@code cardEffects} are all
     * <b>empty</b>, because a counter runs down even in places nobody has seen and naming one
     * would hand the player the map.</p>
     *
     * <p>{@code card} is the <b>event's</b> card, {@code cardEffects} the rows it applied —
     * each with its own card, the narrative the board renders, same shape
     * {@code execute-event} returns — and {@code cardLocation} the place it happened in.</p>
     */
    public static class CounterZeroItem {
        private final String trigger;
        private final long idLocation;
        private final CardInfoResponse card;
        private final CardInfoResponse cardLocation;
        private final List<ExecuteEventResponse.AppliedEffectDto> cardEffects;
        private final String eventUuid;
        private final int clock;
        private final String visibility;

        public CounterZeroItem(String trigger, long idLocation, CardInfoResponse card,
                               CardInfoResponse cardLocation,
                               List<ExecuteEventResponse.AppliedEffectDto> cardEffects,
                               String eventUuid, int clock, String visibility) {
            this.trigger = trigger;
            this.idLocation = idLocation;
            this.card = card;
            this.cardLocation = cardLocation;
            this.cardEffects = cardEffects == null ? new ArrayList<>() : cardEffects;
            this.eventUuid = eventUuid;
            this.clock = clock;
            this.visibility = visibility;
        }

        public String getTrigger() { return trigger; }
        public long getIdLocation() { return idLocation; }
        public CardInfoResponse getCard() { return card; }
        public CardInfoResponse getCardLocation() { return cardLocation; }
        public List<ExecuteEventResponse.AppliedEffectDto> getCardEffects() { return cardEffects; }
        public String getEventUuid() { return eventUuid; }
        public int getClock() { return clock; }
        public String getVisibility() { return visibility; }
    }

    /** Per-character recovery summary (Step 26). */
    public static class RecoveryItem {
        private final String characterUuid;
        private final int energyDelta;
        private final int lifeDelta;
        private final int sadDelta;

        public RecoveryItem(String characterUuid, int energyDelta, int lifeDelta, int sadDelta) {
            this.characterUuid = characterUuid;
            this.energyDelta = energyDelta;
            this.lifeDelta = lifeDelta;
            this.sadDelta = sadDelta;
        }

        public String getCharacterUuid() { return characterUuid; }
        public int getEnergyDelta() { return energyDelta; }
        public int getLifeDelta() { return lifeDelta; }
        public int getSadDelta() { return sadDelta; }
    }
}
