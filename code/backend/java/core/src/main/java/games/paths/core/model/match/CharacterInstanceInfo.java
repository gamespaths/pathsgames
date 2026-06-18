package games.paths.core.model.match;

import java.util.ArrayList;
import java.util.List;

/**
 * CharacterInstanceInfo - Domain model describing a character materialised in a
 * match. Returned by {@code POST /api/matches/{uuid}/join},
 * {@code GET /api/match/{uuid}/players} and
 * {@code GET /api/match/{uuid}/characters/{uuidCharacter}}.
 *
 * <p>Step 21 — carries the final computed statistics, the current location, the
 * runtime state flags, the selected traits and the backpack resources.</p>
 */
public class CharacterInstanceInfo {

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

    private Integer lifeMax;
    private Integer energyMax;
    private Integer sadMax;
    private Integer weightMax;
    private Integer weight;

    private Long idLocation;
    private String locationUuid;
    private String locationName;

    private Boolean isSleeping;
    private Boolean isComa;

    private List<String> traitUuids = new ArrayList<>();

    private List<ItemInstanceInfo> items = new ArrayList<>();

    private Integer food;
    private Integer magic;
    private Integer coin;

    public CharacterInstanceInfo() {
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

    public Integer getLifeMax() { return lifeMax; }
    public void setLifeMax(Integer lifeMax) { this.lifeMax = lifeMax; }

    public Integer getEnergyMax() { return energyMax; }
    public void setEnergyMax(Integer energyMax) { this.energyMax = energyMax; }

    public Integer getSadMax() { return sadMax; }
    public void setSadMax(Integer sadMax) { this.sadMax = sadMax; }

    public Integer getWeightMax() { return weightMax; }
    public void setWeightMax(Integer weightMax) { this.weightMax = weightMax; }

    public Integer getWeight() { return weight; }
    public void setWeight(Integer weight) { this.weight = weight; }

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
    public void setTraitUuids(List<String> traitUuids) {
        this.traitUuids = traitUuids != null ? traitUuids : new ArrayList<>();
    }

    public List<ItemInstanceInfo> getItems() { return items; }
    public void setItems(List<ItemInstanceInfo> items) {
        this.items = items != null ? items : new ArrayList<>();
    }

    public Integer getFood() { return food; }
    public void setFood(Integer food) { this.food = food; }

    public Integer getMagic() { return magic; }
    public void setMagic(Integer magic) { this.magic = magic; }

    public Integer getCoin() { return coin; }
    public void setCoin(Integer coin) { this.coin = coin; }
}
