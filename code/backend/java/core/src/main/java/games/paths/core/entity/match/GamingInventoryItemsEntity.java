package games.paths.core.entity.match;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.IdClass;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

/**
 * GamingInventoryItemsEntity - JPA entity mapped to "gaming_inventory_items".
 * Schema defined by Flyway migration V0.10.6.
 *
 * <p>Step 27: the items a character carries inside a match. Read by the match
 * {@code /info} endpoint to compute the current carried weight and expose the
 * items list. The {@code (id, id_match)} key, {@code uuid} and audit timestamps
 * come from {@link AbstractMatchScopedEntity}.</p>
 */
@Entity
@Table(name = "gaming_inventory_items")
@IdClass(GamingInventoryItemsEntityId.class)
public class GamingInventoryItemsEntity extends AbstractMatchScopedEntity {

    @Column(name = "id_character_match", nullable = false)
    private Long idCharacterMatch;

    @Column(name = "id_item", nullable = false)
    private Long idItem;

    @Column(nullable = false)
    private Integer amount;

    @Column
    private String state;

    @PrePersist
    protected void onCreate() {
        applyUuidAndTimestamps();
        if (amount == null) amount = 1;
        if (state == null) state = "ACTIVE";
    }

    @PreUpdate
    protected void onUpdate() {
        applyUpdateTimestamp();
    }

    public Long getIdCharacterMatch() { return idCharacterMatch; }
    public void setIdCharacterMatch(Long idCharacterMatch) { this.idCharacterMatch = idCharacterMatch; }

    public Long getIdItem() { return idItem; }
    public void setIdItem(Long idItem) { this.idItem = idItem; }

    public Integer getAmount() { return amount; }
    public void setAmount(Integer amount) { this.amount = amount; }

    public String getState() { return state; }
    public void setState(String state) { this.state = state; }
}
