package games.paths.adapters.rest.dto;

import java.util.ArrayList;
import java.util.List;

/**
 * ClassInfoResponse - REST response DTO for a character class.
 */
public class ClassInfoResponse extends AbstractUuidNameDescriptionDto {
    private Long id;
    private int weightMax;
    private int dexterityBase;
    private int intelligenceBase;
    private int constitutionBase;
    private Integer idCard;
    private CardInfoResponse card;
    private List<ClassBonusInfoResponse> bonuses = new ArrayList<>();

    public ClassInfoResponse() {}

    public ClassInfoResponse(String uuid, String name, String description,
                             int weightMax, int dexterityBase, int intelligenceBase, int constitutionBase) {
        super(uuid, name, description);
        this.weightMax = weightMax;
        this.dexterityBase = dexterityBase;
        this.intelligenceBase = intelligenceBase;
        this.constitutionBase = constitutionBase;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public int getWeightMax() { return weightMax; }
    public void setWeightMax(int weightMax) { this.weightMax = weightMax; }

    public int getDexterityBase() { return dexterityBase; }
    public void setDexterityBase(int dexterityBase) { this.dexterityBase = dexterityBase; }

    public int getIntelligenceBase() { return intelligenceBase; }
    public void setIntelligenceBase(int intelligenceBase) { this.intelligenceBase = intelligenceBase; }

    public int getConstitutionBase() { return constitutionBase; }
    public void setConstitutionBase(int constitutionBase) { this.constitutionBase = constitutionBase; }

    public Integer getIdCard() { return idCard; }
    public void setIdCard(Integer idCard) { this.idCard = idCard; }

    public CardInfoResponse getCard() { return card; }
    public void setCard(CardInfoResponse card) { this.card = card; }

    public List<ClassBonusInfoResponse> getBonuses() { return bonuses; }
    public void setBonuses(List<ClassBonusInfoResponse> bonuses) {
        this.bonuses = bonuses != null ? bonuses : new ArrayList<>();
    }
}
