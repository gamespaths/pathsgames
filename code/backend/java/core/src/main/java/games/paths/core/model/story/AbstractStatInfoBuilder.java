package games.paths.core.model.story;

/**
 * Shared base for the {@link AbstractStatInfo} subclass builders.
 *
 * <p>Holds the seven mutable stat fields and exposes a fluent setter per
 * field, returning the concrete builder type via {@link #self()} so callers
 * keep a typed chain (e.g. {@code TraitInfo.builder().life(1).build()}).</p>
 *
 * @param <B> the concrete builder type
 */
public abstract class AbstractStatInfoBuilder<B extends AbstractStatInfoBuilder<B>> {

    int life;
    int energy;
    int sad;
    int dexterity;
    int intelligence;
    int constitution;
    int weight;

    protected abstract B self();

    public B life(int life) { this.life = life; return self(); }
    public B energy(int energy) { this.energy = energy; return self(); }
    public B sad(int sad) { this.sad = sad; return self(); }
    public B dexterity(int dexterity) { this.dexterity = dexterity; return self(); }
    public B intelligence(int intelligence) { this.intelligence = intelligence; return self(); }
    public B constitution(int constitution) { this.constitution = constitution; return self(); }
    public B weight(int weight) { this.weight = weight; return self(); }
}
