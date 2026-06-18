package games.paths.core.entity.match;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.IdClass;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

/**
 * GamingBackpackResourcesEntity - JPA entity mapped to "gaming_backpack_resources".
 * Schema defined by Flyway migration V0.10.6.
 *
 * <p>Step 21: one backpack row per character instance, seeded with default
 * resource values when the character joins the match. The {@code (id, id_match)}
 * key, {@code uuid} and audit timestamps come from
 * {@link AbstractMatchScopedEntity}.</p>
 */
@Entity
@Table(name = "gaming_backpack_resources")
@IdClass(GamingBackpackResourcesEntityId.class)
public class GamingBackpackResourcesEntity extends AbstractMatchScopedEntity {

    @Column(name = "id_character_match", nullable = false)
    private Long idCharacterMatch;

    @Column(nullable = false)
    private Integer food;

    @Column(nullable = false)
    private Integer magic;

    @Column(nullable = false)
    private Integer coin;

    @PrePersist
    protected void onCreate() {
        applyUuidAndTimestamps();
        if (food == null) food = 0;
        if (magic == null) magic = 0;
        if (coin == null) coin = 0;
    }

    @PreUpdate
    protected void onUpdate() {
        applyUpdateTimestamp();
    }

    public Long getIdCharacterMatch() { return idCharacterMatch; }
    public void setIdCharacterMatch(Long idCharacterMatch) { this.idCharacterMatch = idCharacterMatch; }

    public Integer getFood() { return food; }
    public void setFood(Integer food) { this.food = food; }

    public Integer getMagic() { return magic; }
    public void setMagic(Integer magic) { this.magic = magic; }

    public Integer getCoin() { return coin; }
    public void setCoin(Integer coin) { this.coin = coin; }
}
