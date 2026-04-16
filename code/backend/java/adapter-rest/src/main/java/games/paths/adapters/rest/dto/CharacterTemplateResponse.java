package games.paths.adapters.rest.dto;

/**
 * CharacterTemplateResponse - REST response DTO for a character template.
 */
public class CharacterTemplateResponse {

    private String uuid;
    private String name;
    private String description;
    private int lifeMax;
    private int energyMax;
    private int sadMax;
    private int dexterityStart;
    private int intelligenceStart;
    private int constitutionStart;

    public CharacterTemplateResponse() {}

    public CharacterTemplateResponse(String uuid, String name, String description,
                                     int lifeMax, int energyMax, int sadMax,
                                     int dexterityStart, int intelligenceStart, int constitutionStart) {
        this.uuid = uuid;
        this.name = name;
        this.description = description;
        this.lifeMax = lifeMax;
        this.energyMax = energyMax;
        this.sadMax = sadMax;
        this.dexterityStart = dexterityStart;
        this.intelligenceStart = intelligenceStart;
        this.constitutionStart = constitutionStart;
    }

    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public int getLifeMax() { return lifeMax; }
    public void setLifeMax(int lifeMax) { this.lifeMax = lifeMax; }

    public int getEnergyMax() { return energyMax; }
    public void setEnergyMax(int energyMax) { this.energyMax = energyMax; }

    public int getSadMax() { return sadMax; }
    public void setSadMax(int sadMax) { this.sadMax = sadMax; }

    public int getDexterityStart() { return dexterityStart; }
    public void setDexterityStart(int dexterityStart) { this.dexterityStart = dexterityStart; }

    public int getIntelligenceStart() { return intelligenceStart; }
    public void setIntelligenceStart(int intelligenceStart) { this.intelligenceStart = intelligenceStart; }

    public int getConstitutionStart() { return constitutionStart; }
    public void setConstitutionStart(int constitutionStart) { this.constitutionStart = constitutionStart; }
}
