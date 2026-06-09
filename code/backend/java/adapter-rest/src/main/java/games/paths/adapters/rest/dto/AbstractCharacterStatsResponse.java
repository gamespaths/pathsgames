package games.paths.adapters.rest.dto;

import games.paths.core.model.match.CharacterInstanceInfo;

import java.util.ArrayList;
import java.util.List;

/**
 * Shared base for the JSON projections of {@link CharacterInstanceInfo}: the
 * character identity, the computed stat block, the current location, the
 * runtime state flags and the selected traits.
 *
 * <p>v0.20.9 — extracted from {@code CharacterInstanceResponse} and
 * {@code CharacterSummaryResponse} to remove the duplicated stat-projection
 * lines flagged by SonarQube (duplicated lines on new code). Subclasses add
 * only the fields they expose and call {@link #copyStatsFrom} from their
 * {@code fromModel} factory.</p>
 */
public abstract class AbstractCharacterStatsResponse {

    private String uuid;
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
    private String locationName;
    private Boolean isSleeping;
    private Boolean isComa;
    private List<String> traitUuids = new ArrayList<>();

    protected AbstractCharacterStatsResponse() {
    }

    /** Copies the shared stat fields from the domain model into this projection. */
    protected void copyStatsFrom(CharacterInstanceInfo m) {
        this.uuid = m.getUuid();
        this.userUuid = m.getUserUuid();
        this.characterTemplateUuid = m.getCharacterTemplateUuid();
        this.classUuid = m.getClassUuid();
        this.dexterity = m.getDexterity();
        this.intelligence = m.getIntelligence();
        this.constitution = m.getConstitution();
        this.energy = m.getEnergy();
        this.life = m.getLife();
        this.sad = m.getSad();
        this.idLocation = m.getIdLocation();
        this.locationName = m.getLocationName();
        this.isSleeping = m.getIsSleeping();
        this.isComa = m.getIsComa();
        this.traitUuids = m.getTraitUuids() != null ? new ArrayList<>(m.getTraitUuids()) : new ArrayList<>();
    }

    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }
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
    public String getLocationName() { return locationName; }
    public void setLocationName(String locationName) { this.locationName = locationName; }
    public Boolean getIsSleeping() { return isSleeping; }
    public void setIsSleeping(Boolean isSleeping) { this.isSleeping = isSleeping; }
    public Boolean getIsComa() { return isComa; }
    public void setIsComa(Boolean isComa) { this.isComa = isComa; }
    public List<String> getTraitUuids() { return traitUuids; }
    public void setTraitUuids(List<String> traitUuids) { this.traitUuids = traitUuids != null ? traitUuids : new ArrayList<>(); }
}
