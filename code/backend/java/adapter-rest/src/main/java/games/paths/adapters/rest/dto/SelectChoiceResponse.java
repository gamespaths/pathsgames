package games.paths.adapters.rest.dto;

import games.paths.core.port.match.EventExecutionPort.ChoiceResolutionResult;

/**
 * SelectChoiceResponse - body of POST /api/gameplay/{uuidMatch}/action/select-choice (Step 32).
 *
 * <p>Extends {@link ExecuteEventResponse} rather than paraphrasing it: a resolved choice does
 * to the world everything an executed event does — the same effects, the same stat, registry,
 * item, trait and location changes, the same flags and edge states — so the board handles both
 * with one code path and the two can never drift. Only the trigger differs, and that is what
 * the fields below describe.</p>
 *
 * <p>The four {@code *Spent} fields are always {@code 0} here: the cost was paid when the
 * event was opened (Step 31), and resolving is what that payment bought. v0.35.3 added food
 * and magic to that list — an option of its own still costs nothing.</p>
 *
 * <p>{@code narrative} is the option's narrative text, withheld by Step 31 — returning it with
 * the options would have leaked the consequence of a choice not yet made — and revealed now
 * that the choice is irreversible.</p>
 *
 * <p>{@code status} is {@code APPLIED} as usual, except when a linked event turned out to be
 * another choice-event: then it is {@code CHOICES_PENDING} and {@code pendingChoices} carries
 * the next set of options.</p>
 */
public class SelectChoiceResponse extends ExecuteEventResponse {

    private String choiceUuid;
    private String eventUuid;
    private String narrative;
    private CardInfoResponse choiceCard;
    private String choiceEventUuid;
    private CardInfoResponse choiceEventCard;
    private boolean progressRecorded;

    public static SelectChoiceResponse fromModel(ChoiceResolutionResult m) {
        SelectChoiceResponse d = new SelectChoiceResponse();
        d.copyFrom(ExecuteEventResponse.fromModel(m.execution()));
        d.choiceUuid = m.choiceUuid();
        d.eventUuid = m.eventUuid();
        d.narrative = m.narrative();
        d.choiceCard = CardInfoResponse.fromModel(m.choiceCard());
        d.choiceEventUuid = m.choiceEventUuid();
        d.choiceEventCard = CardInfoResponse.fromModel(m.choiceEventCard());
        d.progressRecorded = m.progressRecorded();
        return d;
    }

    /**
     * Copies the shared execute-event block onto this response.
     *
     * <p>{@code eventUuid} is deliberately NOT copied: on the parent it names the event the
     * player triggered, here it names the event that owned the option — the same meaning, but
     * it is set from {@link ChoiceResolutionResult} so the two stay one field on the wire.</p>
     */
    private void copyFrom(ExecuteEventResponse s) {
        setMatchUuid(s.getMatchUuid());
        setEventType(s.getEventType());
        setStatus(s.getStatus());
        setCard(s.getCard());
        setExecutedEventUuids(s.getExecutedEventUuids());
        setEnergySpent(s.getEnergySpent());
        setCoinSpent(s.getCoinSpent());
        setFoodSpent(s.getFoodSpent());
        setMagicSpent(s.getMagicSpent());
        setNewEnergy(s.getNewEnergy());
        setNewCoin(s.getNewCoin());
        setNewFood(s.getNewFood());
        setNewMagic(s.getNewMagic());
        setCurrentClock(s.getCurrentClock());
        setTurnConsumed(s.isTurnConsumed());
        setTimeEnded(s.isTimeEnded());
        setItemAdded(s.isItemAdded());
        setItemRemoved(s.isItemRemoved());
        setWeatherApplied(s.isWeatherApplied());
        setMovementApplied(s.isMovementApplied());
        setForcedSleep(s.isForcedSleep());
        setComaTriggered(s.isComaTriggered());
        setGameOver(s.isGameOver());
        setRefreshRecommended(s.isRefreshRecommended());
        setStatChanges(s.getStatChanges());
        setRegistryChanges(s.getRegistryChanges());
        setTraitChanges(s.getTraitChanges());
        setItemChanges(s.getItemChanges());
        setCharacteristicChanges(s.getCharacteristicChanges());
        setLocationChanges(s.getLocationChanges());
        setEffects(s.getEffects());
        setPendingChoices(s.getPendingChoices());
        setEdgeState(s.getEdgeState());
    }

    public String getChoiceUuid() { return choiceUuid; }
    public void setChoiceUuid(String choiceUuid) { this.choiceUuid = choiceUuid; }

    @Override
    public String getEventUuid() { return eventUuid; }

    @Override
    public void setEventUuid(String eventUuid) { this.eventUuid = eventUuid; }

    public String getNarrative() { return narrative; }
    public void setNarrative(String narrative) { this.narrative = narrative; }

    public CardInfoResponse getChoiceCard() { return choiceCard; }
    public void setChoiceCard(CardInfoResponse choiceCard) { this.choiceCard = choiceCard; }

    public String getChoiceEventUuid() { return choiceEventUuid; }
    public void setChoiceEventUuid(String choiceEventUuid) { this.choiceEventUuid = choiceEventUuid; }

    public CardInfoResponse getChoiceEventCard() { return choiceEventCard; }
    public void setChoiceEventCard(CardInfoResponse c) { this.choiceEventCard = c; }

    public boolean isProgressRecorded() { return progressRecorded; }
    public void setProgressRecorded(boolean progressRecorded) { this.progressRecorded = progressRecorded; }
}
