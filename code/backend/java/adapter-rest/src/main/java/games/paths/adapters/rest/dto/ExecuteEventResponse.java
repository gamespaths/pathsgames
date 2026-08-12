package games.paths.adapters.rest.dto;

import games.paths.core.port.match.EventExecutionPort.AppliedEffect;
import games.paths.core.port.match.EventExecutionPort.CharacteristicChange;
import games.paths.core.port.match.EventExecutionPort.EdgeStateOutcome;
import games.paths.core.port.match.EventExecutionPort.EventExecutionResult;
import games.paths.core.port.match.EventExecutionPort.ItemChange;
import games.paths.core.port.match.EventExecutionPort.LocationChange;
import games.paths.core.port.match.EventExecutionPort.PendingChoice;
import games.paths.core.port.match.EventExecutionPort.RegistryChange;
import games.paths.core.port.match.EventExecutionPort.StatChange;
import games.paths.core.port.match.EventExecutionPort.TraitChange;

import java.util.ArrayList;
import java.util.List;

/**
 * ExecuteEventResponse - body of POST /api/gameplay/{uuidMatch}/action/execute-event (Step 29).
 *
 * <p>Carries what the event did: the flags the board reacts to, the itemised changes, and one
 * {@link AppliedEffectDto} per {@code list_events_effects} row — each with its own card, which
 * is the narrative to render.</p>
 *
 * <p>{@code refreshRecommended} is true when any flag or list is non-empty: the frontend should
 * reload match-info. {@code turnConsumed} is always false in v0.29.0.</p>
 *
 * <p>Step 31: {@code status} tells the two flows apart — {@code APPLIED} (effects ran, as
 * above) or {@code CHOICES_PENDING} (cost paid, effects withheld, {@code pendingChoices}
 * holds the options to render, disabled ones included).</p>
 */
public class ExecuteEventResponse {

    private String matchUuid;
    private String eventUuid;
    private String eventType;
    private String status;
    private CardInfoResponse card;
    private List<String> executedEventUuids;
    private int energySpent;
    private int coinSpent;
    private int newEnergy;
    private int newCoin;
    private int currentClock;
    private boolean turnConsumed;
    private boolean timeEnded;
    private boolean itemAdded;
    private boolean itemRemoved;
    private boolean weatherApplied;
    private boolean movementApplied;
    private boolean forcedSleep;
    private boolean comaTriggered;
    private boolean gameOver;
    private boolean refreshRecommended;
    private List<StatChangeDto> statChanges;
    private List<RegistryChangeDto> registryChanges;
    private List<TraitChangeDto> traitChanges;
    private List<ItemChangeDto> itemChanges;
    private List<CharacteristicChangeDto> characteristicChanges;
    private List<LocationChangeDto> locationChanges;
    private List<AppliedEffectDto> effects;
    private List<PendingChoiceDto> pendingChoices;
    private EdgeStateOutcomeDto edgeState;
    /**
     * Step 33 — the automatic location events this execution set off by pushing somebody
     * somewhere. A forced-movement effect is an arrival, and arriving is a trigger.
     */
    private List<AutomaticEventResponse> automaticEvents = new ArrayList<>();

