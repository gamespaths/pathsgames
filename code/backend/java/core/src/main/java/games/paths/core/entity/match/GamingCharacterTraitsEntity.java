package games.paths.core.entity.match;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.IdClass;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

/**
 * GamingCharacterTraitsEntity - JPA entity mapped to "gaming_character_traits".
 * Schema defined by Flyway migration V0.10.6.
 *
 * <p>Step 21: one row per trait selected for a character instance when it
 * joins the match. The {@code (id, id_match)} key, {@code uuid} and audit
 * timestamps come from {@link AbstractMatchScopedEntity}.</p>
 */
@Entity
@Table(name = "gaming_character_traits")
@IdClass(GamingCharacterTraitsEntityId.class)
public class GamingCharacterTraitsEntity extends AbstractMatchScopedEntity {

    @Column(name = "id_character_match", nullable = false)
    private Long idCharacterMatch;

    @Column(name = "id_traits", nullable = false)
    private Long idTraits;

    @Column(name = "id_event")
    private Long idEvent;

    @PrePersist
    protected void onCreate() {
        applyUuidAndTimestamps();
    }

    @PreUpdate
    protected void onUpdate() {
        applyUpdateTimestamp();
    }

    public Long getIdCharacterMatch() { return idCharacterMatch; }
    public void setIdCharacterMatch(Long idCharacterMatch) { this.idCharacterMatch = idCharacterMatch; }

    public Long getIdTraits() { return idTraits; }
    public void setIdTraits(Long idTraits) { this.idTraits = idTraits; }

    public Long getIdEvent() { return idEvent; }
    public void setIdEvent(Long idEvent) { this.idEvent = idEvent; }
}
