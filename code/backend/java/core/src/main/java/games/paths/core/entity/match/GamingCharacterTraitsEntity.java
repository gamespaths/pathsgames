package games.paths.core.entity.match;

import jakarta.persistence.*;

/**
 * GamingCharacterTraitsEntity - JPA entity mapped to "gaming_character_traits".
 * Schema defined by Flyway migration V0.10.6.
 *
 * <p>Step 21: one row per trait selected for a character instance when it
 * joins the match.</p>
 */
@Entity
@Table(name = "gaming_character_traits")
@IdClass(GamingCharacterTraitsEntityId.class)
public class GamingCharacterTraitsEntity {

    @Id
    @Column(name = "id")
    private Long id;

    @Id
    @Column(name = "id_match")
    private Long idMatch;

    @Column(nullable = false, unique = true)
    private String uuid;

    @Column(name = "id_character_match", nullable = false)
    private Long idCharacterMatch;

    @Column(name = "id_traits", nullable = false)
    private Long idTraits;

    @Column(name = "id_event")
    private Long idEvent;

    @Column(name = "ts_insert", nullable = false, updatable = false)
    private String tsInsert;

    @Column(name = "ts_update", nullable = false)
    private String tsUpdate;

    @PrePersist
    protected void onCreate() {
        String now = java.time.Instant.now().toString();
        if (uuid == null) uuid = java.util.UUID.randomUUID().toString();
        if (tsInsert == null) tsInsert = now;
        if (tsUpdate == null) tsUpdate = now;
    }

    @PreUpdate
    protected void onUpdate() {
        tsUpdate = java.time.Instant.now().toString();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getIdMatch() { return idMatch; }
    public void setIdMatch(Long idMatch) { this.idMatch = idMatch; }

    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }

    public Long getIdCharacterMatch() { return idCharacterMatch; }
    public void setIdCharacterMatch(Long idCharacterMatch) { this.idCharacterMatch = idCharacterMatch; }

    public Long getIdTraits() { return idTraits; }
    public void setIdTraits(Long idTraits) { this.idTraits = idTraits; }

    public Long getIdEvent() { return idEvent; }
    public void setIdEvent(Long idEvent) { this.idEvent = idEvent; }

    public String getTsInsert() { return tsInsert; }
    public void setTsInsert(String tsInsert) { this.tsInsert = tsInsert; }

    public String getTsUpdate() { return tsUpdate; }
    public void setTsUpdate(String tsUpdate) { this.tsUpdate = tsUpdate; }
}
