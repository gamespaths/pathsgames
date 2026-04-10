package games.paths.core.entity.story;

import jakarta.persistence.Column;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;

/**
 * BaseStoryEntity - Base class for all story-related JPA entities.
 *
 * <p>Centralises the fields shared by every story entity and the
 * two JPA lifecycle callbacks that manage them:</p>
 * <ul>
 *   <li>{@code uuid}             — opaque public identifier, auto-generated on first persist</li>
 *   <li>{@code tsInsert}         — ISO-8601 creation timestamp, set once on first persist</li>
 *   <li>{@code tsUpdate}         — ISO-8601 last-update timestamp, refreshed on every update</li>
 *   <li>{@code idCard}           — optional reference to the visual card</li>
 *   <li>{@code idStory}          — optional reference to the parent story</li>
 *   <li>{@code idTextName}       — optional reference to the localised name text</li>
 *   <li>{@code idTextDescription}— optional reference to the localised description text</li>
 * </ul>
 *
 * <p>Concrete entity classes extend this class and may declare their own
 * {@code @PrePersist} method for entity-specific default initialisation.
 * JPA will call <em>both</em> the superclass {@link #baseOnCreate()} and the
 * subclass hook, with the superclass running first, so the uuid/timestamp
 * fields are already populated when the subclass hook executes.</p>
 */
@MappedSuperclass
public abstract class BaseStoryEntity {

    @Column(nullable = false, unique = true)
    private String uuid;

    @Column(name = "ts_insert", nullable = false, updatable = false)
    private String tsInsert;

    @Column(name = "ts_update", nullable = false)
    private String tsUpdate;

    @Column(name = "id_card")
    private Integer idCard;

    @Column(name = "id_story")
    private Long idStory;

    @Column(name = "id_text_name")
    private Integer idTextName;

    @Column(name = "id_text_description")
    private Integer idTextDescription;

    // ─── JPA lifecycle ──────────────────────────────────────────────────────────

    /**
     * Called by JPA before the entity is first persisted.
     * Sets {@code uuid}, {@code tsInsert} and {@code tsUpdate} if still {@code null}.
     * Subclasses may define their own {@code @PrePersist} method for additional defaults.
     */
    @PrePersist
    protected void baseOnCreate() {
        String now = java.time.Instant.now().toString();
        if (uuid == null) uuid = java.util.UUID.randomUUID().toString();
        if (tsInsert == null) tsInsert = now;
        if (tsUpdate == null) tsUpdate = now;
    }

    /**
     * Called by JPA before every update.
     * Refreshes {@code tsUpdate} to the current instant.
     */
    @PreUpdate
    protected void onUpdate() {
        tsUpdate = java.time.Instant.now().toString();
    }

    // ─── Getters / Setters ──────────────────────────────────────────────────────

    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }

    /** Read-only: set automatically by {@link #baseOnCreate()}. */
    public String getTsInsert() { return tsInsert; }

    /** Read-only: set automatically by {@link #baseOnCreate()} and {@link #onUpdate()}. */
    public String getTsUpdate() { return tsUpdate; }

    public Integer getIdCard() { return idCard; }
    public void setIdCard(Integer idCard) { this.idCard = idCard; }

    public Long getIdStory() { return idStory; }
    public void setIdStory(Long idStory) { this.idStory = idStory; }

    public Integer getIdTextName() { return idTextName; }
    public void setIdTextName(Integer idTextName) { this.idTextName = idTextName; }

    public Integer getIdTextDescription() { return idTextDescription; }
    public void setIdTextDescription(Integer idTextDescription) { this.idTextDescription = idTextDescription; }
}
