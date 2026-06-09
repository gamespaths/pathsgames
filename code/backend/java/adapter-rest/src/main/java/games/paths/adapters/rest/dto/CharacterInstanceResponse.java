package games.paths.adapters.rest.dto;

import games.paths.core.model.match.CharacterInstanceInfo;

import java.util.ArrayList;
import java.util.List;

/**
 * CharacterInstanceResponse - full JSON projection of {@link CharacterInstanceInfo}.
 * Step 21 — body returned by {@code POST /api/matches/{uuid}/join} and
 * {@code GET /api/match/{uuid}/characters/{uuidCharacter}}.
 */
public class CharacterInstanceResponse {

    private String uuid;
    private String matchUuid;
    private String userUuid;
    private String characterTemplateUuid;
    private String classUuid;
    private Integer dexterity;
    private Integer intelligence;
    private Integer constitution;
    private Integer energy;
    private Integer life;
    private Integer sad;
    private Long idLocation;
    private String locationUuid;
    private String locationName;
    private Boolean isSleeping;
    private Boolean isComa;
    private List<String> traitUuids = new ArrayList<>();
    private Integer food;
    private Integer magic;
    private Integer coin;

    public CharacterInstanceResponse() {
    }

    public static CharacterInstanceResponse fromModel(CharacterInstanceInfo m) {
        if (m == null) return null;
        CharacterInstanceResponse r = new CharacterInstanceResponse();
        r.uuid = m.getUuid();
        r.matchUuid = m.getMatchUuid();
        r.userUuid = m.getUserUuid();
        r.characterTemplateUuid = m.getCharacterTemplateUuid();
        r.classUuid = m.getClassUuid();
        r.dexterity = m.getDexterity();
        r.intelligence = m.getIntelligence();
        r.constitution = m.getConstitution();
        r.energy = m.getEnergy();
        r.life = m.getLife();
        r.sad = m.getSad();
        r.idLocation = m.getIdLocation();
        r.locationUuid = m.getLocationUuid();
        r.locationName = m.getLocationName();
        r.isSleeping = m.getIsSleeping();
        r.isComa = m.getIsComa();
        r.traitUuids = m.getTraitUuids() != null ? new ArrayList<>(m.getTraitUuids()) : new ArrayList<>();
        r.food = m.getFood();
        r.magic = m.getMagic();
        r.coin = m.getCoin();
        return r;
    }

    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }
    public String getMatchUuid() { return matchUuid; }
    public void setMatchUuid(String matchUuid) { this.matchUuid = matchUuid; }
    public String getUserUuid() { return userUuid; }
    public void setUserUuid(String userUuid) { this.userUuid = userUuid; }
    public String getCharacterTemplateUuid() { return characterTemplateUuid; }
    public void setCharacterTemplateUuid(String characterTemplateUuid) { this.characterTemplateUuid = characterTemplateUuid; }
    public String getClassUuid() { return classUuid; }
    public void setClassUuid(String classUuid) { this.classUuid = classUuid; }
    public Integer getDexterity() { return dexterity; }
    public void setDexterity(Integer dexterity) { this.dexterity = dexterity; }
    public Integer getIntelligence() { return intelligence; }
    public void setIntelligence(Integer intelligence) { this.intelligence = intelligence; }
    public Integer getConstitution() { return constitution; }
    public void setConstitution(Integer constitution) { this.constitution = constitution; }
    public Integer getEnergy() { return energy; }
    public void setEnergy(Integer energy) { this.energy = energy; }
    public Integer getLife() { return life; }
    public void setLife(Integer life) { this.life = life; }
    public Integer getSad() { return sad; }
    public void setSad(Integer sad) { this.sad = sad; }
    public Long getIdLocation() { return idLocation; }
    public void setIdLocation(Long idLocation) { this.idLocation = idLocation; }
    public String getLocationUuid() { return locationUuid; }
    public void setLocationUuid(String locationUuid) { this.locationUuid = locationUuid; }
    public String getLocationName() { return locationName; }
    public void setLocationName(String locationName) { this.locationName = locationName; }
    public Boolean getIsSleeping() { return isSleeping; }
    public void setIsSleeping(Boolean isSleeping) { this.isSleeping = isSleeping; }
    public Boolean getIsComa() { return isComa; }
    public void setIsComa(Boolean isComa) { this.isComa = isComa; }
    public List<String> getTraitUuids() { return traitUuids; }
    public void setTraitUuids(List<String> traitUuids) { this.traitUuids = traitUuids; }
    public Integer getFood() { return food; }
    public void setFood(Integer food) { this.food = food; }
    public Integer getMagic() { return magic; }
    public void setMagic(Integer magic) { this.magic = magic; }
    public Integer getCoin() { return coin; }
    public void setCoin(Integer coin) { this.coin = coin; }
}
