package games.paths.adapters.rest.dto;

import games.paths.core.model.match.CharacterInstanceInfo;

/**
 * CharacterInstanceResponse - full JSON projection of {@link CharacterInstanceInfo}.
 * Step 21 — body returned by {@code POST /api/matches/{uuid}/join} and
 * {@code GET /api/match/{uuid}/characters/{uuidCharacter}}. The shared stat
 * block comes from {@link AbstractCharacterStatsResponse}; this class adds the
 * match/location uuids. Step 35 moved food/magic/coin up into the shared base,
 * so the match /info summary exposes them too; the JSON key set is unchanged.
 */
public class CharacterInstanceResponse extends AbstractCharacterStatsResponse {

    private String matchUuid;
    private String locationUuid;

    public CharacterInstanceResponse() {
    }

    public static CharacterInstanceResponse fromModel(CharacterInstanceInfo m) {
        if (m == null) return null;
        CharacterInstanceResponse r = new CharacterInstanceResponse();
        r.copyStatsFrom(m);
        r.matchUuid = m.getMatchUuid();
        r.locationUuid = m.getLocationUuid();
        return r;
    }

    public String getMatchUuid() { return matchUuid; }
    public void setMatchUuid(String matchUuid) { this.matchUuid = matchUuid; }
    public String getLocationUuid() { return locationUuid; }
    public void setLocationUuid(String locationUuid) { this.locationUuid = locationUuid; }
}