    public static ExecuteEventResponse fromModel(EventExecutionResult m) {
        ExecuteEventResponse d = new ExecuteEventResponse();
        d.matchUuid = m.matchUuid();
        d.eventUuid = m.eventUuid();
        d.eventType = m.eventType();
        d.status = m.status();
        d.card = CardInfoResponse.fromModel(m.card());
        d.executedEventUuids = new ArrayList<>(m.executedEventUuids());
        d.energySpent = m.energySpent();
        d.coinSpent = m.coinSpent();
        d.newEnergy = m.newEnergy();
        d.newCoin = m.newCoin();
        d.currentClock = m.currentClock();
        d.turnConsumed = m.turnConsumed();
        d.timeEnded = m.timeEnded();
        d.itemAdded = m.itemAdded();
        d.itemRemoved = m.itemRemoved();
        d.weatherApplied = m.weatherApplied();
        d.movementApplied = m.movementApplied();
        d.forcedSleep = m.forcedSleep();
        d.comaTriggered = m.comaTriggered();
        d.gameOver = m.gameOver();
        d.refreshRecommended = m.refreshRecommended();

        d.statChanges = new ArrayList<>();
        for (StatChange c : m.statChanges()) {
            d.statChanges.add(StatChangeDto.fromModel(c));
        }
        d.registryChanges = new ArrayList<>();
        for (RegistryChange c : m.registryChanges()) {
            d.registryChanges.add(RegistryChangeDto.fromModel(c));
        }
        d.traitChanges = new ArrayList<>();
        for (TraitChange c : m.traitChanges()) {
            d.traitChanges.add(TraitChangeDto.fromModel(c));
        }
        d.itemChanges = new ArrayList<>();
        for (ItemChange c : m.itemChanges()) {
            d.itemChanges.add(ItemChangeDto.fromModel(c));
        }
        d.characteristicChanges = new ArrayList<>();
        for (CharacteristicChange c : m.characteristicChanges()) {
            d.characteristicChanges.add(CharacteristicChangeDto.fromModel(c));
        }
        d.locationChanges = new ArrayList<>();
        for (LocationChange c : m.locationChanges()) {
            d.locationChanges.add(LocationChangeDto.fromModel(c));
        }
        d.effects = new ArrayList<>();
        for (AppliedEffect e : m.effects()) {
            d.effects.add(AppliedEffectDto.fromModel(e));
        }
        d.pendingChoices = new ArrayList<>();
        for (PendingChoice c : m.pendingChoices()) {
            d.pendingChoices.add(PendingChoiceDto.fromModel(c));
        }
        d.edgeState = EdgeStateOutcomeDto.fromModel(m.edgeState());
        d.automaticEvents = AutomaticEventResponse.fromModels(m.automaticEvents());
        return d;
    }

