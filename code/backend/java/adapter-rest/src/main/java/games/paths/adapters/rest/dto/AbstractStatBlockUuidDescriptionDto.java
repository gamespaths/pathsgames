package games.paths.adapters.rest.dto;

/**
 * Shared base DTO for REST responses that expose the seven canonical stat
 * fields ({@code life}, {@code energy}, {@code sad}, {@code dexterity},
 * {@code intelligence}, {@code constitution}, {@code weight}) on top of a
 * {@code uuid} + {@code description} identifier pair.
 *
 * <p>Used by {@code DifficultyResponse} (v0.19.7) and {@code TraitInfoResponse}
 * (v0.19.6) to eliminate ~28 duplicated lines per class previously flagged by
 * SonarQube. {@code TraitInfoResponse} additionally exposes a {@code name}
 * field declared directly on the subclass.</p>
 */
public abstract class AbstractStatBlockUuidDescriptionDto extends AbstractUuidDescriptionDto {

    private int life;
    private int energy;
    private int sad;
    private int dexterity;
    private int intelligence;
    private int constitution;
    private int weight;

    protected AbstractStatBlockUuidDescriptionDto() {
    }

    protected AbstractStatBlockUuidDescriptionDto(String uuid, String description) {
        super(uuid, description);
    }

    public int getLife() { return life; }
    public void setLife(int life) { this.life = life; }

    public int getEnergy() { return energy; }
    public void setEnergy(int energy) { this.energy = energy; }

    public int getSad() { return sad; }
    public void setSad(int sad) { this.sad = sad; }

    public int getDexterity() { return dexterity; }
    public void setDexterity(int dexterity) { this.dexterity = dexterity; }

    public int getIntelligence() { return intelligence; }
    public void setIntelligence(int intelligence) { this.intelligence = intelligence; }

    public int getConstitution() { return constitution; }
    public void setConstitution(int constitution) { this.constitution = constitution; }

    public int getWeight() { return weight; }
    public void setWeight(int weight) { this.weight = weight; }
}
