package games.paths.adapters.rest.dto;

/**
 * CharacterTemplateResponse - REST response DTO for a character template.
 */
public class CharacterTemplateResponse extends AbstractUuidNameDescriptionDto {

    private int lifeMax;
    private int energyMax;
    private int sadMax;
    private int dexterityStart;
    private int intelligenceStart;
    private int constitutionStart;
    private Integer idCard;
    private CardInfoResponse card;

    public CharacterTemplateResponse() {}

    public CharacterTemplateResponse(String uuid, String name, String description,
                                     int lifeMax, int energyMax, int sadMax,
                                     int dexterityStart, int intelligenceStart, int constitutionStart) {
        super(uuid, name, description);
        this.lifeMax = lifeMax;
        this.energyMax = energyMax;
        this.sadMax = sadMax;
        this.dexterityStart = dexterityStart;
        this.intelligenceStart = intelligenceStart;
        this.constitutionStart = constitutionStart;
    }

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

    public Integer getIdCard() { return idCard; }
    public void setIdCard(Integer idCard) { this.idCard = idCard; }

    public CardInfoResponse getCard() { return card; }
    public void setCard(CardInfoResponse card) { this.card = card; }
}