    public String getMatchUuid() { return matchUuid; }
    public void setMatchUuid(String matchUuid) { this.matchUuid = matchUuid; }
    public String getEventUuid() { return eventUuid; }
    public void setEventUuid(String eventUuid) { this.eventUuid = eventUuid; }
    public String getEventType() { return eventType; }
    public void setEventType(String eventType) { this.eventType = eventType; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public CardInfoResponse getCard() { return card; }
    public void setCard(CardInfoResponse card) { this.card = card; }
    public List<String> getExecutedEventUuids() { return executedEventUuids; }
    public void setExecutedEventUuids(List<String> executedEventUuids) { this.executedEventUuids = executedEventUuids; }
    public int getEnergySpent() { return energySpent; }
    public void setEnergySpent(int energySpent) { this.energySpent = energySpent; }
    public int getCoinSpent() { return coinSpent; }
    public void setCoinSpent(int coinSpent) { this.coinSpent = coinSpent; }
    public int getNewEnergy() { return newEnergy; }
    public void setNewEnergy(int newEnergy) { this.newEnergy = newEnergy; }
    public int getNewCoin() { return newCoin; }
    public void setNewCoin(int newCoin) { this.newCoin = newCoin; }
    public int getCurrentClock() { return currentClock; }
    public void setCurrentClock(int currentClock) { this.currentClock = currentClock; }
    public boolean isTurnConsumed() { return turnConsumed; }
    public void setTurnConsumed(boolean turnConsumed) { this.turnConsumed = turnConsumed; }
    public boolean isTimeEnded() { return timeEnded; }
    public void setTimeEnded(boolean timeEnded) { this.timeEnded = timeEnded; }
    public boolean isItemAdded() { return itemAdded; }
    public void setItemAdded(boolean itemAdded) { this.itemAdded = itemAdded; }
    public boolean isItemRemoved() { return itemRemoved; }
    public void setItemRemoved(boolean itemRemoved) { this.itemRemoved = itemRemoved; }
    public boolean isWeatherApplied() { return weatherApplied; }
    public void setWeatherApplied(boolean weatherApplied) { this.weatherApplied = weatherApplied; }
    public boolean isMovementApplied() { return movementApplied; }
    public void setMovementApplied(boolean movementApplied) { this.movementApplied = movementApplied; }
    public boolean isForcedSleep() { return forcedSleep; }
    public void setForcedSleep(boolean forcedSleep) { this.forcedSleep = forcedSleep; }
    public boolean isComaTriggered() { return comaTriggered; }
    public void setComaTriggered(boolean comaTriggered) { this.comaTriggered = comaTriggered; }
    public boolean isGameOver() { return gameOver; }
    public void setGameOver(boolean gameOver) { this.gameOver = gameOver; }
    public boolean isRefreshRecommended() { return refreshRecommended; }
    public void setRefreshRecommended(boolean refreshRecommended) { this.refreshRecommended = refreshRecommended; }
    public List<StatChangeDto> getStatChanges() { return statChanges; }
    public void setStatChanges(List<StatChangeDto> statChanges) { this.statChanges = statChanges; }
    public List<RegistryChangeDto> getRegistryChanges() { return registryChanges; }
    public void setRegistryChanges(List<RegistryChangeDto> registryChanges) { this.registryChanges = registryChanges; }
    public List<TraitChangeDto> getTraitChanges() { return traitChanges; }
    public void setTraitChanges(List<TraitChangeDto> traitChanges) { this.traitChanges = traitChanges; }
    public List<ItemChangeDto> getItemChanges() { return itemChanges; }
    public void setItemChanges(List<ItemChangeDto> itemChanges) { this.itemChanges = itemChanges; }
    public List<CharacteristicChangeDto> getCharacteristicChanges() { return characteristicChanges; }
    public void setCharacteristicChanges(List<CharacteristicChangeDto> c) { this.characteristicChanges = c; }
    public List<LocationChangeDto> getLocationChanges() { return locationChanges; }
    public void setLocationChanges(List<LocationChangeDto> locationChanges) { this.locationChanges = locationChanges; }
    public List<AppliedEffectDto> getEffects() { return effects; }
    public void setEffects(List<AppliedEffectDto> effects) { this.effects = effects; }
    public List<PendingChoiceDto> getPendingChoices() { return pendingChoices; }
    public void setPendingChoices(List<PendingChoiceDto> pendingChoices) { this.pendingChoices = pendingChoices; }

    /** A statistic that changed, with the value before and after the clamp. */
    public static class StatChangeDto {
        private String characterUuid;
        private String statistic;
        private int before;
        private int after;
        private int delta;

        public static StatChangeDto fromModel(StatChange m) {
            StatChangeDto d = new StatChangeDto();
            d.characterUuid = m.characterUuid();
            d.statistic = m.statistic();
            d.before = m.before();
            d.after = m.after();
            d.delta = m.delta();
            return d;
        }

        public String getCharacterUuid() { return characterUuid; }
        public void setCharacterUuid(String characterUuid) { this.characterUuid = characterUuid; }
        public String getStatistic() { return statistic; }
        public void setStatistic(String statistic) { this.statistic = statistic; }
        public int getBefore() { return before; }
        public void setBefore(int before) { this.before = before; }
        public int getAfter() { return after; }
        public void setAfter(int after) { this.after = after; }
        public int getDelta() { return delta; }
        public void setDelta(int delta) { this.delta = delta; }
    }

    public static class RegistryChangeDto {
        private String key;
        private String oldValue;
        private String newValue;

        public static RegistryChangeDto fromModel(RegistryChange m) {
            RegistryChangeDto d = new RegistryChangeDto();
            d.key = m.key();
            d.oldValue = m.oldValue();
            d.newValue = m.newValue();
            return d;
        }

        public String getKey() { return key; }
        public void setKey(String key) { this.key = key; }
        public String getOldValue() { return oldValue; }
        public void setOldValue(String oldValue) { this.oldValue = oldValue; }
        public String getNewValue() { return newValue; }
        public void setNewValue(String newValue) { this.newValue = newValue; }
    }

    public static class TraitChangeDto {
        private String characterUuid;
        private String traitUuid;
        private String action;

        public static TraitChangeDto fromModel(TraitChange m) {
            TraitChangeDto d = new TraitChangeDto();
            d.characterUuid = m.characterUuid();
            d.traitUuid = m.traitUuid();
            d.action = m.action();
            return d;
        }

        public String getCharacterUuid() { return characterUuid; }
        public void setCharacterUuid(String characterUuid) { this.characterUuid = characterUuid; }
        public String getTraitUuid() { return traitUuid; }
        public void setTraitUuid(String traitUuid) { this.traitUuid = traitUuid; }
        public String getAction() { return action; }
        public void setAction(String action) { this.action = action; }
    }

    public static class ItemChangeDto {
        private String characterUuid;
        private String itemUuid;
        private String action;

        public static ItemChangeDto fromModel(ItemChange m) {
            ItemChangeDto d = new ItemChangeDto();
            d.characterUuid = m.characterUuid();
            d.itemUuid = m.itemUuid();
            d.action = m.action();
            return d;
        }

        public String getCharacterUuid() { return characterUuid; }
        public void setCharacterUuid(String characterUuid) { this.characterUuid = characterUuid; }
        public String getItemUuid() { return itemUuid; }
        public void setItemUuid(String itemUuid) { this.itemUuid = itemUuid; }
        public String getAction() { return action; }
        public void setAction(String action) { this.action = action; }
    }

    public static class CharacteristicChangeDto {
        private String characterUuid;
        private String characteristic;
        private String action;

        public static CharacteristicChangeDto fromModel(CharacteristicChange m) {
            CharacteristicChangeDto d = new CharacteristicChangeDto();
            d.characterUuid = m.characterUuid();
            d.characteristic = m.characteristic();
            d.action = m.action();
            return d;
        }

        public String getCharacterUuid() { return characterUuid; }
        public void setCharacterUuid(String characterUuid) { this.characterUuid = characterUuid; }
        public String getCharacteristic() { return characteristic; }
        public void setCharacteristic(String characteristic) { this.characteristic = characteristic; }
        public String getAction() { return action; }
        public void setAction(String action) { this.action = action; }
    }

    /** One forced movement (v0.29.3): who moved, from where (null when unplaced), to where. */
    public static class LocationChangeDto {
        private String characterUuid;
        private String fromLocationUuid;
        private String toLocationUuid;

        public static LocationChangeDto fromModel(LocationChange m) {
            LocationChangeDto d = new LocationChangeDto();
            d.characterUuid = m.characterUuid();
            d.fromLocationUuid = m.fromLocationUuid();
            d.toLocationUuid = m.toLocationUuid();
            return d;
        }

        public String getCharacterUuid() { return characterUuid; }
        public void setCharacterUuid(String characterUuid) { this.characterUuid = characterUuid; }
        public String getFromLocationUuid() { return fromLocationUuid; }
        public void setFromLocationUuid(String fromLocationUuid) { this.fromLocationUuid = fromLocationUuid; }
        public String getToLocationUuid() { return toLocationUuid; }
        public void setToLocationUuid(String toLocationUuid) { this.toLocationUuid = toLocationUuid; }
    }

    /** One list_events_effects row that ran. Its {@code card} is the narrative to show. */
    public static class AppliedEffectDto {
        private String eventUuid;
        private String effectUuid;
        private String statistic;
        private Integer value;
        private String target;
        private Integer targetClass;
        private List<String> characterUuids;
        private CardInfoResponse card;

        public static AppliedEffectDto fromModel(AppliedEffect m) {
            AppliedEffectDto d = new AppliedEffectDto();
            d.eventUuid = m.eventUuid();
            d.effectUuid = m.effectUuid();
            d.statistic = m.statistic();
            d.value = m.value();
            d.target = m.target();
            d.targetClass = m.targetClass();
            d.characterUuids = new ArrayList<>(m.characterUuids());
            d.card = CardInfoResponse.fromModel(m.card());
            return d;
        }

        public String getEventUuid() { return eventUuid; }
        public void setEventUuid(String eventUuid) { this.eventUuid = eventUuid; }
        public String getEffectUuid() { return effectUuid; }
        public void setEffectUuid(String effectUuid) { this.effectUuid = effectUuid; }
        public String getStatistic() { return statistic; }
        public void setStatistic(String statistic) { this.statistic = statistic; }
        public Integer getValue() { return value; }
        public void setValue(Integer value) { this.value = value; }
        public String getTarget() { return target; }
        public void setTarget(String target) { this.target = target; }
        public Integer getTargetClass() { return targetClass; }
        public void setTargetClass(Integer targetClass) { this.targetClass = targetClass; }
        public List<String> getCharacterUuids() { return characterUuids; }
        public void setCharacterUuids(List<String> characterUuids) { this.characterUuids = characterUuids; }
        public CardInfoResponse getCard() { return card; }
        public void setCard(CardInfoResponse card) { this.card = card; }
    }

    public EdgeStateOutcomeDto getEdgeState() { return edgeState; }
    public void setEdgeState(EdgeStateOutcomeDto edgeState) { this.edgeState = edgeState; }

    public List<AutomaticEventResponse> getAutomaticEvents() { return automaticEvents; }
    public void setAutomaticEvents(List<AutomaticEventResponse> automaticEvents) {
        this.automaticEvents = automaticEvents;
    }

    /**
     * Step 30 edge states: who overflowed on sadness, who fell into a coma, and — when the
     * whole party is down — the story epilogue that was run.
     *
     * <p>The epilogue's events and effects are kept out of the top-level
     * {@code executedEventUuids} / {@code effects}, so the board can tell the narrative the
     * player triggered apart from the engine's answer to their collapse.</p>
     */
    public static class EdgeStateOutcomeDto {
        private List<String> sadnessOverflowUuids;
        private List<String> comaUuids;
        private boolean allPlayersInComa;
        private String comaEventUuid;
        private CardInfoResponse comaEventCard;
        private List<String> comaExecutedEventUuids;
        private List<AppliedEffectDto> comaEffects;

        public static EdgeStateOutcomeDto fromModel(EdgeStateOutcome m) {
            if (m == null) {
                return null;
            }
            EdgeStateOutcomeDto d = new EdgeStateOutcomeDto();
            d.sadnessOverflowUuids = new ArrayList<>(m.sadnessOverflowUuids());
            d.comaUuids = new ArrayList<>(m.comaUuids());
            d.allPlayersInComa = m.allPlayersInComa();
            d.comaEventUuid = m.comaEventUuid();
            d.comaEventCard = CardInfoResponse.fromModel(m.comaEventCard());
            d.comaExecutedEventUuids = new ArrayList<>(m.comaExecutedEventUuids());
            d.comaEffects = new ArrayList<>();
            for (AppliedEffect e : m.comaEffects()) {
                d.comaEffects.add(AppliedEffectDto.fromModel(e));
            }
            return d;
        }

        public List<String> getSadnessOverflowUuids() { return sadnessOverflowUuids; }
        public void setSadnessOverflowUuids(List<String> v) { this.sadnessOverflowUuids = v; }
        public List<String> getComaUuids() { return comaUuids; }
        public void setComaUuids(List<String> comaUuids) { this.comaUuids = comaUuids; }
        public boolean isAllPlayersInComa() { return allPlayersInComa; }
        public void setAllPlayersInComa(boolean v) { this.allPlayersInComa = v; }
        public String getComaEventUuid() { return comaEventUuid; }
        public void setComaEventUuid(String comaEventUuid) { this.comaEventUuid = comaEventUuid; }
        public CardInfoResponse getComaEventCard() { return comaEventCard; }
        public void setComaEventCard(CardInfoResponse v) { this.comaEventCard = v; }
        public List<String> getComaExecutedEventUuids() { return comaExecutedEventUuids; }
        public void setComaExecutedEventUuids(List<String> v) { this.comaExecutedEventUuids = v; }
        public List<AppliedEffectDto> getComaEffects() { return comaEffects; }
        public void setComaEffects(List<AppliedEffectDto> v) { this.comaEffects = v; }
    }

    /**
     * One option of a choice-event (Step 31), priority order, disabled ones included.
     * {@code reason} is null exactly when {@code available}; the choice's narrative text
     * is deliberately not here — it would leak the outcome of a choice not yet made.
     */
    public static class PendingChoiceDto {
        private String uuid;
        private Integer priority;
        private String name;
        private String description;
        private CardInfoResponse card;
        private boolean available;
        private String reason;

        public static PendingChoiceDto fromModel(PendingChoice m) {
            PendingChoiceDto d = new PendingChoiceDto();
            d.uuid = m.uuid();
            d.priority = m.priority();
            d.name = m.name();
            d.description = m.description();
            d.card = CardInfoResponse.fromModel(m.card());
            d.available = m.available();
            d.reason = m.reason();
            return d;
        }

        public String getUuid() { return uuid; }
        public void setUuid(String uuid) { this.uuid = uuid; }
        public Integer getPriority() { return priority; }
        public void setPriority(Integer priority) { this.priority = priority; }
        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public String getDescription() { return description; }
        public void setDescription(String description) { this.description = description; }
        public CardInfoResponse getCard() { return card; }
        public void setCard(CardInfoResponse card) { this.card = card; }
        public boolean isAvailable() { return available; }
        public void setAvailable(boolean available) { this.available = available; }
        public String getReason() { return reason; }
        public void setReason(String reason) { this.reason = reason; }
    }
}
