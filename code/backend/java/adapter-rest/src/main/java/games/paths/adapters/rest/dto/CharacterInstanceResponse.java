package games.paths.adapters.rest.dto;

import games.paths.core.model.match.CharacterInstanceInfo;

/**
 * CharacterInstanceResponse - full JSON projection of {@link CharacterInstanceInfo}.
 * Step 21 — body returned by {@code POST /api/matches/{uuid}/join} and
 * {@code GET /api/match/{uuid}/characters/{uuidCharacter}}. The shared stat
 * block comes from {@link AbstractCharacterStatsResponse}; this class adds the
 * match/location uuids and the backpack resources.
 */
public class CharacterInstanceResponse extends AbstractCharacterStatsResponse {

    private String matchUuid;
    private String locationUuid;
    private Integer food;
    private Integer magic;
    private Integer coin;

    public CharacterInstanceResponse() {
    }

    public static CharacterInstanceResponse fromModel(CharacterInstanceInfo m) {
        if (m == null) return null;
        CharacterInstanceResponse r = new CharacterInstanceResponse();
        r.copyStatsFrom(m);
        r.matchUuid = m.getMatchUuid();
        r.locationUuid = m.getLocationUuid();
        r.food = m.getFood();
        r.magic = m.getMagic();
        r.coin = m.getCoin();
        return r;
    }

    public String getMatchUuid() { return matchUuid; }
    public void setMatchUuid(String matchUuid) { this.matchUuid = matchUuid; }
    public String getLocationUuid() { return locationUuid; }
    public void setLocationUuid(String locationUuid) { this.locationUuid = locationUuid; }
    public Integer getFood() { return food; }
    public void setFood(Integer food) { this.food = food; }
    public Integer getMagic() { return magic; }
    public void setMagic(Integer magic) { this.magic = magic; }
    public Integer getCoin() { return coin; }
    public void setCoin(Integer coin) { this.coin = coin; }
}
