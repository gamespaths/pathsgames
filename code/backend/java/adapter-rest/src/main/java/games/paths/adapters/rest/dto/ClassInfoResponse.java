package games.paths.adapters.rest.dto;

/**
 * ClassInfoResponse - REST response DTO for a character class.
 */
public class ClassInfoResponse extends AbstractUuidNameDescriptionDto {
    private int weightMax;
    private int dexterityBase;
    private int intelligenceBase;
    private int constitutionBase;

    public ClassInfoResponse() {}

    public ClassInfoResponse(String uuid, String name, String description,
                             int weightMax, int dexterityBase, int intelligenceBase, int constitutionBase) {
        super(uuid, name, description);
        this.weightMax = weightMax;
        this.dexterityBase = dexterityBase;
        this.intelligenceBase = intelligenceBase;
        this.constitutionBase = constitutionBase;
    }

    public int getWeightMax() { return weightMax; }
    public void setWeightMax(int weightMax) { this.weightMax = weightMax; }

    public int getDexterityBase() { return dexterityBase; }
    public void setDexterityBase(int dexterityBase) { this.dexterityBase = dexterityBase; }

    public int getIntelligenceBase() { return intelligenceBase; }
    public void setIntelligenceBase(int intelligenceBase) { this.intelligenceBase = intelligenceBase; }

    public int getConstitutionBase() { return constitutionBase; }
    public void setConstitutionBase(int constitutionBase) { this.constitutionBase = constitutionBase; }
}
