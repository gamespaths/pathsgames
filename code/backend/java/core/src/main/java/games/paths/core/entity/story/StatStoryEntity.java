package games.paths.core.entity.story;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;

/**
 * StatStoryEntity - mapped superclass for story entities that expose the seven
 * canonical stat columns ({@code life}, {@code energy}, {@code sad},
 * {@code dexterity}, {@code intelligence}, {@code constitution}, {@code weight}).
 *
 * <p>Shared by {@code TraitEntity} (v0.19.6) and {@code StoryDifficultyEntity}
 * (v0.19.7) — both tables carry the same seven {@code NOT NULL DEFAULT 0}
 * columns. Concrete subclasses keep their own {@code @PrePersist} hook and
 * delegate to {@link #initStatDefaults()} to fill any null stat with {@code 0}.</p>
 *
 * <p>This class extracts the shared schema mapping from the two concrete
 * entities, eliminating ~55 duplicated lines per entity reported by SonarQube.</p>
 */
@MappedSuperclass
public abstract class StatStoryEntity extends BaseStoryScopedEntity {

    @Column(name = "life", nullable = false)
    private Integer life;

    @Column(name = "energy", nullable = false)
    private Integer energy;

    @Column(name = "sad", nullable = false)
    private Integer sad;

    @Column(name = "dexterity", nullable = false)
    private Integer dexterity;

    @Column(name = "intelligence", nullable = false)
    private Integer intelligence;

    @Column(name = "constitution", nullable = false)
    private Integer constitution;

    @Column(name = "weight", nullable = false)
    private Integer weight;

    /**
     * Initialises any null stat field to {@code 0}. Intended to be called from
     * the concrete entity's {@code @PrePersist} hook so the seven NOT NULL
     * columns are populated when no explicit value was provided.
     */
    protected void initStatDefaults() {
        if (life == null) life = 0;
        if (energy == null) energy = 0;
        if (sad == null) sad = 0;
        if (dexterity == null) dexterity = 0;
        if (intelligence == null) intelligence = 0;
        if (constitution == null) constitution = 0;
        if (weight == null) weight = 0;
    }

    // ─── Getters / Setters ──────────────────────────────────────────────────────

    public Integer getLife() { return life; }
    public void setLife(Integer life) { this.life = life; }

    public Integer getEnergy() { return energy; }
    public void setEnergy(Integer energy) { this.energy = energy; }

    public Integer getSad() { return sad; }
    public void setSad(Integer sad) { this.sad = sad; }

    public Integer getDexterity() { return dexterity; }
    public void setDexterity(Integer dexterity) { this.dexterity = dexterity; }

    public Integer getIntelligence() { return intelligence; }
    public void setIntelligence(Integer intelligence) { this.intelligence = intelligence; }

    public Integer getConstitution() { return constitution; }
    public void setConstitution(Integer constitution) { this.constitution = constitution; }

    public Integer getWeight() { return weight; }
    public void setWeight(Integer weight) { this.weight = weight; }
}
