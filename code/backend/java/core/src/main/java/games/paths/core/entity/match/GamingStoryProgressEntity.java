package games.paths.core.entity.match;

import jakarta.persistence.*;

/**
 * GamingStoryProgressEntity - JPA entity mapped to "gaming_story_progress".
 * Schema defined by Flyway migration V0.10.7; first written in Step 32.
 *
 * <p>The milestone tracker: a row lands here only when the resolved option carries
 * {@code is_progress = 1}, marking the narrative as having moved forward. Ordinary
 * choices — the ones that change a stat or open a door but tell no new chapter — resolve
 * without touching this table, which is what keeps it a story outline rather than a
 * second copy of {@code log_choices_executed}.</p>
 *
 * <p>The {@code id} is part of the composite primary key {@code (id, id_match)}; it is
 * assigned explicitly by the adapter (SQLite does not auto-increment it).</p>
 */
@Entity
@Table(name = "gaming_story_progress")
@IdClass(GamingStoryProgressEntityId.class)
public class GamingStoryProgressEntity {

    @Id
    @Column(name = "id")
    private Long id;

    @Id
    @Column(name = "id_match")
    private Long idMatch;

    @Column(nullable = false, unique = true)
    private String uuid;

    @Column(name = "clock")
    private Integer clock;

    /** The event that OWNED the resolved option, never the option itself. */
    @Column(name = "id_event")
    private Long idEvent;

    /** Spelled "choise" in the schema since V0.10.7 — kept as-is, it is the column name. */
    @Column(name = "id_choise")
    private Long idChoise;

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

    public Integer getClock() { return clock; }
    public void setClock(Integer clock) { this.clock = clock; }

    public Long getIdEvent() { return idEvent; }
    public void setIdEvent(Long idEvent) { this.idEvent = idEvent; }

    public Long getIdChoise() { return idChoise; }
    public void setIdChoise(Long idChoise) { this.idChoise = idChoise; }

    public String getTsInsert() { return tsInsert; }
    public void setTsInsert(String tsInsert) { this.tsInsert = tsInsert; }

    public String getTsUpdate() { return tsUpdate; }
    public void setTsUpdate(String tsUpdate) { this.tsUpdate = tsUpdate; }
}
