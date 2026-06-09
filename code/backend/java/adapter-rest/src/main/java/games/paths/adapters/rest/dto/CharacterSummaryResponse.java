package games.paths.adapters.rest.dto;

import games.paths.core.model.match.CharacterInstanceInfo;

/**
 * CharacterSummaryResponse - lightweight JSON projection of
 * {@link CharacterInstanceInfo} used by {@code GET /api/match/{uuid}/players}
 * and embedded as the {@code players} array of {@link MatchInfoResponse}.
 * Step 21. All fields come from {@link AbstractCharacterStatsResponse}.
 */
public class CharacterSummaryResponse extends AbstractCharacterStatsResponse {

    public CharacterSummaryResponse() {
    }

    public static CharacterSummaryResponse fromModel(CharacterInstanceInfo m) {
        if (m == null) return null;
        CharacterSummaryResponse r = new CharacterSummaryResponse();
        r.copyStatsFrom(m);
        return r;
    }
}
