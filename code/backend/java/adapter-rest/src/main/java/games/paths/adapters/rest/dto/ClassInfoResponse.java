package games.paths.adapters.rest.dto;

/**
 * ClassInfoResponse - REST response DTO for a character class.
 */
public class ClassInfoResponse {

    private String uuid;
    private String name;
    private String description;
    private int weightMax;
    private int dexterityBase;
    private int intelligenceBase;
    private int constitutionBase;

    public ClassInfoResponse() {}

    public ClassInfoResponse(String uuid, String name, String description,
                             int weightMax, int dexterityBase, int intelligenceBase, int constitutionBase) {
        this.uuid = uuid;
        this.name = name;
        this.description = description;
        this.weightMax = weightMax;
        this.dexterityBase = dexterityBase;
        this.intelligenceBase = intelligenceBase;
        this.constitutionBase = constitutionBase;
    }

    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public int getWeightMax() { return weightMax; }
    public void setWeightMax(int weightMax) { this.weightMax = weightMax; }

    public int getDexterityBase() { return dexterityBase; }
    public void setDexterityBase(int dexterityBase) { this.dexterityBase = dexterityBase; }

    public int getIntelligenceBase() { return intelligenceBase; }
    public void setIntelligenceBase(int intelligenceBase) { this.intelligenceBase = intelligenceBase; }

    public int getConstitutionBase() { return constitutionBase; }
    public void setConstitutionBase(int constitutionBase) { this.constitutionBase = constitutionBase; }
}
