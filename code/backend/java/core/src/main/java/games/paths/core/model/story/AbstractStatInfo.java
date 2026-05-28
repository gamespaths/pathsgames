package games.paths.core.model.story;

/**
 * Shared base for immutable domain POJOs that carry the seven canonical stat
 * values ({@code life}, {@code energy}, {@code sad}, {@code dexterity},
 * {@code intelligence}, {@code constitution}, {@code weight}).
 *
 * <p>Extended by {@code DifficultyInfo} (v0.19.7) and {@code TraitInfo}
 * (v0.19.6). Builders extend {@link AbstractStatInfoBuilder} to inherit the
 * seven fluent setters, eliminating ~30 duplicated lines per pair previously
 * flagged by SonarQube.</p>
 */
public abstract class AbstractStatInfo {

    private final int life;
    private final int energy;
    private final int sad;
    private final int dexterity;
    private final int intelligence;
    private final int constitution;
    private final int weight;

    protected AbstractStatInfo(AbstractStatInfoBuilder<?> builder) {
        this.life = builder.life;
        this.energy = builder.energy;
        this.sad = builder.sad;
        this.dexterity = builder.dexterity;
        this.intelligence = builder.intelligence;
        this.constitution = builder.constitution;
        this.weight = builder.weight;
    }

    public int getLife() { return life; }
    public int getEnergy() { return energy; }
    public int getSad() { return sad; }
    public int getDexterity() { return dexterity; }
    public int getIntelligence() { return intelligence; }
    public int getConstitution() { return constitution; }
    public int getWeight() { return weight; }
}
