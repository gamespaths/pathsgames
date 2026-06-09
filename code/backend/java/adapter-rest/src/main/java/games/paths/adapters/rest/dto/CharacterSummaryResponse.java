package games.paths.adapters.rest.dto;

import games.paths.core.model.match.CharacterInstanceInfo;

import java.util.ArrayList;
import java.util.List;

/**
 * CharacterSummaryResponse - lightweight JSON projection of
 * {@link CharacterInstanceInfo} used by {@code GET /api/match/{uuid}/players}
 * and embedded as the {@code players} array of {@link MatchInfoResponse}.
 * Step 21.
 */
public class CharacterSummaryResponse {

    private String uuid;
    private String userUuid;
    private String characterTemplateUuid;
    private Integer dexterity;
    private Integer intelligence;
    private Integer constitution;
    private Integer energy;
    private Integer life;
    private Integer sad;
    private Long idLocation;
    private String locationName;
    private Boolean isSleeping;
    private Boolean isComa;
    private String classUuid;
    private List<String> traitUuids = new ArrayList<>();

    public CharacterSummaryResponse() {
    }

    public static CharacterSummaryResponse fromModel(CharacterInstanceInfo m) {
        if (m == null) return null;
        CharacterSummaryResponse r = new CharacterSummaryResponse();
        r.uuid = m.getUuid();
        r.userUuid = m.getUserUuid();
        r.characterTemplateUuid = m.getCharacterTemplateUuid();
        r.dexterity = m.getDexterity();
        r.intelligence = m.getIntelligence();
        r.constitution = m.getConstitution();
        r.energy = m.getEnergy();
        r.life = m.getLife();
        r.sad = m.getSad();
        r.idLocation = m.getIdLocation();
        r.locationName = m.getLocationName();
        r.isSleeping = m.getIsSleeping();
        r.isComa = m.getIsComa();
        r.classUuid = m.getClassUuid();
        r.traitUuids = m.getTraitUuids() != null ? new ArrayList<>(m.getTraitUuids()) : new ArrayList<>();
        return r;
    }

    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }
    public String getUserUuid() { return userUuid; }
    public void setUserUuid(String userUuid) { this.userUuid = userUuid; }
    public String getCharacterTemplateUuid() { return characterTemplateUuid; }
    public void setCharacterTemplateUuid(String characterTemplateUuid) { this.characterTemplateUuid = characterTemplateUuid; }
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
    public String getLocationName() { return locationName; }
    public void setLocationName(String locationName) { this.locationName = locationName; }
    public Boolean getIsSleeping() { return isSleeping; }
    public void setIsSleeping(Boolean isSleeping) { this.isSleeping = isSleeping; }
    public Boolean getIsComa() { return isComa; }
    public void setIsComa(Boolean isComa) { this.isComa = isComa; }
    public String getClassUuid() { return classUuid; }
    public void setClassUuid(String classUuid) { this.classUuid = classUuid; }
    public List<String> getTraitUuids() { return traitUuids; }
    public void setTraitUuids(List<String> traitUuids) { this.traitUuids = traitUuids != null ? traitUuids : new ArrayList<>(); }
}
