package games.paths.adapters.rest.dto;

import games.paths.core.port.match.TimeAdvancementPort;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Response for {@code GET /api/match/{uuidMatch}/clock} (Step 25).
 *
 * <p>Returns the current clock, the story's singular/plural clock labels and the
 * per-character sleeping/energy state. No day/phase model exists yet.</p>
 */
public class ClockResponse {

    private String matchUuid;
    private int currentClock;
    private String clockLabelSingular;
    private String clockLabelPlural;
    private boolean anyCharacterSleeping;
    private List<ClockCharacterResponse> characters;

    public static ClockResponse fromModel(TimeAdvancementPort.ClockResult m) {
        ClockResponse r = new ClockResponse();
        r.matchUuid = m.matchUuid();
        r.currentClock = m.currentClock();
        r.clockLabelSingular = m.clockLabelSingular();
        r.clockLabelPlural = m.clockLabelPlural();
        r.anyCharacterSleeping = m.anyCharacterSleeping();
        r.characters = m.characters() == null ? List.of()
                : m.characters().stream().map(ClockCharacterResponse::fromModel).collect(Collectors.toList());
        return r;
    }

    public String getMatchUuid() { return matchUuid; }
    public int getCurrentClock() { return currentClock; }
    public String getClockLabelSingular() { return clockLabelSingular; }
    public String getClockLabelPlural() { return clockLabelPlural; }
    public boolean isAnyCharacterSleeping() { return anyCharacterSleeping; }
    public List<ClockCharacterResponse> getCharacters() { return characters; }
}
