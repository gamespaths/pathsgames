package games.paths.adapters.rest.dto;

import games.paths.core.port.match.LocationEntryPort;

import java.util.ArrayList;
import java.util.List;

/**
 * One automatic location event the engine fired (Step 33).
 *
 * <p>Rides on every response that can cause an arrival: the movement result, and the
 * event/choice results whose effects can push a character somewhere. {@code trigger} says
 * <em>why</em> it fired — {@code FIRST_ENTRY}, {@code SUBSEQUENT_ENTRY},
 * {@code FIRST_IN_LOCATION}, {@code COUNTER_ZERO} or {@code CHARACTER_START_TIME} — and
 * {@code card} is the narrative the book shows on its right page.</p>
 */
public class AutomaticEventResponse {

    private String trigger;
    private long idLocation;
    private String eventUuid;
    private CardInfoResponse card;
    private List<ExecuteEventResponse.AppliedEffectDto> effects = new ArrayList<>();
    private List<ExecuteEventResponse.StatChangeDto> statChanges = new ArrayList<>();
    private List<ExecuteEventResponse.LocationChangeDto> locationChanges = new ArrayList<>();
    private boolean gameOver;

    public static AutomaticEventResponse fromModel(LocationEntryPort.AutomaticEventFired m) {
        AutomaticEventResponse r = new AutomaticEventResponse();
        r.trigger = m.trigger();
        r.idLocation = m.idLocation();
        r.eventUuid = m.eventUuid();
        r.card = CardInfoResponse.fromModel(m.card());
        if (m.effects() != null) {
            m.effects().forEach(e ->
                    r.effects.add(ExecuteEventResponse.AppliedEffectDto.fromModel(e)));
        }
        if (m.statChanges() != null) {
            m.statChanges().forEach(s ->
                    r.statChanges.add(ExecuteEventResponse.StatChangeDto.fromModel(s)));
        }
        if (m.locationChanges() != null) {
            m.locationChanges().forEach(l ->
                    r.locationChanges.add(ExecuteEventResponse.LocationChangeDto.fromModel(l)));
        }
        r.gameOver = m.gameOver();
        return r;
    }

    /** Convenience: map a whole list, never null. */
    public static List<AutomaticEventResponse> fromModels(
            List<LocationEntryPort.AutomaticEventFired> models) {
        List<AutomaticEventResponse> out = new ArrayList<>();
        if (models != null) {
            models.forEach(m -> out.add(fromModel(m)));
        }
        return out;
    }

    public String getTrigger() { return trigger; }
    public long getIdLocation() { return idLocation; }
    public String getEventUuid() { return eventUuid; }
    public CardInfoResponse getCard() { return card; }
    public List<ExecuteEventResponse.AppliedEffectDto> getEffects() { return effects; }
    public List<ExecuteEventResponse.StatChangeDto> getStatChanges() { return statChanges; }
    public List<ExecuteEventResponse.LocationChangeDto> getLocationChanges() { return locationChanges; }
    public boolean isGameOver() { return gameOver; }
}
